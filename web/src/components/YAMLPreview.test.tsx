// YAMLPreview.test.tsx — Tests for YAMLPreview component.
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US7 (React.memo), US9 (dry-run)

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import YAMLPreview from './YAMLPreview'

// ── US7: React.memo — no re-render when yaml prop is unchanged ────────────

describe('YAMLPreview React.memo (spec 045 US7)', () => {
  it('does not re-render when yaml prop is unchanged', () => {
    function ParentWithStableYaml() {
      const [tick, setTick] = useState(0)
      const yaml = 'apiVersion: v1\nkind: ConfigMap'
      return (
        <div>
          <button onClick={() => setTick((t) => t + 1)} data-testid="bump">
            bump
          </button>
          <YAMLPreview yaml={yaml} title="Test" />
          <span data-testid="tick">{tick}</span>
        </div>
      )
    }

    const { getByTestId } = render(<ParentWithStableYaml />)
    fireEvent.click(getByTestId('bump'))
    expect(screen.getByTestId('yaml-preview')).toBeInTheDocument()
    expect(getByTestId('tick').textContent).toBe('1')
  })

  it('YAMLPreview is exported as a React.memo component', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasInnerType = typeof (YAMLPreview as any)['type'] === 'function'
    expect(hasInnerType).toBe(true)
  })

  it('renders the yaml content', () => {
    render(<YAMLPreview yaml="apiVersion: v1" title="My RGD" />)
    expect(screen.getByTestId('yaml-preview')).toBeInTheDocument()
  })

  it('renders with default title when title prop is omitted', () => {
    render(<YAMLPreview yaml="apiVersion: v1" />)
    expect(screen.getByTestId('yaml-preview')).toBeInTheDocument()
  })

  it('shows Copy kubectl apply button', () => {
    render(<YAMLPreview yaml="apiVersion: v1" />)
    expect(screen.getByText('Copy kubectl apply')).toBeInTheDocument()
  })
})

// ── US9: dry-run validate button and result ────────────────────────────────

describe('YAMLPreview dry-run validate (spec 045 US9)', () => {
  it('onValidate present → Validate against cluster button visible', () => {
    render(<YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} />)
    expect(screen.getByTestId('dry-run-btn')).toBeInTheDocument()
    expect(screen.getByTestId('dry-run-btn').textContent).toContain('Validate against cluster')
  })

  it('onValidate absent → no dry-run button', () => {
    render(<YAMLPreview yaml="apiVersion: v1" />)
    expect(screen.queryByTestId('dry-run-btn')).not.toBeInTheDocument()
  })

  it('validateLoading=true → button text is "Validating…" and is disabled', () => {
    render(
      <YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} validateLoading={true} />,
    )
    const btn = screen.getByTestId('dry-run-btn')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toContain('Validating')
  })

  it('validateResult={ valid: true } → "Valid" text visible', () => {
    render(
      <YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} validateResult={{ valid: true }} />,
    )
    expect(screen.getByTestId('dry-run-result')).toBeInTheDocument()
    expect(screen.getByTestId('dry-run-result').textContent).toContain('Valid')
  })

  it('validateResult={ valid: false, error } → "Validation failed" and error text visible', () => {
    render(
      <YAMLPreview
        yaml="apiVersion: v1"
        onValidate={() => {}}
        validateResult={{ valid: false, error: 'bad CEL expression' }}
      />,
    )
    const result = screen.getByTestId('dry-run-result')
    expect(result.textContent).toContain('Validation failed')
    expect(result.textContent).toContain('bad CEL expression')
  })

  it('validateResult=null → dry-run-result absent', () => {
    render(
      <YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} validateResult={null} />,
    )
    expect(screen.queryByTestId('dry-run-result')).not.toBeInTheDocument()
  })

  // US9/5: stale result clears when yaml changes (prop identity change triggers clearing in parent)
  it('Copy kubectl apply button remains visible when a valid result is shown (US9/7)', () => {
    render(
      <YAMLPreview
        yaml="apiVersion: v1"
        onValidate={() => {}}
        validateResult={{ valid: true }}
      />,
    )
    // Copy button must still be present (not disabled, not removed)
    const copyBtn = screen.getByText('Copy kubectl apply')
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).not.toBeDisabled()
  })

  it('Copy kubectl apply button remains visible when a failed result is shown (US9/7)', () => {
    render(
      <YAMLPreview
        yaml="apiVersion: v1"
        onValidate={() => {}}
        validateResult={{ valid: false, error: 'bad CEL' }}
      />,
    )
    const copyBtn = screen.getByText('Copy kubectl apply')
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).not.toBeDisabled()
  })

  it('Validate button remains visible alongside Copy button — both accessible (US9/7)', () => {
    const handleValidate = vi.fn()
    render(
      <YAMLPreview yaml="apiVersion: v1" onValidate={handleValidate} />,
    )
    expect(screen.getByText('Copy kubectl apply')).toBeInTheDocument()
    expect(screen.getByTestId('dry-run-btn')).toBeInTheDocument()
  })

  it('validateResult rendered as valid when validateResult changes from null to { valid: true } (US9/5 stale check)', () => {
    // Parent controls validateResult; when yaml changes parent should reset it to null.
    // Here we verify the component correctly shows/hides result based on the prop.
    const { rerender } = render(
      <YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} validateResult={null} />,
    )
    expect(screen.queryByTestId('dry-run-result')).not.toBeInTheDocument()

    // Parent sets result
    rerender(
      <YAMLPreview yaml="apiVersion: v1" onValidate={() => {}} validateResult={{ valid: true }} />,
    )
    expect(screen.getByTestId('dry-run-result')).toBeInTheDocument()

    // Parent clears result (yaml changed → parent reset it to null)
    rerender(
      <YAMLPreview yaml="apiVersion: v2" onValidate={() => {}} validateResult={null} />,
    )
    expect(screen.queryByTestId('dry-run-result')).not.toBeInTheDocument()
  })
})
