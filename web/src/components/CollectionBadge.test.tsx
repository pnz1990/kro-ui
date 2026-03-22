// CollectionBadge.test.tsx — Unit tests for the collection health badge.
//
// Spec: .specify/specs/011-collection-explorer/
// Tests: T-002

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CollectionBadge from './CollectionBadge'
import type { K8sObject } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeItem(
  index: number,
  total: number,
  nodeId: string,
  ready: boolean,
): K8sObject {
  return {
    kind: 'Pod',
    metadata: {
      name: `item-${index}`,
      namespace: 'default',
      creationTimestamp: '2026-01-01T00:00:00Z',
      labels: {
        'kro.run/node-id': nodeId,
        'kro.run/collection-index': String(index),
        'kro.run/collection-size': String(total),
      },
    },
    status: { phase: ready ? 'Running' : 'Pending' },
  }
}

// ── CollectionBadge tests ─────────────────────────────────────────────────

describe('CollectionBadge', () => {
  const nodeId = 'workerPods'
  // SVG context: wrap in <svg> to avoid DOM warnings
  function renderInSvg(el: React.ReactElement) {
    return render(<svg>{el}</svg>)
  }

  it('shows 3/3 and uses alive color when all ready', () => {
    const children = [
      makeItem(0, 3, nodeId, true),
      makeItem(1, 3, nodeId, true),
      makeItem(2, 3, nodeId, true),
    ]
    renderInSvg(
      <CollectionBadge
        nodeId={nodeId}
        children={children}
        nodeX={0}
        nodeY={0}
        nodeWidth={180}
        nodeHeight={48}
      />,
    )

    const badge = screen.getByTestId('collection-badge')
    expect(badge).toHaveTextContent('3/3')
    expect(badge).toHaveClass('collection-badge--all-ready')
  })

  it('shows 2/3 and uses warning color when partially ready', () => {
    const children = [
      makeItem(0, 3, nodeId, true),
      makeItem(1, 3, nodeId, true),
      makeItem(2, 3, nodeId, false),
    ]
    renderInSvg(
      <CollectionBadge
        nodeId={nodeId}
        children={children}
        nodeX={0}
        nodeY={0}
        nodeWidth={180}
        nodeHeight={48}
      />,
    )

    const badge = screen.getByTestId('collection-badge')
    expect(badge).toHaveTextContent('2/3')
    expect(badge).toHaveClass('collection-badge--partial')
  })

  it('shows 0/3 and uses error color when none ready', () => {
    const children = [
      makeItem(0, 3, nodeId, false),
      makeItem(1, 3, nodeId, false),
      makeItem(2, 3, nodeId, false),
    ]
    renderInSvg(
      <CollectionBadge
        nodeId={nodeId}
        children={children}
        nodeX={0}
        nodeY={0}
        nodeWidth={180}
        nodeHeight={48}
      />,
    )

    const badge = screen.getByTestId('collection-badge')
    expect(badge).toHaveTextContent('0/3')
    expect(badge).toHaveClass('collection-badge--none-ready')
  })

  it('renders nothing when no items match nodeId', () => {
    renderInSvg(
      <CollectionBadge
        nodeId={nodeId}
        children={[]}
        nodeX={0}
        nodeY={0}
        nodeWidth={180}
        nodeHeight={48}
      />,
    )

    expect(screen.queryByTestId('collection-badge')).not.toBeInTheDocument()
  })

  it('filters items by nodeId correctly', () => {
    const children = [
      makeItem(0, 2, nodeId, true),
      makeItem(1, 2, nodeId, true),
      makeItem(0, 2, 'otherNode', false),
    ]
    renderInSvg(
      <CollectionBadge
        nodeId={nodeId}
        children={children}
        nodeX={0}
        nodeY={0}
        nodeWidth={180}
        nodeHeight={48}
      />,
    )

    const badge = screen.getByTestId('collection-badge')
    // Only the 2 matching items are counted, not the otherNode item
    expect(badge).toHaveTextContent('2/2')
    expect(badge).toHaveClass('collection-badge--all-ready')
  })
})
