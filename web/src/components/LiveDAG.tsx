// LiveDAG.tsx — wraps DAGGraph with live state overlay and node click handling.
//
// Applies per-node CSS classes based on NodeStateMap, preserving the base
// DAGGraph layout (no re-layout on state change — FR-005).

import type { DAGGraph, DAGNode } from '@/lib/dag'
import type { NodeStateMap, NodeLiveState } from '@/lib/instanceNodeState'
import './LiveDAG.css'

interface LiveDAGProps {
  graph: DAGGraph
  nodeStateMap: NodeStateMap
  onNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
}

// ── CSS class helper ───────────────────────────────────────────────────────

function liveStateClass(state: NodeLiveState | undefined): string {
  if (!state) return 'dag-node-live--notfound'
  switch (state) {
    case 'alive':       return 'dag-node-live--alive'
    case 'reconciling': return 'dag-node-live--reconciling'
    case 'error':       return 'dag-node-live--error'
    case 'not-found':   return 'dag-node-live--notfound'
  }
}

/** Look up the live state for a node by its kind (case-insensitive). */
function nodeState(
  node: DAGNode,
  stateMap: NodeStateMap,
): NodeLiveState | undefined {
  // Root CR (instance node) — derive state from the map's first 'reconciling' or 'error' entry
  // The root state reflects the overall instance condition
  if (node.nodeType === 'instance') {
    // Look for any reconciling entry — if found, root is reconciling too
    const states = Object.values(stateMap).map((e) => e.state)
    if (states.includes('reconciling')) return 'reconciling'
    if (states.includes('error')) return 'error'
    if (states.length > 0) return 'alive'
    return undefined
  }

  // Resource nodes — look up by kind
  const kindKey = (node.kind || node.label).toLowerCase()
  const entry = stateMap[kindKey]
  return entry?.state
}

/** Edge path: cubic bezier from parent bottom-center to child top-center. */
function edgePath(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): string {
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height
  const x2 = to.x + to.width / 2
  const y2 = to.y
  const dy = Math.max((y2 - y1) * 0.4, 20)
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`
}

/** Badge character per node type. */
function nodeBadge(node: DAGNode): string | null {
  if (node.isConditional) return '?'
  switch (node.nodeType) {
    case 'collection':          return '∀'
    case 'external':
    case 'externalCollection':  return '⬡'
    default:                    return null
  }
}

/** CSS class for node group: base type + conditional + live state + selected. */
function nodeClassName(
  node: DAGNode,
  state: NodeLiveState | undefined,
  isSelected: boolean,
): string {
  const parts = [
    'dag-node',
    `dag-node--${node.nodeType}`,
  ]
  if (node.isConditional) parts.push('node-conditional')
  if (state) parts.push(liveStateClass(state))
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}

// ── Node component ─────────────────────────────────────────────────────────

interface NodeGroupProps {
  node: DAGNode
  state: NodeLiveState | undefined
  isSelected: boolean
  onNodeClick?: (node: DAGNode) => void
}

function NodeGroup({ node, state, isSelected, onNodeClick }: NodeGroupProps) {
  const badge = nodeBadge(node)
  const cx = node.x + node.width / 2
  const labelY = node.y + node.height / 2 - (node.kind ? 7 : 0)
  const kindY = node.y + node.height / 2 + 8
  const badgeX = node.x + node.width - 10
  const badgeY = node.y + 10

  const className = nodeClassName(node, state, isSelected)

  return (
    <g
      data-testid={`dag-node-${node.id}`}
      className={className}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} (${node.nodeType})`}
      aria-pressed={isSelected}
      onClick={() => onNodeClick?.(node)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNodeClick?.(node)
        }
      }}
    >
      <rect
        className="dag-node-rect"
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
      />
      <text className="dag-node-label" x={cx} y={labelY}>
        {node.label}
      </text>
      {node.kind && (
        <text className="dag-node-kind" x={cx} y={kindY}>
          {node.kind}
        </text>
      )}
      {badge && (
        <text
          className={`dag-node-badge dag-node-badge--${
            node.isConditional ? 'conditional'
            : node.nodeType === 'collection' ? 'collection'
            : 'external'
          }`}
          x={badgeX}
          y={badgeY}
        >
          {badge}
        </text>
      )}
    </g>
  )
}

// ── LiveDAG ────────────────────────────────────────────────────────────────

/**
 * LiveDAG — renders the DAG with live node state overlay colors.
 *
 * Node positions are computed once from the RGD spec and never change
 * (FR-005). Only CSS classes are updated on each poll cycle.
 *
 * Spec: .specify/specs/005-instance-detail-live/
 */
export default function LiveDAG({
  graph,
  nodeStateMap,
  onNodeClick,
  selectedNodeId,
}: LiveDAGProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  return (
    <div className="dag-graph-container live-dag-container">
      <svg
        data-testid="dag-svg"
        width={graph.width}
        height={graph.height}
        viewBox={`0 0 ${graph.width} ${graph.height}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Live resource dependency graph"
        role="img"
      >
        <defs>
          <marker
            id="live-dag-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 1 L 9 5 L 0 9 z"
              style={{ fill: 'var(--color-border)' }}
            />
          </marker>
        </defs>

        {/* Edges — rendered behind nodes */}
        <g aria-hidden="true">
          {graph.edges.map((edge) => {
            const fromNode = nodeMap.get(edge.from)
            const toNode = nodeMap.get(edge.to)
            if (!fromNode || !toNode) return null
            return (
              <path
                key={`${edge.from}→${edge.to}`}
                className="dag-edge"
                d={edgePath(fromNode, toNode)}
                markerEnd="url(#live-dag-arrowhead)"
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {graph.nodes.map((node) => (
            <NodeGroup
              key={node.id}
              node={node}
              state={nodeState(node, nodeStateMap)}
              isSelected={node.id === selectedNodeId}
              onNodeClick={onNodeClick}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
