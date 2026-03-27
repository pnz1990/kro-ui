// YAMLPreview.tsx — Read-only YAML display with Copy YAML and Copy kubectl-apply buttons.
//
// Wraps KroCodeBlock for syntax-highlighted display.
// Adds a "Copy kubectl apply" button that copies a heredoc snippet.
// Adds a "Validate against cluster" button (US9) that triggers a dry-run apply.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-006, FR-007
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US7 (React.memo), US9 (dry-run)

import { memo, useState, useCallback } from 'react'
import type { DryRunResult } from '@/lib/api'
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
 * Wrapped in React.memo so it skips reconciliation when yaml/title props are
 * unchanged — avoids redundant re-renders on large forms (spec 045 US7).
 */
const YAMLPreview = memo(function YAMLPreview({
  yaml,
  title = 'Manifest',
  onValidate,
  validateResult,
  validateLoading,
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
    </div>
  )
})

export default YAMLPreview
