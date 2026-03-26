// LiveNodeDetailPanel.test.tsx — regression tests for live-mode node detail panel.
//
// Covers the three bugs fixed in the node-detail exploration session:
//
//   Bug 1: State nodes (nodeType='state') must NOT show a "Live YAML" section or
//          attempt any API fetch. They produce no Kubernetes objects.
//
//   Bug 2: State nodes must NOT show a live-state badge ("Not Found", etc.).
//          The badge is only meaningful for nodes that map to cluster resources.
//
//   Bug 3: Pending nodes (liveState='pending', excluded by includeWhen) must NOT
//          show a "Live YAML" section or the misleading "CRD may not be provisioned"
//          error. They are absent by design, not because their CRD is missing.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LiveNodeDetailPanel from './LiveNodeDetailPanel'
import type { DAGNode } from '@/lib/dag'

// ── API mock ──────────────────────────────────────────────────────────────
// getResource must be mocked so tests don't fire real network calls.
// Tests for state/pending nodes assert it is NEVER called.

vi.mock('@/lib/api', () => ({
  getResource: vi.fn(),
}))

import { getResource } from '@/lib/api'
const mockedGetResource = vi.mocked(getResource)

// ── Helpers ───────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<DAGNode>): DAGNode {
  return {
    id: 'testNode',
    label: 'testNode',
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

function makeResourceInfo() {
  return {
    kind: 'ConfigMap',
    name: 'my-configmap',
    namespace: 'default',
    group: '',
    version: 'v1',
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('LiveNodeDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: resource fetch succeeds (for non-excluded nodes)
    mockedGetResource.mockResolvedValue({
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'my-configmap', namespace: 'default' },
    })
  })

  // ── Bug 1: State nodes must not show LIVE YAML or trigger API fetch ───────

  it('Bug-1a: state node does not render "Live YAML" section label', () => {
    const node = makeNode({
      id: 'combatResolve',
      label: 'combatResolve',
      nodeType: 'state',
      kind: '',
      includeWhen: ['${schema.spec.attackSeq > kstate(schema.status.game, "seq", 0)}'],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState={undefined}
        resourceInfo={makeResourceInfo()}
        onClose={() => {}}
      />,
    )

    expect(screen.queryByText('Live YAML')).not.toBeInTheDocument()
  })

  it('Bug-1b: state node does not call getResource', () => {
    const node = makeNode({
      id: 'dungeonInit',
      label: 'dungeonInit',
      nodeType: 'state',
      kind: '',
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState={undefined}
        resourceInfo={makeResourceInfo()}
        onClose={() => {}}
      />,
    )

    expect(mockedGetResource).not.toHaveBeenCalled()
  })

  it('Bug-1c: state node shows the "State store node" note instead of YAML', () => {
    const node = makeNode({
      id: 'actionResolve',
      label: 'actionResolve',
      nodeType: 'state',
      kind: '',
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState={undefined}
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/state store node/i)).toBeInTheDocument()
  })

  it('Bug-1d: state node shows its includeWhen expression', () => {
    const expr = '${kstate(schema.status.game, "initProcessedSeq", 0) == 0}'
    const node = makeNode({
      id: 'dungeonInit',
      label: 'dungeonInit',
      nodeType: 'state',
      kind: '',
      includeWhen: [expr],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState={undefined}
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    // Include When section must be rendered
    expect(screen.getByText('Include When')).toBeInTheDocument()
    // No YAML section
    expect(screen.queryByText('Live YAML')).not.toBeInTheDocument()
  })

  // ── Bug 2: State nodes must not show a live-state badge ──────────────────

  it('Bug-2a: state node renders no live-state badge when liveState is undefined', () => {
    const node = makeNode({
      id: 'tickDoT',
      label: 'tickDoT',
      nodeType: 'state',
      kind: '',
    })
    const { container } = render(
      <LiveNodeDetailPanel
        node={node}
        liveState={undefined}
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    // The live-state badge uses data-testid="node-detail-state-badge"
    expect(container.querySelector('[data-testid="node-detail-state-badge"]')).toBeNull()
  })

  it('Bug-2b: resource node correctly shows Ready badge when liveState=alive', () => {
    const node = makeNode({
      id: 'configMap',
      label: 'configMap',
      nodeType: 'resource',
      kind: 'ConfigMap',
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="alive"
        resourceInfo={makeResourceInfo()}
        onClose={() => {}}
      />,
    )

    const badge = screen.getByTestId('node-detail-state-badge')
    expect(badge).toHaveTextContent('Ready')
  })

  // ── Bug 3: Pending nodes (excluded by includeWhen) show accurate messaging ───
  //
  // InstanceDetail suppresses resourceInfo (returns null) for pending/not-found nodes.
  // The panel then renders an inline note inside "Live YAML" instead of fetching.
  // The state badge label is "Excluded" — more accurate than "Pending" since the
  // resource is excluded by includeWhen, not waiting to be created.

  it('Bug-3a: pending node with null resourceInfo does not call getResource', () => {
    const node = makeNode({
      id: 'modifierCR',
      label: 'modifierCR',
      nodeType: 'resource',
      kind: 'Modifier',
      includeWhen: ['${kstate(schema.status.game, "modifier", "none") != "none"}'],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="pending"
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    expect(mockedGetResource).not.toHaveBeenCalled()
  })

  it('Bug-3b: pending node with null resourceInfo shows "excluded by includeWhen" message', () => {
    const node = makeNode({
      id: 'modifierCR',
      label: 'modifierCR',
      nodeType: 'resource',
      kind: 'Modifier',
      includeWhen: ['${kstate(schema.status.game, "modifier", "none") != "none"}'],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="pending"
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/excluded by its/i)).toBeInTheDocument()
  })

  it('Bug-3c: pending node with null resourceInfo does not show the misleading CRD error', () => {
    const node = makeNode({
      id: 'modifierCR',
      label: 'modifierCR',
      nodeType: 'resource',
      kind: 'Modifier',
      includeWhen: ['${kstate(schema.status.game, "modifier", "none") != "none"}'],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="pending"
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    expect(screen.queryByText(/CRD may not be provisioned/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/API server doesn't recognise/i)).not.toBeInTheDocument()
  })

  it('Bug-3d: pending resource node still shows includeWhen and readyWhen sections', () => {
    const node = makeNode({
      id: 'modifierCR',
      label: 'modifierCR',
      nodeType: 'resource',
      kind: 'Modifier',
      includeWhen: ['${kstate(schema.status.game, "modifier", "none") != "none"}'],
      readyWhen: ['${modifierCR.status.?modifierType.orValue("") != ""}'],
      isConditional: true,
      hasReadyWhen: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="pending"
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Include When')).toBeInTheDocument()
    expect(screen.getByText('Ready When')).toBeInTheDocument()
  })

  it('Bug-3e: pending resource node shows "Excluded" state badge', () => {
    const node = makeNode({
      id: 'modifierCR',
      label: 'modifierCR',
      nodeType: 'resource',
      kind: 'Modifier',
      includeWhen: ['${kstate(schema.status.game, "modifier", "none") != "none"}'],
      isConditional: true,
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="pending"
        resourceInfo={null}
        onClose={() => {}}
      />,
    )

    const badge = screen.getByTestId('node-detail-state-badge')
    // "Excluded" is used instead of "Pending" — the resource is excluded by
    // includeWhen, not waiting to be created
    expect(badge).toHaveTextContent('Excluded')
  })

  // ── Positive: non-pending resource node still gets YAML section ──────────

  it('positive: non-pending resource node renders "Live YAML" section', () => {
    const node = makeNode({
      id: 'heroCR',
      label: 'heroCR',
      nodeType: 'resource',
      kind: 'Hero',
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="alive"
        resourceInfo={makeResourceInfo()}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Live YAML')).toBeInTheDocument()
  })

  it('positive: non-pending resource node calls getResource for the YAML fetch', () => {
    const node = makeNode({
      id: 'gameConfig',
      label: 'gameConfig',
      nodeType: 'resource',
      kind: 'ConfigMap',
    })
    render(
      <LiveNodeDetailPanel
        node={node}
        liveState="alive"
        resourceInfo={makeResourceInfo()}
        onClose={() => {}}
      />,
    )

    expect(mockedGetResource).toHaveBeenCalledOnce()
  })
})
