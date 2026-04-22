// StaticChainDAG.tsx — Static RGD detail DAG with chain detection affordances.
//
// Renders the RGD detail Graph tab with two additional affordances on nodes
// whose kind matches another RGD's spec.schema.kind ("chainable" nodes):
//
//   1. ▸/▾ expand toggle — inlines the chained RGD's own static DAG as a
//      nested subgraph. Synchronous (data from already-loaded RGD specs).
//   2. "View RGD →" link — navigates to the chained RGD's detail page with
//      a breadcrumb back.
//
// Visual distinction from spec 012 DeepDAG:
//   - Static expand toggle: .static-chain-expand-toggle (fill: --color-chain-text, teal)
//   - Live expand toggle:    .deep-dag-expand-toggle    (fill: --color-text-muted, grey)
//   - "View RGD →" link:     .static-chain-view-link    (color: --color-primary, blue)
//
// Cycle detection: ancestorSet (ReadonlySet<string> of RGD names already in the
// current expand path) is threaded through recursive renders. If a chainable
// node's chainedRgdName is in ancestorSet, a ⊗ Cycle indicator replaces the
// expand toggle.
//
// Max depth: depth >= 4 → MaxDepth indicator, no expand toggle.
//
// Spec: .specify/specs/025-rgd-static-chain-graph/

import { useState, useMemo, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DAGGraph, DAGNode } from '@/lib/dag'
import { buildChainSubgraph, nodeBadge, forEachLabel, liveStateClass, nodeStateForNode } from '@/lib/dag'
import type { NodeStateMap, NodeLiveState } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'
import DAGTooltip from './DAGTooltip'
import type { DAGTooltipTarget } from './DAGTooltip'
import DAGLegend from './DAGLegend'
import DAGScaleGuard from './DAGScaleGuard'
import { buildDagDescription } from './DAGGraph'
import './StaticChainDAG.css'

// ── Types ─────────────────────────────────────────────────────────────────

export interface StaticChainDAGProps {
  /** The static DAG graph (built from RGD spec with chain detection). */
  graph: DAGGraph
  /** All known RGDs — needed to build nested subgraphs on expand. */
  rgds: K8sObject[]
  /** Called when any node (top-level or nested) is clicked for inspection. */
  onNodeClick?: (nodeId: string) => void
  /** ID of the currently selected/highlighted node. */
  selectedNodeId?: string
  /** RGD names already in the current expansion path — for cycle detection. */
  ancestorSet?: ReadonlySet<string>
  /**
   * Current recursion depth. 0 = top level.
   * At depth >= 4, chainable nodes show max-depth indicator instead of toggle.
   */
  depth?: number
  /** Name of the RGD being displayed (used to seed ancestorSet at top level). */
  rgdName: string
  /**
   * Optional live instance overlay. When provided, nodes receive live-state
   * CSS classes (dag-node-live--alive, dag-node-live--reconciling, etc.).
   * State nodes (nodeType 'state') are never overlaid.
   * Nested subgraph renders do NOT receive this prop (overlay is top-level only).
   * Spec: .specify/specs/029-dag-instance-overlay/
   */
  nodeStateMap?: NodeStateMap
}

// ── Layout constants ──────────────────────────────────────────────────────

const NESTED_HEADER_HEIGHT = 32
const NESTED_PADDING_BOTTOM = 8
const NESTED_MIN_WIDTH = 280
const AFFORDANCE_WIDTH = 90   // width reserved for "View RGD →" link foreignObject
const AFFORDANCE_HEIGHT = 20
const MAX_DEPTH = 4

// ── Helpers ───────────────────────────────────────────────────────────────

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

function nodeBaseClass(
  node: DAGNode,
  isSelected: boolean,
  liveState?: NodeLiveState,
  overlayActive?: boolean,
): string {
  const parts = [`dag-node dag-node--${node.nodeType}`]
  if (node.isConditional) parts.push('node-conditional')
  if (node.isChainable) parts.push('node-chainable')
  // When overlay is active, always push a live-state class for non-state nodes.
  // liveStateClass(undefined) → 'dag-node-live--notfound' — this is intentional:
  // a node absent from the children list should render as notfound, not unstyled.
  // A plain `if (liveState)` guard would silently drop absent nodes (GH #165).
  if (overlayActive && node.nodeType !== 'state') parts.push(liveStateClass(liveState))
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}

// ── NestedSubgraph ────────────────────────────────────────────────────────

/**
 * NestedSubgraph — renders the expanded subgraph for a chainable node.
 * Handles cycle detection, max depth, not-found, and valid subgraphs.
 */
function NestedSubgraph({
  node,
  rgds,
  ancestorSet,
  depth,
  rgdName,
  onNodeClick,
  selectedNodeId,
}: {
  node: DAGNode
  rgds: K8sObject[]
  ancestorSet: ReadonlySet<string>
  depth: number
  rgdName: string
  onNodeClick?: (nodeId: string) => void
  selectedNodeId?: string
}) {
  const chainedName = node.chainedRgdName!

  // Cycle check
  if (ancestorSet.has(chainedName)) {
    return (
      <div className="static-chain-nested-container">
        <div className="static-chain-nested-header">
          <span className="static-chain-nested-header-kind">{node.kind}</span>
        </div>
        <div
          className="static-chain-cycle-indicator"
          data-testid={`static-chain-cycle-${node.id}`}
          role="alert"
        >
          ⊗ Cycle detected
        </div>
      </div>
    )
  }

  // Max depth check
  if (depth >= MAX_DEPTH) {
    return (
      <div className="static-chain-nested-container">
        <div className="static-chain-nested-header">
          <span className="static-chain-nested-header-kind">{node.kind}</span>
        </div>
        <div
          className="static-chain-maxdepth"
          data-testid={`static-chain-maxdepth-${node.id}`}
        >
          ⋯ Max depth
        </div>
      </div>
    )
  }

  const subgraph = buildChainSubgraph(chainedName, rgds)

  if (!subgraph) {
    return (
      <div className="static-chain-nested-container">
        <div className="static-chain-nested-header">
          <span className="static-chain-nested-header-kind">{node.kind}</span>
        </div>
        <div className="static-chain-not-found" role="alert" data-testid="static-chain-not-found">
          Chained RGD &apos;{chainedName}&apos; not found in this cluster — it may have been deleted or not yet applied.
        </div>
      </div>
    )
  }

  const newAncestors = new Set([...ancestorSet, rgdName])

  return (
    <div className="static-chain-nested-container">
      <div className="static-chain-nested-header">
        <span>▾</span>
        <span>{chainedName}</span>
        <span className="static-chain-nested-header-kind">{node.kind}</span>
      </div>
      <StaticChainDAG
        graph={subgraph}
        rgds={rgds}
        onNodeClick={onNodeClick}
        selectedNodeId={selectedNodeId}
        ancestorSet={newAncestors}
        depth={depth + 1}
        rgdName={chainedName}
      />
    </div>
  )
}

// ── StaticChainDAG ────────────────────────────────────────────────────────

/**
 * StaticChainDAG — renders the RGD detail static DAG with chain affordances.
 *
 * Drop-in replacement for <DAGGraph> on the RGD detail Graph tab.
 * Visually identical for non-chainable nodes; adds teal ring + expand/nav
 * affordances on chainable nodes.
 *
 * Spec: .specify/specs/025-rgd-static-chain-graph/
 */
export default function StaticChainDAG({
  graph,
  rgds,
  onNodeClick,
  selectedNodeId,
  ancestorSet,
  depth = 0,
  rgdName,
  nodeStateMap,
}: StaticChainDAGProps) {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const descId = useId()
  const [hoveredTooltip, setHoveredTooltip] = useState<(DAGTooltipTarget & { nodeState?: NodeLiveState }) | null>(null)
  // Debounced hide: gives the cursor time to travel from the node to the tooltip.
  // Issue #188 — without this, onMouseLeave fires before the cursor reaches the tooltip.
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

  // ── Expansion state ────────────────────────────────────────────────────
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set())

  // Accordion: only one subgraph open at a time — prevents layout overlap.
  // Clicking an already-open node collapses it; clicking a different node
  // closes the previously-open one and opens the new one.
  function handleToggle(nodeId: string) {
    setExpandedNodes((prev) =>
      prev.has(nodeId) ? new Set() : new Set([nodeId])
    )
  }

  // ── Effective ancestor set — seed with current rgdName at top level ───
  const effectiveAncestors = useMemo(
    () => ancestorSet ?? new Set([rgdName]),
    [ancestorSet, rgdName],
  )

  // ── Node map for edge rendering ────────────────────────────────────────
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  )

  // ── SVG height accounting for expanded subgraphs ─────────────────────
  // Use graph.height directly — this is the authoritative height from the
  // Dagre layout and is stable across re-renders. Do NOT recompute from
  // graph.nodes[*].y because that produces the same value in theory but
  // creates a dependency on mutable node coordinates that can be inflated
  // by the DOM layout when InstanceOverlayBar is a flex sibling. Issue #183.
  const baseHeight = graph.height
  // Sum the height of all expanded panels rather than taking the max.
  // When two nodes on the same DAG row are both expanded, their panels are
  // both rendered below that row — we need space for all of them, not just
  // the tallest one. Issue #204.
  const extraHeight = useMemo(() => {
    let extra = 0
    for (const nodeId of expandedNodes) {
      const node = nodeMap.get(nodeId)
      if (!node || !node.isChainable) continue
      const chainedName = node.chainedRgdName
      if (!chainedName) continue
      let nestedH: number
      if (effectiveAncestors.has(chainedName) || depth >= MAX_DEPTH) {
        nestedH = 60 + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
      } else {
        const sub = buildChainSubgraph(chainedName, rgds)
        nestedH = sub
          ? sub.height + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
          : 60 + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
      }
      // Accumulate: sum all expansions (each occupies vertical space below its node).
      extra += nestedH + 8
    }
    return extra
  }, [expandedNodes, nodeMap, effectiveAncestors, depth, rgds])

  const svgHeight = baseHeight + Math.max(0, extraHeight)

  // Sorted node list for Arrow key navigation (y ASC, x ASC — reading order).
  const sortedNodes = useMemo(
    () => [...graph.nodes].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x)),
    [graph.nodes],
  )

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
    <div className="dag-graph-container static-chain-dag-container">
      {/* sr-only description — WCAG 2.1 SC 1.1.1: text alternative for the SVG graph */}
      <span id={descId} className="sr-only">
        {buildDagDescription(graph)}
      </span>
      <svg
        ref={svgRef}
        data-testid="dag-svg"
        width={graph.width}
        height={svgHeight}
        viewBox={`0 0 ${graph.width} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Resource dependency graph"
        aria-describedby={descId}
        role="img"
      >
        <defs>
          <marker
            id={`static-chain-arrowhead-${depth}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" style={{ fill: 'var(--color-border)' }} />
          </marker>
        </defs>

        {/* Edges */}
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
                markerEnd={`url(#static-chain-arrowhead-${depth})`}
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {graph.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId
            const badge = nodeBadge(node)
            const cx = node.x + node.width / 2
            // Fixed pixel offsets — safe for both 48px (resource) and 60px (collection) nodes.
            const labelY = node.y + 17
            const kindY = node.y + 32
            const forEachY = node.y + 45
            const badgeX = node.x + node.width - 10
            const badgeY = node.y + 10
            // Overlay: resolve live state for this node (state nodes are never overlaid)
            const liveState = nodeStateMap && node.nodeType !== 'state'
              ? nodeStateForNode(node, nodeStateMap)
              : undefined
            const className = nodeBaseClass(node, isSelected, liveState, !!nodeStateMap)

            const isExpanded = expandedNodes.has(node.id)
            const canExpand = node.isChainable && depth < MAX_DEPTH
            const isCycle = node.isChainable &&
              node.chainedRgdName !== undefined &&
              effectiveAncestors.has(node.chainedRgdName)

            // Toggle position — top-right corner
            const toggleX = node.x + node.width - 8
            const toggleY = node.y + 10

            // Nested subgraph foreignObject dimensions.
            // Clamp nestedX so the panel never overflows the SVG left or right edge. Issue #204.
            const nestedWidth = Math.max(NESTED_MIN_WIDTH, graph.width)
            const rawNestedX = node.x + node.width / 2 - nestedWidth / 2
            const nestedX = Math.max(0, Math.min(rawNestedX, graph.width - nestedWidth))
            const nestedY = node.y + node.height + 8

            // "View RGD →" link foreignObject position
            // Placed just below the node's kind label, right-aligned
            const linkX = node.x + node.width - AFFORDANCE_WIDTH - 4
            const linkY = node.y + node.height - AFFORDANCE_HEIGHT - 4

            return (
              <g key={node.id}>
                {/* ── Main node group ─────────────────────────────────── */}
                <g
                  data-testid={`dag-node-${node.id}`}
                  className={className}
                  tabIndex={0}
                  role="button"
                  aria-label={`${node.label} (${node.nodeType})${node.isChainable ? ', chainable' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => onNodeClick?.(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onNodeClick?.(node.id)
                    } else if (
                      e.key === 'ArrowRight' || e.key === 'ArrowDown' ||
                      e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                    ) {
                      e.preventDefault()
                      handleArrowKey(node.id, e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 'next' : 'prev')
                    }
                  }}
                  onMouseEnter={() => {
                    if (!svgRef.current) return
                    const svgRect = svgRef.current.getBoundingClientRect()
                    cancelTooltipHide()
                    setHoveredTooltip({
                      node,
                      anchorX: svgRect.left + node.x + node.width / 2,
                      anchorY: svgRect.top + node.y,
                      nodeWidth: node.width,
                      nodeHeight: node.height,
                      nodeState: liveState,
                    })
                  }}
                  onMouseLeave={scheduleTooltipHide}
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
                  {/* §XII / fix #86: suppress kind when it fell back to the nodeId */}
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
                </g>

                {/* ── Static expand toggle (teal ▸/▾) ─────────────────── */}
                {/* Shown when chainable AND depth < 4 AND no cycle */}
                {node.isChainable && canExpand && !isCycle && (
                  <g
                    data-testid={`static-chain-toggle-${node.id}`}
                    tabIndex={0}
                    role="button"
                    aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                    aria-expanded={isExpanded}
                    onClick={(e) => { e.stopPropagation(); handleToggle(node.id) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        handleToggle(node.id)
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={node.x + node.width - 18}
                      y={node.y + 2}
                      width={16}
                      height={16}
                      rx={3}
                      fill="transparent"
                    />
                    <text
                      className="static-chain-expand-toggle"
                      x={toggleX}
                      y={toggleY}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </text>
                  </g>
                )}

                {/* ── Max depth indicator ──────────────────────────────── */}
                {node.isChainable && !canExpand && (
                  <text
                    className="static-chain-maxdepth-inline"
                    x={toggleX}
                    y={toggleY}
                    data-testid={`static-chain-maxdepth-${node.id}`}
                    aria-label="Max depth reached"
                  >
                    ⋯ (max depth)
                  </text>
                )}

                {/* ── Cycle indicator (inline on toggle position) ──────── */}
                {node.isChainable && isCycle && (
                  <text
                    className="static-chain-cycle-inline"
                    x={toggleX}
                    y={toggleY}
                    data-testid={`static-chain-cycle-${node.id}`}
                    aria-label="Cycle detected"
                  >
                    ⊗ (cycle)
                  </text>
                )}

                {/* ── "View RGD →" link (foreignObject) ────────────────── */}
                {node.isChainable && node.chainedRgdName && (
                  <foreignObject
                    x={linkX}
                    y={linkY}
                    width={AFFORDANCE_WIDTH}
                    height={AFFORDANCE_HEIGHT}
                    data-testid={`static-chain-link-${node.id}`}
                  >
                    <button
                      className="static-chain-view-link"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/rgds/${node.chainedRgdName}`, {
                          state: { from: rgdName },
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          navigate(`/rgds/${node.chainedRgdName}`, {
                            state: { from: rgdName },
                          })
                        }
                      }}
                    >
                      View RGD →
                    </button>
                  </foreignObject>
                )}

                {/* ── Nested subgraph (foreignObject) ─────────────────── */}
                {isExpanded && node.isChainable && node.chainedRgdName && (
                  <foreignObject
                    data-testid={`static-chain-nested-${node.id}`}
                    x={nestedX}
                    y={nestedY}
                    width={nestedWidth}
                    height={
                      effectiveAncestors.has(node.chainedRgdName) || depth >= MAX_DEPTH
                        ? 60 + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
                        : (() => {
                            const sub = buildChainSubgraph(node.chainedRgdName, rgds)
                            return sub
                              ? sub.height + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
                              : 60 + NESTED_HEADER_HEIGHT + NESTED_PADDING_BOTTOM
                          })()
                    }
                  >
                    <NestedSubgraph
                      node={node}
                      rgds={rgds}
                      ancestorSet={effectiveAncestors}
                      depth={depth}
                      rgdName={rgdName}
                      onNodeClick={onNodeClick}
                      selectedNodeId={selectedNodeId}
                    />
                  </foreignObject>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      {/* Badge legend — only at top level (depth 0), not inside nested subgraphs */}
      {depth === 0 && <DAGLegend />}
      <DAGTooltip
        node={hoveredTooltip?.node ?? null}
        anchorX={hoveredTooltip?.anchorX ?? 0}
        anchorY={hoveredTooltip?.anchorY ?? 0}
        nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
        nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
        nodeState={hoveredTooltip?.nodeState}
        onTooltipMouseEnter={cancelTooltipHide}
        onTooltipMouseLeave={scheduleTooltipHide}
      />
    </div>
    </DAGScaleGuard>
  )
}
