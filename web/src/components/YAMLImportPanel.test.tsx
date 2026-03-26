// YAMLImportPanel.test.tsx — Tests for the collapsible YAML import panel.
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US8

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import YAMLImportPanel from './YAMLImportPanel'

// Minimal valid RGD YAML that parseRGDYAML accepts
const VALID_RGD_YAML = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: test-app
spec:
  schema:
    kind: TestApp
    apiVersion: v1alpha1
`

// ── T046: collapse / expand behaviour ────────────────────────────────────

describe('YAMLImportPanel collapse/expand (T046)', () => {
  it('panel is collapsed by default — body not visible', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    expect(screen.queryByTestId('import-yaml-input')).not.toBeInTheDocument()
    expect(screen.queryByTestId('import-yaml-apply')).not.toBeInTheDocument()
  })

  it('clicking toggle expands panel — body visible', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    expect(screen.getByTestId('import-yaml-input')).toBeInTheDocument()
    expect(screen.getByTestId('import-yaml-apply')).toBeInTheDocument()
  })

  it('clicking toggle again collapses — body hidden', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    const toggle = screen.getByTestId('import-yaml-toggle')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.queryByTestId('import-yaml-input')).not.toBeInTheDocument()
  })

  it('aria-expanded toggles correctly', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    const toggle = screen.getByTestId('import-yaml-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

// ── T047: successful import ───────────────────────────────────────────────

describe('YAMLImportPanel successful import (T047)', () => {
  it('pasting valid RGD YAML and clicking Apply calls onImport with parsed state', () => {
    const onImport = vi.fn()
    render(<YAMLImportPanel onImport={onImport} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))

    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: VALID_RGD_YAML },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    expect(onImport).toHaveBeenCalledOnce()
    const state = onImport.mock.calls[0][0]
    expect(state.rgdName).toBe('test-app')
    expect(state.kind).toBe('TestApp')
  })

  it('after successful import the panel collapses and textarea is cleared', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: VALID_RGD_YAML },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    // Panel collapses — body no longer in DOM
    expect(screen.queryByTestId('import-yaml-input')).not.toBeInTheDocument()
  })

  it('import-parse-error is NOT shown on success', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: VALID_RGD_YAML },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    // After collapse, error element is gone too
    expect(screen.queryByTestId('import-parse-error')).not.toBeInTheDocument()
  })
})

// ── T048: failed import (invalid YAML) ───────────────────────────────────

describe('YAMLImportPanel failed import (T048)', () => {
  it('clicking Apply with invalid YAML shows import-parse-error with message', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: 'this is not yaml' },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    expect(screen.getByTestId('import-parse-error')).toBeInTheDocument()
    expect(screen.getByTestId('import-parse-error').textContent).toBeTruthy()
  })

  it('onImport is NOT called on invalid input', () => {
    const onImport = vi.fn()
    render(<YAMLImportPanel onImport={onImport} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: 'not a ResourceGraphDefinition' },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    expect(onImport).not.toHaveBeenCalled()
  })

  it('panel stays open after failed import', () => {
    render(<YAMLImportPanel onImport={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), {
      target: { value: 'bad input' },
    })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    // Panel stays open — input still visible
    expect(screen.getByTestId('import-yaml-input')).toBeInTheDocument()
  })

  it('clicking Apply with empty textarea shows error', () => {
    const onImport = vi.fn()
    render(<YAMLImportPanel onImport={onImport} />)
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    // textarea is empty (default)
    fireEvent.click(screen.getByTestId('import-yaml-apply'))

    expect(screen.getByTestId('import-parse-error')).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })
})

// ── US8/7: import is always a full replace, never a merge ─────────────────

describe('YAMLImportPanel full replace semantics (spec 045 US8/7)', () => {
  const YAML_A = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: app-a
spec:
  schema:
    kind: AppA
    apiVersion: v1alpha1
`
  const YAML_B = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: app-b
spec:
  schema:
    kind: AppB
    apiVersion: v1alpha1
`

  it('second import fully replaces first import state (not a merge)', () => {
    const onImport = vi.fn()
    render(<YAMLImportPanel onImport={onImport} />)

    // First import
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), { target: { value: YAML_A } })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))
    expect(onImport).toHaveBeenCalledOnce()
    const stateA = onImport.mock.calls[0][0]
    expect(stateA.rgdName).toBe('app-a')
    expect(stateA.kind).toBe('AppA')

    // Re-open and do second import
    fireEvent.click(screen.getByTestId('import-yaml-toggle'))
    fireEvent.change(screen.getByTestId('import-yaml-input'), { target: { value: YAML_B } })
    fireEvent.click(screen.getByTestId('import-yaml-apply'))
    expect(onImport).toHaveBeenCalledTimes(2)

    // Second call must have app-b state, not merged with app-a
    const stateB = onImport.mock.calls[1][0]
    expect(stateB.rgdName).toBe('app-b')
    expect(stateB.kind).toBe('AppB')
    // rgdName must NOT be 'app-a' (no merge)
    expect(stateB.rgdName).not.toBe('app-a')
  })
})
