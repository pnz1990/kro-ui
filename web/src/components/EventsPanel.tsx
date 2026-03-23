// EventsPanel.tsx — Kubernetes events for a CR instance, newest-first.
//
// Updates on every poll cycle via props.
// Deletion-related events (FR-004, spec 031-deletion-debugger) are tagged
// with a ⊘ marker and a rose left-border accent.

import type { K8sList, K8sObject } from '@/lib/api'
import { isDeletionEvent } from '@/lib/k8s'
import './EventsPanel.css'

interface EventsPanelProps {
  events: K8sList | null
}

interface K8sEvent {
  metadata?: Record<string, unknown>
  eventTime?: string
  firstTimestamp?: string
  lastTimestamp?: string
  reason?: string
  message?: string
  type?: string
}

function getEventTime(event: K8sEvent): string {
  const ts = event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString(undefined, {
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

function getEventTimestamp(event: K8sEvent): number {
  const ts = event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp
  if (!ts) return 0
  try { return new Date(ts).getTime() } catch { return 0 }
}

function typeClass(type: string | undefined): string {
  switch (type) {
    case 'Warning': return 'event-type--warning'
    case 'Normal':  return 'event-type--normal'
    default:        return 'event-type--unknown'
  }
}

/**
 * EventsPanel — renders Kubernetes events for the instance, newest-first.
 *
 * Spec: .specify/specs/005-instance-detail-live/ US3 acceptance 3-4
 */
export default function EventsPanel({ events }: EventsPanelProps) {
  const items: K8sEvent[] = events?.items
    ? [...events.items as K8sEvent[]].sort(
        (a, b) => getEventTimestamp(b) - getEventTimestamp(a),
      )
    : []

  return (
    <div data-testid="events-panel" className="events-panel">
      <div className="panel-heading">Events</div>
      {items.length === 0 ? (
        <div className="panel-empty">No events.</div>
      ) : (
        <div className="events-list">
          {items.map((ev, i) => {
            const meta = ev.metadata as Record<string, unknown> | undefined
            const key = (meta?.name as string | undefined) ?? String(i)
            const time = getEventTime(ev)
            const isDeletion = isDeletionEvent(ev as K8sObject)
            return (
              <div key={key} className={`event-row${isDeletion ? ' event-row--deletion' : ''}`}>
                <div className="event-header">
                  {isDeletion && (
                    <span className="event-deletion-tag" aria-label="deletion event">⊘</span>
                  )}
                  {ev.type && (
                    <span className={`event-type ${typeClass(ev.type)}`}>
                      {ev.type}
                    </span>
                  )}
                  {ev.reason && (
                    <span className="event-reason">{ev.reason}</span>
                  )}
                  {time && (
                    <span className="event-time">{time}</span>
                  )}
                </div>
                {ev.message && (
                  <div className="event-message">{ev.message}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
