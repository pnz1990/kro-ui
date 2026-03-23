import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { getRGD, listInstances } from "@/lib/api"
import type { K8sObject, K8sList } from "@/lib/api"
import { toYaml } from "@/lib/yaml"
import { buildDAGGraph, detectCollapseGroups } from "@/lib/dag"
import { usePageTitle } from "@/hooks/usePageTitle"
import KroCodeBlock from "@/components/KroCodeBlock"
import DAGGraph from "@/components/DAGGraph"
import NodeDetailPanel from "@/components/NodeDetailPanel"
import InstanceTable from "@/components/InstanceTable"
import NamespaceFilter from "@/components/NamespaceFilter"
import ValidationTab from "@/components/ValidationTab"
import AccessTab from "@/components/AccessTab"
import DocsTab from "@/components/DocsTab"
import OptimizationAdvisor from "@/components/OptimizationAdvisor"
import "./RGDDetail.css"

/** Valid tab values. Anything else falls back to 'graph'. */
type TabId = "graph" | "instances" | "yaml" | "validation" | "access" | "docs"

function isValidTab(t: string | null): t is TabId {
  return t === "graph" || t === "instances" || t === "yaml" || t === "validation" || t === "access" || t === "docs"
}

/**
 * RGDDetail — RGD detail page with six tabs: Graph, Instances, YAML, Validation, Access, Docs.
 *
 * Active tab is reflected in and restored from `?tab=` URL query parameter.
 * Default tab is "graph".
 *
 * Spec: .specify/specs/003-rgd-detail-dag/, .specify/specs/004-instance-list/,
 *       .specify/specs/017-rgd-validation-linting/, .specify/specs/018-rbac-visualizer/,
 *       .specify/specs/020-schema-doc-generator/
 */
export default function RGDDetail() {
  const { name } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get("tab")
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : "graph"

  // ── RGD data ──────────────────────────────────────────────────────────────
  const [rgd, setRgd] = useState<K8sObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    getRGD(name)
      .then((data) => {
        setRgd(data)
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
    for (const item of source.items) {
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

  // ── Memoised DAG ─────────────────────────────────────────────────────────
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>)
  }, [rgd])

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

  return (
    <div className="rgd-detail">
      {/* Header */}
      <div className="rgd-detail-header">
        <h1 className="rgd-detail-name">{String(rgdName)}</h1>
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
      </div>

      {/* Tab content */}
      <div className="rgd-tab-content">
        {activeTab === "graph" && (
          <>
            <div
              className={`rgd-graph-area${selectedNode ? " rgd-graph-area--with-panel" : ""}`}
            >
              {dagGraph && dagGraph.nodes.length > 0 ? (
                <DAGGraph
                  graph={dagGraph}
                  onNodeClick={(id) => setSelectedNodeId(id)}
                  selectedNodeId={selectedNodeId ?? undefined}
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
              instanceList.items.length === 0 ? (
                <div
                  className="rgd-instances-empty"
                  data-testid="instance-empty-state"
                >
                  No instances found. Create one with{" "}
                  <code>kubectl apply</code>.
                </div>
              ) : (
                <InstanceTable
                  items={instanceList.items}
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
      </div>
    </div>
  )
}
