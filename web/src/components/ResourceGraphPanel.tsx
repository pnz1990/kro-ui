// ResourceGraphPanel.tsx — Instance resource graph panel.
//
// Shows all k8s resources owned by the instance, grouped by kind,
// with health status indicators and clickable rows.
//
// Spec: .specify/specs/issue-538/spec.md

import { useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { formatAge } from '@/lib/format'
import './ResourceGraphPanel.css'

// ── Item status derivation ─────────────────────────────────────────────────

// Same logic as CollectionPanel.tsx — reused here for consistency.
// Issue #252: 'not-reported' matches constitution §XII graceful degradation language.
type ResourceStatus = 'running' | 'pending' | 'failed' | 'not-reported'

function resourceStatus(item: K8sObject): ResourceStatus {
  const status = item.status
  if (typeof status !== 'object' || status === null) return 'not-reported'
  const s = status as Record<string, unknown>

  // ConfigMap, Secret, Namespace, ServiceAccount, etc. have no conditions — treat as running.
  // See AGENTS.md anti-pattern: "isItemReady: stateless resources (ConfigMap etc.) are healthy by existence"
  if (!s.phase && !Array.isArray(s.conditions)) return 'running'

  const phase = s.phase
  if (typeof phase === 'string') {
    switch (phase) {
      case 'Running':
      case 'Active':
      case 'Succeeded':
      case 'Bound':
        return 'running'
      case 'Pending':
        return 'pending'
      case 'Failed':
      case 'Terminating':
        return 'failed'
    }
  }

  const conditions = s.conditions
  if (Array.isArray(conditions)) {
    for (const c of conditions) {
      if (typeof c !== 'object' || c === null) continue
      const cond = c as Record<string, unknown>
      if (
        typeof cond.type === 'string' &&
        (cond.type === 'Ready' || cond.type === 'Available')
      ) {
        if (cond.status === 'True') return 'running'
        if (cond.status === 'False') return 'failed'
      }
    }
  }

  return 'not-reported'
}

const STATUS_LABEL: Record<ResourceStatus, string> = {
  running: 'Running',
  pending: 'Pending',
  failed: 'Failed',
  'not-reported': 'Not reported',
}

// ── Metadata helpers ───────────────────────────────────────────────────────

function getKind(item: K8sObject): string {
  if (typeof item.kind === 'string' && item.kind) return item.kind
  return 'Unknown'
}

function getName(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  const name = meta?.name
  return typeof name === 'string' && name ? name : '—'
}

function getNamespace(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  const ns = meta?.namespace
  if (typeof ns !== 'string' || !ns) return 'cluster-scoped'
  return ns
}

function getCreationTimestamp(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  const ts = meta?.creationTimestamp
  return typeof ts === 'string' ? ts : ''
}

function parseApiVersion(apiVersion: unknown): { group: string; version: string } {
  if (typeof apiVersion !== 'string') return { group: '', version: 'v1' }
  const idx = apiVersion.indexOf('/')
  if (idx < 0) return { group: '', version: apiVersion || 'v1' }
  return { group: apiVersion.slice(0, idx), version: apiVersion.slice(idx + 1) }
}

// ── Group resources by kind ────────────────────────────────────────────────

interface ResourceGroup {
  kind: string
  items: K8sObject[]
}

function groupByKind(items: K8sObject[]): ResourceGroup[] {
  const map = new Map<string, K8sObject[]>()
  for (const item of items) {
    const kind = getKind(item)
    const group = map.get(kind) ?? []
    group.push(item)
    map.set(kind, group)
  }
  // Sort groups alphabetically by kind
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, items]) => ({ kind, items }))
}

// ── Resource row click info ────────────────────────────────────────────────

export interface ResourceClickInfo {
  kind: string
  name: string
  namespace: string
  group: string
  version: string
}

// ── Props ──────────────────────────────────────────────────────────────────

interface ResourceGraphPanelProps {
  /** Children resources — may be null while loading */
  children: K8sObject[] | null
  childrenLoading?: boolean
  onResourceClick?: (info: ResourceClickInfo) => void
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ResourceGraphPanel({
  children,
  childrenLoading = false,
  onResourceClick,
}: ResourceGraphPanelProps) {
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set())

  function toggleKind(kind: string) {
    setExpandedKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) {
        next.delete(kind)
      } else {
        next.add(kind)
      }
      return next
    })
  }

  const groups = children ? groupByKind(children) : []

  return (
    <div data-testid="resource-graph-panel" className="resource-graph-panel">
      <div className="panel-heading">Resources</div>

      {childrenLoading && (!children || children.length === 0) && (
        <div className="resource-graph-loading" aria-live="polite">
          <div className="resource-graph-skeleton" />
          <div className="resource-graph-skeleton resource-graph-skeleton--short" />
        </div>
      )}

      {!childrenLoading && groups.length === 0 && (
        <div className="resource-graph-empty">
          No managed resources found for this instance.
        </div>
      )}

      {groups.length > 0 && (
        <div className="resource-graph-groups">
          {groups.map(({ kind, items }) => {
            const isExpanded = expandedKinds.has(kind)
            return (
              <div key={kind} className="resource-group">
                <button
                  className={`resource-group-header${isExpanded ? ' resource-group-header--expanded' : ''}`}
                  onClick={() => toggleKind(kind)}
                  aria-expanded={isExpanded}
                  aria-controls={`resource-group-${kind}`}
                >
                  <span className="resource-group-chevron" aria-hidden="true">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <span className="resource-group-kind">{kind}</span>
                  <span className="resource-group-count" aria-label={`${items.length} resources`}>
                    {items.length}
                  </span>
                </button>

                {isExpanded && (
                  <div
                    id={`resource-group-${kind}`}
                    className="resource-group-items"
                    role="list"
                  >
                    {items.map((item, idx) => {
                      const status = resourceStatus(item)
                      const name = getName(item)
                      const namespace = getNamespace(item)
                      const ts = getCreationTimestamp(item)
                      const age = ts ? formatAge(ts) : '—'
                      const { group, version } = parseApiVersion(item.apiVersion)

                      return (
                        <div
                          key={`${name}-${idx}`}
                          className={`resource-item${onResourceClick ? ' resource-item--clickable' : ''}`}
                          role="listitem"
                          onClick={
                            onResourceClick
                              ? () => onResourceClick({ kind, name, namespace, group, version })
                              : undefined
                          }
                          tabIndex={onResourceClick ? 0 : undefined}
                          onKeyDown={
                            onResourceClick
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onResourceClick({ kind, name, namespace, group, version })
                                  }
                                }
                              : undefined
                          }
                          aria-label={`${kind} ${name} in ${namespace}: ${STATUS_LABEL[status]}`}
                        >
                          <span
                            className={`resource-status-dot resource-status-dot--${status}`}
                            title={STATUS_LABEL[status]}
                            aria-hidden="true"
                          />
                          <span className="resource-item-name" title={name}>{name}</span>
                          <span className="resource-item-namespace" title={namespace}>
                            {namespace}
                          </span>
                          <span className="resource-item-age" title={ts || 'Unknown creation time'}>
                            {age}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
