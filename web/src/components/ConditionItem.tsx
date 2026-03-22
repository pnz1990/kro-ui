// ConditionItem.tsx — Single validation condition row.
//
// Displays status icon (✓/✗/○), condition type, reason, message, and
// last transition time. Long messages (>200 chars) are truncated with a
// "Show more" toggle.
//
// Spec: .specify/specs/017-rgd-validation-linting/ FR-002, FR-003

import { useState } from 'react'

/** Maximum message length before truncation. */
const MESSAGE_PREVIEW_LEN = 200

export interface RGDCondition {
  type: string
  status: string   // "True" | "False" | "Unknown"
  reason?: string
  message?: string
  lastTransitionTime?: string
}

interface ConditionItemProps {
  condition: RGDCondition
  /** Human-friendly label for the condition type, e.g. "Graph Verified". */
  label: string
}

function formatTime(ts: string | undefined): string {
  if (!ts) return 'N/A'
  try {
    const d = new Date(ts)
    // Zero time (0001-01-01T00:00:00Z) — treat as N/A
    if (d.getFullYear() < 1970) return 'N/A'
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

/**
 * ConditionItem — renders one row of the validation checklist.
 *
 * Spec: .specify/specs/017-rgd-validation-linting/ FR-002, FR-003
 */
export default function ConditionItem({ condition, label }: ConditionItemProps) {
  const [expanded, setExpanded] = useState(false)

  const status = condition.status
  const message = condition.message ?? ''
  const isLong = message.length > MESSAGE_PREVIEW_LEN
  const displayMessage = isLong && !expanded
    ? message.slice(0, MESSAGE_PREVIEW_LEN) + '…'
    : message

  let statusClass: string
  let statusIcon: string
  let statusLabel: string

  if (status === 'True') {
    statusClass = 'condition-item--true'
    statusIcon = '✓'
    statusLabel = 'Passed'
  } else if (status === 'False') {
    statusClass = 'condition-item--false'
    statusIcon = '✗'
    statusLabel = 'Failed'
  } else {
    statusClass = 'condition-item--pending'
    statusIcon = '○'
    statusLabel = 'Pending'
  }

  return (
    <div className={`condition-item ${statusClass}`} data-testid={`condition-item-${condition.type}`}>
      <div className="condition-item__header">
        <span className="condition-item__icon" aria-hidden="true">{statusIcon}</span>
        <span className="condition-item__label">{label}</span>
        <span className="condition-item__status-label">{statusLabel}</span>
        {condition.reason && (
          <span className="condition-item__reason">{condition.reason}</span>
        )}
      </div>

      {message && (
        <div className="condition-item__message">
          <pre className="condition-item__message-pre">{displayMessage}</pre>
          {isLong && (
            <button
              type="button"
              className="condition-item__toggle"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {!message && status !== 'True' && (
        <div className="condition-item__message">
          <span className="condition-item__pending-hint">
            Awaiting controller processing
          </span>
        </div>
      )}

      <div className="condition-item__time">
        Last transition: {formatTime(condition.lastTransitionTime)}
      </div>
    </div>
  )
}
