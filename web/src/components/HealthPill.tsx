// HealthPill.tsx — Instance health status pill for the instance detail header.
//
// Shows a prominent colored pill beside the instance name.
// State is derived from the already-polled instance data (no extra fetch needed).
//
// Spec: .specify/specs/028-instance-health-rollup/spec.md US3 FR-008

import type { InstanceHealth } from '@/lib/format'
import './HealthPill.css'

interface HealthPillProps {
  /** Current health state. null = data not yet loaded (shows skeleton). */
  health: InstanceHealth | null
}

/** Map 6-state value to a human-readable label. */
function pillLabel(state: string): string {
  switch (state) {
    case 'ready':       return 'Ready'
    case 'degraded':    return 'Degraded'
    case 'reconciling': return 'Reconciling'
    case 'error':       return 'Error'
    case 'pending':     return 'Pending'
    default:            return 'Unknown'
  }
}

/**
 * HealthPill — status pill rendered in the instance detail page header.
 *
 * Visible states: Ready (green), Degraded (orange), Reconciling (amber),
 *                 Error (rose), Pending (violet), Unknown (gray), loading skeleton.
 *
 * spec: .specify/specs/028-instance-health-rollup/ US3
 */
export default function HealthPill({ health }: HealthPillProps) {
  if (health === null) {
    return (
      <span
        className="health-pill health-pill--loading"
        data-testid="health-pill"
        aria-hidden="true"
      />
    )
  }

  const label = pillLabel(health.state)
  const tooltip = health.reason ? `${health.reason}${health.message ? `: ${health.message}` : ''}` : undefined

  return (
    <span
      className={`health-pill health-pill--${health.state}`}
      data-testid="health-pill"
      role="img"
      aria-label={`Health: ${label}`}
      title={tooltip}
    >
      {label}
    </span>
  )
}
