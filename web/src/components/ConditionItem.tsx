// ConditionItem.tsx — Single validation condition row.
//
// Displays status icon (✓/✗/○), condition type, reason, message, and
// last transition time. Long messages (>200 chars) are truncated with a
// "Show more" toggle.
//
// Issue #103: known kro internal error patterns are rewritten into plain-English
// summaries; the raw Go error chain is available via a "Show raw" toggle.
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
  /**
   * True when the condition type is absent from status.conditions entirely
   * (i.e., this kro version does not emit it). Rendered as "Not reported"
   * with a neutral indicator rather than the orange "Pending" state.
   * See: https://github.com/pnz1990/kro-ui/issues/59
   */
  isAbsent?: boolean
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
 * rewriteConditionMessage — translates known kro internal error strings into
 * plain-English summaries. Returns null when no pattern matches (caller should
 * show the raw message as-is). (Issue #103)
 *
 * Recognised patterns:
 *   1. "cannot resolve group version kind ... schema not found"
 *      → "Referenced kind X is not yet registered — check that the providing
 *         RGD is Ready before applying this one."
 *   2. "references unknown identifiers: [...]"
 *      → "CEL expression references an unknown field or resource ID — check
 *         forEach, includeWhen, and readyWhen expressions for typos."
 *   3. "failed to build OpenAPI schema ... unknown type: array"
 *      → "Schema uses 'type: array' which is not supported by this kro version —
 *         use lists.range() with an integer field instead."
 */
function rewriteConditionMessage(reason: string, message: string): string | null {
  if (message.includes('cannot resolve group version kind') && message.includes('schema not found')) {
    // Extract "Kind=ChainChild" from within the GVK string.
    // The message format is: ... "kro.run/v1alpha1, Kind=ChainChild" ...
    const kindMatch = message.match(/Kind=([A-Za-z][A-Za-z0-9]*)/)
    const kindName = kindMatch ? kindMatch[1] : 'the referenced kind'
    return `Referenced kind "${kindName}" is not yet registered. ` +
      `Ensure the ResourceGraphDefinition that provides this kind is Ready before applying.`
  }

  if (message.includes('references unknown identifiers')) {
    const identMatch = message.match(/references unknown identifiers:\s*\[([^\]]+)\]/)
    const identList = identMatch ? identMatch[1] : 'unknown fields'
    return `CEL expression references unknown identifier(s): ${identList}. ` +
      `Check forEach, includeWhen, and readyWhen expressions for typos or missing resource IDs.`
  }

  if (message.includes('unknown type: array') || (message.includes('field type') && message.includes('array'))) {
    return `Schema field uses "type: array" which is not supported by this kro version. ` +
      `Use an integer field with lists.range() in the forEach expression instead.`
  }

  if (reason === 'AwaitingReconciliation') {
    return null // handled by the "Awaiting controller processing" hint already
  }

  return null // no known pattern — show raw
}

/**
 * ConditionItem — renders one row of the validation checklist.
 *
 * Spec: .specify/specs/017-rgd-validation-linting/ FR-002, FR-003
 */
export default function ConditionItem({ condition, label, isAbsent }: ConditionItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  // Absent conditions (not emitted by this kro version) render as "Not reported"
  // with a neutral indicator — distinct from Unknown/Pending which means the
  // controller hasn't processed it yet.
  if (isAbsent) {
    return (
      <div
        className="condition-item condition-item--absent"
        data-testid={`condition-item-${condition.type}`}
      >
        <div className="condition-item__header">
          <span className="condition-item__icon" aria-hidden="true">–</span>
          <span className="condition-item__label">{label}</span>
          <span className="condition-item__status-label">Not reported</span>
        </div>
        <div className="condition-item__message">
          <span className="condition-item__pending-hint">
            Not emitted by the connected kro version
          </span>
        </div>
      </div>
    )
  }

  const status = condition.status
  const rawMessage = condition.message ?? ''

  // Issue #103: rewrite known kro internal error patterns to plain English.
  // If no pattern matches, show raw message as-is (with optional truncation).
  const rewritten = rawMessage ? rewriteConditionMessage(condition.reason ?? '', rawMessage) : null
  const displayAsRewritten = rewritten !== null && !showRaw

  const isLong = rawMessage.length > MESSAGE_PREVIEW_LEN
  const displayRaw = isLong && !expanded
    ? rawMessage.slice(0, MESSAGE_PREVIEW_LEN) + '…'
    : rawMessage

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

      {rawMessage && (
        <div className="condition-item__message">
          {displayAsRewritten ? (
            <>
              <p className="condition-item__message-rewritten">{rewritten}</p>
              <button
                type="button"
                className="condition-item__toggle condition-item__toggle--raw"
                onClick={() => setShowRaw(true)}
              >
                Show raw error
              </button>
            </>
          ) : (
            <>
              <pre className="condition-item__message-pre">{displayRaw}</pre>
              {isLong && (
                <button
                  type="button"
                  className="condition-item__toggle"
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
              {rewritten !== null && (
                <button
                  type="button"
                  className="condition-item__toggle condition-item__toggle--raw"
                  onClick={() => setShowRaw(false)}
                >
                  Show summary
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!rawMessage && status !== 'True' && (
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
