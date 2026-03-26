// RGDAuthoringForm.test.tsx — Form interaction tests for spec 044 extensions
//
// Tests: status field add/remove/update, resource type toggle, template editor,
// forEach iterators, advanced options (includeWhen/readyWhen), scope radio,
// spec field constraint expand/collapse.

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RGDAuthoringForm from './RGDAuthoringForm'
import type { RGDAuthoringState } from '@/lib/generator'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRes(patch: Partial<import('@/lib/generator').AuthoringResource> = {}): import('@/lib/generator').AuthoringResource {
  return {
    _key: 'res-0',
    id: 'web',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    resourceType: 'managed',
    templateYaml: '',
    includeWhen: '',
    readyWhen: [],
    forEachIterators: [{ _key: 'fe-0', variable: '', expression: '' }],
    externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
    ...patch,
  }
}

function makeState(overrides: Partial<RGDAuthoringState> = {}): RGDAuthoringState {
  return {
    rgdName: 'test-app',
    kind: 'TestApp',
    group: 'kro.run',
    apiVersion: 'v1alpha1',
    scope: 'Namespaced',
    specFields: [],
    statusFields: [],
    resources: [],
    ...overrides,
  }
}

function renderForm(
  state: RGDAuthoringState = makeState(),
  onChange = vi.fn(),
) {
  return render(<RGDAuthoringForm state={state} onChange={onChange} />)
}

// ── US7: Scope radio ──────────────────────────────────────────────────────

describe('Scope radio (US7)', () => {
  it('renders Namespaced and Cluster radio buttons', () => {
    renderForm()
    expect(screen.getByTestId('scope-namespaced')).toBeInTheDocument()
    expect(screen.getByTestId('scope-cluster')).toBeInTheDocument()
  })

  it('Namespaced radio is checked by default', () => {
    renderForm()
    const radio = screen.getByTestId('scope-namespaced') as HTMLInputElement
    expect(radio.checked).toBe(true)
  })

  it('calls onChange with scope: Cluster when Cluster radio clicked', () => {
    const onChange = vi.fn()
    renderForm(makeState({ scope: 'Namespaced' }), onChange)
    fireEvent.click(screen.getByTestId('scope-cluster'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'Cluster' }),
    )
  })
})

// ── US2: Status fields ────────────────────────────────────────────────────

describe('Status fields section (US2)', () => {
  it('renders status fields section', () => {
    renderForm()
    expect(screen.getByTestId('status-fields-section')).toBeInTheDocument()
  })

  it('renders add status field button', () => {
    renderForm()
    expect(screen.getByTestId('add-status-field-btn')).toBeInTheDocument()
  })

  it('adds a status field row when button clicked', () => {
    const onChange = vi.fn()
    renderForm(makeState(), onChange)
    fireEvent.click(screen.getByTestId('add-status-field-btn'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        statusFields: expect.arrayContaining([
          expect.objectContaining({ name: '', expression: '' }),
        ]),
      }),
    )
  })

  it('renders name and expression inputs for each status field', () => {
    const sf = { id: 'sf-1', name: 'endpoint', expression: '${svc.spec.clusterIP}' }
    renderForm(makeState({ statusFields: [sf] }))
    expect(screen.getByTestId('status-field-name-sf-1')).toBeInTheDocument()
    expect(screen.getByTestId('status-field-expr-sf-1')).toBeInTheDocument()
  })

  it('updates status field name on input change', () => {
    const onChange = vi.fn()
    const sf = { id: 'sf-1', name: '', expression: '' }
    renderForm(makeState({ statusFields: [sf] }), onChange)
    const input = screen.getByTestId('status-field-name-sf-1')
    fireEvent.change(input, { target: { value: 'endpoint' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        statusFields: [expect.objectContaining({ name: 'endpoint' })],
      }),
    )
  })

  it('removes status field when remove button clicked', () => {
    const onChange = vi.fn()
    const sf = { id: 'sf-1', name: 'endpoint', expression: '${x}' }
    renderForm(makeState({ statusFields: [sf] }), onChange)
    fireEvent.click(screen.getByTestId('status-field-remove-sf-1'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ statusFields: [] }),
    )
  })
})

// ── US5: Resource type toggle ─────────────────────────────────────────────

describe('Resource type toggle (US5)', () => {
  it('renders resource type select for each resource', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    expect(screen.getByTestId('resource-type-res-0')).toBeInTheDocument()
  })

  it('default is Managed', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    const sel = screen.getByTestId('resource-type-res-0') as HTMLSelectElement
    expect(sel.value).toBe('managed')
  })

  it('calls onChange when type changed to forEach', () => {
    const onChange = vi.fn()
    renderForm(makeState({ resources: [makeRes()] }), onChange)
    fireEvent.change(screen.getByTestId('resource-type-res-0'), {
      target: { value: 'forEach' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.arrayContaining([
          expect.objectContaining({ resourceType: 'forEach' }),
        ]),
      }),
    )
  })

  it('calls onChange when type changed to externalRef', () => {
    const onChange = vi.fn()
    renderForm(makeState({ resources: [makeRes()] }), onChange)
    fireEvent.change(screen.getByTestId('resource-type-res-0'), {
      target: { value: 'externalRef' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.arrayContaining([
          expect.objectContaining({ resourceType: 'externalRef' }),
        ]),
      }),
    )
  })
})

// ── US1: Template editor ──────────────────────────────────────────────────

describe('Template editor (US1)', () => {
  it('renders template expand button for managed resource', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    expect(screen.getByTestId('template-expand-res-0')).toBeInTheDocument()
  })

  it('template textarea is not visible before expand', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    expect(screen.queryByTestId('template-body-res-0')).not.toBeInTheDocument()
  })

  it('shows template textarea after clicking expand', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    fireEvent.click(screen.getByTestId('template-expand-res-0'))
    expect(screen.getByTestId('template-body-res-0')).toBeInTheDocument()
  })

  it('hides template textarea after second click (collapse)', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    const btn = screen.getByTestId('template-expand-res-0')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.queryByTestId('template-body-res-0')).not.toBeInTheDocument()
  })

  it('calls onChange with updated templateYaml on textarea change', () => {
    const onChange = vi.fn()
    renderForm(makeState({ resources: [makeRes()] }), onChange)
    fireEvent.click(screen.getByTestId('template-expand-res-0'))
    const textarea = screen.getByTestId('template-body-res-0')
    fireEvent.change(textarea, { target: { value: 'spec:\n  replicas: 3' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.arrayContaining([
          expect.objectContaining({ templateYaml: 'spec:\n  replicas: 3' }),
        ]),
      }),
    )
  })

  it('does NOT show template expand button for externalRef resource', () => {
    renderForm(makeState({ resources: [makeRes({ resourceType: 'externalRef' })] }))
    expect(screen.queryByTestId('template-expand-res-0')).not.toBeInTheDocument()
  })
})

// ── US5: forEach iterators ────────────────────────────────────────────────

describe('forEach iterators (US5)', () => {
  it('renders forEach iterator rows when resource is forEach type', () => {
    renderForm(
      makeState({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [{ _key: 'fe-0', variable: 'region', expression: '${schema.spec.regions}' }],
          }),
        ],
      }),
    )
    expect(screen.getByTestId('foreach-var-res-0-0')).toBeInTheDocument()
    expect(screen.getByTestId('foreach-expr-res-0-0')).toBeInTheDocument()
  })

  it('calls onChange with new iterator when add iterator clicked', () => {
    const onChange = vi.fn()
    renderForm(
      makeState({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [{ _key: 'fe-0', variable: 'x', expression: '${y}' }],
          }),
        ],
      }),
      onChange,
    )
    fireEvent.click(screen.getByTestId('foreach-add-res-0'))
    const call = onChange.mock.calls[0][0] as RGDAuthoringState
    expect(call.resources[0].forEachIterators).toHaveLength(2)
  })

  it('removes iterator when remove button clicked', () => {
    const onChange = vi.fn()
    renderForm(
      makeState({
        resources: [
          makeRes({
            resourceType: 'forEach',
            forEachIterators: [
              { _key: 'fe-0', variable: 'a', expression: '${x}' },
              { _key: 'fe-1', variable: 'b', expression: '${y}' },
            ],
          }),
        ],
      }),
      onChange,
    )
    fireEvent.click(screen.getByTestId('foreach-remove-res-0-0'))
    const call = onChange.mock.calls[0][0] as RGDAuthoringState
    expect(call.resources[0].forEachIterators).toHaveLength(1)
    expect(call.resources[0].forEachIterators[0].variable).toBe('b')
  })
})

// ── US3+US4: Advanced options ─────────────────────────────────────────────

describe('Advanced options - includeWhen + readyWhen (US3+US4)', () => {
  it('renders advanced options toggle button', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    expect(screen.getByTestId('advanced-expand-res-0')).toBeInTheDocument()
  })

  it('includeWhen input is not visible before expand', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    expect(screen.queryByTestId('resource-include-when-res-0')).not.toBeInTheDocument()
  })

  it('shows includeWhen input after clicking advanced expand', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    fireEvent.click(screen.getByTestId('advanced-expand-res-0'))
    expect(screen.getByTestId('resource-include-when-res-0')).toBeInTheDocument()
  })

  it('calls onChange when includeWhen value typed', () => {
    const onChange = vi.fn()
    renderForm(makeState({ resources: [makeRes()] }), onChange)
    fireEvent.click(screen.getByTestId('advanced-expand-res-0'))
    fireEvent.change(screen.getByTestId('resource-include-when-res-0'), {
      target: { value: '${schema.spec.monitoring}' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.arrayContaining([
          expect.objectContaining({ includeWhen: '${schema.spec.monitoring}' }),
        ]),
      }),
    )
  })

  it('shows add readyWhen button in advanced options', () => {
    renderForm(makeState({ resources: [makeRes()] }))
    fireEvent.click(screen.getByTestId('advanced-expand-res-0'))
    expect(screen.getByTestId('readywhen-add-res-0')).toBeInTheDocument()
  })

  it('adds a readyWhen row when button clicked', () => {
    const onChange = vi.fn()
    renderForm(makeState({ resources: [makeRes()] }), onChange)
    fireEvent.click(screen.getByTestId('advanced-expand-res-0'))
    fireEvent.click(screen.getByTestId('readywhen-add-res-0'))
    const call = onChange.mock.calls[0][0] as RGDAuthoringState
    expect(call.resources[0].readyWhen).toHaveLength(1)
  })

  it('removes a readyWhen row when remove button clicked', () => {
    const onChange = vi.fn()
    renderForm(
      makeState({
        resources: [makeRes({ readyWhen: ['${db.status.ready}', '${db.status.endpoint}'] })],
      }),
      onChange,
    )
    fireEvent.click(screen.getByTestId('advanced-expand-res-0'))
    fireEvent.click(screen.getByTestId('readywhen-remove-res-0-0'))
    const call = onChange.mock.calls[0][0] as RGDAuthoringState
    expect(call.resources[0].readyWhen).toHaveLength(1)
    expect(call.resources[0].readyWhen[0]).toBe('${db.status.endpoint}')
  })
})

// ── US8: Spec field constraint expansion ──────────────────────────────────

describe('Spec field constraints (US8)', () => {
  const field = { id: 'f1', name: 'replicas', type: 'integer', defaultValue: '1', required: false }

  it('renders field expand button', () => {
    renderForm(makeState({ specFields: [field] }))
    expect(screen.getByTestId('field-expand-f1')).toBeInTheDocument()
  })

  it('constraint inputs are not visible before expand', () => {
    renderForm(makeState({ specFields: [field] }))
    expect(screen.queryByTestId('field-min-f1')).not.toBeInTheDocument()
  })

  it('shows constraint inputs after clicking expand', () => {
    renderForm(makeState({ specFields: [field] }))
    fireEvent.click(screen.getByTestId('field-expand-f1'))
    expect(screen.getByTestId('field-min-f1')).toBeInTheDocument()
    expect(screen.getByTestId('field-max-f1')).toBeInTheDocument()
    expect(screen.getByTestId('field-enum-f1')).toBeInTheDocument()
    expect(screen.getByTestId('field-pattern-f1')).toBeInTheDocument()
  })

  it('hides constraint inputs on second click (collapse)', () => {
    renderForm(makeState({ specFields: [field] }))
    const btn = screen.getByTestId('field-expand-f1')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.queryByTestId('field-min-f1')).not.toBeInTheDocument()
  })

  it('calls onChange with updated minimum on input change', () => {
    const onChange = vi.fn()
    renderForm(makeState({ specFields: [field] }), onChange)
    fireEvent.click(screen.getByTestId('field-expand-f1'))
    fireEvent.change(screen.getByTestId('field-min-f1'), { target: { value: '1' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        specFields: expect.arrayContaining([expect.objectContaining({ minimum: '1' })]),
      }),
    )
  })

  it('calls onChange with updated enum on input change', () => {
    const onChange = vi.fn()
    renderForm(makeState({ specFields: [field] }), onChange)
    fireEvent.click(screen.getByTestId('field-expand-f1'))
    fireEvent.change(screen.getByTestId('field-enum-f1'), {
      target: { value: 'dev,staging,prod' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        specFields: expect.arrayContaining([
          expect.objectContaining({ enum: 'dev,staging,prod' }),
        ]),
      }),
    )
  })
})
