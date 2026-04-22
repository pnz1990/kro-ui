// LiveDAG.tsx — wraps DAGGraph with live state overlay and node click handling.
//
// Applies per-node CSS classes based on NodeStateMap, preserving the base
// DAGGraph layout (no re-layout on state change — FR-005).
//
// Spec 011 extension: collection nodes receive a CollectionBadge health overlay.
// Fix #64: SVG height is fitted to actual node bounding box.
// Fix #73 / Spec 021: hover tooltip via shared DAGTooltip (portal, viewport-clamped).
// Spec 021: readyWhen badge on nodes with hasReadyWhen.

import { useState, useRef } from 'react'
import type { DAGGraph, DAGNode } from '@/lib/dag'
// Issue #255: fittedHeight extracted to dag.ts alongside fittedWidth — no more duplication
import { nodeBadge, liveStateClass as liveStateClassHelper, forEachLabel, nodeStateForNode, fittedWidth, fittedHeight } from '@/lib/dag'
import type { NodeStateMap, NodeLiveState } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import CollectionBadge from './CollectionBadge'
import DAGTooltip from './DAGTooltip'
import DAGLegend from './DAGLegend'
import type { DAGTooltipTarget } from './DAGTooltip'
import './LiveDAG.css'

interface LiveDAGProps {
  graph: DAGGraph
  nodeStateMap: NodeStateMap
  onNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
  /** Collection children — used to render health badges on forEach nodes. */
  children?: K8sObject[]
}

// ── CSS class helper ───────────────────────────────────────────────────────

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
  if (state) parts.push(liveStateClassHelper(state))
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}

// ── Node component ─────────────────────────────────────────────────────────

interface NodeGroupProps {
  node: DAGNode
  state: NodeLiveState | undefined
  isSelected: boolean
  onNodeClick?: (node: DAGNode) => void
  onHover: (target: DAGTooltipTarget | null) => void
  svgRef: React.RefObject<SVGSVGElement | null>
  /** Pre-filtered children for collection badge (only passed for collection nodes). */
  children?: K8sObject[]
  /** Arrow key navigation callback (prev/next in reading order). */
  onArrowKey?: (nodeId: string, direction: 'prev' | 'next') => void
}

function NodeGroup({ node, state, isSelected, onNodeClick, onHover, svgRef, children, onArrowKey }: NodeGroupProps) {
  const badge = nodeBadge(node)
  const cx = node.x + node.width / 2
  // Fixed pixel offsets — safe for both 48px (resource) and 60px (collection) nodes.
  const labelY = node.y + 17
  const kindY = node.y + 32
  const forEachY = node.y + 45
  const badgeX = node.x + node.width - 10
  const badgeY = node.y + 10

  const className = nodeClassName(node, state, isSelected)

  function handleMouseEnter() {
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    onHover({
      node,
      anchorX: svgRect.left + node.x,
      anchorY: svgRect.top + node.y,
      nodeWidth: node.width,
      nodeHeight: node.height,
    })
  }

  return (
    <g
      data-testid={`dag-node-${node.id}`}
      className={className}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} (${node.nodeType})`}
      aria-pressed={isSelected}
      onClick={() => onNodeClick?.(node)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNodeClick?.(node)
        } else if (
          e.key === 'ArrowRight' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowUp'
        ) {
          e.preventDefault()
          const direction =
            e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 'next' : 'prev'
          onArrowKey?.(node.id, direction)
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
      {/* §XII / fix #147: suppress kind when it fell back to the nodeId (state nodes
          with no template). Showing the same string twice adds no information. */}
      {node.kind && node.kind !== node.id && (
        <text className="dag-node-kind" x={cx} y={kindY}>
          {node.kind}
        </text>
      )}
      {forEachLabel(node.forEach) && (
        <text
          data-testid={`dag-node-foreach-${node.id}`}
          className="dag-node-foreach"
          x={cx}
          y={forEachY}
          aria-label={`forEach: ${node.forEach}`}
        >
          <title>{node.forEach}</title>
          {forEachLabel(node.forEach)}
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
      {node.hasReadyWhen && (
        <text
          className="dag-node-badge dag-node-badge--ready-when"
          x={node.x + 10}
          y={node.y + node.height - 8}
          aria-label="has readyWhen condition"
        >
          ⧖
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
  const svgWidth = fittedWidth(graph)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredTooltip, setHoveredTooltip] = useState<DAGTooltipTarget | null>(null)

  // Sorted node list for Arrow key navigation (y ASC, x ASC — reading order).
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  function handleArrowKey(nodeId: string, direction: 'prev' | 'next') {
    const idx = sortedNodes.findIndex((n) => n.id === nodeId)
    if (idx === -1) return
    const nextIdx =
      direction === 'next'
        ? Math.min(idx + 1, sortedNodes.length - 1)
        : Math.max(idx - 1, 0)
    const targetId = sortedNodes[nextIdx]?.id
    if (!targetId || targetId === nodeId) return
    const el = svgRef.current?.querySelector<SVGGElement>(
      `[data-testid="dag-node-${targetId}"]`,
    )
    el?.focus()
  }
  // Debounced hide — gives cursor time to travel from node to tooltip. Issue #188.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleTooltipHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setHoveredTooltip(null), 150)
  }

  function cancelTooltipHide() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  return (
    <div className="dag-graph-container live-dag-container">
      <svg
        ref={svgRef}
        data-testid="dag-svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
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
              state={nodeStateForNode(node, nodeStateMap)}
              isSelected={node.id === selectedNodeId}
              onNodeClick={onNodeClick}
              onHover={(target) => {
                if (target) { cancelTooltipHide(); setHoveredTooltip(target) }
                else { scheduleTooltipHide() }
              }}
              svgRef={svgRef}
              children={node.nodeType === 'collection' ? children : undefined}
              onArrowKey={handleArrowKey}
            />
          ))}
        </g>
      </svg>

      <DAGTooltip
        node={hoveredTooltip?.node ?? null}
        anchorX={hoveredTooltip?.anchorX ?? 0}
        anchorY={hoveredTooltip?.anchorY ?? 0}
        nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
        nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
        nodeState={
          hoveredTooltip?.node
            ? nodeStateForNode(hoveredTooltip.node, nodeStateMap)
            : undefined
        }
        onTooltipMouseEnter={cancelTooltipHide}
        onTooltipMouseLeave={scheduleTooltipHide}
      />

      {/* Node-type badge legend (L-1) */}
      <DAGLegend />

      {/* Live-state legend (L-2, issue #167) */}
      <div className="live-dag-state-legend" aria-label="Live node state legend">
        <span className="live-dag-state-legend__entry" title="Resource exists and all readyWhen conditions are met">
          <span className="live-dag-state-legend__dot live-dag-state-legend__dot--alive" aria-hidden="true" />
          Alive
        </span>
        <span className="live-dag-state-legend__entry" title="kro is applying the resource template, or readyWhen is not yet satisfied">
          <span className="live-dag-state-legend__dot live-dag-state-legend__dot--reconciling" aria-hidden="true" />
          Reconciling
        </span>
        <span className="live-dag-state-legend__entry" title="Resource was not created because its includeWhen condition evaluated to false">
          <span className="live-dag-state-legend__dot live-dag-state-legend__dot--pending" aria-hidden="true" />
          Excluded
        </span>
        <span className="live-dag-state-legend__entry" title="Resource has a failed condition (e.g. Available=False or Ready=False)">
          <span className="live-dag-state-legend__dot live-dag-state-legend__dot--error" aria-hidden="true" />
          Error
        </span>
        <span className="live-dag-state-legend__entry" title="Resource not yet present in the cluster — kro may still be creating it">
          <span className="live-dag-state-legend__dot live-dag-state-legend__dot--notfound" aria-hidden="true" />
          Not found
        </span>
      </div>
    </div>
  )
}
