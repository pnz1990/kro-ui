// GenerateTab.test.tsx — Unit tests for GenerateTab, InstanceForm, BatchForm, RGDAuthoringForm
//
// Spec: .specify/specs/026-rgd-yaml-generator/ Testing Requirements

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GenerateTab from './GenerateTab'
import type { K8sObject } from '@/lib/api'

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeRGD(
  schemaSpec: Record<string, string> = {},
  kind = 'WebApp',
): K8sObject {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'ResourceGraphDefinition',
    metadata: { name: 'test-rgd' },
    spec: {
      schema: {
        kind,
        apiVersion: 'v1alpha1',
        group: 'kro.run',
        spec: schemaSpec,
        status: {},
      },
    },
  }
}

// Mock clipboard API
beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

// ── T029: GenerateTab — Form mode ─────────────────────────────────────────

describe('GenerateTab — form mode', () => {
  it('renders with data-testid="generate-tab"', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByTestId('generate-tab')).toBeDefined()
  })

  it('renders the three mode switcher buttons', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByTestId('mode-btn-form')).toBeDefined()
    expect(screen.getByTestId('mode-btn-batch')).toBeDefined()
    expect(screen.getByTestId('mode-btn-rgd')).toBeDefined()
  })

  it('mode btn labels are correct', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByTestId('mode-btn-form').textContent).toBe('Instance Form')
    expect(screen.getByTestId('mode-btn-batch').textContent).toBe('Batch')
    expect(screen.getByTestId('mode-btn-rgd').textContent).toBe('New RGD')
  })

  it('defaults to form mode — InstanceForm is rendered', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByTestId('instance-form')).toBeDefined()
  })

  it('renders metadata.name row for RGD with no spec fields', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByLabelText('metadata.name')).toBeDefined()
  })

  it('renders one input per spec field', () => {
    const rgd = makeRGD({ name: 'string', image: 'string' })
    render(<GenerateTab rgd={rgd} />)
    expect(screen.getByLabelText('name')).toBeDefined()
    expect(screen.getByLabelText('image')).toBeDefined()
  })

  it('renders enum field as select with correct options', () => {
    const rgd = makeRGD({ env: 'string | enum=dev,staging,prod' })
    render(<GenerateTab rgd={rgd} />)
    const select = screen.getByLabelText('env') as HTMLSelectElement
    expect(select.tagName.toLowerCase()).toBe('select')
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain('dev')
    expect(options).toContain('staging')
    expect(options).toContain('prod')
  })

  it('renders boolean field as checkbox', () => {
    const rgd = makeRGD({ enabled: 'boolean | default=true' })
    render(<GenerateTab rgd={rgd} />)
    const input = screen.getByLabelText('enabled') as HTMLInputElement
    expect(input.type).toBe('checkbox')
    expect(input.checked).toBe(true)
  })

  it('renders YAML preview', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    expect(screen.getByTestId('yaml-preview')).toBeDefined()
  })

  it('updates YAML preview when a field value changes', () => {
    const rgd = makeRGD({ replicas: 'integer | default=1' })
    render(<GenerateTab rgd={rgd} />)
    const input = screen.getByLabelText('replicas') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    // YAML preview should now reflect replicas: 5
    const yamlPreview = screen.getByTestId('yaml-preview')
    expect(yamlPreview).toBeDefined()
  })
})

// ── T029: InstanceForm — empty state ──────────────────────────────────────

describe('InstanceForm — empty state', () => {
  it('shows "no configurable fields" message when schema has no spec fields', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    // metadata.name row is present, but no field rows
    expect(screen.getByText(/no configurable fields/i)).toBeDefined()
  })
})

// ── T035: BatchForm mode ──────────────────────────────────────────────────

describe('GenerateTab — batch mode', () => {
  it('switches to batch mode on Batch button click', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    expect(screen.getByTestId('batch-form')).toBeDefined()
  })

  it('renders textarea in batch mode', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')
    expect(textarea).toBeDefined()
  })

  it('shows manifest count badge for 2 valid rows', () => {
    render(<GenerateTab rgd={makeRGD({ name: 'string' })} />)
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'name=alpha\nname=beta' } })
    // Badge with count should appear
    expect(screen.getByText(/2 manifests?/i)).toBeDefined()
  })

  it('shows error indicator for a malformed row', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: '=bad' } })
    expect(screen.getByText(/line 1/i)).toBeDefined()
  })
})

// ── T041: RGD authoring mode ──────────────────────────────────────────────

describe('GenerateTab — New RGD mode', () => {
  it('switches to New RGD mode on button click', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-rgd'))
    expect(screen.getByTestId('rgd-authoring-form')).toBeDefined()
  })

  it('kind input renders in New RGD mode', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-rgd'))
    const kindInput = screen.getByLabelText('Kind')
    expect(kindInput).toBeDefined()
  })

  it('Add Field button adds a new field row', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-rgd'))
    const addFieldBtn = screen.getByText(/add field/i)
    fireEvent.click(addFieldBtn)
    // After clicking, there should be at least one field row
    const fieldRows = document.querySelectorAll('.rgd-authoring-form__field-row')
    expect(fieldRows.length).toBeGreaterThanOrEqual(1)
  })

  it('Add Resource button adds a new resource row', () => {
    render(<GenerateTab rgd={makeRGD()} />)
    fireEvent.click(screen.getByTestId('mode-btn-rgd'))
    const initialRows = document.querySelectorAll('.rgd-authoring-form__resource-row').length
    const addResourceBtn = screen.getByText(/add resource/i)
    fireEvent.click(addResourceBtn)
    const afterRows = document.querySelectorAll('.rgd-authoring-form__resource-row').length
    expect(afterRows).toBe(initialRows + 1)
  })
})
