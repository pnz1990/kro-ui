import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams, useLocation, Link } from "react-router-dom"
import { getRGD, listRGDs, listInstances, getInstance, getInstanceChildren } from "@/lib/api"
import type { K8sObject, K8sList } from "@/lib/api"
import { toYaml } from "@/lib/yaml"
import { buildDAGGraph, detectCollapseGroups } from "@/lib/dag"
import { extractRGDKind, extractReadyStatus } from "@/lib/format"
import { buildNodeStateMap } from "@/lib/instanceNodeState"
import type { NodeStateMap } from "@/lib/instanceNodeState"
import { usePageTitle } from "@/hooks/usePageTitle"
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
import type { PickerItem } from "@/components/InstanceOverlayBar"
import "./RGDDetail.css"

/** Valid tab values. Anything else falls back to 'graph'. */
type TabId = "graph" | "instances" | "yaml" | "validation" | "errors" | "access" | "docs" | "generate"

function isValidTab(t: string | null): t is TabId {
  return t === "graph" || t === "instances" || t === "yaml" || t === "validation" || t === "errors" || t === "access" || t === "docs" || t === "generate"
}

/**
 * RGDDetail — RGD detail page with eight tabs: Graph, Instances, YAML, Validation, Errors, Access, Docs, Generate.
 *
 * Active tab is reflected in and restored from `?tab=` URL query parameter.
 * Default tab is "graph".
 *
 * Spec: .specify/specs/003-rgd-detail-dag/, .specify/specs/004-instance-list/,
 *       .specify/specs/017-rgd-validation-linting/, .specify/specs/018-rbac-visualizer/,
 *       .specify/specs/020-schema-doc-generator/, .specify/specs/030-error-patterns-tab/,
 *       .specify/specs/036-rgd-detail-header/
 */
export default function RGDDetail() {
  const { name } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // Breadcrumb: set when navigated via "View RGD →" from another RGD (spec 025)
  const fromRgd = (location.state as { from?: string } | null)?.from || null

  const rawTab = searchParams.get("tab")
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : "graph"

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

  useEffect(() => {
    if (!name) return
    setLoading(true)
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

  // ── Instances tab state ───────────────────────────────────────────────────

  // namespace param from URL — empty string means "all namespaces"
  const namespaceParam = searchParams.get("namespace") ?? ""

  const [instanceList, setInstanceList] = useState<K8sList | null>(null)
  const [instancesLoading, setInstancesLoading] = useState(false)
  const [instancesError, setInstancesError] = useState<string | null>(null)

  // Fetch all instances (no namespace filter) when the Instances tab is active.
  // This provides the full list from which namespace options are derived (FR-003).
  const [allInstances, setAllInstances] = useState<K8sList | null>(null)

  useEffect(() => {
    if (activeTab !== "instances" || !name) return
    setInstancesLoading(true)
    setInstancesError(null)

    const ns = namespaceParam || undefined
    const fetchFiltered = listInstances(name, ns)
    const fetchAll = namespaceParam
      ? listInstances(name)
      : fetchFiltered

    fetchFiltered
      .then((data) => {
        setInstanceList(data)
        setInstancesError(null)
      })
      .catch((err: Error) => {
        setInstancesError(err.message)
        setInstanceList(null)
      })
      .finally(() => setInstancesLoading(false))

    // Fetch unfiltered list to populate namespace dropdown (only when filtered)
    if (namespaceParam) {
      fetchAll
        .then((data) => setAllInstances(data))
        .catch(() => {
          // Non-critical: namespace options fall back to current filtered list
        })
    } else {
      fetchFiltered.then((data) => setAllInstances(data)).catch(() => {})
    }
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
      .catch((err: Error) => {
        setPickerError(err.message)
      })
      .finally(() => setPickerLoading(false))
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

    Promise.all([
      getInstance(ns, instanceName, String(name)),
      getInstanceChildren(ns, instanceName, String(name)),
    ])
      .then(([instance, childrenRes]) => {
        setOverlayInstance(instance)
        setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? []))
        setOverlayError(null)
      })
      .catch((err: Error) => {
        setOverlayError(err.message)
        setOverlayInstance(null)
        setOverlayNodeStateMap(null)
      })
      .finally(() => setOverlayLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey, name, overlayRetry])

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
    setPickerError(null)
    setPickerItems([])
    setPickerLoading(false)
    // Re-trigger the picker fetch effect by temporarily resetting its guard
    // (the effect checks pickerItems.length + pickerLoading + pickerError)
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

  // ── Memoised DAG ─────────────────────────────────────────────────────────
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>, rgds)
  }, [rgd, rgds])

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
      setSearchParams({})
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
    return <div className="rgd-detail-error">Error: {error}</div>
  }

  if (!rgd) return null

  const rgdKind = extractRGDKind(rgd)
  const readyState = extractReadyStatus(rgd)

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
      </div>

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
      </div>

      {/* Tab content */}
      <div className="rgd-tab-content">
        {activeTab === "graph" && (
          <>
            {/* Issue #129: "refreshed X ago" indicator (constitution §XIII) */}
            {rgdLastFetched && (
              <div className="rgd-graph-refresh-hint" aria-live="polite">
                refreshed {formatAgo(rgdLastFetched)}
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
                  No managed resources defined
                </div>
              )}
            </div>
            <OptimizationAdvisor
              key={String(rgdName)}
              groups={collapseGroups}
            />
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </>
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
              <div className="rgd-instances-error" data-testid="instance-error-state">
                <span className="rgd-instances-error__msg">
                  Error: {instancesError}
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
                  No instances found. Create one with{" "}
                  <code>kubectl apply</code>.
                </div>
              ) : (
                <InstanceTable
                  items={instanceList.items ?? []}
                  rgdName={String(rgdName)}
                />
              )
            )}
          </div>
        )}

        {activeTab === "yaml" && (
          <div className="rgd-tab-panel">
            <KroCodeBlock code={toYaml(rgd)} title="ResourceGraphDefinition" />
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
