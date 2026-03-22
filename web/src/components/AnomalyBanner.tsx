// AnomalyBanner.tsx — Alert banner for detected kro event anomalies.
//
// Renders a dismissible amber (stuck) or rose (burst) banner per anomaly.
// Dismissal is local state only — not persisted.
//
// Spec: .specify/specs/019-smart-event-stream/ US3, FR-005

import { useState } from 'react'
import type { Anomaly } from '@/lib/events'
import './AnomalyBanner.css'

interface AnomalyBannerProps {
  anomaly: Anomaly
}

/**
 * AnomalyBanner — displays a single detected anomaly with dismiss button.
 *
 * Spec: .specify/specs/019-smart-event-stream/ FR-005, US3
 */
export default function AnomalyBanner({ anomaly }: AnomalyBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const isStuck = anomaly.type === 'stuck'

  return (
    <div
      className={`anomaly-banner ${isStuck ? 'anomaly-banner--stuck' : 'anomaly-banner--burst'}`}
      role="alert"
      data-testid="anomaly-banner"
      data-anomaly-type={anomaly.type}
    >
      <svg
        className="anomaly-banner__icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 1.5L14.5 13H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
        <line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>

      <span className="anomaly-banner__message">{anomaly.message}</span>

      <button
        type="button"
        className="anomaly-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss anomaly alert"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
