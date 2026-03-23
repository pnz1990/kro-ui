// DAGTooltip.tsx — Shared portal tooltip for DAG node hover.
//
// Displays node id, kind, node type, includeWhen (if present), and
// readyWhen (if present) with CEL syntax highlighting.
//
// Rendered via createPortal to document.body to escape SVG clipping.
// Viewport-clamped in a useEffect after initial render to prevent overflow.
//
// Constitution §XIII: DAG tooltips MUST use createPortal + getBoundingClientRect
// clamping. Anti-pattern #77: one shared implementation, imported by all graph
// components — never duplicated.
//
// Spec: .specify/specs/021-readywhen-cel-dag/

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DAGNode } from '@/lib/dag'
import { nodeTypeLabel } from '@/lib/dag'
import type { NodeLiveState } from '@/lib/instanceNodeState'
import KroCodeBlock from './KroCodeBlock'
import './DAGTooltip.css'

export interface DAGTooltipProps {
  /** Node to display. Pass null to hide the tooltip entirely. */
  node: DAGNode | null
  /** Viewport-relative X of the hovered node's left edge. */
  anchorX: number
  /** Viewport-relative Y of the hovered node's top edge. */
  anchorY: number
  /** Width of the hovered node rect (for right-side anchor calculation). */
  nodeWidth: number
  /** Height of the hovered node rect (for bottom-side anchor calculation). */
  nodeHeight: number
  /**
   * Optional live state for the hovered node.
   * When provided, a "State: <label>" line is shown in the tooltip.
   * Also relaxes the early-return guard — tooltip renders even if readyWhen
   * and includeWhen are both empty, so users can see state on any node.
   * Spec: .specify/specs/029-dag-instance-overlay/
   */
  nodeState?: NodeLiveState
}

/**
 * DAGTooltipTarget — the hover state shape stored in each graph component.
 * Exported here so all three graph components (DAGGraph, LiveDAG, DeepDAG)
 * import the same type rather than declaring their own local interface.
 */
export interface DAGTooltipTarget {
  node: DAGNode
  anchorX: number
  anchorY: number
  nodeWidth: number
  nodeHeight: number
}

/** Filter out blank CEL expression strings before rendering. */
function nonEmpty(exprs: string[]): string[] {
  return exprs.filter((s) => s.trim() !== '')
}

/** Maps NodeLiveState to the CSS modifier used in .dag-tooltip__state--* */
function stateClass(state: NodeLiveState): string {
  switch (state) {
    case 'alive':       return 'alive'
    case 'reconciling': return 'reconciling'
    case 'error':       return 'error'
    case 'not-found':   return 'notfound'
  }
}

/** Human-readable label for a live state. */
const STATE_LABEL: Record<NodeLiveState, string> = {
  alive: 'Alive',
  reconciling: 'Reconciling',
  error: 'Error',
  'not-found': 'Not found',
}

/**
 * DAGTooltip — portal-rendered, viewport-clamped hover tooltip.
 *
 * Returns null if:
 *   - node is null (no hover target)
 *   - node has no non-empty readyWhen expressions (tooltip not useful)
 *
 * Per the constitution, the tooltip shows id, kind, node type, includeWhen
 * (if present), and readyWhen (if present).
 */
export default function DAGTooltip({
  node,
  anchorX,
  anchorY,
  nodeWidth,
  nodeHeight,
  nodeState,
}: DAGTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [visible, setVisible] = useState(false)

  // Compute initial (un-clamped) position: below-right of the node
  const initialLeft = anchorX + nodeWidth + 8
  const initialTop = anchorY

  useEffect(() => {
    if (!node || !tooltipRef.current) return

    // Reset visible on each new node so the transition re-triggers
    setVisible(false)

    const el = tooltipRef.current
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8

    let left = initialLeft
    let top = initialTop

    // Flip left if right edge overflows
    if (left + rect.width > vw - margin) {
      left = anchorX - rect.width - margin
    }
    // Ensure left is never off the left edge
    if (left < margin) left = margin

    // Flip up if bottom edge overflows
    if (top + rect.height > vh - margin) {
      top = anchorY + nodeHeight - rect.height
    }
    // Ensure top is never off the top edge
    if (top < margin) top = margin

    setPos({ left, top })
    setVisible(true)
  }, [node, anchorX, anchorY, nodeWidth, nodeHeight, initialLeft, initialTop])

  // Hide when node is null — reset state for next hover
  useEffect(() => {
    if (!node) {
      setPos(null)
      setVisible(false)
    }
  }, [node])

  if (!node) return null

  const readyWhenExprs = nonEmpty(node.readyWhen)
  const includeWhenExprs = nonEmpty(node.includeWhen)

  // Nothing interesting to show — bail out
  // Relaxed when nodeState is provided (overlay active): every node gets a tooltip
  if (readyWhenExprs.length === 0 && includeWhenExprs.length === 0 && !nodeState) return null

  const readyWhenCode =
    'readyWhen:\n' + readyWhenExprs.map((e) => `  - ${e}`).join('\n')
  const includeWhenCode =
    'includeWhen:\n' + includeWhenExprs.map((e) => `  - ${e}`).join('\n')

  const tooltipEl = (
    <div
      ref={tooltipRef}
      id="dag-node-tooltip"
      role="tooltip"
      className={`dag-tooltip${visible ? ' dag-tooltip--visible' : ''}`}
      style={
        pos
          ? { left: pos.left, top: pos.top }
          : { left: initialLeft, top: initialTop }
      }
    >
      <div className="dag-tooltip-header">
        <span className="dag-tooltip-node-id">{node.id}</span>
        {node.kind && (
          <span className="dag-tooltip-node-kind">{node.kind}</span>
        )}
        <span className="dag-tooltip-node-type">
          {nodeTypeLabel(node.nodeType)}
        </span>
        {nodeState && (
          <span className={`dag-tooltip__state dag-tooltip__state--${stateClass(nodeState)}`}>
            {STATE_LABEL[nodeState]}
          </span>
        )}
      </div>

      {includeWhenExprs.length > 0 && (
        <div className="dag-tooltip-section">
          <div className="dag-tooltip-section-label">Include When</div>
          <KroCodeBlock code={includeWhenCode} />
        </div>
      )}

      {readyWhenExprs.length > 0 && (
        <div className="dag-tooltip-section">
          <div className="dag-tooltip-section-label">Ready When</div>
          <KroCodeBlock code={readyWhenCode} />
        </div>
      )}
    </div>
  )

  return createPortal(tooltipEl, document.body)
}
