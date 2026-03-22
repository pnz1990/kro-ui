// EventGroup.tsx — Collapsible instance group for the "By Instance" view.
//
// Shows the instance name as header with a warning count badge.
// Expanded/collapsed state is local; new events prepend without collapsing.
//
// Spec: .specify/specs/019-smart-event-stream/ US2

import { useState } from 'react'
import type { KubeEvent } from '@/lib/events'
import EventRow from './EventRow'
import './EventGroup.css'

interface EventGroupProps {
  instanceName: string
  events: KubeEvent[]
  /** If true, the group starts expanded (default: true). */
  initiallyExpanded?: boolean
}

function countWarnings(events: KubeEvent[]): number {
  return events.filter(e => e.type === 'Warning').length
}

/**
 * EventGroup — collapsible section for events belonging to one kro instance.
 *
 * The group header shows:
 * - Instance name
 * - Warning count badge (red/amber if > 0)
 * - Event count
 * - Chevron toggle
 *
 * Spec: .specify/specs/019-smart-event-stream/ FR-004, US2
 */
export default function EventGroup({ instanceName, events, initiallyExpanded = true }: EventGroupProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const warningCount = countWarnings(events)

  return (
    <div className="event-group" data-testid="event-group" data-instance={instanceName}>
      <button
        type="button"
        className="event-group__header"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        aria-controls={`event-group-body-${instanceName}`}
      >
        <svg
          className={`event-group__chevron ${expanded ? 'event-group__chevron--open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="event-group__name">{instanceName}</span>

        {warningCount > 0 && (
          <span
            className="event-group__warning-badge"
            aria-label={`${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
          >
            {warningCount}
          </span>
        )}

        <span className="event-group__count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <div
          id={`event-group-body-${instanceName}`}
          className="event-group__body"
          data-testid="event-group-body"
        >
          {events.map(event => (
            <EventRow key={event.metadata.uid} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
