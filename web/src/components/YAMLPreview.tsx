// YAMLPreview.tsx — Read-only YAML display with Copy YAML and Copy kubectl-apply buttons.
//
// Wraps KroCodeBlock for syntax-highlighted display.
// Adds a "Copy kubectl apply" button that copies a heredoc snippet.
// Adds a "Validate against cluster" button (US9) that triggers a dry-run apply.
// Adds an "Apply to cluster" button (spec issue-713) gated on canApplyRGDs capability.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-006, FR-007
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US7 (React.memo), US9 (dry-run)
// Spec: .specify/specs/issue-713/spec.md O4, O5

import { memo, useState, useCallback } from 'react'
import type { DryRunResult, ApplyRGDResult } from '@/lib/api'
import KroCodeBlock from '@/components/KroCodeBlock'
import './YAMLPreview.css'

export interface YAMLPreviewProps {
  /** The YAML content to display and offer for copying. */
  yaml: string
  /** Title shown in the code block header. */
  title?: string
  /** US9: callback invoked when user clicks "Validate against cluster". */
  onValidate?: () => void
  /** US9: current dry-run result, or null when no result is pending/available. */
  validateResult?: DryRunResult | null
  /** US9: true while a validation request is in-flight. */
  validateLoading?: boolean
  /**
   * Apply-to-cluster callback (spec issue-713 O5).
   * When provided, an "Apply to cluster" button is rendered.
   * The callback is invoked when the user clicks the button.
   * The parent is responsible for making the API call and passing applyResult.
   */
  onApply?: () => void
  /** Current apply result, or null when no apply has been attempted. */
  applyResult?: ApplyRGDResult | null
  /** Error message from the last apply attempt, or null when no error. */
  applyError?: string | null
  /** true while an apply request is in-flight. */
  applyLoading?: boolean
}

/**
 * YAMLPreview — syntax-highlighted YAML with Copy YAML + Copy kubectl apply.
 *
 * Copy kubectl apply produces a heredoc snippet:
 *   kubectl apply -f - <<'EOF'
 *   <yaml>
 *   EOF
 *
 * When onValidate is provided, a "Validate against cluster" button is shown
 * that triggers a dry-run apply via the backend (spec 045 US9).
 *
 * When onApply is provided, an "Apply to cluster" button is shown that applies
 * the RGD YAML to the cluster via SSA (spec issue-713 O4, O5).
 * The parent controls whether to show onApply (check canApplyRGDs capability).
 *
 * Wrapped in React.memo so it skips reconciliation when yaml/title props are
 * unchanged — avoids redundant re-renders on large forms (spec 045 US7).
 */
const YAMLPreview = memo(function YAMLPreview({
  yaml,
  title = 'Manifest',
  onValidate,
  validateResult,
  validateLoading,
  onApply,
  applyResult,
  applyError,
  applyLoading,
}: YAMLPreviewProps) {
  const [copiedKubectl, setCopiedKubectl] = useState(false)

  const handleCopyKubectl = useCallback(() => {
    const snippet = `kubectl apply -f - <<'EOF'\n${yaml}\nEOF`
    navigator.clipboard.writeText(snippet).then(
      () => {
        setCopiedKubectl(true)
        setTimeout(() => setCopiedKubectl(false), 2000)
      },
      () => {/* silent fail — clipboard may be unavailable */},
    )
  }, [yaml])

  return (
    <div className="yaml-preview" data-testid="yaml-preview">
      <KroCodeBlock code={yaml} title={title} />
      <div className="yaml-preview__actions">
        <button
          type="button"
          className="yaml-preview__kubectl-btn"
          onClick={handleCopyKubectl}
          aria-label={copiedKubectl ? 'Copied kubectl apply!' : 'Copy kubectl apply command'}
          title="Copy kubectl apply"
        >
          {copiedKubectl ? 'Copied!' : 'Copy kubectl apply'}
        </button>
        {onValidate && (
          <button
            type="button"
            className="yaml-preview__kubectl-btn"
            onClick={onValidate}
            disabled={validateLoading}
            aria-busy={validateLoading ? 'true' : undefined}
            data-testid="dry-run-btn"
          >
            {validateLoading ? 'Validating\u2026' : 'Validate against cluster'}
          </button>
        )}
        {onApply && (
          <button
            type="button"
            className="yaml-preview__kubectl-btn yaml-preview__apply-btn"
            onClick={onApply}
            disabled={applyLoading}
            aria-busy={applyLoading ? 'true' : undefined}
            data-testid="apply-to-cluster-btn"
          >
            {applyLoading ? 'Applying\u2026' : 'Apply to cluster'}
          </button>
        )}
      </div>
      {validateResult !== null && validateResult !== undefined && (
        <div className="yaml-preview__validate-result" data-testid="dry-run-result">
          {validateResult.valid ? (
            <span className="yaml-preview__validate-ok">✓ Valid</span>
          ) : (
            <span className="yaml-preview__validate-err">
              ✗ Validation failed: {(validateResult as { valid: false; error: string }).error}
            </span>
          )}
        </div>
      )}
      {/* Apply result — shown after apply completes (spec issue-713 O6) */}
      {applyResult !== null && applyResult !== undefined && (
        <div className="yaml-preview__validate-result" data-testid="apply-result">
          <span className="yaml-preview__validate-ok">
            ✓ {applyResult.message}
          </span>
        </div>
      )}
      {applyError !== null && applyError !== undefined && applyError !== '' && (
        <div className="yaml-preview__validate-result" data-testid="apply-error">
          <span className="yaml-preview__validate-err">
            ✗ Apply failed: {applyError}
          </span>
        </div>
      )}
    </div>
  )
})

export default YAMLPreview
