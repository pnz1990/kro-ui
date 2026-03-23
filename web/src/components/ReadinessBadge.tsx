import type { ReadyStatus, InstanceHealth } from '@/lib/format'
import './ReadinessBadge.css'

interface ReadinessBadgeProps {
  status: ReadyStatus | InstanceHealth
}

/** Map any 5-state value to its display label. */
function stateLabel(state: string): string {
  switch (state) {
    case 'ready':       return 'Ready'
    case 'error':       return 'Not Ready'
    case 'reconciling': return 'Reconciling'
    case 'pending':     return 'Pending'
    default:            return 'Unknown'
  }
}

/**
 * ReadinessBadge — colored pill badge derived from the Ready condition.
 *
 * States (5):
 *   ready       → green "Ready"
 *   error       → rose "Not Ready" + tooltip showing reason/message
 *   reconciling → amber "Reconciling" + tooltip showing reason
 *   pending     → violet "Pending"
 *   unknown     → gray "Unknown"
 *
 * Accepts both ReadyStatus (3-state) and InstanceHealth (5-state) since
 * they share the same { state, reason, message } shape.
 *
 * Spec: .specify/specs/028-instance-health-rollup/ US2 FR-006
 */
export default function ReadinessBadge({ status }: ReadinessBadgeProps) {
  const label = stateLabel(status.state)

  const showTooltip = (status.state === 'error' || status.state === 'reconciling') && status.reason
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
      {label}
    </span>
  )
}
