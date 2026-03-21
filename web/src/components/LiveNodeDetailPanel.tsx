// LiveNodeDetailPanel.tsx — Live-mode variant of NodeDetailPanel.
//
// Extends the base NodeDetailPanel with:
//   - Live state badge (alive / reconciling / error / not-found)
//   - YAML fetch from the cluster for resource nodes (FR-006)
//   - forEach node guidance note (FR-010)
//   - Survives poll refreshes — the panel is NOT re-mounted on state update (FR-008)
//
// Spec: .specify/specs/005-instance-detail-live/

import { useState, useEffect, useRef } from 'react'
import type { DAGNode } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import { getResource } from '@/lib/api'
import KroCodeBlock from './KroCodeBlock'
import './LiveNodeDetailPanel.css'

// ── Props ──────────────────────────────────────────────────────────────────

export interface LiveNodeDetailPanelProps {
  node: DAGNode
  /** Live state of this node — may change each poll cycle. */
  liveState: NodeLiveState | undefined
  /** Resolved resource info for YAML fetch. */
  resourceInfo: {
    kind: string
    name: string
    namespace: string
    group: string
    version: string
  } | null
  onClose: () => void
}

// ── State badge ────────────────────────────────────────────────────────────

interface StateBadgeProps {
  state: NodeLiveState | undefined
}

const STATE_LABEL: Record<NodeLiveState, string> = {
  alive: 'Ready',
  reconciling: 'Reconciling',
  error: 'Error',
  'not-found': 'Not Found',
}

function StateBadge({ state }: StateBadgeProps) {
  if (!state) return null
  const label = STATE_LABEL[state]
  return (
    <span
      data-testid="node-detail-state-badge"
      className={`live-state-badge live-state-badge--${state}`}
      aria-label={`Node state: ${label}`}
    >
      {label}
    </span>
  )
}

// ── Section helper ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="node-detail-section">
      <div className="node-detail-section-label">{label}</div>
      {children}
    </div>
  )
}

// ── YAML section ───────────────────────────────────────────────────────────

type YamlState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; yaml: string; kubectl: string }
  | { status: 'not-found'; kubectl: string }
  | { status: 'timeout'; kubectl: string }
  | { status: 'error'; message: string }

interface YamlSectionProps {
  nodeId: string
  resourceInfo: LiveNodeDetailPanelProps['resourceInfo']
}

function buildKubectlCmd(
  kind: string,
  name: string,
  namespace: string,
): string {
  if (namespace) {
    return `kubectl get ${kind} ${name} -n ${namespace} -o yaml`
  }
  return `kubectl get ${kind} ${name} -o yaml`
}

function toYamlString(obj: K8sObject): string {
  // Use our minimal YAML serializer
  // Dynamic import would create circular dep; inline a minimal approach
  const lines: string[] = []
  function walk(v: unknown, indent: number): void {
    const pad = '  '.repeat(indent)
    if (v === null || v === undefined) { lines.push('null'); return }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      lines.push(String(v))
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>)
          if (entries.length > 0) {
            const [fk, fv] = entries[0]
            lines.push(`${pad}- ${fk}: `)
            walk(fv, indent + 1)
            for (const [k, val] of entries.slice(1)) {
              lines.push(`${pad}  ${k}: `)
              walk(val, indent + 2)
            }
          } else {
            lines.push(`${pad}- {}`)
          }
        } else {
          lines.push(`${pad}- ${String(item)}`)
        }
      }
      return
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val === null || val === undefined) {
          lines.push(`${pad}${k}: null`)
        } else if (typeof val === 'object' && !Array.isArray(val)) {
          const nested = val as Record<string, unknown>
          if (Object.keys(nested).length === 0) {
            lines.push(`${pad}${k}: {}`)
          } else {
            lines.push(`${pad}${k}:`)
            walk(val, indent + 1)
          }
        } else if (Array.isArray(val)) {
          if ((val as unknown[]).length === 0) {
            lines.push(`${pad}${k}: []`)
          } else {
            lines.push(`${pad}${k}:`)
            walk(val, indent + 1)
          }
        } else {
          lines.push(`${pad}${k}: ${String(val)}`)
        }
      }
    }
  }
  walk(obj, 0)
  return lines.join('\n')
}

function YamlSection({ nodeId, resourceInfo }: YamlSectionProps) {
  const [yamlState, setYamlState] = useState<YamlState>({ status: 'idle' })
  // Track the nodeId for which we have fetched — don't re-fetch on re-render
  const fetchedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!resourceInfo || fetchedForRef.current === nodeId) return

    const { kind, name, namespace, group, version } = resourceInfo
    const kubectl = buildKubectlCmd(kind, name, namespace)

    fetchedForRef.current = nodeId
    setYamlState({ status: 'loading' })

    const timeoutId = setTimeout(() => {
      setYamlState({ status: 'timeout', kubectl })
    }, 15000)

    getResource(namespace, group, version, kind, name)
      .then((obj) => {
        clearTimeout(timeoutId)
        const yamlText = toYamlString(obj)
        setYamlState({ status: 'loaded', yaml: yamlText, kubectl })
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId)
        const msg = err.message ?? ''
        if (msg.includes('404') || msg.includes('not found') || msg.includes('HTTP 404')) {
          setYamlState({ status: 'not-found', kubectl })
        } else {
          setYamlState({ status: 'error', message: msg })
        }
      })

    return () => clearTimeout(timeoutId)
  }, [nodeId, resourceInfo])

  function handleRetry() {
    fetchedForRef.current = null
    setYamlState({ status: 'idle' })
  }

  return (
    <div data-testid="node-yaml-section" className="node-yaml-section">
      {yamlState.status === 'idle' || yamlState.status === 'loading' ? (
        <div className="node-yaml-loading" aria-live="polite">
          <span className="node-yaml-spinner">⟳</span> fetching from cluster…
        </div>
      ) : yamlState.status === 'loaded' ? (
        <>
          <div className="node-yaml-kubectl">
            <code>{yamlState.kubectl}</code>
          </div>
          <KroCodeBlock code={yamlState.yaml} />
        </>
      ) : yamlState.status === 'not-found' ? (
        <div className="node-yaml-not-found">
          <div className="node-yaml-not-found-msg">Resource not found in cluster.</div>
          <div className="node-yaml-kubectl">
            <code>{yamlState.kubectl}</code>
          </div>
        </div>
      ) : yamlState.status === 'timeout' ? (
        <div className="node-yaml-timeout">
          <div className="node-yaml-timeout-msg">Fetch timed out.</div>
          <div className="node-yaml-kubectl">
            <code>{yamlState.kubectl}</code>
          </div>
          <button
            type="button"
            className="node-yaml-retry-btn"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="node-yaml-error">Error: {yamlState.message}</div>
      )}
    </div>
  )
}

// ── Node type labels ────────────────────────────────────────────────────────

const CONCEPT_TEXT: Record<string, string> = {
  instance:
    'Root Custom Resource — The CR generated by this RGD. Its spec fields are ' +
    'defined by the schema, and its status is projected from child resource values.',
  resource:
    'Managed Resource — A Kubernetes resource created and owned by kro when an ' +
    'instance of this RGD exists.',
  collection:
    'forEach Collection — A set of Kubernetes resources created by iterating over ' +
    'a CEL expression. Each item produces one resource instance.',
  external:
    'External Reference — A reference to a pre-existing Kubernetes resource. ' +
    'kro reads it but does not create or own it.',
  externalCollection:
    'External Reference Collection — References to pre-existing Kubernetes resources ' +
    'matched by label selector. kro reads them but does not create or own them.',
}

const TYPE_LABEL: Record<string, string> = {
  instance: 'Root CR',
  resource: 'Managed Resource',
  collection: 'forEach Collection',
  external: 'External Ref',
  externalCollection: 'External Ref Collection',
}

const TYPE_ICON: Record<string, string> = {
  instance: '◉',
  resource: '⬜',
  collection: '∀',
  external: '⬡',
  externalCollection: '⬡',
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * LiveNodeDetailPanel — slide-in panel with live state, YAML, and node metadata.
 *
 * Key spec requirements implemented:
 * - FR-006: YAML fetch from GET /api/v1/resources/:ns/:group/:version/:kind/:name
 * - FR-007: Uses resolved resource info (from children list lookup)
 * - FR-008: survives poll refreshes (no re-mount; only liveState prop changes)
 * - FR-010: forEach nodes show guidance, no YAML fetch
 * - NFR-004: 15s YAML fetch timeout
 */
export default function LiveNodeDetailPanel({
  node,
  liveState,
  resourceInfo,
  onClose,
}: LiveNodeDetailPanelProps) {
  const conceptText = CONCEPT_TEXT[node.nodeType] ?? ''
  const typeLabel = TYPE_LABEL[node.nodeType] ?? node.nodeType
  const typeIcon = TYPE_ICON[node.nodeType] ?? '⬜'

  // Build CEL snippet
  const celLines: string[] = []
  if (node.readyWhen.length > 0) {
    celLines.push('readyWhen:')
    for (const expr of node.readyWhen) celLines.push(`  - ${expr}`)
  }
  if (node.includeWhen.length > 0) {
    celLines.push('includeWhen:')
    for (const expr of node.includeWhen) celLines.push(`  - ${expr}`)
  }
  if (node.forEach) celLines.push(`forEach: ${node.forEach}`)
  if (node.nodeType === 'instance' && node.schemaStatus) {
    const entries = Object.entries(node.schemaStatus)
    if (entries.length > 0) {
      celLines.push('status:')
      for (const [key, val] of entries) celLines.push(`  ${key}: ${String(val)}`)
    }
  }
  const celCode = celLines.join('\n')

  const extRef = node.externalRef as Record<string, unknown> | undefined
  const extMeta = extRef?.metadata as Record<string, unknown> | undefined

  const isForEach = node.nodeType === 'collection'

  return (
    <div data-testid="node-detail-panel" className="node-detail-panel live-node-detail-panel">
      {/* Header */}
      <div className="node-detail-header">
        <div className="node-detail-title">
          <div className="node-detail-kind-row">
            <span data-testid="node-detail-kind" className="node-detail-kind">
              {node.kind || node.label}
            </span>
            <StateBadge state={liveState} />
          </div>
          <span className="node-detail-id">{node.id}</span>
        </div>
        <button
          data-testid="node-detail-close"
          className="node-detail-close"
          onClick={onClose}
          aria-label="Close node detail panel"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="node-detail-body">
        {/* Node type badge */}
        <Section label="Type">
          <div className="node-type-badge-row">
            <span className={`node-type-badge node-type-badge--${node.nodeType}`}>
              <span>{typeIcon}</span>
              <span>{typeLabel}</span>
            </span>
            {node.isConditional && (
              <span className="node-conditional-badge">
                <span>?</span>
                <span>conditional</span>
              </span>
            )}
          </div>
        </Section>

        {/* Concept explanation */}
        <Section label="Concept">
          <p data-testid="node-detail-concept" className="node-detail-concept">
            {conceptText}
          </p>
        </Section>

        {/* forEach guidance — no YAML fetch */}
        {isForEach && (
          <Section label="Note">
            <p className="node-detail-concept node-detail-foreach-note">
              forEach node — multiple resources exist. Use Deep View to inspect each one.
            </p>
          </Section>
        )}

        {/* YAML section — resource and external nodes only */}
        {!isForEach && node.nodeType !== 'instance' && (
          <Section label="Live YAML">
            <YamlSection nodeId={node.id} resourceInfo={resourceInfo} />
          </Section>
        )}

        {/* CEL expressions */}
        {celCode && (
          <Section label="CEL Expressions">
            <KroCodeBlock code={celCode} />
          </Section>
        )}

        {/* External ref details */}
        {(node.nodeType === 'external' || node.nodeType === 'externalCollection') &&
          extRef && (
          <Section label="External Reference">
            <div className="node-detail-extref">
              {extRef.apiVersion != null && <div>apiVersion: {String(extRef.apiVersion)}</div>}
              {extRef.kind != null && <div>kind: {String(extRef.kind)}</div>}
              {extMeta?.name != null && <div>name: {String(extMeta.name)}</div>}
              {extMeta?.namespace != null && <div>namespace: {String(extMeta.namespace)}</div>}
              {extMeta?.selector != null && (
                <div>selector: {JSON.stringify(extMeta.selector)}</div>
              )}
            </div>
          </Section>
        )}

        {/* Schema spec for root node */}
        {node.nodeType === 'instance' && node.schemaSpec && (
          <Section label="Schema Fields">
            <KroCodeBlock
              code={Object.entries(node.schemaSpec)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join('\n')}
            />
          </Section>
        )}
      </div>
    </div>
  )
}
