// InstanceDetail.tsx — Live instance detail page with 5s polling DAG.
//
// Implements spec 005-instance-detail-live.
// Extended by spec 011-collection-explorer: collection node clicks open
// CollectionPanel instead of LiveNodeDetailPanel.
//
// Data flow:
//   - mount: parallel fetch of instance + events (fast), children (slow, non-blocking),
//     and RGD spec (fast, once only) — FR-001
//   - poll:  re-fetch instance + events every 5s via usePolling (FR-002)
//   - children: fetched separately on mount and each poll, does NOT block DAG rendering
//   - RGD spec: fetched once only (static between deployments)
//   - NodeStateMap: derived from instance + children on every poll cycle
//   - NodeDetailPanel: stays open through poll refreshes (FR-008)

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  getInstance,
  getInstanceEvents,
  getInstanceChildren,
  getRGD,
  listRGDs,
} from '@/lib/api'
import type { K8sObject, K8sList } from '@/lib/api'
import type { DAGNode } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import { buildDAGGraph } from '@/lib/dag'
import { buildNodeStateMap } from '@/lib/instanceNodeState'
import { resolveChildResourceInfo } from '@/lib/resolveResourceName'
import { extractInstanceHealth, applyDegradedState, displayNamespace } from '@/lib/format'
import { countHealthyChildren } from '@/lib/telemetry'
import { usePolling } from '@/hooks/usePolling'
import { isTerminating, getDeletionTimestamp, getFinalizers } from '@/lib/k8s'
import { translateApiError } from '@/lib/errors'
import DeepDAG from '@/components/DeepDAG'
import LiveNodeDetailPanel from '@/components/LiveNodeDetailPanel'
import CollectionPanel from '@/components/CollectionPanel'
import SpecPanel from '@/components/SpecPanel'
import ConditionsPanel from '@/components/ConditionsPanel'
import EventsPanel from '@/components/EventsPanel'
import TerminatingBanner from '@/components/TerminatingBanner'
import FinalizersPanel from '@/components/FinalizersPanel'
import TelemetryPanel from '@/components/TelemetryPanel'
import HealthPill from '@/components/HealthPill'
import CopySpecButton from '@/components/CopySpecButton'
import ResourceGraphPanel from '@/components/ResourceGraphPanel'
import type { ResourceClickInfo } from '@/components/ResourceGraphPanel'
import './InstanceDetail.css'

// ── Poll result type ───────────────────────────────────────────────────────

/** Fast data that updates every 5s — instance detail + events. */
interface FastData {
  instance: K8sObject
  events: K8sList
}

// ── Refresh indicator ──────────────────────────────────────────────────────

function RefreshIndicator({
  lastRefresh,
  error,
}: {
  lastRefresh: Date | null
  error: string | null
}) {
  const [, setTick] = useState(0)

  // Re-render every second to update the "refreshed Ns ago" counter
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return (
      <span data-testid="live-refresh-indicator" className="refresh-indicator refresh-indicator--error">
        Refresh paused — retrying in 10s
      </span>
    )
  }

  if (!lastRefresh) {
    return (
      <span data-testid="live-refresh-indicator" className="refresh-indicator">
        loading…
      </span>
    )
  }

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastRefresh.getTime()) / 1000))
  return (
    <span data-testid="live-refresh-indicator" className="refresh-indicator">
      refreshed {secondsAgo}s ago
    </span>
  )
}

// ── Reconcile-paused detection ────────────────────────────────────────────
// kro v0.9.1 made `suspended` the canonical annotation value (PR #1221).
// kro v0.9.0 used `disabled`. Both are still accepted by kro ≥v0.9.1.
// kro-ui detects either value so the banner shows on both old and new clusters.
//   Annotation: metadata.annotations["kro.run/reconcile"] === "suspended" | "disabled"
// When present, kro stops reconciling the instance until the annotation is removed.

function isReconcilePaused(instance: K8sObject | null): boolean {
  if (!instance) return false
  const meta = instance.metadata as Record<string, unknown> | undefined
  if (!meta) return false
  const annotations = meta.annotations
  if (typeof annotations !== 'object' || annotations === null) return false
  const val = (annotations as Record<string, unknown>)['kro.run/reconcile']
  return val === 'suspended' || val === 'disabled'
}

// ── Reconciling duration ──────────────────────────────────────────────────
// Returns the number of minutes the instance has been in a non-Ready state,
// derived from the earliest failing condition's lastTransitionTime.
// Returns null when the transition time is unavailable.

function reconcilingSinceMinutes(instance: K8sObject | null): number | null {
  if (!instance) return null
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return null
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return null
  let oldest: number | null = null
  for (const c of conditions as Array<Record<string, unknown>>) {
    if (c.status !== 'False' && c.status !== 'Unknown') continue
    const t = c.lastTransitionTime
    if (typeof t !== 'string') continue
    const ms = Date.parse(t)
    if (!isNaN(ms) && (oldest === null || ms < oldest)) oldest = ms
  }
  if (oldest === null) return null
  return Math.floor((Date.now() - oldest) / 60_000)
}

// ── Reconciling banner ─────────────────────────────────────────────────────

/** Format a duration in minutes as a human-readable string.
 * e.g. 3827m → "2d 15h", 90m → "1h 30m", 45m → "45m".
 */
function formatReconcileDuration(mins: number): string {
  if (mins >= 24 * 60) {
    const d = Math.floor(mins / (24 * 60))
    const h = Math.floor((mins % (24 * 60)) / 60)
    return h > 0 ? `${d}d ${h}h` : `${d}d`
  }
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

function isReconciling(instance: K8sObject | null): boolean {
  if (!instance) return false
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return false
  // kro v0.8.5: status.state === 'IN_PROGRESS' when readyWhen is unmet —
  // does NOT emit Progressing=True; without this the banner is invisible.
  if (status.state === 'IN_PROGRESS') return true
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return false
  return (conditions as Array<{ type: string; status: string }>).some(
    // Issue #243: kro v0.8.x uses 'GraphProgressing'; v0.9.x+ uses 'Progressing'.
    (c) =>
      (c.type === 'Progressing' || c.type === 'GraphProgressing') &&
      c.status === 'True',
  )
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * InstanceDetail — live DAG page for a kro CR instance.
 *
 * Route: /rgds/:rgdName/instances/:namespace/:instanceName
 * Spec:  .specify/specs/005-instance-detail-live/
 */
export default function InstanceDetail() {
  const { rgdName, namespace, instanceName } = useParams<{
    rgdName: string
    namespace: string
    instanceName: string
  }>()

  // ── RGD spec — fetched once ─────────────────────────────────────────────
  const [rgd, setRgd] = useState<K8sObject | null>(null)
  const [rgdError, setRgdError] = useState<string | null>(null)
  const [rgdLoading, setRgdLoading] = useState(true)

  useEffect(() => {
    if (!rgdName) return
    getRGD(rgdName)
      .then((data) => { setRgd(data); setRgdError(null) })
      .catch((err: Error) => { setRgdError(err.message) })
      .finally(() => setRgdLoading(false))
  }, [rgdName])

  // ── All RGDs — fetched once for chaining detection (spec 012) ────────────
  const [allRGDs, setAllRGDs] = useState<K8sObject[]>([])

  useEffect(() => {
    listRGDs()
      .then((list) => setAllRGDs(list.items ?? []))
      .catch(() => { /* non-fatal: chaining detection degrades gracefully */ })
  }, [])

  // ── Children — fetched separately; does NOT block DAG rendering ──────────
  // ListChildResources does full-cluster discovery and can be slow (O(N) GVRs).
  // We store the latest resolved children independently of the fast poll.
  const [children, setChildren] = useState<K8sObject[]>([])
  const [childrenLoading, setChildrenLoading] = useState(true)

  const fetchChildren = useCallback(() => {
    if (!namespace || !instanceName || !rgdName) return
    getInstanceChildren(namespace, instanceName, rgdName)
      .then((resp) => {
        setChildren(resp.items ?? [])
        setChildrenLoading(false)
      })
      .catch(() => {
        setChildrenLoading(false) /* non-fatal: keep previous children */
      })
  }, [namespace, instanceName, rgdName])

  // Fetch children on mount and every 5s via a separate interval
  useEffect(() => {
    fetchChildren()
    const id = setInterval(fetchChildren, 5000)
    return () => clearInterval(id)
  }, [fetchChildren])

  // ── Poll: instance + events every 5s (fast path) ────────────────────────
  const fetcher = useCallback(async (): Promise<FastData> => {
    if (!namespace || !instanceName || !rgdName) {
      throw new Error('Missing route params')
    }
    const [instance, events] = await Promise.all([
      getInstance(namespace, instanceName, rgdName),
      getInstanceEvents(namespace, instanceName),
    ])
    return { instance, events }
  }, [namespace, instanceName, rgdName])

  const { data: fastData, error: pollError, loading: pollLoading, lastRefresh, refresh: pollRefresh } = usePolling(
    fetcher,
    [namespace, instanceName, rgdName],
    { intervalMs: 5000 },
  )

  // ── Poll tick counter — increments on each successful poll ───────────────
  // Used by TerminatingBanner to recompute relative time without setInterval.
  const [pollTick, setPollTick] = useState(0)
  useEffect(() => {
    if (lastRefresh) setPollTick((t) => t + 1)
  }, [lastRefresh])

  // ── Selected node panel (survives poll refreshes — FR-008) ───────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<DAGNode | null>(null)

  // ── Snooze state (GH #276 F-8) ─────────────────────────────────────────────
  // Session-only: snoozed node IDs are not persisted. Snooze mutes the error
  // ring on a specific node without affecting the CR health state.
  const [snoozedNodes, setSnoozedNodes] = useState<Set<string>>(new Set())
  const handleSnooze = useCallback((nodeId: string) => {
    setSnoozedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId) // toggle off (unsnooze)
      } else {
        next.add(nodeId) // snooze
      }
      return next
    })
  }, [])
  /**
   * panelMode: controls which panel is shown when a node is selected.
   *   'node'       → LiveNodeDetailPanel (resource / external / instance nodes)
   *   'collection' → CollectionPanel (forEach collection nodes — spec 011)
   */
  const [panelMode, setPanelMode] = useState<'node' | 'collection'>('node')

  // ── Resource graph panel selection (spec issue-538) ────────────────────────
  // When a resource row is clicked in ResourceGraphPanel, we store its
  // ResourceClickInfo and open LiveNodeDetailPanel with a synthetic node.
  const [resourcePanelInfo, setResourcePanelInfo] = useState<ResourceClickInfo | null>(null)

  // ── DAG graph — built once from RGD spec ────────────────────────────────
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>)
  }, [rgd])

  // ── Node state map — derived on every poll + children update ─────────────
  const nodeStateMap = useMemo(() => {
    if (!fastData) return {}
    return buildNodeStateMap(fastData.instance, children, dagGraph?.nodes ?? [])
  }, [fastData, children, dagGraph])

  // ── Detect instance deletion (next poll returns 404) ────────────────────
  const instanceGoneRef = useRef(false)
  const instanceGone =
    pollError != null &&
    (pollError.includes('404') ||
      pollError.includes('not found') ||
      pollError.includes('HTTP 404'))

  // Latch instanceGoneRef in an effect — safe to mutate refs inside effects.
  // Never mutate a ref during render (Strict Mode double-invokes renders).
  useEffect(() => {
    if (instanceGone) instanceGoneRef.current = true
  }, [instanceGone])

  // ── Node click handler ───────────────────────────────────────────────────
  function handleNodeClick(node: DAGNode) {
    setSelectedNodeId(node.id)
    setSelectedNode(node)
    setResourcePanelInfo(null) // clear resource graph selection when DAG node selected
    // Spec 011: forEach collection nodes open CollectionPanel
    setPanelMode(node.nodeType === 'collection' ? 'collection' : 'node')
  }

  function handlePanelClose() {
    setSelectedNodeId(null)
    setSelectedNode(null)
    setResourcePanelInfo(null)
    setPanelMode('node')
  }

  // ── Resource graph click handler (spec issue-538) ──────────────────────
  function handleResourceClick(info: ResourceClickInfo) {
    setResourcePanelInfo(info)
    // Clear DAG selection so the two panels don't overlap
    setSelectedNodeId(null)
    setSelectedNode(null)
  }

  // ── Resolve resource info for the open panel ────────────────────────────
  const resolvedResourceInfo = useMemo(() => {
    if (!selectedNode || !instanceName) return null
    // forEach nodes: no YAML fetch (FR-010)
    if (selectedNode.nodeType === 'collection') return null
    // Root instance node: no YAML
    if (selectedNode.nodeType === 'instance') return null

    // Short-circuit: external ref nodes use the metadata from the RGD spec
    // directly. External refs are pre-existing resources not labelled by kro,
    // so they never appear in the children list and resolveChildResourceInfo
    // would always fall through to a wrong guessed name. GH #403.
    if (
      (selectedNode.nodeType === 'external' || selectedNode.nodeType === 'externalCollection') &&
      selectedNode.externalRef
    ) {
      const ref = selectedNode.externalRef as Record<string, unknown>
      const meta = (ref.metadata ?? {}) as Record<string, unknown>
      const apiVer = typeof ref.apiVersion === 'string' ? ref.apiVersion : 'v1'
      const slashIdx = apiVer.indexOf('/')
      const group   = slashIdx >= 0 ? apiVer.slice(0, slashIdx) : ''
      const version = slashIdx >= 0 ? apiVer.slice(slashIdx + 1) : (apiVer || 'v1')
      const name = typeof meta.name === 'string' ? meta.name : ''
      // Selector-based external collections have no single name — suppress YAML fetch.
      if (!name) return null
      return {
        kind:      typeof ref.kind === 'string' ? ref.kind : selectedNode.kind,
        name,
        namespace: typeof meta.namespace === 'string' ? meta.namespace : '',
        group,
        version,
      }
    }

    // Fix GH #403: nodeStateMap is keyed by kro.run/node-id (= node.id), NOT
    // by lowercased kind. The old kindKey lookup always returned undefined,
    // so the pending/not-found guard never fired, causing spurious YAML errors
    // on absent managed resources (pending, not-found states).
    const liveState = nodeStateMap[selectedNode.id]?.state
    if (liveState === 'pending' || liveState === 'not-found') return null

    return resolveChildResourceInfo(
      selectedNode.label,
      instanceName,
      children,
      selectedNode.kind || undefined,
    )
  }, [selectedNode, instanceName, children, nodeStateMap])

  // ── Live state for the selected node ────────────────────────────────────
  // Fall back to 'not-found' when children haven't loaded yet — ensures the
  // state badge is always rendered (never returns undefined once fastData exists).
  const selectedNodeLiveState: NodeLiveState | undefined = useMemo(() => {
    if (!selectedNode || !fastData) return undefined
    if (selectedNode.nodeType === 'instance') {
      const states = Object.values(nodeStateMap).map((e) => e.state)
      if (states.includes('reconciling')) return 'reconciling'
      if (states.includes('error')) return 'error'
      if (states.length > 0) return 'alive'
      return 'not-found'
    }
    // State nodes produce no K8s resources — they have no meaningful live state.
    // Returning undefined suppresses the state badge entirely for these nodes.
    if (selectedNode.nodeType === 'state') return undefined
    // Fix GH #403: use node.id (= kro.run/node-id), not lowercased kind.
    return nodeStateMap[selectedNode.id]?.state ?? 'not-found'
  }, [selectedNode, fastData, nodeStateMap])

  // ── Resource graph synthetic node (spec issue-538) ────────────────────────
  // When a resource row is clicked in ResourceGraphPanel, synthesize a minimal
  // DAGNode so we can reuse LiveNodeDetailPanel for YAML display.
  const resourcePanelSyntheticNode: DAGNode | null = useMemo(() => {
    if (!resourcePanelInfo) return null
    return {
      id: `resource-graph-${resourcePanelInfo.kind}-${resourcePanelInfo.name}`,
      label: resourcePanelInfo.name,
      nodeType: 'resource',
      kind: resourcePanelInfo.kind,
      isConditional: false,
      hasReadyWhen: false,
      celExpressions: [],
      includeWhen: [],
      readyWhen: [],
      isChainable: false,
      x: 0, y: 0, width: 0, height: 0,
    }
  }, [resourcePanelInfo])

  // ── Instance name for breadcrumbs ────────────────────────────────────────
  const displayName = instanceName ?? '…'

  // ── Page title ──────────────────────────────────────────────────────────
  usePageTitle(
    instanceName && rgdName
      ? `${instanceName} / ${rgdName}`
      : instanceName ?? rgdName ?? ''
  )

  // ── Loading: gate only on the fast poll (instance + events) ─────────────
  // Children load separately and do not block DAG rendering.
  const isLoading = pollLoading && !fastData

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div data-testid="instance-detail-page" className="instance-detail">
      {/* Breadcrumbs — issue #70: add Instances segment */}
      <nav className="instance-detail-breadcrumbs" aria-label="Breadcrumb">
        <ol className="breadcrumb-list">
          <li className="breadcrumb-item">
            <Link to="/" className="breadcrumb-link">Overview</Link>
          </li>
          {rgdName && (
            <li className="breadcrumb-item">
              <Link to={`/rgds/${rgdName}`} className="breadcrumb-link">{rgdName}</Link>
            </li>
          )}
          {rgdName && (
            <li className="breadcrumb-item">
              <Link to={`/rgds/${rgdName}?tab=instances`} className="breadcrumb-link">Instances</Link>
            </li>
          )}
          <li className="breadcrumb-item">
            <span className="breadcrumb-current" aria-current="page">{displayName}</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="instance-detail-header">
        <h1 className="instance-detail-name">{displayName}</h1>
        <HealthPill health={fastData ? applyDegradedState(
          extractInstanceHealth(fastData.instance),
          countHealthyChildren(nodeStateMap).hasError,
        ) : null} />
        {fastData && <CopySpecButton instance={fastData.instance} />}
        <div className="instance-detail-meta">
          {namespace && <span className="instance-detail-ns">{displayNamespace(namespace)}</span>}
          <RefreshIndicator lastRefresh={lastRefresh} error={instanceGone ? null : (pollError && !pollLoading ? pollError : null)} />
          <button
            type="button"
            className="instance-detail-refresh-btn"
            onClick={pollRefresh}
            aria-label="Refresh now"
            title="Refresh now — trigger an immediate poll instead of waiting for the next 5-second cycle"
            data-testid="instance-refresh-btn"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Terminating banner (FR-001) — takes precedence over Reconciling */}
      {fastData && isTerminating(fastData.instance) && (
        <TerminatingBanner
          deletionTimestamp={getDeletionTimestamp(fastData.instance) ?? ''}
          tick={pollTick}
          instanceKind={typeof fastData.instance.kind === 'string' ? fastData.instance.kind : undefined}
          instanceName={instanceName}
          instanceNamespace={namespace === '_' ? '' : namespace}
          finalizers={getFinalizers(fastData.instance)}
        />
      )}

      {/* Reconciliation paused banner (kro v0.9.1 — annotation kro.run/reconcile=suspended (also accepts legacy 'disabled')) */}
      {fastData && isReconcilePaused(fastData.instance) && (
        <div
          className="reconcile-paused-banner"
          role="status"
          aria-live="polite"
          title="kro.run/reconcile: suspended annotation is present. Remove the annotation to resume reconciliation: kubectl annotate <kind> <name> kro.run/reconcile-"
        >
          <span className="reconcile-paused-banner__icon" aria-hidden="true">⏸</span>
          Reconciliation paused — kro will not apply changes until the{' '}
          <code className="reconcile-paused-banner__code">kro.run/reconcile: suspended</code>
          {' '}annotation is removed.
        </div>
      )}

      {/* Reconciling banner (FR-003) — only when NOT terminating */}
      {fastData && !isTerminating(fastData.instance) && isReconciling(fastData.instance) && (() => {
        const mins = reconcilingSinceMinutes(fastData.instance)
        const isStuck = mins !== null && mins >= 5
        return (
          <div
            className={`reconciling-banner${isStuck ? ' reconciling-banner--stuck' : ''}`}
            role="status"
            aria-live="polite"
            title="kro is actively applying changes to this instance's managed resources. This is normal during creation and after spec changes. If this persists, check the Conditions panel for details."
          >
            <span className="reconciling-banner-pulse" aria-hidden="true">●</span>
            {isStuck
              ? <>kro has been reconciling this instance for {formatReconcileDuration(mins!)} — check the Conditions panel and <code>kubectl describe</code> the child resources for errors.</>
              : 'kro is reconciling this instance'
            }
          </div>
        )
      })()}

      {/* Instance deleted banner */}
      {instanceGoneRef.current && (
        <div className="instance-gone-banner" role="alert">
          Instance not found — it may have been deleted.{' '}
          <Link to={`/rgds/${encodeURIComponent(rgdName ?? '')}`}>View all instances →</Link>
        </div>
      )}

      {/* Poll error (non-404) */}
      {pollError && !instanceGone && !pollLoading && (
        <div className="poll-error-banner" role="status">
          Refresh paused ({translateApiError(pollError)}) — retrying in 10s
        </div>
      )}

      {/* RGD error */}
      {rgdError && (
        <div className="instance-detail-error" role="alert">
          <p>{translateApiError(rgdError)} The RGD may have been deleted or renamed.</p>
          {rgdName && (
            <Link to={`/rgds/${rgdName}`} className="instance-detail-error__back-link">
              ← Back to {rgdName}
            </Link>
          )}
        </div>
      )}

      {/* Loading state — only until the fast poll (instance + events) resolves */}
      {isLoading && (
        <div className="instance-detail-loading" aria-live="polite">
          Loading…
        </div>
      )}

      {/* Main content — renders as soon as instance + events are available */}
      {!isLoading && fastData && (
        <>
          {/* Telemetry strip — age, time in state, children health, warnings (spec 027) */}
          <TelemetryPanel
            instance={fastData.instance}
            nodeStateMap={nodeStateMap}
            events={fastData.events}
          />

          <div className={`instance-detail-content${selectedNode ? ' instance-detail-content--with-panel' : ''}`}>
            {/* DAG */}
            <div className="instance-detail-dag-area">
              {rgdLoading ? (
                <div className="instance-detail-dag-empty">Loading graph…</div>
              ) : dagGraph && dagGraph.nodes.length > 0 ? (
                <DeepDAG
                  graph={dagGraph}
                  nodeStateMap={nodeStateMap}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedNodeId ?? undefined}
                  children={children}
                  rgds={allRGDs}
                  namespace={namespace ?? ''}
                  snoozedNodes={snoozedNodes}
                  onSnooze={handleSnooze}
                />
              ) : (
                <div className="instance-detail-dag-empty">
                  No managed resources defined in this <abbr title="ResourceGraphDefinition">RGD</abbr>.{' '}
                  {rgdName && (
                    <Link to={`/rgds/${rgdName}`}>
                      View the RGD&apos;s Graph tab
                    </Link>
                  )}{' '}
                  to inspect the resource dependency graph.
                </div>
              )}
            </div>

            {/* Live node state legend — shown when nodeStateMap is non-empty */}
            {Object.keys(nodeStateMap).length > 0 && (
              <div className="instance-detail-live-legend" aria-label="Live node state legend">
                <span className="live-dag-state-legend__entry" title="Resource exists and all readyWhen conditions are met">
                  <span className="live-dag-state-legend__dot live-dag-state-legend__dot--alive" aria-hidden="true" />
                  Alive
                </span>
                <span className="live-dag-state-legend__entry" title="kro is applying changes, or readyWhen is not yet satisfied">
                  <span className="live-dag-state-legend__dot live-dag-state-legend__dot--reconciling" aria-hidden="true" />
                  Reconciling
                </span>
                <span className="live-dag-state-legend__entry" title="Resource was excluded by its includeWhen condition">
                  <span className="live-dag-state-legend__dot live-dag-state-legend__dot--pending" aria-hidden="true" />
                  Excluded
                </span>
                <span className="live-dag-state-legend__entry" title="Resource has a failed condition (e.g. Available=False)">
                  <span className="live-dag-state-legend__dot live-dag-state-legend__dot--error" aria-hidden="true" />
                  Error
                </span>
                <span className="live-dag-state-legend__entry" title="Resource not yet present in the cluster">
                  <span className="live-dag-state-legend__dot live-dag-state-legend__dot--notfound" aria-hidden="true" />
                  Not found
                </span>
              </div>
            )}

            {/* Below-DAG panels */}
            <div className="instance-detail-panels">
              <SpecPanel instance={fastData.instance} />
              <ConditionsPanel instance={fastData.instance} />
              <FinalizersPanel
                finalizers={getFinalizers(fastData.instance)}
                defaultExpanded={isTerminating(fastData.instance)}
              />
              <EventsPanel events={fastData.events} namespace={namespace} />
              {/* Resource graph — all k8s resources owned by this instance (spec issue-538) */}
              <ResourceGraphPanel
                children={children}
                childrenLoading={childrenLoading}
                onResourceClick={handleResourceClick}
              />
            </div>
          </div>
        </>
      )}

      {/* Node detail / collection side panel (FR-006, FR-008, spec 011) */}
      {selectedNode && panelMode === 'collection' ? (
        <CollectionPanel
          node={selectedNode}
          children={children}
          namespace={namespace ?? ''}
          onClose={handlePanelClose}
        />
      ) : selectedNode && panelMode === 'node' ? (
        <LiveNodeDetailPanel
          node={selectedNode}
          liveState={selectedNodeLiveState}
          resourceInfo={resolvedResourceInfo}
          onClose={handlePanelClose}
        />
      ) : resourcePanelInfo && resourcePanelSyntheticNode ? (
        /* Resource graph panel click — show YAML for selected resource (spec issue-538) */
        <LiveNodeDetailPanel
          node={resourcePanelSyntheticNode}
          liveState="alive"
          resourceInfo={resourcePanelInfo}
          onClose={handlePanelClose}
        />
      ) : null}
    </div>
  )
}
