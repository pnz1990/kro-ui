// NodeLibrary.test.tsx — Unit tests for the Designer node library panel.
//
// Design ref: docs/design/31-rgd-designer.md §Future → ✅

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodeLibrary, {
  NODE_LIBRARY_CATEGORIES,
  templateToResource,
  type NodeTemplate,
} from './NodeLibrary'

// ── templateToResource ─────────────────────────────────────────────────────

describe('templateToResource', () => {
  const tpl: NodeTemplate = {
    label: 'Deployment',
    description: 'Test deployment',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    templateYaml: 'spec: {}',
  }

  it('maps apiVersion and kind', () => {
    const r = templateToResource(tpl)
    expect(r.apiVersion).toBe('apps/v1')
    expect(r.kind).toBe('Deployment')
  })

  it('lowercases kind as default id', () => {
    const r = templateToResource(tpl)
    expect(r.id).toBe('deployment')
  })

  it('preserves templateYaml', () => {
    const r = templateToResource(tpl)
    expect(r.templateYaml).toBe('spec: {}')
  })

  it('defaults resourceType to managed', () => {
    const r = templateToResource(tpl)
    expect(r.resourceType).toBe('managed')
  })

  it('initialises forEachIterators with one entry', () => {
    const r = templateToResource(tpl)
    expect(r.forEachIterators).toHaveLength(1)
    expect(r.forEachIterators[0].variable).toBe('')
    expect(r.forEachIterators[0].expression).toBe('')
  })

  it('generates unique _key values', () => {
    const r1 = templateToResource(tpl)
    const r2 = templateToResource(tpl)
    expect(r1._key).not.toBe(r2._key)
  })
})

// ── NODE_LIBRARY_CATEGORIES ────────────────────────────────────────────────

describe('NODE_LIBRARY_CATEGORIES', () => {
  it('is non-empty', () => {
    expect(NODE_LIBRARY_CATEGORIES.length).toBeGreaterThan(0)
  })

  it('every template has required fields', () => {
    for (const cat of NODE_LIBRARY_CATEGORIES) {
      for (const tpl of cat.templates) {
        expect(tpl.label).toBeTruthy()
        expect(tpl.apiVersion).toBeTruthy()
        expect(tpl.kind).toBeTruthy()
        expect(tpl.description).toBeTruthy()
        expect(tpl.templateYaml).toBeTruthy()
      }
    }
  })

  it('contains Deployment in Workloads', () => {
    const workloads = NODE_LIBRARY_CATEGORIES.find((c) => c.label === 'Workloads')
    expect(workloads).toBeTruthy()
    const dep = workloads!.templates.find((t) => t.kind === 'Deployment')
    expect(dep).toBeTruthy()
  })

  it('contains Service in Networking', () => {
    const net = NODE_LIBRARY_CATEGORIES.find((c) => c.label === 'Networking')
    expect(net).toBeTruthy()
    const svc = net!.templates.find((t) => t.kind === 'Service')
    expect(svc).toBeTruthy()
  })
})

// ── NodeLibrary rendering ──────────────────────────────────────────────────

describe('NodeLibrary', () => {
  it('renders the panel header', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    expect(screen.getByText('Node Library')).toBeInTheDocument()
  })

  it('renders all category labels when expanded', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    for (const cat of NODE_LIBRARY_CATEGORIES) {
      expect(screen.getByText(cat.label)).toBeInTheDocument()
    }
  })

  it('renders template add buttons for expanded categories', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    // All categories are expanded by default
    expect(screen.getByTestId('node-library-add-Deployment')).toBeInTheDocument()
    expect(screen.getByTestId('node-library-add-Service')).toBeInTheDocument()
    expect(screen.getByTestId('node-library-add-ConfigMap')).toBeInTheDocument()
  })

  it('calls onAddResource with correct resource when template clicked', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const btn = screen.getByTestId('node-library-add-Deployment')
    fireEvent.click(btn)
    expect(onAdd).toHaveBeenCalledTimes(1)
    const resource = onAdd.mock.calls[0][0]
    expect(resource.kind).toBe('Deployment')
    expect(resource.apiVersion).toBe('apps/v1')
    expect(resource.resourceType).toBe('managed')
  })

  it('collapses the entire panel when collapse button clicked', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    // Body visible initially
    expect(screen.getByTestId('node-library')).toBeInTheDocument()
    expect(screen.getByText('Click a template to add it as a resource')).toBeInTheDocument()
    // Click collapse
    const collapseBtn = screen.getByTitle('Collapse node library')
    fireEvent.click(collapseBtn)
    expect(screen.queryByText('Click a template to add it as a resource')).not.toBeInTheDocument()
  })

  it('expands the panel again after collapsing', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const collapseBtn = screen.getByTitle('Collapse node library')
    fireEvent.click(collapseBtn)
    // Now collapsed — button says Expand
    const expandBtn = screen.getByTitle('Expand node library')
    fireEvent.click(expandBtn)
    expect(screen.getByText('Click a template to add it as a resource')).toBeInTheDocument()
  })

  it('toggles a category closed on click', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    // Click "Workloads" category header to collapse it
    const workloadsHeader = screen.getByRole('button', { name: /workloads/i })
    fireEvent.click(workloadsHeader)
    expect(screen.queryByTestId('node-library-add-Deployment')).not.toBeInTheDocument()
  })

  it('re-expands a collapsed category', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const workloadsHeader = screen.getByRole('button', { name: /workloads/i })
    fireEvent.click(workloadsHeader) // collapse
    fireEvent.click(workloadsHeader) // expand
    expect(screen.getByTestId('node-library-add-Deployment')).toBeInTheDocument()
  })

  it('sets aria-expanded on category headers', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const workloadsHeader = screen.getByRole('button', { name: /workloads/i })
    expect(workloadsHeader).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(workloadsHeader)
    expect(workloadsHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('sets aria-label on each template add button', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const btn = screen.getByTestId('node-library-add-Deployment')
    expect(btn).toHaveAttribute('aria-label', 'Add Deployment resource')
  })

  it('shows description text for each template', () => {
    const onAdd = vi.fn()
    render(<NodeLibrary onAddResource={onAdd} />)
    const deployTpl = NODE_LIBRARY_CATEGORIES.find((c) => c.label === 'Workloads')!
      .templates.find((t) => t.kind === 'Deployment')!
    expect(screen.getByText(deployTpl.description)).toBeInTheDocument()
  })
})
