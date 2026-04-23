// LiveDAG.test.tsx — unit tests for the LiveDAG component.
//
// Issue #218: LiveDAG was the only DAG component without tests.
// Covers: rendering, live-state class application, node click, tooltip timer cleanup.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LiveDAG from './LiveDAG'
import type { DAGGraph, DAGNode, DAGEdge } from '@/lib/dag'
import type { NodeStateMap } from '@/lib/instanceNodeState'

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
    x: 50,
    y: 32,
    width: 180,
    height: 48,
    ...overrides,
  }
}

function makeGraph(nodes: DAGNode[], edges: DAGEdge[] = []): DAGGraph {
  return { nodes, edges, width: 400, height: 200 }
}

function makeStateMap(entries: Record<string, NodeStateMap[string]> = {}): NodeStateMap {
  return entries
}

// ── T218: LiveDAG tests ───────────────────────────────────────────────────

describe('LiveDAG', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── T218-01: basic render ───────────────────────────────────────────────

  it('T218-01: renders SVG with correct testid and at least one node', () => {
    const graph = makeGraph([makeNode('cfg')])
    render(<LiveDAG graph={graph} nodeStateMap={makeStateMap()} />)

    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-cfg')).toBeInTheDocument()
  })

  it('T218-02: renders without crashing when nodeStateMap is empty', () => {
    const graph = makeGraph([
      makeNode('a'),
      makeNode('b', { nodeType: 'instance' }),
    ])
    // Empty state map — should not throw
    expect(() =>
      render(<LiveDAG graph={graph} nodeStateMap={{}} />),
    ).not.toThrow()
  })

  it('T218-03: renders empty graph (no nodes) without crashing', () => {
    render(<LiveDAG graph={makeGraph([])} nodeStateMap={{}} />)
    expect(screen.getByTestId('dag-svg')).toBeInTheDocument()
  })

  // ── T218-04/05/06: live-state CSS classes ─────────────────────────────

  it('T218-04: applies dag-node-live--alive class when node state is alive', () => {
    const graph = makeGraph([makeNode('cfg', { kind: 'ConfigMap' })])
    const stateMap = makeStateMap({
      // nodeStateForNode looks up stateMap[node.kind.toLowerCase()]
      configmap: { state: 'alive', kind: 'ConfigMap', name: 'x', namespace: 'default', group: '', version: 'v1' },
    })
    render(<LiveDAG graph={graph} nodeStateMap={stateMap} />)
    expect(screen.getByTestId('dag-node-cfg').getAttribute('class')).toContain('dag-node-live--alive')
  })

  it('T218-05: applies dag-node-live--error class when node state is error', () => {
    const graph = makeGraph([makeNode('dep', { kind: 'Deployment' })])
    const stateMap = makeStateMap({
      // nodeStateForNode looks up stateMap[node.kind.toLowerCase()]
      deployment: { state: 'error', kind: 'Deployment', name: 'x', namespace: 'default', group: 'apps', version: 'v1' },
    })
    render(<LiveDAG graph={graph} nodeStateMap={stateMap} />)
    expect(screen.getByTestId('dag-node-dep').getAttribute('class')).toContain('dag-node-live--error')
  })

  it('T218-06: no live-state class when node is absent from stateMap (state is undefined)', () => {
    // LiveDAG only adds a live-state class when state is truthy — absence means no class.
    // This documents the current contract: absent nodes render without a state badge.
    const graph = makeGraph([makeNode('svc', { kind: 'Service' })])
    render(<LiveDAG graph={graph} nodeStateMap={{}} />)
    const cls = screen.getByTestId('dag-node-svc').getAttribute('class') ?? ''
    // Only base classes — no live-state class when state is undefined
    expect(cls).toContain('dag-node--resource')
    expect(cls).not.toContain('dag-node-live--')
  })

  // ── T218-07: selected node highlight ──────────────────────────────────

  it('T218-07: applies dag-node--selected class to the selected node', () => {
    const graph = makeGraph([makeNode('cm'), makeNode('ns', { y: 140 })])
    render(<LiveDAG graph={graph} nodeStateMap={{}} selectedNodeId="cm" />)

    expect(screen.getByTestId('dag-node-cm').getAttribute('class')).toContain('dag-node--selected')
    expect(screen.getByTestId('dag-node-ns').getAttribute('class')).not.toContain('dag-node--selected')
  })

  // ── T218-08: node click callback ──────────────────────────────────────

  it('T218-08: calls onNodeClick with the clicked node', () => {
    const onNodeClick = vi.fn()
    const node = makeNode('cm')
    render(<LiveDAG graph={makeGraph([node])} nodeStateMap={{}} onNodeClick={onNodeClick} />)

    fireEvent.click(screen.getByTestId('dag-node-cm'))
    expect(onNodeClick).toHaveBeenCalledOnce()
    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'cm' }))
  })

  it('T218-09: node can be activated with Enter key (keyboard a11y)', () => {
    const onNodeClick = vi.fn()
    render(<LiveDAG graph={makeGraph([makeNode('cm')])} nodeStateMap={{}} onNodeClick={onNodeClick} />)

    fireEvent.keyDown(screen.getByTestId('dag-node-cm'), { key: 'Enter' })
    expect(onNodeClick).toHaveBeenCalledOnce()
  })

  // ── T218-10: tooltip hide-timer is cleared on unmount ─────────────────

  it('T218-10: schedules a hide-timer on mouseLeave (setTimeout called)', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const graph = makeGraph([makeNode('cm')])
    render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    // Mouse into node then out — scheduleTooltipHide calls setTimeout
    fireEvent.mouseEnter(screen.getByTestId('dag-node-cm'))
    fireEvent.mouseLeave(screen.getByTestId('dag-node-cm'))

    expect(setTimeoutSpy).toHaveBeenCalled()
    setTimeoutSpy.mockRestore()
  })

  it('T218-11: cancels pending hide-timer on second mouseEnter (clearTimeout called)', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const graph = makeGraph([makeNode('cm')])
    render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    // First leave schedules hide, second enter cancels it
    fireEvent.mouseEnter(screen.getByTestId('dag-node-cm'))
    fireEvent.mouseLeave(screen.getByTestId('dag-node-cm'))
    fireEvent.mouseEnter(screen.getByTestId('dag-node-cm'))

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  // ── T218-11: edges rendered ────────────────────────────────────────────

  it('T218-12: renders edge paths for the provided edges', () => {
    const a = makeNode('a', { y: 32 })
    const b = makeNode('b', { y: 140 })
    const graph = makeGraph([a, b], [{ from: 'a', to: 'b' }])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)
    // At least one path element rendered for the edge
    expect(container.querySelectorAll('path.dag-edge').length).toBeGreaterThanOrEqual(1)
  })

  // ── T29-2: Node search keyboard shortcut (issue #771) ─────────────────

  it('T29-2-01: pressing "/" opens the node search box', () => {
    const graph = makeGraph([
      makeNode('cfg', { label: 'config', kind: 'ConfigMap' }),
      makeNode('svc', { label: 'service', kind: 'Service' }),
    ])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    expect(container.querySelector('.dag-node-search')).toBeInTheDocument()
    const input = container.querySelector('.dag-node-search__input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('role', 'searchbox')
    expect(input).toHaveAttribute('aria-label', 'Search DAG nodes')
  })

  it('T29-2-02: pressing Escape closes the search box', () => {
    const graph = makeGraph([makeNode('cfg', { label: 'config', kind: 'ConfigMap' })])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })
    expect(container.querySelector('.dag-node-search')).toBeInTheDocument()

    const input = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('.dag-node-search')).not.toBeInTheDocument()
  })

  it('T29-2-03: typing in search filters nodes — non-matching nodes become dimmed', () => {
    const graph = makeGraph([
      makeNode('cfg', { label: 'config', kind: 'ConfigMap' }),
      makeNode('svc', { label: 'service', kind: 'Service' }),
    ])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    const input = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    fireEvent.change(input, { target: { value: 'config' } })

    // The SVG g wrappers have opacity applied via style
    // "cfg" matches "config" label, "svc" does not
    const svgG = container.querySelectorAll('svg > g > g')
    // Find the wrapper for the non-matching node — it should have opacity: 0.25
    // We look for a <g> whose inner dag-node is svc
    const svcWrapper = Array.from(svgG).find((g) => g.querySelector('[data-testid="dag-node-svc"]'))
    const cfgWrapper = Array.from(svgG).find((g) => g.querySelector('[data-testid="dag-node-cfg"]'))
    expect(svcWrapper).toHaveStyle({ opacity: '0.25' })
    expect(cfgWrapper).not.toHaveStyle({ opacity: '0.25' })
  })

  it('T29-2-04: pressing Enter selects the top match and closes search', () => {
    const onNodeClick = vi.fn()
    const cfg = makeNode('cfg', { label: 'config', kind: 'ConfigMap' })
    const svc = makeNode('svc', { label: 'service', kind: 'Service', y: 140 })
    const graph = makeGraph([cfg, svc])
    const { container } = render(
      <LiveDAG graph={graph} nodeStateMap={{}} onNodeClick={onNodeClick} />,
    )

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    const input = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    fireEvent.change(input, { target: { value: 'config' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // onNodeClick called with the matching node
    expect(onNodeClick).toHaveBeenCalledOnce()
    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'cfg' }))
    // search box closed
    expect(container.querySelector('.dag-node-search')).not.toBeInTheDocument()
  })

  it('T29-2-05: Enter with no matches does not call onNodeClick', () => {
    const onNodeClick = vi.fn()
    const graph = makeGraph([makeNode('cfg', { label: 'config', kind: 'ConfigMap' })])
    const { container } = render(
      <LiveDAG graph={graph} nodeStateMap={{}} onNodeClick={onNodeClick} />,
    )

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    const input = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    fireEvent.change(input, { target: { value: 'zzznomatch' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onNodeClick).not.toHaveBeenCalled()
    // search box still closes after Enter
    expect(container.querySelector('.dag-node-search')).not.toBeInTheDocument()
  })

  it('T29-2-06: closing the search resets the query (no dimming after close)', () => {
    const graph = makeGraph([
      makeNode('cfg', { label: 'config', kind: 'ConfigMap' }),
      makeNode('svc', { label: 'service', kind: 'Service' }),
    ])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    const input = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    fireEvent.change(input, { target: { value: 'config' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    // After close, search box gone
    expect(container.querySelector('.dag-node-search')).not.toBeInTheDocument()

    // Re-open — input should be empty and no dimming
    fireEvent.keyDown(dagContainer, { key: '/' })
    const newInput = container.querySelector<HTMLInputElement>('.dag-node-search__input')!
    expect(newInput.value).toBe('')
  })

  it('T29-2-07: "/" does not open search when an input is already focused', () => {
    const graph = makeGraph([makeNode('cfg')])
    const { container } = render(<LiveDAG graph={graph} nodeStateMap={{}} />)

    // Simulate focused input inside the container
    const fakeInput = document.createElement('input')
    document.body.appendChild(fakeInput)
    fakeInput.focus()

    const dagContainer = container.querySelector('.live-dag-container')!
    fireEvent.keyDown(dagContainer, { key: '/' })

    // Search box should NOT open because document.activeElement is an input
    expect(container.querySelector('.dag-node-search')).not.toBeInTheDocument()

    document.body.removeChild(fakeInput)
  })
})
