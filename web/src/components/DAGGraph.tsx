// DAGGraph — pure SVG renderer for a DAGGraph data structure.
//
// Data-driven: accepts {nodes, edges} — zero kro-specific logic.
// All kro knowledge lives in web/src/lib/dag.ts.
// Fix #64: SVG height is fitted to actual node bounding box, not layout estimate.
// Fix #73: Portal tooltip on node hover shows ID, kind, type, includeWhen CEL.
// Spec 021: hover tooltip via shared DAGTooltip (portal, viewport-clamped);
//           readyWhen badge + section split in detail panel.
// Spec issue-575 (27.13): DAGScaleGuard wraps the SVG — graphs >100 nodes
//   show a text-mode fallback by default to prevent browser lock-up.

import { useState, useRef, useId } from 'react'
import type { DAGGraph, DAGNode } from '@/lib/dag'
// Issue #255: fittedHeight extracted to dag.ts alongside fittedWidth — no more duplication
import { nodeBadge, forEachLabel, fittedWidth, fittedHeight } from '@/lib/dag'
import DAGTooltip from './DAGTooltip'
import type { DAGTooltipTarget } from './DAGTooltip'
import DAGScaleGuard from './DAGScaleGuard'
import DAGMinimap from './DAGMinimap'
import './DAGGraph.css'

interface DAGGraphProps {
  graph: DAGGraph
  onNodeClick?: (nodeId: string) => void
  selectedNodeId?: string
}

/** Cubic bezier edge path from parent bottom-center to child top-center. */
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

/** CSS class for a node group based on nodeType. */
function nodeTypeClass(node: DAGNode): string {
  const base = `dag-node dag-node--${node.nodeType}`
  const cond = node.isConditional ? ' node-conditional' : ''
  return base + cond
}

/** Single DAG node rendered as SVG group. */
function NodeGroup({
  node,
  isSelected,
  onNodeClick,
  onHover,
  svgRef,
  onArrowKey,
}: {
  node: DAGNode
  isSelected: boolean
  onNodeClick?: (id: string) => void
  onHover: (target: DAGTooltipTarget | null) => void
  svgRef: React.RefObject<SVGSVGElement | null>
  onArrowKey?: (nodeId: string, direction: 'prev' | 'next') => void
}) {
  const badge = nodeBadge(node)
  const cx = node.x + node.width / 2
  // Fixed pixel offsets — safe for both 48px (resource) and 60px (collection) nodes.
  const labelY = node.y + 17
  const kindY = node.y + 32
  const forEachY = node.y + 45
  const badgeX = node.x + node.width - 10
  const badgeY = node.y + 10

  const className =
    nodeTypeClass(node) + (isSelected ? ' dag-node--selected' : '')

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
      onClick={() => onNodeClick?.(node.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNodeClick?.(node.id)
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
      {/* §XII / fix #86: suppress kind when it fell back to the nodeId (state nodes
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
    </g>
  )
}

/**
 * Build a screen-reader text alternative for a DAG graph.
 *
 * Format: "Resource graph: N node(s) — label1 (type1), label2 (type2)[, ...] — M connection(s)"
 * For large graphs (>8 nodes): summarise with counts only to avoid overwhelming the user.
 * WCAG 2.1 SC 1.1.1: provides a text alternative for the complex SVG image.
 */
export function buildDagDescription(graph: DAGGraph): string {
  const n = graph.nodes.length
  const e = graph.edges.length
  const nodeStr =
    n <= 8
      ? graph.nodes.map((nd) => `${nd.label} (${nd.nodeType})`).join(', ')
      : `${n} nodes`
  const edgeStr =
    e === 0 ? '' : `, ${e} connection${e === 1 ? '' : 's'}`
  return `Resource graph: ${n} node${n === 1 ? '' : 's'} — ${nodeStr}${edgeStr}`
}

/**
 * DAGGraph — renders a DAGGraph as inline SVG.
 *
 * Purely data-driven: no kro-specific knowledge. Pass any DAGGraph
 * produced by buildDAGGraph() (or a hand-crafted one for testing).
 */
export default function DAGGraph({
  graph,
  onNodeClick,
  selectedNodeId,
}: DAGGraphProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const svgHeight = fittedHeight(graph)
  const svgWidth = fittedWidth(graph)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredTooltip, setHoveredTooltip] = useState<DAGTooltipTarget | null>(null)
  const descId = useId()

  // Sorted node list for Arrow key navigation.
  // Sort by (y ASC, x ASC) — top-to-bottom, left-to-right (reading order).
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

  return (
    <DAGScaleGuard graph={graph}>
      <div className="dag-graph-container">
        {/* sr-only description — WCAG 2.1 SC 1.1.1: text alternative for the SVG graph */}
        <span id={descId} className="sr-only">
          {buildDagDescription(graph)}
        </span>
        <svg
        ref={svgRef}
        data-testid="dag-svg"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Resource dependency graph"
        aria-describedby={descId}
        role="img"
      >
        <defs>
          <marker
            id="dag-arrowhead"
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

        {/* Edges — rendered first so they appear behind nodes */}
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
                markerEnd="url(#dag-arrowhead)"
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
              isSelected={node.id === selectedNodeId}
              onNodeClick={onNodeClick}
              onHover={setHoveredTooltip}
              svgRef={svgRef}
              onArrowKey={handleArrowKey}
            />
          ))}
        </g>
      </svg>

      {/* Minimap — renders for graphs > DAG_MINIMAP_THRESHOLD nodes */}
      <DAGMinimap graph={graph} />

      <DAGTooltip
        node={hoveredTooltip?.node ?? null}
        anchorX={hoveredTooltip?.anchorX ?? 0}
        anchorY={hoveredTooltip?.anchorY ?? 0}
        nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
        nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
      />
    </div>
    </DAGScaleGuard>
  )
}
