import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { getRGD } from "@/lib/api"
import type { K8sObject } from "@/lib/api"
import { toYaml } from "@/lib/yaml"
import { buildDAGGraph } from "@/lib/dag"
import KroCodeBlock from "@/components/KroCodeBlock"
import DAGGraph from "@/components/DAGGraph"
import NodeDetailPanel from "@/components/NodeDetailPanel"
import "./RGDDetail.css"

/** Valid tab values. Anything else falls back to 'graph'. */
type TabId = "graph" | "instances" | "yaml"

function isValidTab(t: string | null): t is TabId {
  return t === "graph" || t === "instances" || t === "yaml"
}

/**
 * RGDDetail — RGD detail page with three tabs: Graph, Instances, YAML.
 *
 * Active tab is reflected in and restored from `?tab=` URL query parameter.
 * Default tab is "graph".
 *
 * Spec: .specify/specs/003-rgd-detail-dag/
 */
export default function RGDDetail() {
  const { name } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get("tab")
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : "graph"

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

  // Build DAG graph once when RGD data loads (memoised — pure function, stable)
  const dagGraph = useMemo(() => {
    if (!rgd?.spec) return null
    return buildDAGGraph(rgd.spec as Record<string, unknown>)
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
            <div className="rgd-instances-placeholder">
              Instance list coming in spec 004.
            </div>
          </div>
        )}

        {activeTab === "yaml" && (
          <div className="rgd-tab-panel">
            <KroCodeBlock code={toYaml(rgd)} title="ResourceGraphDefinition" />
          </div>
        )}
      </div>
    </div>
  )
}
