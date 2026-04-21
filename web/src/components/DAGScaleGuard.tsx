// DAGScaleGuard — wraps DAGGraph/StaticChainDAG to protect against rendering
// very large graphs (>100 nodes) that can lock up the browser.
//
// Design ref: docs/design/27-stage3-kro-tracking.md §Future 27.13
//
// When graph.nodes.length > DAG_SCALE_THRESHOLD:
//   1. Default view: text-mode list grouped by node type
//   2. Banner: explains why the graph is hidden + node count
//   3. Toggle button: "Show graph (N nodes — may be slow)"
//
// When graph.nodes.length ≤ DAG_SCALE_THRESHOLD:
//   Renders children directly (no overhead for normal-sized graphs).

import { useState } from 'react'
import type { DAGGraph } from '@/lib/dag'
import { NODE_TYPE_LABEL } from '@/lib/dag'
import './DAGScaleGuard.css'

/** Threshold above which the scale guard activates. */
export const DAG_SCALE_THRESHOLD = 100

interface DAGScaleGuardProps {
  /** The graph to guard. If nodes.length ≤ threshold, renders children. */
  graph: DAGGraph
  /** The full graph renderer — rendered when guard is inactive or overridden. */
  children: React.ReactNode
}

/** Text-mode node list — grouped by nodeType, each row shows id + kind. */
function NodeTextList({ graph }: { graph: DAGGraph }) {
  // Group nodes by nodeType for readability
  const groups = new Map<string, typeof graph.nodes>()
  for (const node of graph.nodes) {
    const key = NODE_TYPE_LABEL[node.nodeType] ?? String(node.nodeType)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(node)
  }

  return (
    <div className="dag-scale-list" role="list" aria-label="Resource node list">
      {[...groups.entries()].map(([label, nodes]) => (
        <div key={label} className="dag-scale-list__group">
          <div className="dag-scale-list__group-header">
            {label} <span className="dag-scale-list__count">({nodes.length})</span>
          </div>
          {nodes.map((node) => (
            <div
              key={node.id}
              className="dag-scale-list__row"
              role="listitem"
            >
              <span className="dag-scale-list__id">{node.id}</span>
              {node.kind && node.kind !== node.id && (
                <span className="dag-scale-list__kind">{node.kind}</span>
              )}
              {node.isConditional && (
                <span
                  className="dag-scale-list__badge"
                  aria-label="conditional node"
                  title="Only included when includeWhen condition is true"
                >
                  ?
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * DAGScaleGuard — wraps a DAG renderer with a scale protection fallback.
 *
 * For graphs with ≤ DAG_SCALE_THRESHOLD nodes: renders children directly.
 * For graphs with > DAG_SCALE_THRESHOLD nodes: shows text list with toggle.
 */
export default function DAGScaleGuard({ graph, children }: DAGScaleGuardProps) {
  const [showGraph, setShowGraph] = useState(false)
  const nodeCount = graph.nodes.length

  // Small graph — pass through without overhead
  if (nodeCount <= DAG_SCALE_THRESHOLD) {
    return <>{children}</>
  }

  return (
    <div className="dag-scale-guard">
      <div className="dag-scale-guard__banner" role="status">
        <span className="dag-scale-guard__icon" aria-hidden="true">⚠</span>
        <span className="dag-scale-guard__message">
          This RGD has <strong>{nodeCount} nodes</strong>.
          Graph view may be slow — showing text list.
        </span>
        <button
          type="button"
          className="dag-scale-guard__toggle"
          onClick={() => setShowGraph((v) => !v)}
          aria-expanded={showGraph}
        >
          {showGraph
            ? 'Show text list'
            : `Show graph (${nodeCount} nodes — may be slow)`}
        </button>
      </div>

      {showGraph ? children : <NodeTextList graph={graph} />}
    </div>
  )
}
