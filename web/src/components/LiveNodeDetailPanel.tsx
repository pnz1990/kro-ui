// LiveNodeDetailPanel.tsx — Live-mode variant of NodeDetailPanel.
//
// Extends the base NodeDetailPanel with:
//   - Live state badge (alive / reconciling / error / not-found)
//   - YAML fetch from the cluster for resource nodes (FR-006)
//   - forEach node guidance note (FR-010)
//   - Survives poll refreshes — the panel is NOT re-mounted on state update (FR-008)
//   - Terminating row + Finalizers section (FR-006, spec 031-deletion-debugger)
//
// Spec: .specify/specs/005-instance-detail-live/
// Spec 021: readyWhen, includeWhen, forEach, status each in independent sections.

import { useState, useEffect, useRef } from 'react'
import type { DAGNode } from '@/lib/dag'
import { NODE_TYPE_LABEL, NODE_CONCEPT_TEXT } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import { getResource } from '@/lib/api'
import { toYaml, cleanK8sObject } from '@/lib/yaml'
import { isTerminating, getDeletionTimestamp, getFinalizers, formatRelativeTime } from '@/lib/k8s'
import { translateApiError } from '@/lib/errors'
import KroCodeBlock from './KroCodeBlock'
import FinalizersPanel from './FinalizersPanel'
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
  // 'pending' means includeWhen evaluated to false — kro never created the resource.
  // "Excluded" is more accurate than "Pending" (which implies "waiting to be created").
  pending: 'Excluded',
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
  /** Called with the raw K8sObject when fetch succeeds — used to extract deletion metadata. */
  onRawObj?: (obj: K8sObject) => void
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

function YamlSection({ nodeId, resourceInfo, onRawObj }: YamlSectionProps) {
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
        // Notify parent with the raw object for deletion metadata extraction
        onRawObj?.(obj)
        const yamlText = toYaml(cleanK8sObject(obj))
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
  }, [nodeId, resourceInfo, onRawObj])

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
        <div className="node-yaml-error" role="alert">
          <div className="node-yaml-error-msg">
            {translateApiError(yamlState.message ?? '')}
          </div>
          <button
            type="button"
            className="node-yaml-retry-btn"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ── Node type labels ────────────────────────────────────────────────────────

/** Human-readable concept explanation per upstream kro node type.
 * Single source of truth is NODE_CONCEPT_TEXT in @/lib/dag.ts (constitution §IX).
 */
const CONCEPT_TEXT = NODE_CONCEPT_TEXT

const TYPE_ICON: Record<string, string> = {
  instance: '◉',
  resource: '⬜',
  collection: '∀',
  external: '⬡',
  externalCollection: '⬡',
  state: '⊞',
}

/** Filter blank CEL expressions before rendering. */
function nonEmpty(exprs: string[]): string[] {
  return exprs.filter((s) => s.trim() !== '')
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
 * - spec 031-deletion-debugger FR-006: Terminating row + Finalizers panel for child nodes
 */
export default function LiveNodeDetailPanel({
  node,
  liveState,
  resourceInfo,
  onClose,
}: LiveNodeDetailPanelProps) {
  const conceptText = CONCEPT_TEXT[node.nodeType] ?? ''
  const typeLabel = NODE_TYPE_LABEL[node.nodeType] ?? node.nodeType
  const typeIcon = TYPE_ICON[node.nodeType] ?? '⬜'

  const readyWhenExprs = nonEmpty(node.readyWhen)
  const includeWhenExprs = nonEmpty(node.includeWhen)
  const statusEntries =
    node.nodeType === 'instance' && node.schemaStatus
      ? Object.entries(node.schemaStatus)
      : []

  const extRef = node.externalRef as Record<string, unknown> | undefined
  const extMeta = extRef?.metadata as Record<string, unknown> | undefined

  const isForEach = node.nodeType === 'collection'
  // State nodes produce no Kubernetes objects — never fetch YAML for them.
  const isStateNode = node.nodeType === 'state'

  // ── Deletion metadata from fetched raw resource (FR-006) ──────────────────
  // Populated via the onRawObj callback from YamlSection when the resource fetch succeeds.
  const [rawResourceObj, setRawResourceObj] = useState<K8sObject | null>(null)

  // Reset when the selected node changes (different nodeId = different resource)
  const prevNodeIdRef = useRef<string | null>(null)
  if (prevNodeIdRef.current !== node.id) {
    prevNodeIdRef.current = node.id
    // Reset to null synchronously during render when nodeId changes
    // (safe because this runs before the YamlSection fetch for the new node)
  }

  // Compute deletion info from the raw object (graceful: null = not yet fetched)
  const resourceIsTerminating = rawResourceObj ? isTerminating(rawResourceObj) : false
  const resourceDeletionTs = rawResourceObj ? getDeletionTimestamp(rawResourceObj) : undefined
  const resourceFinalizers = rawResourceObj ? getFinalizers(rawResourceObj) : []

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
        {/* Terminating row (FR-006) — only for non-instance, non-forEach nodes */}
        {!isForEach && node.nodeType !== 'instance' && resourceIsTerminating && resourceDeletionTs && (
          <div className="live-panel-terminating-row" role="status">
            <span aria-hidden="true">⊗</span>
            Terminating since {formatRelativeTime(resourceDeletionTs)}
          </div>
        )}

        {/* Node type badge */}
        <Section label="Type">
          <div className="node-type-badge-row">
            <span className={`node-type-badge node-type-badge--${node.nodeType}`}>
              <span>{typeIcon}</span>
              <span>{typeLabel}</span>
            </span>
            {node.isConditional && (
              <span className="node-conditional-badge">
                <span aria-hidden="true">◈</span>
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

        {/* State node guidance — no YAML fetch (state nodes produce no K8s objects) */}
        {isStateNode && (
          <Section label="Note">
            <p className="node-detail-concept node-detail-foreach-note">
              State store node — no Kubernetes resource is created for this node.
              It computes values and writes them into kro&apos;s internal state store.
            </p>
          </Section>
        )}

        {/* YAML section — resource and external nodes only.
            Suppressed for state nodes (no K8s object) and when resourceInfo is
            null (node absent — pending/not-found). */}
        {!isForEach && !isStateNode && node.nodeType !== 'instance' && (
          <Section label="Live YAML">
            {resourceInfo ? (
              <YamlSection
                nodeId={node.id}
                resourceInfo={resourceInfo}
                onRawObj={setRawResourceObj}
              />
            ) : liveState === 'pending' ? (
              <p className="node-yaml-absent-note">
                This resource is excluded by its <code>includeWhen</code> condition — it has
                not been created yet.
              </p>
            ) : (
              <p className="node-yaml-absent-note">
                Resource not yet present in the cluster.
              </p>
            )}
          </Section>
        )}

        {/* Finalizers (FR-006) — shown after YAML section for non-instance, non-forEach, non-state nodes */}
        {!isForEach && !isStateNode && node.nodeType !== 'instance' && resourceFinalizers.length > 0 && (
          <Section label="Finalizers">
            <FinalizersPanel
              finalizers={resourceFinalizers}
              defaultExpanded={resourceIsTerminating}
            />
          </Section>
        )}

        {/* Ready When — readyWhen CEL conditions (spec 021) */}
        {readyWhenExprs.length > 0 && (
          <Section label="Ready When">
            <KroCodeBlock
              code={'readyWhen:\n' + readyWhenExprs.map((e) => `  - ${e}`).join('\n')}
            />
          </Section>
        )}

        {/* Include When — conditional inclusion guard */}
        {includeWhenExprs.length > 0 && (
          <Section label="Include When">
            <KroCodeBlock
              code={'includeWhen:\n' + includeWhenExprs.map((e) => `  - ${e}`).join('\n')}
            />
          </Section>
        )}

        {/* forEach — collection iterator */}
        {node.forEach && (
          <Section label="forEach">
            <KroCodeBlock code={`forEach: ${node.forEach}`} />
          </Section>
        )}

        {/* Status Projections — root node only */}
        {statusEntries.length > 0 && (
          <Section label="Status Projections">
            <KroCodeBlock
              code={
                'status:\n' +
                statusEntries.map(([k, v]) => `  ${k}: ${String(v)}`).join('\n')
              }
            />
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
