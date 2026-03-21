import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DAGGraph from './DAGGraph'
import type { DAGGraph as DAGGraphType, DAGNode, DAGEdge } from '@/lib/dag'

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
    x: 0,
    y: 0,
    width: 180,
    height: 48,
    ...overrides,
  }
}

function makeGraph(nodes: DAGNode[], edges: DAGEdge[] = []): DAGGraphType {
  return { nodes, edges, width: 400, height: 200 }
}

// ── T015: Basic render — nodes and edges ──────────────────────────────────

describe('DAGGraph', () => {
  it('T015: renders svg with data-testid and correct number of nodes and edges', () => {
    const nodeA = makeNode('nodeA', { x: 50, y: 32, nodeType: 'instance' })
    const nodeB = makeNode('nodeB', { x: 50, y: 160 })
    const edge: DAGEdge = { from: 'nodeA', to: 'nodeB' }
    const graph = makeGraph([nodeA, nodeB], [edge])

    const { container } = render(<DAGGraph graph={graph} />)

    // SVG container
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()

    // Both nodes rendered
    expect(screen.getByTestId('dag-node-nodeA')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-nodeB')).toBeInTheDocument()

    // Edge rendered as path
    const paths = container.querySelectorAll('path.dag-edge')
    expect(paths.length).toBeGreaterThanOrEqual(1)
  })

  // ── T016: Collection badge + conditional badge ─────────────────────────

  it('T016: collection node renders ∀ badge; conditional node renders ? badge with node-conditional class', () => {
    const collectionNode = makeNode('myCollection', {
      nodeType: 'collection',
      x: 50,
      y: 32,
    })
    const conditionalNode = makeNode('myConditional', {
      nodeType: 'resource',
      isConditional: true,
      x: 280,
      y: 32,
    })
    const graph = makeGraph([collectionNode, conditionalNode])

    const { container } = render(<DAGGraph graph={graph} />)

    // Collection node has ∀ badge
    const collectionGroup = screen.getByTestId('dag-node-myCollection')
    expect(collectionGroup.textContent).toContain('∀')

    // Conditional node has ? badge
    const conditionalGroup = screen.getByTestId('dag-node-myConditional')
    expect(conditionalGroup.textContent).toContain('?')

    // Conditional node has node-conditional class
    expect(container.querySelector('[data-testid="dag-node-myConditional"]')).toHaveClass(
      'node-conditional',
    )
  })

  // ── T017: External node — dashed stroke and ⬡ icon ───────────────────

  it('T017: external node has dashed stroke class and ⬡ icon', () => {
    const externalNode = makeNode('extDb', {
      nodeType: 'external',
      x: 50,
      y: 32,
    })
    const graph = makeGraph([externalNode])

    render(<DAGGraph graph={graph} />)

    const group = screen.getByTestId('dag-node-extDb')
    expect(group.textContent).toContain('⬡')
    // The group itself carries the external CSS class (which applies dashed stroke to the rect)
    expect(group).toHaveClass('dag-node--external')
  })

  // ── T018: Root node has instance class ───────────────────────────────

  it('T018: root node (nodeType instance) gets dag-node--instance class', () => {
    const rootNode = makeNode('schema', {
      nodeType: 'instance',
      kind: 'WebApp',
      x: 100,
      y: 32,
      width: 200,
      height: 52,
    })
    const graph = makeGraph([rootNode])

    render(<DAGGraph graph={graph} />)

    const group = screen.getByTestId('dag-node-schema')
    expect(group).toHaveClass('dag-node--instance')
  })

  // ── T019: Click callback ───────────────────────────────────────────────

  it('T019: clicking a node calls onNodeClick with the node id', () => {
    const onClick = vi.fn()
    const node = makeNode('clickable', { x: 50, y: 32 })
    const graph = makeGraph([node])

    render(<DAGGraph graph={graph} onNodeClick={onClick} />)

    const group = screen.getByTestId('dag-node-clickable')
    fireEvent.click(group)

    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith('clickable')
  })
})
