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

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DAGMinimap, { DAG_MINIMAP_THRESHOLD } from './DAGMinimap'
import type { DAGGraph as DAGGraphType, DAGNode, DAGEdge } from '@/lib/dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeNode(id: string, x = 0, y = 0): DAGNode {
  return {
    id,
    label: id,
    nodeType: 'resource',
    kind: 'ConfigMap',
    isConditional: false,
    hasReadyWhen: false,
    celExpressions: [],
    includeWhen: [],
    readyWhen: [],
    isChainable: false,
    x,
    y,
    width: 180,
    height: 48,
  }
}

function makeEdge(from: string, to: string): DAGEdge {
  return { from, to }
}

function makeGraph(nodeCount: number): DAGGraphType {
  const nodes: DAGNode[] = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(`node-${i}`, i * 200, i * 60),
  )
  const edges: DAGEdge[] = nodeCount > 1
    ? [makeEdge('node-0', 'node-1')]
    : []
  return { nodes, edges, width: 800, height: nodeCount * 60 }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('DAGMinimap', () => {
  beforeEach(() => {
    // Clear localStorage before each test to avoid state bleed
    try {
      localStorage.removeItem('dag-minimap-dismissed')
    } catch {
      // localStorage may not be available in all test environments
    }
  })

  describe('below threshold', () => {
    it('renders null for small graphs (5 nodes)', () => {
      const graph = makeGraph(5)
      const { container } = render(<DAGMinimap graph={graph} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders null for graph exactly at threshold', () => {
      const graph = makeGraph(DAG_MINIMAP_THRESHOLD)
      const { container } = render(<DAGMinimap graph={graph} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('above threshold', () => {
    const LARGE_COUNT = DAG_MINIMAP_THRESHOLD + 1

    it('renders minimap with aria-label when node count exceeds threshold', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)
      expect(screen.getByRole('img', { name: /graph overview minimap/i })).toBeInTheDocument()
    })

    it('displays node count in footer', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)
      expect(screen.getByText(`${LARGE_COUNT} nodes`)).toBeInTheDocument()
    })

    it('renders an SVG with edges and nodes', () => {
      const graph = makeGraph(LARGE_COUNT)
      const { container } = render(<DAGMinimap graph={graph} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      // Edges
      const lines = container.querySelectorAll('line.dag-minimap__edge')
      expect(lines.length).toBeGreaterThan(0)
      // Node rects
      const rects = container.querySelectorAll('rect.dag-minimap__node')
      expect(rects.length).toBe(LARGE_COUNT)
    })

    it('has a dismiss button', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)
      expect(screen.getByRole('button', { name: /dismiss minimap/i })).toBeInTheDocument()
    })

    it('hides minimap and shows show-button after dismiss', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss minimap/i }))

      // Minimap container gone
      expect(screen.queryByRole('img', { name: /graph overview minimap/i })).not.toBeInTheDocument()
      // Show button appears
      expect(screen.getByRole('button', { name: /show graph minimap/i })).toBeInTheDocument()
    })

    it('restores minimap after clicking show-button', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)

      // Dismiss
      fireEvent.click(screen.getByRole('button', { name: /dismiss minimap/i }))
      // Show again
      fireEvent.click(screen.getByRole('button', { name: /show graph minimap/i }))

      expect(screen.getByRole('img', { name: /graph overview minimap/i })).toBeInTheDocument()
    })

    it('persists dismissed state to localStorage', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(<DAGMinimap graph={graph} />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss minimap/i }))
      expect(localStorage.getItem('dag-minimap-dismissed')).toBe('1')
    })

    it('clears localStorage when show-button clicked', () => {
      const graph = makeGraph(LARGE_COUNT)
      localStorage.setItem('dag-minimap-dismissed', '1')
      // Re-render after setting storage (start in dismissed state)
      render(<DAGMinimap graph={graph} />)

      // Should start in dismissed state
      expect(screen.getByRole('button', { name: /show graph minimap/i })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /show graph minimap/i }))
      expect(localStorage.getItem('dag-minimap-dismissed')).toBeNull()
    })
  })

  describe('node type colors', () => {
    it('renders instance node with primary color fill', () => {
      const nodes: DAGNode[] = [
        { ...makeNode('schema', 0, 0), nodeType: 'instance' },
        ...Array.from({ length: DAG_MINIMAP_THRESHOLD }, (_, i) =>
          makeNode(`r${i}`, (i + 1) * 200, (i + 1) * 60),
        ),
      ]
      const graph: DAGGraphType = { nodes, edges: [], width: 800, height: 600 }
      const { container } = render(<DAGMinimap graph={graph} />)

      const instanceRect = container.querySelector('rect.dag-minimap__node[style*="primary"]')
      expect(instanceRect).toBeTruthy()
    })

    it('renders collection node with collection border color', () => {
      const nodes: DAGNode[] = [
        { ...makeNode('mycoll', 0, 0), nodeType: 'collection' },
        ...Array.from({ length: DAG_MINIMAP_THRESHOLD }, (_, i) =>
          makeNode(`r${i}`, (i + 1) * 200, (i + 1) * 60),
        ),
      ]
      const graph: DAGGraphType = { nodes, edges: [], width: 800, height: 600 }
      const { container } = render(<DAGMinimap graph={graph} />)

      const collRect = container.querySelector('rect.dag-minimap__node[style*="collection"]')
      expect(collRect).toBeTruthy()
    })
  })
})
