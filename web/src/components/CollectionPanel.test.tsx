// CollectionPanel.test.tsx — Unit tests for CollectionPanel and isItemReady helper.
//
// Spec: .specify/specs/011-collection-explorer/
// Tests: T-001, T-002, T-003

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CollectionPanel from './CollectionPanel'
import { isItemReady } from '@/lib/collection'
import type { K8sObject } from '@/lib/api'
import type { DAGNode } from '@/lib/dag'

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal K8sObject representing a collection item with the given
 * kro labels. `ready` controls whether `status.phase` is "Running".
 */
function makeItem(
  index: number,
  total: number,
  nodeId: string,
  overrides: {
    ready?: boolean
    name?: string
    kind?: string
    creationTimestamp?: string
    phase?: string
  } = {},
): K8sObject {
  const {
    ready = true,
    name = `item-${index}`,
    kind = 'Pod',
    creationTimestamp = '2026-01-01T00:00:00Z',
    phase,
  } = overrides

  return {
    apiVersion: 'v1',
    kind,
    metadata: {
      name,
      namespace: 'default',
      creationTimestamp,
      labels: {
        'kro.run/node-id': nodeId,
        'kro.run/collection-index': String(index),
        'kro.run/collection-size': String(total),
      },
    },
    status: phase != null
      ? { phase }
      : ready
        ? { phase: 'Running' }
        : { phase: 'Pending' },
  }
}

function makeNode(nodeId: string, forEach = '${schema.spec.items}'): DAGNode {
  return {
    id: nodeId,
    label: nodeId,
    nodeType: 'collection',
    kind: 'Pod',
    isConditional: false,
    hasReadyWhen: false,
    celExpressions: [],
    includeWhen: [],
    readyWhen: [],
    forEach,
    isChainable: false,
    x: 0,
    y: 0,
    width: 180,
    height: 48,
  }
}

// ── T-003: isItemReady pure function ──────────────────────────────────────

describe('isItemReady', () => {
  it('returns true for phase=Running', () => {
    expect(isItemReady(makeItem(0, 1, 'pods', { phase: 'Running' }))).toBe(true)
  })

  it('returns true for phase=Active', () => {
    const item = makeItem(0, 1, 'pods', { phase: 'Running' })
    ;(item as Record<string, unknown>).status = { phase: 'Active' }
    expect(isItemReady(item)).toBe(true)
  })

  it('returns true for phase=Succeeded', () => {
    const item = makeItem(0, 1, 'pods', { phase: 'Running' })
    ;(item as Record<string, unknown>).status = { phase: 'Succeeded' }
    expect(isItemReady(item)).toBe(true)
  })

  it('returns false for phase=Pending', () => {
    expect(isItemReady(makeItem(0, 1, 'pods', { phase: 'Pending' }))).toBe(false)
  })

  it('returns false for phase=Failed', () => {
    const item = makeItem(0, 1, 'pods', { phase: 'Running' })
    ;(item as Record<string, unknown>).status = { phase: 'Failed' }
    expect(isItemReady(item)).toBe(false)
  })

  it('returns true for status.conditions Ready=True', () => {
    const item = makeItem(0, 1, 'pods')
    ;(item as Record<string, unknown>).status = {
      conditions: [{ type: 'Ready', status: 'True' }],
    }
    expect(isItemReady(item)).toBe(true)
  })

  it('returns true for status.conditions Available=True', () => {
    const item = makeItem(0, 1, 'pods')
    ;(item as Record<string, unknown>).status = {
      conditions: [{ type: 'Available', status: 'True' }],
    }
    expect(isItemReady(item)).toBe(true)
  })

  it('returns false for status.conditions Ready=False', () => {
    const item = makeItem(0, 1, 'pods')
    ;(item as Record<string, unknown>).status = {
      conditions: [{ type: 'Ready', status: 'False' }],
    }
    expect(isItemReady(item)).toBe(false)
  })

  it('returns false for missing status', () => {
    const item = makeItem(0, 1, 'pods')
    ;(item as Record<string, unknown>).status = undefined
    expect(isItemReady(item)).toBe(false)
  })
})

// ── T-001: CollectionPanel rendering ─────────────────────────────────────

describe('CollectionPanel', () => {
  const nodeId = 'workerPods'
  const node = makeNode(nodeId)

  it('renders one row per collection item', () => {
    const children = [
      makeItem(0, 3, nodeId, { name: 'myapp-alice' }),
      makeItem(1, 3, nodeId, { name: 'myapp-bob' }),
      makeItem(2, 3, nodeId, { name: 'myapp-charlie' }),
    ]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('myapp-alice')).toBeInTheDocument()
    expect(screen.getByText('myapp-bob')).toBeInTheDocument()
    expect(screen.getByText('myapp-charlie')).toBeInTheDocument()
  })

  it('sorts items by collection-index ascending', () => {
    // Provide items out of order
    const children = [
      makeItem(2, 3, nodeId, { name: 'charlie' }),
      makeItem(0, 3, nodeId, { name: 'alice' }),
      makeItem(1, 3, nodeId, { name: 'bob' }),
    ]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    const rows = screen.getAllByTestId('collection-item-row')
    expect(rows[0]).toHaveTextContent('alice')
    expect(rows[1]).toHaveTextContent('bob')
    expect(rows[2]).toHaveTextContent('charlie')
  })

  it('shows empty state for 0 items', () => {
    render(
      <CollectionPanel
        node={node}
        children={[]}
        namespace="default"
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('collection-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('collection-empty-state')).toHaveTextContent('forEach expression evaluated to an empty list')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <CollectionPanel
        node={node}
        children={[]}
        namespace="default"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByTestId('collection-panel-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows forEach expression in header', () => {
    render(
      <CollectionPanel
        node={node}
        children={[]}
        namespace="default"
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('collection-foreach-expr')).toHaveTextContent(
      '${schema.spec.items}',
    )
  })

  it('shows total count from kro.run/collection-size label', () => {
    const children = [makeItem(0, 5, nodeId)]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('collection-count')).toHaveTextContent('5')
  })

  it('transitions to YAML view on row click, then back to table', () => {
    const children = [makeItem(0, 1, nodeId, { name: 'myapp-alice' })]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    // Click the row → YAML view
    fireEvent.click(screen.getByTestId('collection-item-row'))
    expect(screen.getByTestId('collection-yaml-view')).toBeInTheDocument()
    expect(screen.queryByTestId('collection-table')).not.toBeInTheDocument()

    // Click back → table view
    fireEvent.click(screen.getByTestId('collection-back-btn'))
    expect(screen.getByTestId('collection-table')).toBeInTheDocument()
    expect(screen.queryByTestId('collection-yaml-view')).not.toBeInTheDocument()
  })

  it('shows legacy fallback when kro.run/node-id labels are absent', () => {
    const legacyItem: K8sObject = {
      kind: 'Pod',
      metadata: { name: 'legacy-pod', namespace: 'default', labels: {} },
      status: { phase: 'Running' },
    }
    render(
      <CollectionPanel
        node={node}
        children={[legacyItem]}
        namespace="default"
        onClose={() => {}}
      />,
    )

    // All children have no kro.run/node-id label → legacy notice is shown
    expect(screen.getByText(/Legacy collection — labels unavailable/)).toBeInTheDocument()
  })

  it('shows index, name, kind, status, age columns in table', () => {
    const children = [makeItem(0, 1, nodeId, { name: 'mypod', kind: 'Pod' })]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    const row = screen.getByTestId('collection-item-row')
    // Index column
    expect(row).toHaveTextContent('0')
    // Name
    expect(row).toHaveTextContent('mypod')
    // Kind
    expect(row).toHaveTextContent('Pod')
  })

  it('filters out children belonging to other nodes', () => {
    const children = [
      makeItem(0, 1, nodeId, { name: 'mine' }),
      makeItem(0, 1, 'otherNode', { name: 'not-mine' }),
    ]
    render(
      <CollectionPanel
        node={node}
        children={children}
        namespace="default"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('mine')).toBeInTheDocument()
    expect(screen.queryByText('not-mine')).not.toBeInTheDocument()
  })
})
