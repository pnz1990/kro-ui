import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams, useLocation, Link } from "react-router-dom"
import { getRGD, listRGDs, listInstances, getInstance, getInstanceChildren } from "@/lib/api"
import type { K8sObject, K8sList } from "@/lib/api"
import { translateApiError } from "@/lib/errors"
import { toYaml, cleanK8sObject } from "@/lib/yaml"
import { buildDAGGraph, detectCollapseGroups } from "@/lib/dag"
import { extractRGDKind, extractReadyStatus, extractLastRevision } from "@/lib/format"
import { buildNodeStateMap } from "@/lib/instanceNodeState"
import type { NodeStateMap } from "@/lib/instanceNodeState"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useHealthTrend } from "@/hooks/useHealthTrend"
import StatusDot from "@/components/StatusDot"
import KroCodeBlock from "@/components/KroCodeBlock"
import StaticChainDAG from "@/components/StaticChainDAG"
import NodeDetailPanel from "@/components/NodeDetailPanel"
import InstanceTable from "@/components/InstanceTable"
import NamespaceFilter from "@/components/NamespaceFilter"
import ValidationTab from "@/components/ValidationTab"
import ErrorsTab from "@/components/ErrorsTab"
import AccessTab from "@/components/AccessTab"
import DocsTab from "@/components/DocsTab"
import GenerateTab from "@/components/GenerateTab"
import OptimizationAdvisor from "@/components/OptimizationAdvisor"
import InstanceOverlayBar from "@/components/InstanceOverlayBar"
import RevisionsTab from "@/components/RevisionsTab"
import type { PickerItem } from "@/components/InstanceOverlayBar"
import { useCapabilities } from "@/lib/features"
import RGDStatStrip from "@/components/RGDStatStrip"
import HealthTrendSparkline from "@/components/HealthTrendSparkline"
import "./RGDDetail.css"

/** Valid tab values. Anything else falls back to 'graph'. */
type TabId = "graph" | "instances" | "yaml" | "validation" | "errors" | "access" | "docs" | "generate" | "revisions"

function isValidTab(t: string | null): t is TabId {
  return t === "graph" || t === "instances" || t === "yaml" || t === "validation" || t === "errors" || t === "access" || t === "docs" || t === "generate" || t === "revisions"
}

/**
 * RGDDetail — RGD detail page with nine tabs: Graph, Instances, YAML, Validation, Errors, Access, Docs, Generate, Revisions.
 *
 * The Revisions tab is only shown when the cluster has the GraphRevision CRD
 * (capabilities.hasGraphRevisions = true, requires kro v0.9.0+).
 *
 * Active tab is reflected in and restored from `?tab=` URL query parameter.
 * Default tab is "graph".
 *
 * Spec: .specify/specs/003-rgd-detail-dag/, .specify/specs/004-instance-list/,
 *       .specify/specs/017-rgd-validation-linting/, .specify/specs/018-rbac-visualizer/,
 *       .specify/specs/020-schema-doc-generator/, .specify/specs/030-error-patterns-tab/,
 *       .specify/specs/036-rgd-detail-header/
 * GH #274: kro v0.9.0 Graph Revisions tab
 */
export default function RGDDetail() {
  const { name } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // Capabilities: used to gate the Revisions tab (kro v0.9.0+)
  const { capabilities } = useCapabilities()
  const hasRevisions = capabilities?.schema?.hasGraphRevisions === true

  // Breadcrumb: set when navigated via "View RGD →" from another RGD (spec 025)
  const fromRgd = (location.state as { from?: string } | null)?.from || null

  const rawTab = searchParams.get("tab")
  // Issue #367: if ?tab=revisions but the cluster doesn't support GraphRevisions
  // (kro < v0.9.0), treat it as invalid so we fall back to the graph tab.
  // Without this check, navigating to ?tab=revisions renders a blank content area
  // because the Revisions tab content is gated on hasRevisions.
  const activeTab: TabId = isValidTab(rawTab) && (rawTab !== "revisions" || hasRevisions)
    ? rawTab
    : "graph"

  // ── RGD data ──────────────────────────────────────────────────────────────
  const [rgd, setRgd] = useState<K8sObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // Issue #129: track when the RGD was last fetched for the "refreshed X ago" indicator.
  const [rgdLastFetched, setRgdLastFetched] = useState<Date | null>(null)
  // Issue #129: tick every 1s so the elapsed label stays current (same pattern as Fleet).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── All RGDs for chain detection (spec 025) ───────────────────────────────
  const [rgds, setRgds] = useState<K8sObject[]>([])

  // Issue #261: extract the RGD fetch into a useCallback so the initial
  // useEffect and the retryLoad handler share one source of truth.
  const fetchRGD = useCallback(() => {
    if (!name) return
    setLoading(true)
    setError(null)
    // Fetch RGD detail and all RGDs in parallel; listRGDs failure is non-fatal
    // (chain detection degrades to no chainable marking rather than an error page)
    Promise.all([
      getRGD(name),
      listRGDs().catch(() => ({ metadata: {}, items: [] as K8sObject[] })),
    ])
      .then(([data, allRgds]) => {
        setRgd(data)
        setRgds(allRgds.items ?? [])
        setRgdLastFetched(new Date())
        setError(null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setRgd(null)
      })
      .finally(() => setLoading(false))
  }, [name])

  useEffect(() => {
    fetchRGD()
  }, [fetchRGD])

  // ── Instances tab state ───────────────────────────────────────────────────

  // namespace param from URL — empty string means "all namespaces"
  const namespaceParam = searchParams.get("namespace") ?? ""

  const [instanceList, setInstanceList] = useState<K8sList | null>(null)
  const [instancesLoading, setInstancesLoading] = useState(false)
  const [instancesError, setInstancesError] = useState<string | null>(null)

  // Health trend: accumulate per-poll snapshots for the sparkline.
  // Spec: .specify/specs/issue-539/spec.md O3, O5
  const { samples: healthSamples, record: recordHealthSample } = useHealthTrend()

  // Eager instance count for the stat strip — fetched once when the RGD loads,
  // not gated on the Instances tab being active. null=loading, undefined=failed.
  // AbortController ensures no setState-after-unmount if user navigates away. #411
  const [eagerInstanceCount, setEagerInstanceCount] = useState<number | null | undefined>(null)
  useEffect(() => {
    if (!name) return
    const ac = new AbortController()
    setEagerInstanceCount(null)
    listInstances(name)
      .then((data) => {
        if (!ac.signal.aborted) setEagerInstanceCount((data.items ?? []).length)
      })
      .catch(() => {
        if (!ac.signal.aborted) setEagerInstanceCount(undefined)
      })
    return () => ac.abort()
  }, [name])

  // Fetch all instances (no namespace filter) when the Instances tab is active.
  // This provides the full list from which namespace options are derived (FR-003).
  const [allInstances, setAllInstances] = useState<K8sList | null>(null)

  useEffect(() => {
    if (activeTab !== "instances" || !name) return
    setInstancesLoading(true)
    setInstancesError(null)

    const ac = new AbortController()
    const ns = namespaceParam || undefined
    const fetchFiltered = listInstances(name, ns, { signal: ac.signal })
    const fetchAll = namespaceParam
      ? listInstances(name, undefined, { signal: ac.signal })
      : fetchFiltered

    fetchFiltered
      .then((data) => {
        if (ac.signal.aborted) return
        setInstanceList(data)
        setInstancesError(null)
        // Record health snapshot for sparkline (spec issue-539 O3)
        recordHealthSample(data.items ?? [])
      })
      .catch((err: Error) => {
        if (ac.signal.aborted) return
        setInstancesError(err.message)
        setInstanceList(null)
      })
      .finally(() => { if (!ac.signal.aborted) setInstancesLoading(false) })

    // Fetch unfiltered list to populate namespace dropdown (only when filtered)
    if (namespaceParam) {
      fetchAll
        .then((data) => { if (!ac.signal.aborted) setAllInstances(data) })
        .catch(() => {
          // Non-critical: namespace options fall back to current filtered list
        })
    } else {
      fetchFiltered.then((data) => { if (!ac.signal.aborted) setAllInstances(data) }).catch(() => {})
    }
    return () => ac.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, name, namespaceParam])

  // Derive unique namespace options from the unfiltered instance list (FR-003)
  const namespaceOptions = useMemo(() => {
    const source = allInstances ?? instanceList
    if (!source) return []
    const seen = new Set<string>()
    for (const item of source.items ?? []) {
      const meta = item.metadata as Record<string, unknown> | undefined
      const ns = typeof meta?.namespace === 'string' ? meta.namespace : ''
      if (ns) seen.add(ns)
    }
    return Array.from(seen).sort()
  }, [allInstances, instanceList])

  function handleNamespaceChange(ns: string) {
    const next: Record<string, string> = { tab: "instances" }
    if (ns) next.namespace = ns
    setSearchParams(next)
  }

  // ── Graph tab overlay state ───────────────────────────────────────────────
  // spec: .specify/specs/029-dag-instance-overlay/

  // Memoised DAG — declared here so the overlay useEffect can include it in its
  // dependency array without a "used before declaration" error (issue #233).
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>, rgds)
  }, [rgd, rgds])

  // Picker: list of instances for the overlay <select>
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  // Selected overlay key: "<namespace>/<name>" or null (= no overlay)
  const [overlayKey, setOverlayKey] = useState<string | null>(null)
  // Raw instance data for the selected overlay (drives summary bar)
  const [overlayInstance, setOverlayInstance] = useState<K8sObject | null>(null)
  // NodeStateMap built from selected instance + children (drives node colors)
  const [overlayNodeStateMap, setOverlayNodeStateMap] = useState<NodeStateMap | null>(null)
  const [overlayLoading, setOverlayLoading] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)
  // Retry counter — incrementing re-triggers the overlay fetch effect
  const [overlayRetry, setOverlayRetry] = useState(0)

  // Fetch picker items once when the Graph tab first becomes active.
  // Mirrors the lazy fetch pattern used for the Instances tab.
  useEffect(() => {
    if (activeTab !== "graph" || !name) return
    // One-shot: don't re-fetch if already loaded or in progress
    if (pickerItems.length > 0 || pickerLoading || pickerError) return
    setPickerLoading(true)
    setPickerError(null)
    const pickerAC = new AbortController()
     listInstances(name, undefined, { signal: pickerAC.signal })
      .then((data) => {
        if (pickerAC.signal.aborted) return
        const items: PickerItem[] = (data.items ?? []).map((item) => {
          const meta = item.metadata as Record<string, unknown> | undefined
          return {
            namespace: typeof meta?.namespace === 'string' ? meta.namespace : '',
            name: typeof meta?.name === 'string' ? meta.name : '',
          }
        }).filter((item) => item.name !== '')
        setPickerItems(items)
        setPickerError(null)
      })
      .catch((err: Error) => {
        if (pickerAC.signal.aborted) return
        setPickerError(err.message)
      })
      .finally(() => { if (!pickerAC.signal.aborted) setPickerLoading(false) })
    return () => pickerAC.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, name])
  useEffect(() => {
    if (!overlayKey || !name) {
      // Key cleared → reset overlay state immediately
      setOverlayInstance(null)
      setOverlayNodeStateMap(null)
      setOverlayError(null)
      return
    }
    // Parse "<namespace>/<name>" — namespace may be empty for cluster-scoped CRs
    const slashIdx = overlayKey.indexOf('/')
    const ns = slashIdx === -1 ? '' : overlayKey.slice(0, slashIdx)
    const instanceName = slashIdx === -1 ? overlayKey : overlayKey.slice(slashIdx + 1)

    setOverlayLoading(true)
    setOverlayError(null)
    setOverlayNodeStateMap(null)

    const overlayAC = new AbortController()
    Promise.all([
      getInstance(ns, instanceName, String(name)),
      getInstanceChildren(ns, instanceName, String(name)),
    ])
      .then(([instance, childrenRes]) => {
        if (overlayAC.signal.aborted) return
        setOverlayInstance(instance)
        setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? [], dagGraph?.nodes ?? []))
        setOverlayError(null)
      })
      .catch((err: Error) => {
        if (overlayAC.signal.aborted) return
        setOverlayError(err.message)
        setOverlayInstance(null)
        setOverlayNodeStateMap(null)
      })
      .finally(() => { if (!overlayAC.signal.aborted) setOverlayLoading(false) })
    return () => overlayAC.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey, name, overlayRetry, dagGraph])

  function handleOverlaySelect(key: string | null) {
    setOverlayKey(key)
    if (!key) {
      // Clear synchronously so StaticChainDAG loses nodeStateMap immediately
      setOverlayInstance(null)
      setOverlayNodeStateMap(null)
      setOverlayError(null)
    }
  }

  function handlePickerRetry() {
    // Issue #261: removed spurious setPickerLoading(false) immediately before
    // setPickerLoading(true) — that caused an unnecessary re-render.
    setPickerError(null)
    setPickerItems([])
    if (!name) return
    setPickerLoading(true)
    listInstances(name)
      .then((data) => {
        const items: PickerItem[] = (data.items ?? []).map((item) => {
          const meta = item.metadata as Record<string, unknown> | undefined
          return {
            namespace: typeof meta?.namespace === 'string' ? meta.namespace : '',
            name: typeof meta?.name === 'string' ? meta.name : '',
          }
        }).filter((item) => item.name !== '')
        setPickerItems(items)
        setPickerError(null)
      })
      .catch((err: Error) => setPickerError(err.message))
      .finally(() => setPickerLoading(false))
  }
  function handleOverlayRetry() {
    if (!overlayKey) return
    setOverlayError(null)
    setOverlayRetry((c) => c + 1)
  }

  // ── Collapse candidate groups (static analysis, no API call) ─────────────
  // spec: .specify/specs/023-rgd-optimization-advisor/
  const collapseGroups = useMemo(() => {
    if (!rgd?.spec) return []
    return detectCollapseGroups(rgd.spec)
  }, [rgd])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !dagGraph) return null
    return dagGraph.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [selectedNodeId, dagGraph])

  function setTab(t: TabId) {
    if (t === "graph") {
      // Issue #249: only remove the `tab` key — preserve all other params
      // (e.g. `?namespace=kube-system`) so switching back restores the filter.
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.delete("tab")
        return p
      })
    } else {
      setSearchParams({ tab: t })
    }
  }

  const rgdName =
    (rgd?.metadata as Record<string, unknown> | undefined)?.name ?? name ?? ""

  // Page title: "<rgdName> — kro-ui"
  usePageTitle(String(rgdName))

  if (loading) {
    return <div className="rgd-detail-loading">Loading…</div>
  }

  if (error) {
    // Issue #261: use the shared fetchRGD callback instead of a duplicate fetch body
    return (
      <div className="rgd-detail-error" role="alert" data-testid="rgd-detail-error">
        <p className="rgd-detail-error__msg">{translateApiError(error)}</p>
        <div className="rgd-detail-error__actions">
          <button type="button" className="rgd-detail-error__retry-btn" onClick={fetchRGD}>
            Retry
          </button>
          <Link to="/" className="rgd-detail-error__back-link">← Back to Overview</Link>
        </div>
      </div>
    )
  }

  if (!rgd) return null

  const rgdKind = extractRGDKind(rgd)
  const readyState = extractReadyStatus(rgd)

  // FR-020: Cluster scope badge — shown only when spec.schema.scope === 'Cluster'.
  const schemaObj = (rgd?.spec as Record<string, unknown> | undefined)
    ?.schema as Record<string, unknown> | undefined
  const isClusterScoped = (schemaObj?.scope as string | undefined) === 'Cluster'

  // FR-050: lastIssuedRevision chip — extracted via shared extractLastRevision() (#413).
  const lastIssuedRevision = rgd ? extractLastRevision(rgd) : null

  return (
    <div className="rgd-detail">
      {/* Breadcrumb — shown when navigated via "View RGD →" (spec 025) */}
      {fromRgd && (
        <div data-testid="rgd-breadcrumb" className="rgd-breadcrumb">
          <Link data-testid="rgd-breadcrumb-link" to={`/rgds/${fromRgd}`}>
            ← {fromRgd}
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="rgd-detail-header">
        <div className="rgd-detail-header-row">
          <StatusDot state={readyState.state} reason={readyState.reason} message={readyState.message} />
          <h1 className="rgd-detail-name">{String(rgdName)}</h1>
        </div>
        {rgdKind && (
          <span className="rgd-detail-kind" data-testid="rgd-detail-kind">{rgdKind}</span>
        )}
        {/* FR-020: Cluster scope badge — hidden for Namespaced (default) */}
        {isClusterScoped && (
          <span
            className="rgd-scope-badge"
            aria-label="Cluster-scoped resource"
            data-testid="rgd-scope-badge"
          >
            Cluster
          </span>
        )}
        {/* FR-050: lastIssuedRevision chip — shown only when > 0 (kro v0.9.0+) */}
        {lastIssuedRevision !== null && (
          <span
            className="rgd-revision-chip"
            title={`Graph revision ${lastIssuedRevision} — a GraphRevision CR snapshot is created each time kro re-processes this RGD. This is the most recently issued revision number.`}
            data-testid="rgd-revision-chip"
          >
            Rev #{lastIssuedRevision}
          </span>
        )}
      </div>

      {/* Stat strip — Age / Resources / Instances / Latest revision */}
      <RGDStatStrip
        rgd={rgd}
        instanceCount={eagerInstanceCount}
        hasRevisions={hasRevisions}
      />

      {/* Tab bar */}
      <div className="rgd-tab-bar" role="tablist">
        <button
          data-testid="tab-graph"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "graph"}
          onClick={() => setTab("graph")}
          type="button"
        >
          Graph
        </button>
        <button
          data-testid="tab-instances"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "instances"}
          onClick={() => setTab("instances")}
          type="button"
        >
          Instances
        </button>
        <button
          data-testid="tab-yaml"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "yaml"}
          onClick={() => setTab("yaml")}
          type="button"
        >
          YAML
        </button>
        <button
          data-testid="tab-validation"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "validation"}
          onClick={() => setTab("validation")}
          type="button"
        >
          Validation
        </button>
        <button
          data-testid="tab-errors"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "errors"}
          onClick={() => setTab("errors")}
          type="button"
        >
          Errors
        </button>
        <button
          data-testid="tab-access"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "access"}
          onClick={() => setTab("access")}
          type="button"
        >
          Access
        </button>
        <button
          data-testid="tab-docs"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "docs"}
          onClick={() => setTab("docs")}
          type="button"
        >
          Docs
        </button>
        <button
          data-testid="tab-generate"
          className="rgd-tab-btn"
          role="tab"
          aria-selected={activeTab === "generate"}
          onClick={() => setTab("generate")}
          type="button"
        >
          Generate
        </button>
        {hasRevisions && (
          <button
            data-testid="tab-revisions"
            className="rgd-tab-btn"
            role="tab"
            aria-selected={activeTab === "revisions"}
            onClick={() => setTab("revisions")}
            type="button"
            title="GraphRevision history — kro v0.9.0+"
          >
            Revisions
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="rgd-tab-content">
        {activeTab === "graph" && (
          <div className="rgd-graph-column">
            {/* Issue #129: "refreshed X ago" indicator (constitution §XIII) */}
            {rgdLastFetched && (
              <div className="rgd-graph-refresh-hint" aria-live="polite">
                refreshed {formatAgo(rgdLastFetched)}
                {/* Resource kind breakdown — shows complexity at a glance when ≥2 resources */}
                {rgd && (() => {
                  const resources = (rgd.spec as Record<string, unknown>)?.resources
                  if (!Array.isArray(resources) || resources.length < 2) return null
                  const kindCounts = new Map<string, number>()
                  for (const r of resources) {
                    const rObj = r as Record<string, unknown>
                    const tmpl = rObj?.template as Record<string, unknown> | undefined
                    const kind = tmpl?.kind as string | undefined
                    if (kind) kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1)
                  }
                  const parts: string[] = []
                  kindCounts.forEach((count, kind) => {
                    parts.push(count > 1 ? `${count}×${kind}` : kind)
                  })
                  return (
                    <span
                      className="rgd-graph-complexity-hint"
                      title={`${resources.length} resource${resources.length === 1 ? '' : 's'}: ${parts.join(', ')}`}
                    >
                      · {resources.length} resources ({parts.join(', ')})
                    </span>
                  )
                })()}
              </div>
            )}
            <div
              className={`rgd-graph-area${selectedNode ? " rgd-graph-area--with-panel" : ""}`}
            >
              <InstanceOverlayBar
                rgdName={String(rgdName)}
                items={pickerItems}
                pickerLoading={pickerLoading}
                pickerError={pickerError}
                rgdReady={readyState.state !== 'error'}
                selected={overlayKey}
                overlayInstance={overlayInstance}
                overlayLoading={overlayLoading}
                overlayError={overlayError}
                onSelect={handleOverlaySelect}
                onPickerRetry={handlePickerRetry}
                onOverlayRetry={handleOverlayRetry}
              />
              {dagGraph && dagGraph.nodes.length > 0 ? (
                <StaticChainDAG
                  graph={dagGraph}
                  rgds={rgds}
                  onNodeClick={(id) => setSelectedNodeId(id)}
                  selectedNodeId={selectedNodeId ?? undefined}
                  rgdName={String(rgdName)}
                  nodeStateMap={overlayNodeStateMap ?? undefined}
                />
              ) : (
                <div className="rgd-graph-empty">
                  No managed resources defined in this RGD.{' '}
                  Open the{' '}
                  <button type="button" className="rgd-graph-empty__tab-link" onClick={() => setTab('yaml')}>YAML tab</button>
                  {' '}to inspect the spec, or use the{' '}
                  <button type="button" className="rgd-graph-empty__tab-link" onClick={() => setTab('generate')}>Generate tab</button>
                  {' '}to scaffold a new resource.
                </div>
              )}
              <OptimizationAdvisor
                key={String(rgdName)}
                groups={collapseGroups}
              />
            </div>
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </div>
        )}

        {activeTab === "instances" && (
          <div className="rgd-tab-panel">
            <div className="rgd-instances-toolbar">
              <NamespaceFilter
                namespaces={namespaceOptions}
                selected={namespaceParam}
                onChange={handleNamespaceChange}
              />
            </div>

            {instancesLoading && (
              <div className="rgd-instances-loading">Loading instances…</div>
            )}

            {!instancesLoading && instancesError && (
              <div className="rgd-instances-error" data-testid="instance-error-state" role="alert">
                <span className="rgd-instances-error__msg">
                  {readyState.state === 'error'
                    ? <>
                        This RGD&apos;s CRD has not been provisioned yet. Instances can only be
                        created once the RGD is Ready.{' '}
                        <button
                          type="button"
                          className="rgd-instances-error__tab-link"
                          onClick={() => setTab('validation')}
                        >
                          Check the Validation tab
                        </button>{' '}
                        for details.
                      </>
                    : translateApiError(instancesError)
                  }
                </span>
                <button
                  type="button"
                  className="rgd-instances-retry-btn"
                  data-testid="btn-retry"
                  onClick={() => {
                    // Re-trigger by toggling a dummy counter via namespace param
                    // Actually: re-trigger by clearing error — effect re-runs on tab/name/ns
                    setInstancesError(null)
                    setInstancesLoading(true)
                    listInstances(name ?? "", namespaceParam || undefined)
                      .then((data) => {
                        setInstanceList(data)
                        if (!namespaceParam) setAllInstances(data)
                      })
                      .catch((err: Error) => setInstancesError(err.message))
                      .finally(() => setInstancesLoading(false))
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!instancesLoading && !instancesError && instanceList && (
              (instanceList.items ?? []).length === 0 ? (
                <div
                  className="rgd-instances-empty"
                  data-testid="instance-empty-state"
                >
                  No instances found.{' '}
                  Use the{' '}
                  <button
                    type="button"
                    className="rgd-instances-empty__tab-link"
                    onClick={() => setSearchParams({ tab: 'generate' })}
                  >
                    Generate tab
                  </button>
                  {' '}to scaffold the YAML, then apply it with{' '}
                  <code>kubectl apply</code>.
                </div>
              ) : (
                <>
                  {/* Health trend sparkline — spec issue-539 O1, O2 */}
                  <HealthTrendSparkline samples={healthSamples} />
                  <InstanceTable
                    items={instanceList.items ?? []}
                    rgdName={String(rgdName)}
                  />
                </>
              )
            )}
          </div>
        )}

        {activeTab === "yaml" && (
          <div className="rgd-tab-panel">
            <KroCodeBlock code={toYaml(cleanK8sObject(rgd))} title="ResourceGraphDefinition" />
          </div>
        )}

        {activeTab === "validation" && (
          <div className="rgd-tab-panel">
            <ValidationTab rgd={rgd} />
          </div>
        )}

        {activeTab === "errors" && (
          <div className="rgd-tab-panel">
            <ErrorsTab
              rgdName={String(rgdName)}
              namespace={namespaceParam || undefined}
            />
          </div>
        )}

        {activeTab === "access" && (
          <div className="rgd-tab-panel">
            <AccessTab rgdName={String(rgdName)} />
          </div>
        )}

        {activeTab === "docs" && (
          <div className="rgd-tab-panel">
            <DocsTab rgd={rgd} />
          </div>
        )}

        {activeTab === "generate" && (
          <div className="rgd-tab-panel">
            <GenerateTab rgd={rgd} />
          </div>
        )}

        {/* Revisions tab — kro v0.9.0+ only (gated by hasGraphRevisions capability) */}
        {activeTab === "revisions" && hasRevisions && name && (
          <div className="rgd-tab-panel">
            <RevisionsTab rgdName={name} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Utilities ────────────────────────────────────────────────────────────────

/** Format a Date as "Xs ago" / "Xm ago" / "just now". Issue #129. */
function formatAgo(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}
