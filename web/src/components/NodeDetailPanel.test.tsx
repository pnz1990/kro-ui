import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodeDetailPanel from './NodeDetailPanel'
import type { DAGNode } from '@/lib/dag'

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
    x: 0,
    y: 0,
    width: 180,
    height: 48,
    ...overrides,
  }
}

// ── T023: NodeTypeResource concept ────────────────────────────────────────

describe('NodeDetailPanel', () => {
  it('T023: shows kind and Managed Resource concept for NodeTypeResource', () => {
    const node = makeNode({ nodeType: 'resource', kind: 'ConfigMap' })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.getByTestId('node-detail-panel')).toBeInTheDocument()
    expect(screen.getByTestId('node-detail-kind')).toHaveTextContent('ConfigMap')
    expect(screen.getByTestId('node-detail-concept')).toHaveTextContent('Managed Resource')
  })

  // ── T024: NodeTypeCollection concept ──────────────────────────────────

  it('T024: shows forEach Collection concept for NodeTypeCollection', () => {
    const node = makeNode({
      nodeType: 'collection',
      kind: 'Deployment',
      forEach: '${schema.spec.items}',
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.getByTestId('node-detail-concept')).toHaveTextContent('forEach Collection')
  })

  // ── T025: NodeTypeExternal concept ────────────────────────────────────

  it('T025: shows External Reference concept for NodeTypeExternal', () => {
    const node = makeNode({
      nodeType: 'external',
      kind: 'Service',
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.getByTestId('node-detail-concept')).toHaveTextContent('External Reference')
  })

  // ── T026: NodeTypeInstance concept ────────────────────────────────────

  it('T026: shows Root Custom Resource concept for NodeTypeInstance', () => {
    const node = makeNode({
      id: 'schema',
      nodeType: 'instance',
      kind: 'WebApp',
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.getByTestId('node-detail-concept')).toHaveTextContent('Root Custom Resource')
  })

  // ── T027: includeWhen expressions rendered via KroCodeBlock ──────────

  it('T027: node with includeWhen expressions renders KroCodeBlock', () => {
    const node = makeNode({
      nodeType: 'resource',
      isConditional: true,
      includeWhen: ['${schema.spec.enableConfig}'],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    // KroCodeBlock is rendered (has data-testid="kro-code-block")
    expect(screen.getByTestId('kro-code-block')).toBeInTheDocument()
  })

  // ── T028: Close button calls onClose ─────────────────────────────────

  it('T028: clicking close button calls onClose callback', () => {
    const onClose = vi.fn()
    const node = makeNode({ nodeType: 'resource' })
    render(<NodeDetailPanel node={node} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('node-detail-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
