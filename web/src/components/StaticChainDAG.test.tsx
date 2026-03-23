// StaticChainDAG.test.tsx — Unit tests for the static RGD chaining graph component.
//
// Spec: .specify/specs/025-rgd-static-chain-graph/
// Tests: T015 (chainable marking), T022 (expand/collapse, cycle, depth), T027 (view-link)

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StaticChainDAG from './StaticChainDAG'
import type { DAGGraph, DAGNode, DAGEdge } from '@/lib/dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<DAGNode> = {}): DAGNode {
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
    ...overrides,
  }
}

function makeChainableNode(id: string, kind: string, chainedRgdName: string): DAGNode {
  return makeNode(id, { kind, isChainable: true, chainedRgdName })
}

function makeGraph(nodes: DAGNode[], edges: DAGEdge[] = []): DAGGraph {
  return { nodes, edges, width: 400, height: 200 }
}

/** Minimal RGD object matching chain-child fixture. */
function makeRGDObject(name: string, schemaKind: string, resourceKinds: string[] = []) {
  return {
    metadata: { name },
    spec: {
      schema: { kind: schemaKind, apiVersion: 'v1alpha1' },
      resources: resourceKinds.map((k, i) => ({
        id: `res${i}`,
        template: { apiVersion: 'v1', kind: k, metadata: { name: `res${i}` } },
      })),
    },
  }
}

function renderComponent(
  graph: DAGGraph,
  rgds = [] as ReturnType<typeof makeRGDObject>[],
  opts: {
    ancestorSet?: ReadonlySet<string>
    depth?: number
    rgdName?: string
    onNodeClick?: (id: string) => void
  } = {},
) {
  return render(
    <MemoryRouter>
      <StaticChainDAG
        graph={graph}
        rgds={rgds}
        ancestorSet={opts.ancestorSet}
        depth={opts.depth}
        rgdName={opts.rgdName ?? 'test-parent'}
        onNodeClick={opts.onNodeClick}
      />
    </MemoryRouter>,
  )
}

// ── T015: Chainable node marking ──────────────────────────────────────────

describe('StaticChainDAG — chainable node marking (T015)', () => {
  it('chainable node gets node-chainable class; non-chainable does not', () => {
    const chainable = makeChainableNode('db', 'Database', 'database-rgd')
    const plain = makeNode('ns', { kind: 'Namespace' })
    const graph = makeGraph([chainable, plain])

    renderComponent(graph)

    // chainable node: data-testid is on the inner .dag-node SVG <g>
    // SVG elements have SVGAnimatedString for className — use getAttribute
    const dbNodeEl = screen.getByTestId('dag-node-db')
    expect(dbNodeEl.getAttribute('class')).toContain('node-chainable')

    // non-chainable node: does not have node-chainable
    const nsNodeEl = screen.getByTestId('dag-node-ns')
    expect(nsNodeEl.getAttribute('class')).not.toContain('node-chainable')
  })

  it('renders SVG with dag-svg test-id', () => {
    const graph = makeGraph([makeNode('root', { nodeType: 'instance' })])
    renderComponent(graph)
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
  })

  it('renders each node with dag-node-{id} test-id', () => {
    const graph = makeGraph([makeNode('abc'), makeNode('xyz')])
    renderComponent(graph)
    expect(screen.getByTestId('dag-node-abc')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-xyz')).toBeInTheDocument()
  })
})

// ── T022: Expand/collapse, cycle, max-depth ───────────────────────────────

describe('StaticChainDAG — expand/collapse affordances (T022)', () => {
  const childRgd = makeRGDObject('database-rgd', 'Database', ['ConfigMap', 'ServiceAccount'])

  it('chainable node at depth < 4 has static-chain-toggle-{id}', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd], { depth: 0 })
    expect(screen.getByTestId('static-chain-toggle-db')).toBeInTheDocument()
  })

  it('clicking toggle expands node — static-chain-nested-{id} appears', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd], { depth: 0 })

    expect(screen.queryByTestId('static-chain-nested-db')).toBeNull()
    fireEvent.click(screen.getByTestId('static-chain-toggle-db'))
    expect(screen.getByTestId('static-chain-nested-db')).toBeInTheDocument()
  })

  it('clicking toggle again collapses — static-chain-nested-{id} disappears', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd], { depth: 0 })

    fireEvent.click(screen.getByTestId('static-chain-toggle-db'))
    expect(screen.getByTestId('static-chain-nested-db')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('static-chain-toggle-db'))
    expect(screen.queryByTestId('static-chain-nested-db')).toBeNull()
  })

  it('expanding a node whose chainedRgdName is in ancestorSet shows cycle indicator', () => {
    const node = makeChainableNode('cycle', 'CycleA', 'cycle-a-rgd')
    const graph = makeGraph([node])
    const cycleRgd = makeRGDObject('cycle-a-rgd', 'CycleA', ['ConfigMap'])

    // ancestorSet already contains 'cycle-a-rgd' — cycle!
    renderComponent(graph, [cycleRgd], {
      ancestorSet: new Set(['test-parent', 'cycle-a-rgd']),
      rgdName: 'test-parent',
    })

    // Toggle should not be shown (cycle detection hides it)
    expect(screen.queryByTestId('static-chain-toggle-cycle')).toBeNull()
    // Cycle inline indicator should be shown
    expect(screen.getByTestId('static-chain-cycle-cycle')).toBeInTheDocument()
  })

  it('node at depth >= 4 renders maxdepth indicator and NO toggle', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])

    renderComponent(graph, [childRgd], { depth: 4 })

    expect(screen.queryByTestId('static-chain-toggle-db')).toBeNull()
    expect(screen.getByTestId('static-chain-maxdepth-db')).toBeInTheDocument()
  })

  it('collapsed node has no static-chain-nested-{id}', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd])
    expect(screen.queryByTestId('static-chain-nested-db')).toBeNull()
  })
})

// ── T027: "View RGD →" link presence rules ────────────────────────────────

describe('StaticChainDAG — View RGD → link (T027)', () => {
  const childRgd = makeRGDObject('database-rgd', 'Database', ['ConfigMap'])

  it('chainable node has static-chain-link-{id}', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd])
    expect(screen.getByTestId('static-chain-link-db')).toBeInTheDocument()
  })

  it('non-chainable node does NOT have static-chain-link-{id}', () => {
    const node = makeNode('ns', { kind: 'Namespace' })
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd])
    expect(screen.queryByTestId('static-chain-link-ns')).toBeNull()
  })

  it('view-link is present even at depth >= 4 (no toggle, but link remains)', () => {
    const node = makeChainableNode('db', 'Database', 'database-rgd')
    const graph = makeGraph([node])
    renderComponent(graph, [childRgd], { depth: 4 })

    // toggle absent, link present
    expect(screen.queryByTestId('static-chain-toggle-db')).toBeNull()
    expect(screen.getByTestId('static-chain-link-db')).toBeInTheDocument()
  })

  it('view-link is present when cycle is detected (cycle indicator shown, link remains)', () => {
    const node = makeChainableNode('cycle', 'CycleA', 'cycle-rgd')
    const cycleRgd = makeRGDObject('cycle-rgd', 'CycleA')
    const graph = makeGraph([node])

    renderComponent(graph, [cycleRgd], {
      ancestorSet: new Set(['test-parent', 'cycle-rgd']),
    })

    // cycle indicator shown
    expect(screen.getByTestId('static-chain-cycle-cycle')).toBeInTheDocument()
    // link still present
    expect(screen.getByTestId('static-chain-link-cycle')).toBeInTheDocument()
  })
})
