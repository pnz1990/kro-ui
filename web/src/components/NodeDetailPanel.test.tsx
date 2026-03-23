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
    isChainable: false,
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

  // ── T027 (updated): includeWhen renders in labelled "Include When" section ──

  it('T027: node with includeWhen renders "Include When" section label', () => {
    const node = makeNode({
      nodeType: 'resource',
      isConditional: true,
      includeWhen: ['${schema.spec.enableConfig}'],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    // The section label should be "Include When", not the old "CEL Expressions"
    const labels = screen.getAllByText(/include when/i)
    expect(labels.length).toBeGreaterThanOrEqual(1)
    // KroCodeBlock is still rendered
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

  // ── T015a: readyWhen section (spec 021) ───────────────────────────────

  it('T015a: node with readyWhen shows "Ready When" section, not "CEL Expressions"', () => {
    const node = makeNode({
      nodeType: 'resource',
      hasReadyWhen: true,
      readyWhen: ['${appNamespace.status.phase == "Active"}'],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    // "Ready When" label must be present
    expect(screen.getByText('Ready When')).toBeInTheDocument()
    // Old merged label must NOT appear
    expect(screen.queryByText('CEL Expressions')).not.toBeInTheDocument()
  })

  it('T015b: node with only readyWhen shows no "Include When" section', () => {
    const node = makeNode({
      nodeType: 'resource',
      hasReadyWhen: true,
      readyWhen: ['${appNamespace.status.phase == "Active"}'],
      includeWhen: [],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.queryByText('Include When')).not.toBeInTheDocument()
  })

  it('T015c: node with both readyWhen and includeWhen shows both sections independently', () => {
    const node = makeNode({
      nodeType: 'resource',
      hasReadyWhen: true,
      isConditional: true,
      readyWhen: ['${appNamespace.status.phase == "Active"}'],
      includeWhen: ['${schema.spec.enableConfig}'],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.getByText('Ready When')).toBeInTheDocument()
    expect(screen.getByText('Include When')).toBeInTheDocument()
  })

  it('T015d: node with no readyWhen and no includeWhen shows neither section heading', () => {
    const node = makeNode({
      nodeType: 'resource',
      hasReadyWhen: false,
      readyWhen: [],
      includeWhen: [],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.queryByText('Ready When')).not.toBeInTheDocument()
    expect(screen.queryByText('Include When')).not.toBeInTheDocument()
    expect(screen.queryByText('CEL Expressions')).not.toBeInTheDocument()
  })

  it('T015e: node with empty-string readyWhen array treats it as absent', () => {
    const node = makeNode({
      nodeType: 'resource',
      hasReadyWhen: false,
      readyWhen: ['', '   '],
      includeWhen: [],
    })
    render(<NodeDetailPanel node={node} onClose={() => {}} />)

    expect(screen.queryByText('Ready When')).not.toBeInTheDocument()
  })
})
