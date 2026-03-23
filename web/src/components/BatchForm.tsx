// BatchForm.tsx — Textarea-driven batch manifest generator.
//
// Renders a textarea for batch input (one line = one manifest).
// Shows per-row error indicators and a manifest count badge.
//
// Spec: .specify/specs/026-rgd-yaml-generator/ FR-008, FR-009

import type { SchemaDoc } from '@/lib/schema'
import type { BatchRow } from '@/lib/generator'
import './BatchForm.css'

export interface BatchFormProps {
  schema: SchemaDoc
  batchText: string
  onBatchTextChange: (text: string) => void
  rows: BatchRow[]
}

/**
 * BatchForm — textarea-driven batch manifest generator.
 *
 * Each non-empty line of the textarea becomes one YAML document in the preview.
 * Format hint: "key=value pairs separated by spaces. One manifest per line."
 */
export default function BatchForm({
  batchText,
  onBatchTextChange,
  rows,
}: BatchFormProps) {
  const validCount = rows.filter(
    (r) => Object.keys(r.values).length > 0,
  ).length

  return (
    <div className="batch-form" data-testid="batch-form">
      <div className="batch-form__header">
        <p className="batch-form__hint">
          Format: <code>key=value</code> pairs separated by spaces. One manifest per line.
        </p>
        {batchText.trim() && (
          <span className="batch-form__badge" data-testid="batch-count">
            {validCount} {validCount === 1 ? 'manifest' : 'manifests'}
          </span>
        )}
      </div>

      <textarea
        className="batch-form__textarea"
        value={batchText}
        onChange={(e) => onBatchTextChange(e.target.value)}
        rows={8}
        placeholder={'name=my-app image=nginx\nname=my-app-2 image=nginx:alpine'}
        aria-label="Batch input"
        spellCheck={false}
      />

      {!batchText.trim() && (
        <p className="batch-form__empty">
          Enter one set of values per line to generate multiple manifests
        </p>
      )}

      {/* Per-row error list */}
      {rows.some((r) => r.error) && (
        <ul className="batch-form__errors" aria-label="Batch parse errors">
          {rows
            .filter((r) => r.error)
            .map((r) => (
              <li key={r.index} className="batch-form__error-item">
                Line {r.index + 1}: {r.error}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
