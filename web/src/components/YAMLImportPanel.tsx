// YAMLImportPanel.tsx — Collapsible YAML import panel for the RGD Designer.
//
// Allows the user to paste an existing ResourceGraphDefinition YAML and click
// "Apply" to populate the authoring form. On success the form state is replaced
// and the panel collapses. On parse error an inline message is shown.
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US8, FR-013–FR-016

import { useState } from 'react'
import { parseRGDYAML } from '@/lib/generator'
import type { RGDAuthoringState } from '@/lib/generator'
import './YAMLImportPanel.css'

interface YAMLImportPanelProps {
  /** Called when a valid RGD YAML is parsed and the user clicks Apply. */
  onImport: (state: RGDAuthoringState) => void
}

/**
 * YAMLImportPanel — collapsible paste-import panel.
 *
 * Collapsed by default. Toggle header to reveal textarea + Apply button.
 * On Apply:
 *   - valid YAML → calls onImport(state), collapses, clears textarea.
 *   - invalid YAML → shows inline parse error, does NOT call onImport.
 *
 * Spec: 045-rgd-designer-validation-optimizer US8
 */
export default function YAMLImportPanel({ onImport }: YAMLImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  function toggle() {
    setIsOpen((prev) => !prev)
    // Clear error when collapsing
    if (isOpen) setParseError(null)
  }

  function handleApply() {
    const result = parseRGDYAML(value)
    if (result.ok) {
      onImport(result.state)
      setIsOpen(false)
      setValue('')
      setParseError(null)
    } else {
      setParseError(result.error)
    }
  }

  return (
    <div className="yaml-import-panel">
      <button
        type="button"
        className="yaml-import-panel__header"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls="import-yaml-body"
        data-testid="import-yaml-toggle"
      >
        <span className="yaml-import-panel__toggle-icon">{isOpen ? '▾' : '▸'}</span>
        Import YAML
      </button>

      {isOpen && (
        <div className="yaml-import-panel__body" id="import-yaml-body">
          <textarea
            className="yaml-import-panel__textarea"
            rows={10}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              // Clear stale error on edit
              if (parseError) setParseError(null)
            }}
            placeholder="Paste a ResourceGraphDefinition YAML here…"
            aria-label="Paste ResourceGraphDefinition YAML"
            data-testid="import-yaml-input"
            spellCheck={false}
          />
          <button
            type="button"
            className="yaml-import-panel__apply-btn"
            onClick={handleApply}
            data-testid="import-yaml-apply"
          >
            Apply
          </button>
          {parseError !== null && (
            <span
              className="yaml-import-panel__error"
              role="alert"
              aria-live="polite"
              data-testid="import-parse-error"
            >
              {parseError}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
