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

// ── Spec 045 US10: static validation section ──────────────────────────────

describe('Static validation section (spec 045 US10)', () => {
  it('staticIssues=[] → static-validation-section absent', () => {
    renderForm(makeState(), vi.fn())
    expect(screen.queryByTestId('static-validation-section')).not.toBeInTheDocument()
  })

  it('staticIssues=[{field,message}] → section visible with field path and message', () => {
    const issues: import('@/lib/api').StaticIssue[] = [
      { field: 'spec.schema.spec.replicas', message: 'unknown type' },
    ]
    render(<RGDAuthoringForm state={makeState()} onChange={vi.fn()} staticIssues={issues} />)
    expect(screen.getByTestId('static-validation-section')).toBeInTheDocument()
    expect(screen.getByText('spec.schema.spec.replicas')).toBeInTheDocument()
    expect(screen.getByText('unknown type')).toBeInTheDocument()
  })

  it('multiple issues → multiple rows rendered', () => {
    const issues: import('@/lib/api').StaticIssue[] = [
      { field: 'spec.schema.spec.replicas', message: 'unknown type' },
      { field: 'spec.resources[web].id', message: 'resource ID must be lowerCamelCase' },
    ]
    render(<RGDAuthoringForm state={makeState()} onChange={vi.fn()} staticIssues={issues} />)
    expect(screen.getByText('spec.schema.spec.replicas')).toBeInTheDocument()
    expect(screen.getByText('spec.resources[web].id')).toBeInTheDocument()
  })
})

// T006: metadata validation messages (US1)
describe('Validation: metadata messages (spec 045 US1)', () => {
  it('shows "Kind is required" when kind is empty', () => {
    renderForm(makeState({ kind: '' }))
    expect(screen.getByText('Kind is required')).toBeInTheDocument()
  })

  it('shows PascalCase warning when kind is lowercase-first', () => {
    renderForm(makeState({ kind: 'webApp' }))
    expect(screen.getByText(/PascalCase/)).toBeInTheDocument()
  })

  it('shows no kind message when kind is valid PascalCase', () => {
    renderForm(makeState({ kind: 'WebApp' }))
    expect(screen.queryByText(/Kind is required/)).not.toBeInTheDocument()
    expect(screen.queryByText(/PascalCase/)).not.toBeInTheDocument()
  })

  it('shows "RGD name is required" when rgdName is empty', () => {
    renderForm(makeState({ rgdName: '' }))
    expect(screen.getByText('RGD name is required')).toBeInTheDocument()
  })

  it('YAML preview still renders even when validation errors exist', () => {
    // AuthorPage wraps YAMLPreview; in RGDAuthoringForm tests we just confirm
    // the form renders without crashing when kind is empty
    const { container } = renderForm(makeState({ kind: '' }))
    expect(container).not.toBeEmptyDOMElement()
  })
})

// T011: duplicate resource ID rendering (US2)
describe('Validation: duplicate resource ID (spec 045 US2)', () => {
  it('shows "Duplicate resource ID" on both rows when two resources share the same id', () => {
    const r1 = makeRes({ _key: 'r1', id: 'deployment' })
    const r2 = makeRes({ _key: 'r2', id: 'deployment' })
    renderForm(makeState({ resources: [r1, r2] }))
    const msgs = screen.getAllByText('Duplicate resource ID')
    expect(msgs).toHaveLength(2)
  })

  it('does not show duplicate message when ids are distinct', () => {
    const r1 = makeRes({ _key: 'r1', id: 'deployment' })
    const r2 = makeRes({ _key: 'r2', id: 'service' })
    renderForm(makeState({ resources: [r1, r2] }))
    expect(screen.queryByText('Duplicate resource ID')).not.toBeInTheDocument()
  })
})

// T014: duplicate spec/status field name rendering (US3)
describe('Validation: duplicate field names (spec 045 US3)', () => {
  it('shows "Duplicate spec field name" on both spec field rows with same name', () => {
    const f1: import('@/lib/generator').AuthoringField = {
      id: 'f1', name: 'replicas', type: 'integer', defaultValue: '', required: false,
    }
    const f2: import('@/lib/generator').AuthoringField = {
      id: 'f2', name: 'replicas', type: 'string', defaultValue: '', required: false,
    }
    renderForm(makeState({ specFields: [f1, f2] }))
    const msgs = screen.getAllByText('Duplicate spec field name')
    expect(msgs).toHaveLength(2)
  })

  it('shows "Duplicate status field name" on both status field rows with same name', () => {
    const sf1: import('@/lib/generator').AuthoringStatusField = {
      id: 'sf1', name: 'endpoint', expression: '${svc.spec.clusterIP}',
    }
    const sf2: import('@/lib/generator').AuthoringStatusField = {
      id: 'sf2', name: 'endpoint', expression: '${svc.spec.clusterIP}',
    }
    renderForm(makeState({ statusFields: [sf1, sf2] }))
    const msgs = screen.getAllByText('Duplicate status field name')
    expect(msgs).toHaveLength(2)
  })
})

// T018: min > max constraint rendering (US4)
describe('Validation: min > max constraint (spec 045 US4)', () => {
  it('shows "minimum must be ≤ maximum" inside expanded constraints panel', () => {
    const f: import('@/lib/generator').AuthoringField = {
      id: 'f1', name: 'count', type: 'integer', defaultValue: '',
      required: false, minimum: '10', maximum: '5',
    }
    renderForm(makeState({ specFields: [f] }))
    // Expand constraints
    fireEvent.click(screen.getByTestId('field-expand-f1'))
    expect(screen.getByText('minimum must be \u2264 maximum')).toBeInTheDocument()
  })
})

// T021: forEach no-iterator rendering (US5)
describe('Validation: forEach requires iterator (spec 045 US5)', () => {
  it('shows "forEach resources require at least one iterator" for forEach resource with no valid iterators', () => {
    const r = makeRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [{ _key: 'fe1', variable: '', expression: '' }],
    })
    renderForm(makeState({ resources: [r] }))
    expect(
      screen.getByText('forEach resources require at least one iterator'),
    ).toBeInTheDocument()
  })

  it('does not show iterator warning when forEach resource has a valid iterator', () => {
    const r = makeRes({
      _key: 'r1',
      id: 'configmap',
      resourceType: 'forEach',
      forEachIterators: [{ _key: 'fe1', variable: 'region', expression: '${schema.spec.regions}' }],
    })
    renderForm(makeState({ resources: [r] }))
    expect(
      screen.queryByText('forEach resources require at least one iterator'),
    ).not.toBeInTheDocument()
  })
})

// T023: validation summary badge rendering (US6)
describe('Validation: summary badge (spec 045 US6)', () => {
  it('does not show validation-summary when state is valid (kind=TestApp, rgdName=test-app)', () => {
    renderForm(makeState())
    expect(screen.queryByTestId('validation-summary')).not.toBeInTheDocument()
  })

  it('shows validation-summary with count when kind is empty', () => {
    renderForm(makeState({ kind: '' }))
    const badge = screen.getByTestId('validation-summary')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toMatch(/1/)
  })

  it('shows correct count for multiple issues (empty kind + empty rgdName)', () => {
    renderForm(makeState({ kind: '', rgdName: '' }))
    const badge = screen.getByTestId('validation-summary')
    expect(badge.textContent).toMatch(/2/)
  })

  // US1/5 + US6/3: validation is advisory only — form and YAML remain functional
  it('form still renders (not crashed/blocked) when validation errors are present (US1/5)', () => {
    const { container } = renderForm(makeState({ kind: '', rgdName: '' }))
    // The form element must still be in the DOM — errors do not prevent rendering
    expect(container.querySelector('[data-testid="rgd-authoring-form"]')).not.toBeNull()
    // The validation badge is present but no element is disabled that shouldn't be
    expect(screen.getByTestId('validation-summary')).toBeInTheDocument()
  })
})

// ── US10/7: graceful degradation when staticIssues is undefined ────────────

describe('Static validation section: graceful degradation (spec 045 US10/7)', () => {
  it('staticIssues undefined → section absent (silent degradation)', () => {
    // When the endpoint is unavailable, AuthorPage keeps staticIssues=[]
    // and does not pass the prop. Verify the section stays hidden.
    renderForm(makeState())
    expect(screen.queryByTestId('static-validation-section')).not.toBeInTheDocument()
  })

  it('staticIssues=[] (empty after endpoint failure) → section absent', () => {
    render(<RGDAuthoringForm state={makeState()} onChange={vi.fn()} staticIssues={[]} />)
    expect(screen.queryByTestId('static-validation-section')).not.toBeInTheDocument()
  })
})
