import type { ReadyStatus, InstanceHealth } from '@/lib/format'
import { HEALTH_STATE_ICON } from '@/lib/format'
import './ReadinessBadge.css'

interface ReadinessBadgeProps {
  status: ReadyStatus | InstanceHealth
}

/** Map any 6-state value to its display label. */
function stateLabel(state: string): string {
  switch (state) {
    case 'ready':       return 'Ready'
    case 'degraded':    return 'Degraded'
    case 'error':       return 'Not Ready'
    case 'reconciling': return 'Reconciling'
    case 'pending':     return 'Pending'
    default:            return 'Unknown'
  }
}

/**
 * ReadinessBadge — colored pill badge derived from the Ready condition.
 *
 * States (6):
 *   ready       → green "✓ Ready"
 *   degraded    → orange "⚠ Degraded" + tooltip (CR ready but child errors)
 *   error       → rose "✗ Not Ready" + tooltip showing reason/message
 *   reconciling → amber "↻ Reconciling" + tooltip showing reason
 *   pending     → violet "… Pending"
 *   unknown     → gray "? Unknown"
 *
 * Icon prefix (aria-hidden) satisfies WCAG 2.1 SC 1.4.1 (Use of Color) —
 * spec issue-580 / docs/design/30-health-system.md.
 *
 * Accepts both ReadyStatus (3-state) and InstanceHealth (6-state) since
 * they share the same { state, reason, message } shape.
 *
 * Spec: .specify/specs/028-instance-health-rollup/ US2 FR-006
 */
export default function ReadinessBadge({ status }: ReadinessBadgeProps) {
  const label = stateLabel(status.state)
  const icon = HEALTH_STATE_ICON[status.state as keyof typeof HEALTH_STATE_ICON] ?? '?'

  const showTooltip = (status.state === 'error' || status.state === 'reconciling' || status.state === 'degraded') && status.reason
  const tooltip = showTooltip
    ? `${status.reason}${status.message ? `: ${status.message}` : ''}`
    : label

  return (
    <span
      className={`readiness-badge readiness-badge--${status.state}`}
      data-testid="readiness-badge"
      role="img"
      aria-label={`Readiness: ${label}`}
      title={tooltip}
    >
      <span aria-hidden="true" className="readiness-badge__icon">{icon}</span>
      {label}
    </span>
  )
}

