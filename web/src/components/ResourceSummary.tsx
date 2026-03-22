// ResourceSummary.tsx — Node type breakdown and CEL cross-reference list.
//
// Computes the resource summary client-side from spec.resources using
// buildDAGGraph — the same logic as the Graph tab (FR-004).
// CEL cross-references are extracted from the DAG edges (FR-005).
//
// Spec: .specify/specs/017-rgd-validation-linting/ US2, FR-004, FR-005

import { useMemo } from 'react'
import { buildDAGGraph } from '@/lib/dag'

interface ResourceSummaryProps {
  /** The spec object of a kro RGD (rgd.spec). */
  spec: Record<string, unknown>
}

interface NodeCounts {
  total: number
  managed: number
  collections: number
  externalRefs: number
}

interface CELRef {
  from: string
  to: string
}

function computeSummary(spec: Record<string, unknown>): {
  counts: NodeCounts
  celRefs: CELRef[]
} {
  const graph = buildDAGGraph(spec)

  // Count node types (exclude the root 'schema' / 'instance' node)
  let managed = 0
  let collections = 0
  let externalRefs = 0

  for (const node of graph.nodes) {
    if (node.nodeType === 'instance') continue // skip root
    if (node.nodeType === 'resource') managed++
    else if (node.nodeType === 'collection') collections++
    else if (node.nodeType === 'external' || node.nodeType === 'externalCollection') externalRefs++
  }

  const total = managed + collections + externalRefs

  // CEL cross-references come from edges (dependency → dependent).
  // Exclude edges to/from the root 'schema' node that are implicit reachability
  // edges — they don't represent real CEL references. Real edges only exist
  // if the dependent node's template/externalRef actually referenced the source.
  // Since buildDAGGraph only adds schema→X edges for unreachable nodes, we
  // filter those out by checking if any node's celExpressions reference the
  // source.
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const celRefs: CELRef[] = []

  for (const edge of graph.edges) {
    const toNode = nodeById.get(edge.to)
    if (!toNode) continue
    // Only include edge if the target node actually references the source in CEL
    const allExprs = [
      ...toNode.celExpressions,
      ...toNode.includeWhen,
      ...toNode.readyWhen,
    ]
    const referencesSource = allExprs.some((expr) =>
      expr.includes(edge.from),
    )
    if (referencesSource) {
      celRefs.push({ from: edge.from, to: edge.to })
    }
  }

  return {
    counts: { total, managed, collections, externalRefs },
    celRefs,
  }
}

/**
 * ResourceSummary — shows node type breakdown and CEL cross-references.
 *
 * Spec: .specify/specs/017-rgd-validation-linting/ US2
 */
export default function ResourceSummary({ spec }: ResourceSummaryProps) {
  const { counts, celRefs } = useMemo(() => computeSummary(spec), [spec])

  return (
    <div className="resource-summary" data-testid="resource-summary">
      <div className="resource-summary__heading">Resource Summary</div>

      <div className="resource-summary__counts">
        <span className="resource-summary__total">
          {counts.total} resource{counts.total !== 1 ? 's' : ''}
        </span>
        <span className="resource-summary__breakdown">
          {counts.managed > 0 && (
            <span className="resource-summary__type resource-summary__type--managed">
              {counts.managed} managed
            </span>
          )}
          {counts.collections > 0 && (
            <span className="resource-summary__type resource-summary__type--collection">
              {counts.collections} collection{counts.collections !== 1 ? 's' : ''}
            </span>
          )}
          {counts.externalRefs > 0 && (
            <span className="resource-summary__type resource-summary__type--external">
              {counts.externalRefs} external ref{counts.externalRefs !== 1 ? 's' : ''}
            </span>
          )}
          {counts.total === 0 && (
            <span className="resource-summary__type resource-summary__type--empty">
              none
            </span>
          )}
        </span>
      </div>

      {celRefs.length > 0 && (
        <div className="resource-summary__refs">
          <div className="resource-summary__refs-heading">CEL Cross-References</div>
          <ul className="resource-summary__refs-list">
            {celRefs.map((ref, i) => (
              <li key={i} className="resource-summary__ref-item">
                <span className="resource-summary__ref-from">{ref.from}</span>
                <span className="resource-summary__ref-arrow" aria-hidden="true"> → </span>
                <span className="resource-summary__ref-to">{ref.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
