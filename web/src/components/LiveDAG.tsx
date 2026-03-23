// LiveDAG.tsx — wraps DAGGraph with live state overlay and node click handling.
//
// Applies per-node CSS classes based on NodeStateMap, preserving the base
// DAGGraph layout (no re-layout on state change — FR-005).
//
// Spec 011 extension: collection nodes receive a CollectionBadge health overlay.
// Fix #64: SVG height is fitted to actual node bounding box.
// Fix #73: Portal tooltip on node hover shows ID, kind, type, live state.

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DAGGraph, DAGNode } from '@/lib/dag'
import type { NodeStateMap, NodeLiveState, NodeStateEntry } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import { tokenize } from '@/lib/highlighter'
import { nodeTypeLabel, tokenClass } from '@/lib/dagTooltip'
import CollectionBadge from './CollectionBadge'
import './LiveDAG.css'

const PADDING = 32

/** Compute the actual content height from node bounding boxes (issue #64). */
function fittedHeight(graph: DAGGraph): number {
  if (graph.nodes.length === 0) return graph.height
  const maxBottom = Math.max(...graph.nodes.map((n) => n.y + n.height))
  return maxBottom + PADDING
}

interface LiveDAGProps {
  graph: DAGGraph
  nodeStateMap: NodeStateMap
  onNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
  /** Collection children — used to render health badges on forEach nodes. */
  children?: K8sObject[]
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

/** Look up the full NodeStateEntry for a node (used for tooltip). */
function nodeEntry(
  node: DAGNode,
  stateMap: NodeStateMap,
): NodeStateEntry | undefined {
  if (node.nodeType === 'instance') return undefined
  const kindKey = (node.kind || node.label).toLowerCase()
  return stateMap[kindKey]
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

/** Human-readable live state label. */
function liveStateLabel(state: NodeLiveState | undefined): string {
  if (!state) return 'Not reported'
  switch (state) {
    case 'alive':       return 'Alive'
    case 'reconciling': return 'Reconciling'
    case 'error':       return 'Error'
    case 'not-found':   return 'Not found'
  }
}

/** CSS modifier class for state label colour. */
function stateLabelClass(state: NodeLiveState | undefined): string {
  if (!state) return 'dag-tooltip__state--notfound'
  switch (state) {
    case 'alive':       return 'dag-tooltip__state--alive'
    case 'reconciling': return 'dag-tooltip__state--reconciling'
    case 'error':       return 'dag-tooltip__state--error'
    case 'not-found':   return 'dag-tooltip__state--notfound'
  }
}

// ── Tooltip ────────────────────────────────────────────────────────────────

interface TooltipState {
  node: DAGNode
  state: NodeLiveState | undefined
  entry: NodeStateEntry | undefined
  x: number
  y: number
}

function LiveDagTooltip({ state }: { state: TooltipState }) {
  const { node, state: liveState, entry, x, y } = state
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 })

  useEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x + 12
    let top = y + 12
    if (left + width > vw - 8) left = x - width - 12
    if (top + height > vh - 8) top = y - height - 12
    setPos({ left, top })
  }, [x, y])

  const tokens = node.includeWhen.length > 0
    ? tokenize(node.includeWhen.join(' && '))
    : null

  return createPortal(
    <div
      ref={ref}
      className="dag-tooltip"
      role="tooltip"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="dag-tooltip__id">{node.id}</div>
      <div className="dag-tooltip__row">
        <span className="dag-tooltip__label">Kind</span>
        <span className="dag-tooltip__value dag-tooltip__value--mono">
          {node.kind || node.id}
        </span>
      </div>
      <div className="dag-tooltip__row">
        <span className="dag-tooltip__label">Type</span>
        <span className="dag-tooltip__value">{nodeTypeLabel(node.nodeType)}</span>
      </div>
      <div className="dag-tooltip__row">
        <span className="dag-tooltip__label">State</span>
        <span className={`dag-tooltip__value dag-tooltip__state ${stateLabelClass(liveState)}`}>
          {liveStateLabel(liveState)}
        </span>
      </div>
      {entry && entry.name && (
        <div className="dag-tooltip__row">
          <span className="dag-tooltip__label">Name</span>
          <span className="dag-tooltip__value dag-tooltip__value--mono">
            {entry.namespace ? `${entry.namespace}/${entry.name}` : entry.name}
          </span>
        </div>
      )}
      {tokens && (
        <div className="dag-tooltip__cel">
          <span className="dag-tooltip__label">includeWhen</span>
          <span className="dag-tooltip__cel-code">
            {tokens.map((tok, i) => (
              <span key={i} className={tokenClass(tok.type)}>
                {tok.text}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ── Node component ─────────────────────────────────────────────────────────

interface NodeGroupProps {
  node: DAGNode
  state: NodeLiveState | undefined
  isSelected: boolean
  onNodeClick?: (node: DAGNode) => void
  onNodeHover?: (node: DAGNode | null, x: number, y: number) => void
  /** Pre-filtered children for collection badge (only passed for collection nodes). */
  children?: K8sObject[]
}

function NodeGroup({ node, state, isSelected, onNodeClick, onNodeHover, children }: NodeGroupProps) {
  const badge = nodeBadge(node)
  const cx = node.x + node.width / 2
  const labelY = node.y + node.height / 2 - (node.kind ? 7 : 0)
  const kindY = node.y + node.height / 2 + 8
  const badgeX = node.x + node.width - 10
  const badgeY = node.y + 10

  const className = nodeClassName(node, state, isSelected)

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => onNodeHover?.(node, e.clientX, e.clientY),
    [node, onNodeHover],
  )
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => onNodeHover?.(node, e.clientX, e.clientY),
    [node, onNodeHover],
  )
  const handleMouseLeave = useCallback(
    () => onNodeHover?.(null, 0, 0),
    [onNodeHover],
  )

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
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
      {node.nodeType === 'collection' && children && children.length > 0 && (
        <CollectionBadge
          nodeId={node.id}
          children={children}
          nodeX={node.x}
          nodeY={node.y}
          nodeWidth={node.width}
          nodeHeight={node.height}
        />
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
  children,
}: LiveDAGProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const svgHeight = fittedHeight(graph)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const handleNodeHover = useCallback(
    (node: DAGNode | null, x: number, y: number) => {
      if (node === null) {
        setTooltip(null)
      } else {
        setTooltip({
          node,
          state: nodeState(node, nodeStateMap),
          entry: nodeEntry(node, nodeStateMap),
          x,
          y,
        })
      }
    },
    [nodeStateMap],
  )

  return (
    <div className="dag-graph-container live-dag-container">
      <svg
        data-testid="dag-svg"
        width={graph.width}
        height={svgHeight}
        viewBox={`0 0 ${graph.width} ${svgHeight}`}
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
              onNodeHover={handleNodeHover}
              children={node.nodeType === 'collection' ? children : undefined}
            />
          ))}
        </g>
      </svg>

      {tooltip && <LiveDagTooltip state={tooltip} />}
    </div>
  )
}
