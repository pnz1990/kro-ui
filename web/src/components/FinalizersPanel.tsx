// FinalizersPanel.tsx — Collapsible panel listing Kubernetes finalizers.
//
// Used on both the instance detail page (FR-002) and the live node detail
// slide-in panel (FR-006).
//
// Guard: renders nothing when finalizers array is empty.
// kro.run/* finalizers get a distinct primary-coloured badge border.
//
// Spec: .specify/specs/031-deletion-debugger/ FR-002, FR-006

import { useState } from 'react'
import './FinalizersPanel.css'

interface FinalizersPanelProps {
  /** List of finalizer strings. Renders nothing when empty. */
  finalizers: string[]
  /**
   * Whether the panel is initially expanded.
   * Defaults to false (collapsed). Should be true when the instance
   * is actively Terminating.
   */
  defaultExpanded?: boolean
}

/**
 * FinalizersPanel — collapsible list of finalizer strings.
 *
 * Empty array: returns null (AC-004).
 * kro.run/* finalizers: highlighted with primary-coloured border.
 * Collapsed label: "Finalizers (N)" — Expanded label: "Finalizers"
 */
export default function FinalizersPanel({ finalizers, defaultExpanded = false }: FinalizersPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // AC-004: Render nothing when finalizers list is empty
  if (finalizers.length === 0) return null

  const toggleLabel = expanded
    ? 'Finalizers'
    : `Finalizers (${finalizers.length})`

  return (
    <div className="finalizers-panel">
      <button
        type="button"
        className="finalizers-panel-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {toggleLabel}
        <span
          className={`finalizers-panel-toggle-chevron${expanded ? ' finalizers-panel-toggle-chevron--open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="finalizer-badges-list">
          {finalizers.map((f) => (
            <span
              key={f}
              className={`finalizer-badge${f.startsWith('kro.run/') ? ' finalizer-badge--kro' : ''}`}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
