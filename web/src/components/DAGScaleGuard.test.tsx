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

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DAGScaleGuard, { DAG_SCALE_THRESHOLD } from './DAGScaleGuard'
import type { DAGGraph as DAGGraphType, DAGNode, DAGEdge } from '@/lib/dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeNode(id: string): DAGNode {
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
    x: 0,
    y: 0,
    width: 180,
    height: 48,
  }
}

function makeGraph(nodeCount: number): DAGGraphType {
  const nodes: DAGNode[] = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(`node-${i}`),
  )
  const edges: DAGEdge[] = []
  return { nodes, edges, width: 400, height: 200 }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('DAGScaleGuard', () => {
  describe('below threshold', () => {
    it('renders children directly when node count is at threshold', () => {
      const graph = makeGraph(DAG_SCALE_THRESHOLD)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph here</div>
        </DAGScaleGuard>,
      )
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      // No banner
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('renders children for small graphs (5 nodes)', () => {
      const graph = makeGraph(5)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">small graph</div>
        </DAGScaleGuard>,
      )
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })
  })

  describe('above threshold', () => {
    const LARGE_COUNT = DAG_SCALE_THRESHOLD + 1

    it('shows warning banner with node count when threshold is exceeded', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph here</div>
        </DAGScaleGuard>,
      )
      const banner = screen.getByRole('status')
      expect(banner).toBeInTheDocument()
      expect(banner).toHaveTextContent(`${LARGE_COUNT} nodes`)
    })

    it('does NOT render children by default when threshold is exceeded', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph here</div>
        </DAGScaleGuard>,
      )
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
    })

    it('shows text-mode node list by default', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div>graph</div>
        </DAGScaleGuard>,
      )
      expect(screen.getByRole('list', { name: /resource node list/i })).toBeInTheDocument()
    })

    it('shows toggle button with node count', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div>graph</div>
        </DAGScaleGuard>,
      )
      const toggle = screen.getByRole('button')
      expect(toggle).toHaveTextContent(`${LARGE_COUNT} nodes`)
    })

    it('clicking toggle reveals children (graph view)', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph here</div>
        </DAGScaleGuard>,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    it('clicking toggle twice goes back to text list', () => {
      const graph = makeGraph(LARGE_COUNT)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph here</div>
        </DAGScaleGuard>,
      )
      const toggle = screen.getByRole('button')
      fireEvent.click(toggle) // show graph
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      fireEvent.click(toggle) // back to list
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
      expect(screen.getByRole('list', { name: /resource node list/i })).toBeInTheDocument()
    })

    it('text list shows node ids', () => {
      const nodes: DAGNode[] = Array.from({ length: LARGE_COUNT }, (_, i) =>
        makeNode(`my-node-${i}`),
      )
      const graph: DAGGraphType = { nodes, edges: [], width: 400, height: 200 }
      render(
        <DAGScaleGuard graph={graph}>
          <div>graph</div>
        </DAGScaleGuard>,
      )
      // First node ID should appear in the list
      expect(screen.getByText('my-node-0')).toBeInTheDocument()
    })

    it('marks conditional nodes with a badge', () => {
      const nodes: DAGNode[] = [
        ...Array.from({ length: DAG_SCALE_THRESHOLD }, (_, i) => makeNode(`node-${i}`)),
        { ...makeNode('conditional-node'), isConditional: true },
      ]
      const graph: DAGGraphType = { nodes, edges: [], width: 400, height: 200 }
      render(
        <DAGScaleGuard graph={graph}>
          <div>graph</div>
        </DAGScaleGuard>,
      )
      const badge = screen.getByLabelText('conditional node')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('threshold boundary', () => {
    it('DAG_SCALE_THRESHOLD is exported and equals 100', () => {
      expect(DAG_SCALE_THRESHOLD).toBe(100)
    })

    it('does not activate for exactly 100 nodes', () => {
      const graph = makeGraph(100)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph</div>
        </DAGScaleGuard>,
      )
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('activates for exactly 101 nodes', () => {
      const graph = makeGraph(101)
      render(
        <DAGScaleGuard graph={graph}>
          <div data-testid="child-content">graph</div>
        </DAGScaleGuard>,
      )
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
