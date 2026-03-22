// CollectionPanel.tsx — Collection explorer panel for forEach nodes.
//
// Opened when a NodeTypeCollection node is clicked in the live DAG.
// Shows a table of expanded resources with drill-down to individual YAML.
//
// Spec: .specify/specs/011-collection-explorer/

import { useState, useEffect, useRef } from 'react'
import type { DAGNode } from '@/lib/dag'
import type { K8sObject } from '@/lib/api'
import { getResource } from '@/lib/api'
import { formatAge } from '@/lib/format'
import { toYaml } from '@/lib/yaml'
import KroCodeBlock from './KroCodeBlock'
import './CollectionPanel.css'

// ── kro label constants ────────────────────────────────────────────────────

const LABEL_NODE_ID = 'kro.run/node-id'
const LABEL_COLL_INDEX = 'kro.run/collection-index'
const LABEL_COLL_SIZE = 'kro.run/collection-size'

// ── isItemReady ────────────────────────────────────────────────────────────

/**
 * Determine whether a collection item resource is "ready".
 *
 * Priority:
 *   1. status.phase — Running, Active, or Succeeded → true
 *   2. status.conditions — Ready=True or Available=True → true
 *   3. All other cases → false
 *
 * Exported for unit-testing. Pure function — no side effects.
 */
export function isItemReady(item: K8sObject): boolean {
  const status = item.status
  if (typeof status !== 'object' || status === null) return false

  const s = status as Record<string, unknown>

  // Phase check
  const phase = s.phase
  if (typeof phase === 'string') {
    if (phase === 'Running' || phase === 'Active' || phase === 'Succeeded') return true
    // Known non-ready phases — fall through to conditions check
  }

  // Conditions check
  const conditions = s.conditions
  if (Array.isArray(conditions)) {
    for (const c of conditions) {
      if (typeof c !== 'object' || c === null) continue
      const cond = c as Record<string, unknown>
      if (
        typeof cond.type === 'string' &&
        typeof cond.status === 'string' &&
        (cond.type === 'Ready' || cond.type === 'Available') &&
        cond.status === 'True'
      ) {
        return true
      }
    }
  }

  return false
}

// ── Item status derivation ─────────────────────────────────────────────────

type ItemStatus = 'running' | 'pending' | 'failed' | 'unknown'

function itemStatus(item: K8sObject): ItemStatus {
  const status = item.status
  if (typeof status !== 'object' || status === null) return 'unknown'
  const s = status as Record<string, unknown>

  const phase = s.phase
  if (typeof phase === 'string') {
    switch (phase) {
      case 'Running':
      case 'Active':
      case 'Succeeded':
        return 'running'
      case 'Pending':
        return 'pending'
      case 'Failed':
      case 'Terminating':
        return 'failed'
    }
  }

  // Conditions-based fallback
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

  return 'unknown'
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  running: 'Running',
  pending: 'Pending',
  failed: 'Failed',
  unknown: 'Unknown',
}

// ── Label accessors ────────────────────────────────────────────────────────

function getLabels(item: K8sObject): Record<string, string> {
  const meta = item.metadata
  if (typeof meta !== 'object' || meta === null) return {}
  const labels = (meta as Record<string, unknown>).labels
  if (typeof labels !== 'object' || labels === null) return {}
  return labels as Record<string, string>
}

function getMetaName(item: K8sObject): string {
  const meta = item.metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const name = (meta as Record<string, unknown>).name
  return typeof name === 'string' ? name : ''
}

function getMetaCreationTimestamp(item: K8sObject): string {
  const meta = item.metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const ts = (meta as Record<string, unknown>).creationTimestamp
  return typeof ts === 'string' ? ts : ''
}

function getItemKind(item: K8sObject): string {
  return typeof item.kind === 'string' ? item.kind : ''
}

// ── kubectl command builder ────────────────────────────────────────────────

function buildKubectlCmd(kind: string, name: string, namespace: string): string {
  if (namespace) return `kubectl get ${kind} ${name} -n ${namespace} -o yaml`
  return `kubectl get ${kind} ${name} -o yaml`
}

// ── YAML view for a single collection item ─────────────────────────────────

type YamlViewState =
  | { status: 'loading' }
  | { status: 'loaded'; yaml: string; kubectl: string }
  | { status: 'not-found'; kubectl: string }
  | { status: 'timeout'; kubectl: string }
  | { status: 'error'; message: string }

interface ItemYamlViewProps {
  item: K8sObject
  namespace: string
  onBack: () => void
}

function ItemYamlView({ item, namespace, onBack }: ItemYamlViewProps) {
  const name = getMetaName(item)
  const kind = getItemKind(item)
  const kubectl = buildKubectlCmd(kind, name, namespace)

  // Determine group/version for getResource()
  const apiVersion = typeof item.apiVersion === 'string' ? item.apiVersion : 'v1'
  const slashIdx = apiVersion.indexOf('/')
  const group = slashIdx >= 0 ? apiVersion.slice(0, slashIdx) : ''
  const version = slashIdx >= 0 ? apiVersion.slice(slashIdx + 1) : apiVersion

  const [viewState, setViewState] = useState<YamlViewState>({ status: 'loading' })
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const timeoutId = setTimeout(() => {
      setViewState({ status: 'timeout', kubectl })
    }, 15000)

    getResource(namespace, group, version, kind, name)
      .then((obj) => {
        clearTimeout(timeoutId)
        setViewState({ status: 'loaded', yaml: toYaml(obj), kubectl })
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId)
        const msg = err.message ?? ''
        if (msg.includes('404') || msg.includes('not found') || msg.includes('HTTP 404')) {
          setViewState({ status: 'not-found', kubectl })
        } else {
          setViewState({ status: 'error', message: msg })
        }
      })

    return () => clearTimeout(timeoutId)
  }, [namespace, group, version, kind, name, kubectl])

  function handleRetry() {
    fetchedRef.current = false
    setViewState({ status: 'loading' })
  }

  return (
    <div data-testid="collection-yaml-view" className="collection-yaml-view">
      <div className="collection-yaml-nav">
        <button
          data-testid="collection-back-btn"
          type="button"
          className="collection-back-btn"
          onClick={onBack}
        >
          ← Back to collection
        </button>
        <span className="collection-yaml-name">{name}</span>
      </div>

      {viewState.status === 'loading' ? (
        <div className="collection-yaml-loading" aria-live="polite">
          <span className="collection-yaml-spinner">⟳</span> fetching from cluster…
        </div>
      ) : viewState.status === 'loaded' ? (
        <>
          <div className="collection-yaml-kubectl">
            <code>{viewState.kubectl}</code>
          </div>
          <KroCodeBlock code={viewState.yaml} />
        </>
      ) : viewState.status === 'not-found' ? (
        <div className="collection-yaml-not-found">
          <div className="collection-yaml-not-found-msg">Resource not found in cluster.</div>
          <div className="collection-yaml-kubectl">
            <code>{viewState.kubectl}</code>
          </div>
        </div>
      ) : viewState.status === 'timeout' ? (
        <div className="collection-yaml-timeout">
          <div className="collection-yaml-timeout-msg">Fetch timed out.</div>
          <div className="collection-yaml-kubectl">
            <code>{viewState.kubectl}</code>
          </div>
          <button
            type="button"
            className="collection-yaml-retry-btn"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="collection-yaml-error">Error: {viewState.message}</div>
      )}
    </div>
  )
}

// ── Status cell ────────────────────────────────────────────────────────────

function StatusCell({ item }: { item: K8sObject }) {
  const s = itemStatus(item)
  return (
    <span
      className={`collection-item-status collection-item-status--${s}`}
      aria-label={`Status: ${STATUS_LABEL[s]}`}
    >
      <span className="collection-item-status-dot" aria-hidden="true" />
      {STATUS_LABEL[s]}
    </span>
  )
}

// ── CollectionPanel props ──────────────────────────────────────────────────

export interface CollectionPanelProps {
  node: DAGNode
  children: K8sObject[]
  namespace: string
  instanceName: string
  onClose: () => void
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * CollectionPanel — side panel for inspecting a forEach collection node.
 *
 * Opened from InstanceDetail when a NodeTypeCollection node is clicked.
 * Filters the pre-fetched children array by kro.run/node-id === node.id,
 * sorts by kro.run/collection-index, and renders an item table.
 * Clicking a row opens the resource's live YAML.
 *
 * Spec: .specify/specs/011-collection-explorer/
 */
export default function CollectionPanel({
  node,
  children,
  namespace,
  onClose,
}: CollectionPanelProps) {
  const [selectedItem, setSelectedItem] = useState<K8sObject | null>(null)

  // ── Filter and sort collection items ───────────────────────────────────
  const items = children
    .filter((child) => getLabels(child)[LABEL_NODE_ID] === node.id)
    .sort((a, b) => {
      const ia = parseInt(getLabels(a)[LABEL_COLL_INDEX] ?? '0', 10)
      const ib = parseInt(getLabels(b)[LABEL_COLL_INDEX] ?? '0', 10)
      return ia - ib
    })

  // Expected total from kro.run/collection-size label on any item
  const expectedTotal =
    items.length > 0
      ? parseInt(getLabels(items[0])[LABEL_COLL_SIZE] ?? String(items.length), 10)
      : 0

  // Whether this appears to be a pre-kro-0.8.0 collection (no kro labels on any child)
  const allChildrenLabelless =
    children.length > 0 &&
    children.every((child) => !getLabels(child)[LABEL_NODE_ID])

  const forEachExpr = node.forEach ?? ''

  // ── Back to table (clears selected item without re-fetch) ──────────────
  function handleBack() {
    setSelectedItem(null)
  }

  return (
    <div
      data-testid="collection-panel"
      className="node-detail-panel collection-panel"
    >
      {/* Header */}
      <div className="node-detail-header">
        <div className="node-detail-title">
          <div className="node-detail-kind-row">
            <span className="node-detail-kind">{node.kind || node.label}</span>
            <span className="node-type-badge node-type-badge--collection">
              <span>∀</span>
              <span>forEach Collection</span>
            </span>
          </div>
          <span className="node-detail-id">{node.id}</span>
        </div>
        <button
          data-testid="collection-panel-close"
          className="node-detail-close"
          onClick={onClose}
          aria-label="Close collection panel"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="node-detail-body">
        {/* forEach expression + count summary */}
        <div className="collection-panel-summary">
          <div className="collection-panel-foreach-row">
            <span className="collection-panel-foreach-label">forEach</span>
            <code
              data-testid="collection-foreach-expr"
              className="collection-panel-foreach-expr"
            >
              {forEachExpr}
            </code>
          </div>
          <div className="collection-panel-count-row">
            <span className="collection-panel-count-label">Items</span>
            <span
              data-testid="collection-count"
              className="collection-panel-count"
            >
              {expectedTotal > 0 ? expectedTotal : items.length}
            </span>
          </div>
        </div>

        {/* YAML view or table */}
        {selectedItem != null ? (
          <ItemYamlView
            item={selectedItem}
            namespace={namespace}
            onBack={handleBack}
          />
        ) : allChildrenLabelless ? (
          /* Legacy: kro < 0.8.0 — no kro.run/node-id labels */
          <div className="collection-legacy-notice">
            <span className="collection-legacy-icon" aria-hidden="true">⚠</span>
            <span>Legacy collection — labels unavailable</span>
          </div>
        ) : items.length === 0 ? (
          <div
            data-testid="collection-empty-state"
            className="collection-empty-state"
          >
            Empty collection — 0 resources
          </div>
        ) : (
          <div className="collection-table-wrapper">
            <table
              data-testid="collection-table"
              className="collection-table"
              aria-label={`Collection items for ${node.id}`}
            >
              <thead>
                <tr>
                  <th scope="col">Idx</th>
                  <th scope="col">Name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Status</th>
                  <th scope="col">Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const labels = getLabels(item)
                  const idx = labels[LABEL_COLL_INDEX] ?? '?'
                  const name = getMetaName(item)
                  const kind = getItemKind(item)
                  const ts = getMetaCreationTimestamp(item)
                  const age = ts ? formatAge(ts) : '—'

                  return (
                    <tr
                      key={`${idx}-${name}`}
                      data-testid="collection-item-row"
                      className="collection-item-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect ${name}`}
                      onClick={() => setSelectedItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedItem(item)
                        }
                      }}
                    >
                      <td className="collection-col-idx">{idx}</td>
                      <td className="collection-col-name">{name}</td>
                      <td className="collection-col-kind">{kind}</td>
                      <td className="collection-col-status">
                        <StatusCell item={item} />
                      </td>
                      <td className="collection-col-age">{age}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
