// EventRow.tsx — Single Kubernetes event row with type indicator left border,
// timestamp, reason, message, and source.
//
// Spec: .specify/specs/019-smart-event-stream/
// kro v0.9.0: condition-transition events get a distinct visual category
// (blue left border + state-change icon) when HasInstanceConditionEvents is active.

import type { KubeEvent } from '@/lib/events'
import { isConditionTransitionEvent } from '@/lib/events'
import './EventRow.css'

interface EventRowProps {
  event: KubeEvent
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

function sourceLabel(event: KubeEvent): string {
  const comp = event.source?.component ?? event.reportingComponent ?? ''
  const host = event.source?.host ?? ''
  if (comp && host) return `${comp}/${host}`
  return comp || host
}

/**
 * EventRow — renders a single Kubernetes event with a left border colored
 * amber (Warning) or subtle gray (Normal).
 *
 * Spec: .specify/specs/019-smart-event-stream/ FR-001, SC-001
 */
export default function EventRow({ event }: EventRowProps) {
  const isWarning = event.type === 'Warning'
  const isConditionTransition = !isWarning && isConditionTransitionEvent(event)
  const src = sourceLabel(event)

  const rowClass = isWarning
    ? 'event-stream-row event-stream-row--warning'
    : isConditionTransition
      ? 'event-stream-row event-stream-row--condition'
      : 'event-stream-row event-stream-row--normal'

  const badgeClass = isWarning
    ? 'event-stream-row__type-badge event-stream-row__type-badge--warning'
    : isConditionTransition
      ? 'event-stream-row__type-badge event-stream-row__type-badge--condition'
      : 'event-stream-row__type-badge event-stream-row__type-badge--normal'

  return (
    <div
      className={rowClass}
      data-testid="event-row"
      data-event-type={event.type}
      data-event-category={isConditionTransition ? 'condition-transition' : undefined}
    >
      <div className="event-stream-row__body">
        <div className="event-stream-row__header">
          <span
            className={badgeClass}
            title={isConditionTransition ? 'Condition state transition (kro v0.9.0)' : undefined}
          >
            {isWarning ? (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 1L15 14H1L8 1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
                <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="12.5" r="0.75" fill="currentColor" />
              </svg>
            ) : isConditionTransition ? (
              // State-change icon for condition-transition events (kro v0.9.0)
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8h6M9 6l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="11" r="0.75" fill="currentColor" />
              </svg>
            )}
            {event.type}
          </span>

          <span className="event-stream-row__reason">{event.reason}</span>

          <span className="event-stream-row__object">
            {event.involvedObject.kind}/{event.involvedObject.name}
          </span>

          <span className="event-stream-row__time">{formatTimestamp(event.lastTimestamp)}</span>
        </div>

        {event.message && (
          <div className="event-stream-row__message">{event.message}</div>
        )}

        {src && (
          <div className="event-stream-row__source">{src}</div>
        )}
      </div>
    </div>
  )
}
