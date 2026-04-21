// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * DAGMinimap — fixed-position minimap overlay for large DAGs.
 *
 * Design ref: docs/design/28-rgd-display.md §Future
 *   "DAG minimap: for large graphs (>50 nodes) add a fixed-position mini-map
 *   (SVG overlay, no extra dependencies) so operators can orient themselves
 *   without scrolling; required for usability at real scale"
 *
 * Spec: .specify/specs/issue-578/spec.md
 *
 * When graph.nodes.length > DAG_MINIMAP_THRESHOLD (50):
 *   - Renders a scaled-down SVG in the bottom-right of the container.
 *   - Node types are color-coded using CSS variable tokens.
 *   - Edges are rendered as thin lines.
 *   - A dismiss button (×) hides the minimap; dismissed state is persisted
 *     in localStorage so it survives page reloads.
 *
 * When graph.nodes.length ≤ DAG_MINIMAP_THRESHOLD: renders null (no overhead).
 * No external dependencies — pure SVG.
 */

import { useState, useCallback } from 'react'
import type { DAGGraph } from '@/lib/dag'
import './DAGMinimap.css'

/** Threshold above which the minimap activates. */
export const DAG_MINIMAP_THRESHOLD = 50

const STORAGE_KEY = 'dag-minimap-dismissed'

/** Minimap canvas dimensions (px) */
const MM_WIDTH = 160
const MM_HEIGHT = 120

/** Read dismiss state from localStorage (fail-open: false = visible). */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist dismiss state to localStorage. */
function writeDismissed(val: boolean): void {
  try {
    if (val) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage not available — no-op
  }
}

/**
 * CSS fill color for a node rect in the minimap.
 * Uses CSS custom properties from tokens.css for theme correctness.
 */
function nodeMinimapFill(nodeType: string): string {
  switch (nodeType) {
    case 'instance':     return 'var(--color-primary)'
    case 'resource':     return 'var(--color-border)'
    case 'collection':   return 'var(--node-collection-border)'
    case 'external':
    case 'externalCollection': return 'var(--node-external-border)'
    case 'state':        return 'var(--node-state-border)'
    default:             return 'var(--color-border)'
  }
}

interface DAGMinimapProps {
  graph: DAGGraph
}

/**
 * DAGMinimap — overlay minimap for graphs > DAG_MINIMAP_THRESHOLD nodes.
 *
 * Returns null for small graphs (no rendering cost).
 */
export default function DAGMinimap({ graph }: DAGMinimapProps) {
  const [dismissed, setDismissed] = useState<boolean>(readDismissed)

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    writeDismissed(true)
  }, [])

  const handleShow = useCallback(() => {
    setDismissed(false)
    writeDismissed(false)
  }, [])

  // Small graph — no minimap needed
  if (graph.nodes.length <= DAG_MINIMAP_THRESHOLD) return null

  // Compute graph bounding box for scaling
  const allX = graph.nodes.flatMap((n) => [n.x, n.x + n.width])
  const allY = graph.nodes.flatMap((n) => [n.y, n.y + n.height])
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)
  const graphW = maxX - minX || 1
  const graphH = maxY - minY || 1

  // Padding inside minimap (px)
  const PAD = 6
  const scaleX = (MM_WIDTH - PAD * 2) / graphW
  const scaleY = (MM_HEIGHT - PAD * 2) / graphH
  const scale = Math.min(scaleX, scaleY)

  function mx(x: number): number {
    return PAD + (x - minX) * scale
  }
  function my(y: number): number {
    return PAD + (y - minY) * scale
  }

  // If dismissed, show a small "show minimap" toggle button instead
  if (dismissed) {
    return (
      <button
        type="button"
        className="dag-minimap-show-btn"
        onClick={handleShow}
        aria-label="Show graph minimap"
        title="Show graph minimap"
      >
        ⊞
      </button>
    )
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  return (
    <div className="dag-minimap" role="img" aria-label="Graph overview minimap">
      <button
        type="button"
        className="dag-minimap__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss minimap"
        title="Dismiss minimap"
      >
        ×
      </button>
      <svg
        width={MM_WIDTH}
        height={MM_HEIGHT}
        viewBox={`0 0 ${MM_WIDTH} ${MM_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Edges */}
        <g>
          {graph.edges.map((edge) => {
            const from = nodeMap.get(edge.from)
            const to = nodeMap.get(edge.to)
            if (!from || !to) return null
            const x1 = mx(from.x + from.width / 2)
            const y1 = my(from.y + from.height)
            const x2 = mx(to.x + to.width / 2)
            const y2 = my(to.y)
            return (
              <line
                key={`${edge.from}→${edge.to}`}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                className="dag-minimap__edge"
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {graph.nodes.map((node) => {
            const w = Math.max(node.width * scale, 2)
            const h = Math.max(node.height * scale, 2)
            return (
              <rect
                key={node.id}
                x={mx(node.x)}
                y={my(node.y)}
                width={w}
                height={h}
                rx={1}
                className="dag-minimap__node"
                style={{ fill: nodeMinimapFill(node.nodeType) }}
              />
            )
          })}
        </g>
      </svg>

      <div className="dag-minimap__footer">
        {graph.nodes.length} nodes
      </div>
    </div>
  )
}
