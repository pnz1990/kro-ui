// ExpandableNode.tsx — SVG node group with expand/collapse toggle for deep graph.
//
// Renders a kro-managed CRD node with a ▸/▾ toggle icon.
// When expanded, renders the child instance's subgraph inline via SVG foreignObject.
//
// The nested subgraph renderer is injected via `renderNested` to avoid a
// circular import between ExpandableNode ↔ DeepDAG.
//
// Spec: .specify/specs/012-rgd-chaining-deep-graph/ FR-002, FR-004, FR-005, FR-006

import type { ReactNode } from 'react'
import type { DAGNode } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import './DeepDAG.css'

// ── Nested subgraph data ────────────────────────────────────────────────────

export interface ExpandedNodeData {
  /** Total pixel width of the child subgraph (from DAGGraph.width). */
  nestedWidth: number
  /** Total pixel height of the child subgraph (from DAGGraph.height). */
  nestedHeight: number
  /** The rendered nested subgraph content (provided by DeepDAG). */
  content: ReactNode
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface ExpandableNodeProps {
  /** The DAG node to render. */
  node: DAGNode
  /** Live state for this node from the parent StateMap. */
  state: NodeLiveState | undefined
  /** Whether this node is selected (highlights it). */
  isSelected: boolean
  /** Called when the user clicks the node body (to inspect YAML). */
  onNodeClick?: (node: DAGNode) => void
  /** Called when the user clicks the expand/collapse toggle. */
  onToggle: () => void
  /** Whether this node is currently expanded. */
  isExpanded: boolean
  /** Current recursion depth (0 = top-level). Max displayable = 3 (0..3 = 4 levels). */
  depth: number
  /** Expanded subgraph data — present when isExpanded and fully loaded. */
  expandedData?: ExpandedNodeData
  /** True while the child instance data is being fetched. */
  childLoading?: boolean
  /** Non-null when the child fetch failed. */
  childError?: string
}

// ── Layout constants ──────────────────────────────────────────────────────

const NESTED_HEADER_HEIGHT = 32
const NESTED_PADDING_BOTTOM = 8
const NESTED_MIN_WIDTH = 280
const NESTED_LOADING_HEIGHT = 60

// ── CSS class helpers (mirrors LiveDAG) ──────────────────────────────────

function liveStateClass(state: NodeLiveState | undefined): string {
  if (!state) return 'dag-node-live--notfound'
  switch (state) {
    case 'alive':       return 'dag-node-live--alive'
    case 'reconciling': return 'dag-node-live--reconciling'
    case 'error':       return 'dag-node-live--error'
    case 'pending':     return 'dag-node-live--pending'
    case 'not-found':   return 'dag-node-live--notfound'
  }
}

function nodeClassName(
  node: DAGNode,
  state: NodeLiveState | undefined,
  isSelected: boolean,
): string {
  const parts = [
    'dag-node',
    `dag-node--${node.nodeType}`,
    'deep-dag-expandable',
  ]
  if (node.isConditional) parts.push('node-conditional')
  if (state) parts.push(liveStateClass(state))
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}

// ── ExpandableNode ──────────────────────────────────────────────────────────

/**
 * ExpandableNode — renders a single kro-managed CRD node with deep expand
 * capability. When expanded, embeds a nested subgraph via SVG foreignObject.
 *
 * Spec: .specify/specs/012-rgd-chaining-deep-graph/ FR-002, FR-004, FR-006
 */
export default function ExpandableNode({
  node,
  state,
  isSelected,
  onNodeClick,
  onToggle,
  isExpanded,
  depth,
  expandedData,
  childLoading,
  childError,
}: ExpandableNodeProps) {
  const cx = node.x + node.width / 2
  const labelY = node.y + node.height / 2 - (node.kind ? 7 : 0)
  const kindY = node.y + node.height / 2 + 8

  // Toggle icon position: top-right corner
  const toggleX = node.x + node.width - 8
  const toggleY = node.y + 10

  // FR-006: Max depth = 4 levels (depth 0..3 = 4 levels).
  // At depth >= 4, show ellipsis indicator instead of expand toggle.
  const canExpand = depth < 4

  const className = nodeClassName(node, state, isSelected)

  // ── Nested subgraph dimensions ────────────────────────────────────────────
  const nestedWidth = expandedData
    ? Math.max(expandedData.nestedWidth, NESTED_MIN_WIDTH)
    : NESTED_MIN_WIDTH
  const contentHeight = expandedData
    ? expandedData.nestedHeight
    : NESTED_LOADING_HEIGHT
  const nestedHeight = NESTED_HEADER_HEIGHT + contentHeight + NESTED_PADDING_BOTTOM

  // Center the nested container horizontally relative to the parent node
  const nestedX = node.x + node.width / 2 - nestedWidth / 2
  const nestedY = node.y + node.height + 8

  return (
    <g data-testid={`dag-node-${node.id}`}>
      {/* ── Main node group ── */}
      <g
        className={className}
        tabIndex={0}
        role="button"
        aria-label={`${node.label} (${node.nodeType})${isExpanded ? ', expanded' : ''}`}
        aria-pressed={isSelected}
        aria-expanded={canExpand ? isExpanded : undefined}
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
      </g>

      {/* ── Expand / collapse toggle ── */}
      {canExpand && (
        <g
          data-testid={`deep-dag-toggle-${node.id}`}
          tabIndex={0}
          role="button"
          aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onToggle()
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Transparent hit area for better click target */}
          <rect
            x={node.x + node.width - 18}
            y={node.y + 2}
            width={16}
            height={16}
            rx={3}
            fill="transparent"
          />
          <text
            className="deep-dag-expand-toggle"
            x={toggleX}
            y={toggleY}
          >
            {isExpanded ? '▾' : '▸'}
          </text>
        </g>
      )}

      {/* ── Max depth reached indicator (depth >= 4) ── */}
      {!canExpand && (
        <text
          className="deep-dag-expand-toggle"
          x={toggleX}
          y={toggleY}
          data-testid={`deep-dag-maxdepth-${node.id}`}
          aria-label="Max depth reached"
        >
          ⋯
        </text>
      )}

      {/* ── Nested subgraph (SVG foreignObject) ── */}
      {isExpanded && (
        <foreignObject
          data-testid={`deep-dag-nested-${node.id}`}
          x={nestedX}
          y={nestedY}
          width={nestedWidth}
          height={nestedHeight}
        >
          <div className="deep-dag-nested-container">
            {/* Header bar */}
            <div className="deep-dag-nested-header">
              <span>▾</span>
              <span>{node.label}</span>
              <span className="deep-dag-nested-header-kind">{node.kind}</span>
            </div>

            {/* Loading state */}
            {childLoading && !expandedData && (
              <div
                className="deep-dag-nested-loading"
                data-testid={`deep-dag-loading-${node.id}`}
                aria-live="polite"
              >
                Loading…
              </div>
            )}

            {/* Error state */}
            {childError && !expandedData && (
              <div
                className="deep-dag-nested-error"
                data-testid={`deep-dag-error-${node.id}`}
                role="alert"
              >
                {childError}
              </div>
            )}

            {/* Nested subgraph content (provided by DeepDAG via expandedData.content) */}
            {expandedData?.content}
          </div>
        </foreignObject>
      )}
    </g>
  )
}
