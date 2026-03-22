// DeepDAG.test.tsx — Unit tests for DeepDAG recursive expansion.
//
// Spec: .specify/specs/012-rgd-chaining-deep-graph/
// Tests: T001–T005

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import DeepDAG from './DeepDAG'
import type { DAGGraph, DAGNode, DAGEdge } from '@/lib/dag'
import type { NodeStateMap } from '@/lib/instanceNodeState'
import type { K8sObject } from '@/lib/api'

// ── Mock API module ────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getRGD: vi.fn(),
  getInstance: vi.fn(),
  getInstanceChildren: vi.fn(),
  listInstances: vi.fn(),
}))

import { getRGD, getInstance, getInstanceChildren, listInstances } from '@/lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

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
    x: 32,
    y: 32,
    width: 180,
    height: 48,
    ...overrides,
  }
}

function makeGraph(nodes: DAGNode[], edges: DAGEdge[] = []): DAGGraph {
  return { nodes, edges, width: 400, height: 200 }
}

/** A minimal RGD object with spec.schema.kind = schemaKind. */
function makeRGD(schemaKind: string, name = 'test-rgd'): K8sObject {
  return {
    metadata: { name },
    spec: {
      schema: { kind: schemaKind, apiVersion: 'v1alpha1' },
      resources: [
        {
          id: 'childResource',
          template: { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'child' } },
        },
      ],
    },
  }
}

/** A minimal instance object with Ready=True condition. */
function makeInstance(name: string, namespace: string): K8sObject {
  return {
    kind: 'Database',
    metadata: { name, namespace },
    status: {
      conditions: [{ type: 'Ready', status: 'True' }],
    },
  }
}

const emptyStateMap: NodeStateMap = {}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DeepDAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── T001: Renders expand icon on kro-managed CRD nodes ───────────────────

  it('T001: renders expand icon (▸) on kro-managed CRD nodes', () => {
    const rgds = [makeRGD('Database', 'database')]
    const kroNode = makeNode('db', { kind: 'Database' })
    const graph = makeGraph([kroNode])

    render(
      <DeepDAG
        graph={graph}
        nodeStateMap={emptyStateMap}
        rgds={rgds}
        namespace="default"
      />
    )

    // The toggle button for the kro node should be present and show ▸
    const toggle = screen.getByTestId('deep-dag-toggle-db')
    expect(toggle).toBeInTheDocument()
    expect(toggle.textContent).toContain('▸')
  })

  // ── T002: Does NOT render expand icon on non-kro nodes ───────────────────

  it('T002: does NOT render expand icon on non-kro (native k8s) nodes', () => {
    const rgds = [makeRGD('Database', 'database')]
    // Deployment is a native k8s kind — not in rgds
    const nativeNode = makeNode('deploy', { kind: 'Deployment' })
    const graph = makeGraph([nativeNode])

    render(
      <DeepDAG
        graph={graph}
        nodeStateMap={emptyStateMap}
        rgds={rgds}
        namespace="default"
      />
    )

    // No toggle element for this node
    expect(screen.queryByTestId('deep-dag-toggle-deploy')).not.toBeInTheDocument()
  })

  // ── T003: Renders nested subgraph on expand click ─────────────────────────

  it('T003: fetches child data and renders nested subgraph on expand click', async () => {
    const rgds = [makeRGD('Database', 'database')]
    const kroNode = makeNode('db', { kind: 'Database' })
    const graph = makeGraph([kroNode])

    // Set up API mocks
    const childRGD = makeRGD('Database', 'database')
    const childInstance = makeInstance('my-database', 'default')
    const childInstanceList = {
      items: [childInstance],
      metadata: {},
    }

    vi.mocked(getRGD).mockResolvedValue(childRGD)
    vi.mocked(listInstances).mockResolvedValue(childInstanceList)
    vi.mocked(getInstance).mockResolvedValue(childInstance)
    vi.mocked(getInstanceChildren).mockResolvedValue({ items: [] })

    render(
      <DeepDAG
        graph={graph}
        nodeStateMap={emptyStateMap}
        rgds={rgds}
        namespace="default"
      />
    )

    // Click the expand toggle
    const toggle = screen.getByTestId('deep-dag-toggle-db')
    await act(async () => {
      fireEvent.click(toggle)
    })

    // Loading state should appear
    await waitFor(() => {
      expect(screen.getByTestId('deep-dag-toggle-db')).toBeInTheDocument()
    })

    // Wait for nested subgraph to appear
    await waitFor(() => {
      expect(screen.getByTestId('deep-dag-nested-db')).toBeInTheDocument()
    })

    // Toggle now shows ▾ (collapsed indicator)
    expect(screen.getByTestId('deep-dag-toggle-db').textContent).toContain('▾')

    // API calls made correctly
    expect(getRGD).toHaveBeenCalledWith('database')
    expect(listInstances).toHaveBeenCalledWith('database', 'default')
  })

  // ── T004: Caps recursion at 4 levels ─────────────────────────────────────

  it('T004: shows max depth indicator instead of expand icon when depth >= 4', () => {
    const rgds = [makeRGD('Database', 'database')]
    const kroNode = makeNode('db', { kind: 'Database' })
    const graph = makeGraph([kroNode])

    // depth=4 means we've already expanded 4 levels deep
    render(
      <DeepDAG
        graph={graph}
        nodeStateMap={emptyStateMap}
        rgds={rgds}
        namespace="default"
        depth={4}
      />
    )

    // No expand toggle — should show max depth indicator (⋯) instead
    expect(screen.queryByTestId('deep-dag-toggle-db')).not.toBeInTheDocument()
    expect(screen.getByTestId('deep-dag-maxdepth-db')).toBeInTheDocument()
  })

  // ── T005: Collapses subgraph on toggle ────────────────────────────────────

  it('T005: collapses nested subgraph when toggle is clicked again', async () => {
    const rgds = [makeRGD('Database', 'database')]
    const kroNode = makeNode('db', { kind: 'Database' })
    const graph = makeGraph([kroNode])

    const childRGD = makeRGD('Database', 'database')
    const childInstance = makeInstance('my-database', 'default')
    vi.mocked(getRGD).mockResolvedValue(childRGD)
    vi.mocked(listInstances).mockResolvedValue({ items: [childInstance], metadata: {} })
    vi.mocked(getInstance).mockResolvedValue(childInstance)
    vi.mocked(getInstanceChildren).mockResolvedValue({ items: [] })

    render(
      <DeepDAG
        graph={graph}
        nodeStateMap={emptyStateMap}
        rgds={rgds}
        namespace="default"
      />
    )

    const toggle = screen.getByTestId('deep-dag-toggle-db')

    // Expand
    await act(async () => {
      fireEvent.click(toggle)
    })
    await waitFor(() => {
      expect(screen.getByTestId('deep-dag-nested-db')).toBeInTheDocument()
    })

    // Collapse
    await act(async () => {
      fireEvent.click(screen.getByTestId('deep-dag-toggle-db'))
    })

    // Nested subgraph should no longer be rendered
    expect(screen.queryByTestId('deep-dag-nested-db')).not.toBeInTheDocument()

    // Toggle shows ▸ again
    expect(screen.getByTestId('deep-dag-toggle-db').textContent).toContain('▸')
  })
})
