// HealthPill.tsx — Instance health status pill for the instance detail header.
//
// Shows a prominent colored pill beside the instance name.
// State is derived from the already-polled instance data (no extra fetch needed).
//
// Color-blind accessibility: each state shows an icon prefix (HEALTH_STATE_ICON)
// as a secondary signal alongside the hue, satisfying WCAG 2.1 SC 1.4.1.
//
// Spec: .specify/specs/028-instance-health-rollup/spec.md US3 FR-008
//       .specify/specs/issue-580/spec.md O2

import type { InstanceHealth } from '@/lib/format'
import { HEALTH_STATE_ICON } from '@/lib/format'
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

/** Per-state fallback tooltip when health.reason is absent. */
const STATE_TOOLTIP: Record<string, string> = {
  ready:       'All managed resources are healthy and readyWhen conditions are met.',
  degraded:    'Instance is ready at the CR level, but one or more child resources have errors (e.g. Available=False). Check the DAG for the affected nodes.',
  reconciling: 'kro is actively applying changes to this instance\'s managed resources. This is normal during creation and after updates.',
  error:       'A condition on this instance has failed. Check the Conditions panel for details.',
  pending:     'All conditions are Unknown — kro has not yet processed this instance.',
  unknown:     'No conditions have been reported yet for this instance.',
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
  const icon = HEALTH_STATE_ICON[health.state] ?? '?'
  // Prefer the reason/message from the condition; fall back to a static explanation.
  const tooltip = health.reason
    ? `${health.reason}${health.message ? `: ${health.message}` : ''}`
    : STATE_TOOLTIP[health.state]

  return (
    <span
      className={`health-pill health-pill--${health.state}`}
      data-testid="health-pill"
      role="img"
      aria-label={`Health: ${label}`}
      title={tooltip}
    >
      <span aria-hidden="true" className="health-pill__icon">{icon}</span>
      {label}
    </span>
  )
}

