// YAMLPreview.tsx — Read-only YAML display with Copy YAML and Copy kubectl-apply buttons.
//
// Wraps KroCodeBlock for syntax-highlighted display.
// Adds a "Copy kubectl apply" button that copies a heredoc snippet.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-006, FR-007

import { useState, useCallback } from 'react'
import KroCodeBlock from '@/components/KroCodeBlock'
import './YAMLPreview.css'

export interface YAMLPreviewProps {
  /** The YAML content to display and offer for copying. */
  yaml: string
  /** Title shown in the code block header. */
  title?: string
}

/**
 * YAMLPreview — syntax-highlighted YAML with Copy YAML + Copy kubectl apply.
 *
 * Copy kubectl apply produces a heredoc snippet:
 *   kubectl apply -f - <<'EOF'
 *   <yaml>
 *   EOF
 *
 * Uses the same copy confirmation pattern as KroCodeBlock (icon swap, 2s reset).
 */
export default function YAMLPreview({ yaml, title = 'Manifest' }: YAMLPreviewProps) {
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
      </div>
    </div>
  )
}
