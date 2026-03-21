// InstanceDetail.tsx — Live instance detail page with 5s polling DAG.
//
// Implements spec 005-instance-detail-live.
//
// Data flow:
//   - mount: parallel fetch of instance, events, children, RGD spec (FR-001)
//   - poll:  re-fetch instance + events + children every 5s (FR-002)
//   - RGD spec: fetched once only (static between deployments)
//   - NodeStateMap: derived from instance + children on every poll cycle
//   - NodeDetailPanel: stays open through poll refreshes (FR-008)

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getInstance,
  getInstanceEvents,
  getInstanceChildren,
  getRGD,
} from '@/lib/api'
import type { K8sObject, K8sList } from '@/lib/api'
import type { DAGNode } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import { buildDAGGraph } from '@/lib/dag'
import { buildNodeStateMap } from '@/lib/instanceNodeState'
import { resolveChildResourceInfo } from '@/lib/resolveResourceName'
import { usePolling } from '@/hooks/usePolling'
import LiveDAG from '@/components/LiveDAG'
import LiveNodeDetailPanel from '@/components/LiveNodeDetailPanel'
import SpecPanel from '@/components/SpecPanel'
import ConditionsPanel from '@/components/ConditionsPanel'
import EventsPanel from '@/components/EventsPanel'
import './InstanceDetail.css'

// ── Poll result type ───────────────────────────────────────────────────────

interface LiveData {
  instance: K8sObject
  events: K8sList
  children: K8sObject[]
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

// ── Reconciling banner ─────────────────────────────────────────────────────

function isReconciling(instance: K8sObject | null): boolean {
  if (!instance) return false
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return false
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return false
  return (conditions as Array<{ type: string; status: string }>).some(
    (c) => c.type === 'Progressing' && c.status === 'True',
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

  // ── Poll: instance + events + children every 5s ─────────────────────────
  const fetcher = useCallback(async (): Promise<LiveData> => {
    if (!namespace || !instanceName || !rgdName) {
      throw new Error('Missing route params')
    }
    const [instance, events, childrenResp] = await Promise.all([
      getInstance(namespace, instanceName, rgdName),
      getInstanceEvents(namespace, instanceName),
      getInstanceChildren(namespace, instanceName, rgdName),
    ])
    return {
      instance,
      events,
      children: childrenResp.items ?? [],
    }
  }, [namespace, instanceName, rgdName])

  const { data: liveData, error: pollError, loading: pollLoading, lastRefresh } = usePolling(
    fetcher,
    [namespace, instanceName, rgdName],
    { intervalMs: 5000 },
  )

  // ── Selected node panel (survives poll refreshes — FR-008) ───────────────
  // We track by nodeId only. The panel is not closed on re-render.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<DAGNode | null>(null)

  // ── DAG graph — built once from RGD spec ────────────────────────────────
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>)
  }, [rgd])

  // ── Node state map — derived on every poll ───────────────────────────────
  const nodeStateMap = useMemo(() => {
    if (!liveData) return {}
    return buildNodeStateMap(liveData.instance, liveData.children)
  }, [liveData])

  // ── Detect instance deletion (next poll returns 404) ────────────────────
  const instanceGoneRef = useRef(false)
  const instanceGone =
    pollError != null &&
    (pollError.includes('404') ||
      pollError.includes('not found') ||
      pollError.includes('HTTP 404'))

  if (instanceGone && !instanceGoneRef.current) {
    instanceGoneRef.current = true
  }

  // ── Node click handler ───────────────────────────────────────────────────
  function handleNodeClick(node: DAGNode) {
    setSelectedNodeId(node.id)
    setSelectedNode(node)
  }

  function handlePanelClose() {
    setSelectedNodeId(null)
    setSelectedNode(null)
  }

  // ── Resolve resource info for the open panel ────────────────────────────
  const resolvedResourceInfo = useMemo(() => {
    if (!selectedNode || !instanceName || !liveData) return null
    // forEach nodes: no YAML fetch (FR-010)
    if (selectedNode.nodeType === 'collection') return null
    // Root instance node: no YAML
    if (selectedNode.nodeType === 'instance') return null
    return resolveChildResourceInfo(
      selectedNode.label,
      instanceName,
      liveData.children,
    )
  }, [selectedNode, instanceName, liveData])

  // ── Live state for the selected node ────────────────────────────────────
  const selectedNodeLiveState: NodeLiveState | undefined = useMemo(() => {
    if (!selectedNode) return undefined
    if (selectedNode.nodeType === 'instance') {
      const states = Object.values(nodeStateMap).map((e) => e.state)
      if (states.includes('reconciling')) return 'reconciling'
      if (states.includes('error')) return 'error'
      if (states.length > 0) return 'alive'
      return undefined
    }
    const kindKey = (selectedNode.kind || selectedNode.label).toLowerCase()
    return nodeStateMap[kindKey]?.state
  }, [selectedNode, nodeStateMap])

  // ── Instance name for breadcrumbs ────────────────────────────────────────
  const displayName = instanceName ?? '…'

  // ── Render ───────────────────────────────────────────────────────────────

  const isLoading = (rgdLoading || pollLoading) && !liveData

  return (
    <div data-testid="instance-detail-page" className="instance-detail">
      {/* Breadcrumbs */}
      <div className="instance-detail-breadcrumbs">
        <Link to="/" className="breadcrumb-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        {rgdName && (
          <>
            <Link to={`/rgds/${rgdName}`} className="breadcrumb-link">{rgdName}</Link>
            <span className="breadcrumb-sep">›</span>
          </>
        )}
        <span className="breadcrumb-current">{displayName}</span>
      </div>

      {/* Header */}
      <div className="instance-detail-header">
        <h1 className="instance-detail-name">{displayName}</h1>
        <div className="instance-detail-meta">
          {namespace && <span className="instance-detail-ns">{namespace}</span>}
          <RefreshIndicator lastRefresh={lastRefresh} error={instanceGone ? null : (pollError && !pollLoading ? pollError : null)} />
        </div>
      </div>

      {/* Reconciling banner (FR-003) */}
      {liveData && isReconciling(liveData.instance) && (
        <div className="reconciling-banner" role="status" aria-live="polite">
          <span className="reconciling-banner-pulse" aria-hidden="true">●</span>
          kro is reconciling this instance
        </div>
      )}

      {/* Instance deleted banner */}
      {instanceGoneRef.current && (
        <div className="instance-gone-banner" role="alert">
          Instance not found — it may have been deleted.
        </div>
      )}

      {/* Poll error (non-404) */}
      {pollError && !instanceGone && !pollLoading && (
        <div className="poll-error-banner" role="status">
          Refresh paused — retrying in 10s
        </div>
      )}

      {/* RGD error */}
      {rgdError && (
        <div className="instance-detail-error" role="alert">
          Could not load RGD spec: {rgdError}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="instance-detail-loading" aria-live="polite">
          Loading…
        </div>
      )}

      {/* Main content */}
      {!isLoading && liveData && (
        <div className={`instance-detail-content${selectedNode ? ' instance-detail-content--with-panel' : ''}`}>
          {/* DAG */}
          <div className="instance-detail-dag-area">
            {dagGraph && dagGraph.nodes.length > 0 ? (
              <LiveDAG
                graph={dagGraph}
                nodeStateMap={nodeStateMap}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNodeId ?? undefined}
              />
            ) : (
              <div className="instance-detail-dag-empty">
                No managed resources defined in this RGD.
              </div>
            )}
          </div>

          {/* Below-DAG panels */}
          <div className="instance-detail-panels">
            <SpecPanel instance={liveData.instance} />
            <ConditionsPanel instance={liveData.instance} />
            <EventsPanel events={liveData.events} />
          </div>
        </div>
      )}

      {/* Node detail side panel (FR-006, FR-008) */}
      {selectedNode && (
        <LiveNodeDetailPanel
          node={selectedNode}
          liveState={selectedNodeLiveState}
          resourceInfo={resolvedResourceInfo}
          onClose={handlePanelClose}
        />
      )}
    </div>
  )
}
