// CollectionBadge.tsx — Health summary badge for forEach collection nodes in the live DAG.
//
// Renders as an SVG <text> element inside the DAG node group.
// Shows "ready/total" count with color-coded state:
//   all ready   → --color-alive (emerald)
//   partial     → --color-reconciling (amber)
//   none ready  → --color-error (rose)
//
// Spec: .specify/specs/011-collection-explorer/

import { isItemReady } from './CollectionPanel'
import type { K8sObject } from '@/lib/api'
import './CollectionBadge.css'

// ── Label constant ─────────────────────────────────────────────────────────

const LABEL_NODE_ID = 'kro.run/node-id'
const LABEL_COLL_SIZE = 'kro.run/collection-size'

// ── Props ──────────────────────────────────────────────────────────────────

export interface CollectionBadgeProps {
  /** The forEach node ID to match against kro.run/node-id labels. */
  nodeId: string
  /** All children from getInstanceChildren — will be filtered client-side. */
  children: K8sObject[]
  /** Node bounding box for SVG positioning. */
  nodeX: number
  nodeY: number
  nodeWidth: number
  nodeHeight: number
}

// ── Badge state derivation ─────────────────────────────────────────────────

type BadgeState = 'all-ready' | 'partial' | 'none-ready'

function badgeState(ready: number, total: number): BadgeState {
  if (total === 0) return 'none-ready'
  if (ready === total) return 'all-ready'
  if (ready > 0) return 'partial'
  return 'none-ready'
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * CollectionBadge — inline SVG text element showing the collection health.
 *
 * Must be rendered inside an SVG context (inside a <g> element for a
 * collection DAG node). Uses CSS fill classes rather than inline colors
 * to respect tokens.css custom properties.
 *
 * Spec: .specify/specs/011-collection-explorer/ FR-006
 */
export default function CollectionBadge({
  nodeId,
  children,
  nodeX,
  nodeY,
  nodeWidth,
  nodeHeight,
}: CollectionBadgeProps) {
  // Filter items for this specific collection node
  const items = children.filter((child) => {
    const meta = child.metadata
    if (typeof meta !== 'object' || meta === null) return false
    const labels = (meta as Record<string, unknown>).labels
    if (typeof labels !== 'object' || labels === null) return false
    return (labels as Record<string, string>)[LABEL_NODE_ID] === nodeId
  })

  // Nothing to show if no items observed yet
  if (items.length === 0) return null

  const total = parseInt(
    (() => {
      const first = items[0]
      const meta = first.metadata
      if (typeof meta !== 'object' || meta === null) return String(items.length)
      const labels = (meta as Record<string, unknown>).labels
      if (typeof labels !== 'object' || labels === null) return String(items.length)
      return (labels as Record<string, string>)[LABEL_COLL_SIZE] ?? String(items.length)
    })(),
    10,
  )
  const ready = items.filter(isItemReady).length
  const state = badgeState(ready, total)
  const label = `${ready}/${total}`

  // Position: centered horizontally, near the bottom of the node
  const x = nodeX + nodeWidth / 2
  const y = nodeY + nodeHeight - 6

  return (
    <text
      data-testid="collection-badge"
      className={`collection-badge collection-badge--${state}`}
      x={x}
      y={y}
      textAnchor="middle"
      aria-label={`Collection health: ${label}`}
    >
      {label}
    </text>
  )
}
