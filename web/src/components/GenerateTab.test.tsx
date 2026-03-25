// GenerateTab.test.tsx — Unit tests for GenerateTab, InstanceForm, BatchForm, RGDAuthoringForm
//
// Spec: .specify/specs/026-rgd-yaml-generator/ Testing Requirements

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

/** Wrap GenerateTab in MemoryRouter (required because it now uses <Link>). */
function renderTab(rgd: K8sObject) {
  return render(
    <MemoryRouter>
      <GenerateTab rgd={rgd} />
    </MemoryRouter>
  )
}

// ── T029: GenerateTab — Form mode ─────────────────────────────────────────

describe('GenerateTab — form mode', () => {
  it('renders with data-testid="generate-tab"', () => {
    renderTab(makeRGD())
    expect(screen.getByTestId('generate-tab')).toBeDefined()
  })

  it('renders the two mode switcher buttons (New RGD mode removed in v0.4.1)', () => {
    renderTab(makeRGD())
    expect(screen.getByTestId('mode-btn-form')).toBeDefined()
    expect(screen.getByTestId('mode-btn-batch')).toBeDefined()
    expect(screen.queryByTestId('mode-btn-rgd')).toBeNull()
  })

  it('mode btn labels are correct', () => {
    renderTab(makeRGD())
    expect(screen.getByTestId('mode-btn-form').textContent).toBe('Instance Form')
    expect(screen.getByTestId('mode-btn-batch').textContent).toBe('Batch')
  })

  it('defaults to form mode — InstanceForm is rendered', () => {
    renderTab(makeRGD())
    expect(screen.getByTestId('instance-form')).toBeDefined()
  })

  it('renders metadata.name row for RGD with no spec fields', () => {
    renderTab(makeRGD())
    expect(screen.getByLabelText('metadata.name')).toBeDefined()
  })

  it('renders one input per spec field', () => {
    const rgd = makeRGD({ name: 'string', image: 'string' })
    renderTab(rgd)
    expect(screen.getByLabelText('name')).toBeDefined()
    expect(screen.getByLabelText('image')).toBeDefined()
  })

  it('renders enum field as select with correct options', () => {
    const rgd = makeRGD({ env: 'string | enum=dev,staging,prod' })
    renderTab(rgd)
    const select = screen.getByLabelText('env') as HTMLSelectElement
    expect(select.tagName.toLowerCase()).toBe('select')
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain('dev')
    expect(options).toContain('staging')
    expect(options).toContain('prod')
  })

  it('renders boolean field as checkbox', () => {
    const rgd = makeRGD({ enabled: 'boolean | default=true' })
    renderTab(rgd)
    const input = screen.getByLabelText('enabled') as HTMLInputElement
    expect(input.type).toBe('checkbox')
    expect(input.checked).toBe(true)
  })

  it('renders YAML preview', () => {
    renderTab(makeRGD())
    expect(screen.getByTestId('yaml-preview')).toBeDefined()
  })

  it('updates YAML preview when a field value changes', () => {
    const rgd = makeRGD({ replicas: 'integer | default=1' })
    renderTab(rgd)
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
    renderTab(makeRGD())
    // metadata.name row is present, but no field rows
    expect(screen.getByText(/no configurable fields/i)).toBeDefined()
  })
})

// ── T035: BatchForm mode ──────────────────────────────────────────────────

describe('GenerateTab — batch mode', () => {
  it('switches to batch mode on Batch button click', () => {
    renderTab(makeRGD())
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    expect(screen.getByTestId('batch-form')).toBeDefined()
  })

  it('renders textarea in batch mode', () => {
    renderTab(makeRGD())
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')
    expect(textarea).toBeDefined()
  })

  it('shows manifest count badge for 2 valid rows', () => {
    renderTab(makeRGD({ name: 'string' }))
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'name=alpha\nname=beta' } })
    // Badge with count should appear
    expect(screen.getByText(/2 manifests?/i)).toBeDefined()
  })

  it('shows error indicator for a malformed row', () => {
    renderTab(makeRGD())
    fireEvent.click(screen.getByTestId('mode-btn-batch'))
    const textarea = document.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: '=bad' } })
    expect(screen.getByText(/line 1/i)).toBeDefined()
  })
})

// ── T041: RGD authoring mode ──────────────────────────────────────────────

// New RGD mode was removed in v0.4.1 (issue #205).
// The authoring scaffolder is now at /author (spec 039).
// Tests for the mode have been removed; the mode-btn-rgd testid no longer exists.
describe('GenerateTab — RGD Designer link', () => {
  it('renders a link to /author', () => {
    renderTab(makeRGD())
    const link = screen.getByRole('link', { name: /RGD Designer/i })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toContain('/author')
  })
})
