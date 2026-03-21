import type { ReadyStatus } from '@/lib/format'
import { readyStateLabel } from '@/lib/format'
import './ReadinessBadge.css'

interface ReadinessBadgeProps {
  status: ReadyStatus
}

/**
 * ReadinessBadge — colored pill badge derived from the Ready condition.
 *
 * States:
 *   ready   → green "Ready"
 *   error   → red "Not Ready" + tooltip showing reason/message
 *   unknown → gray "Unknown"
 *
 * Spec: .specify/specs/004-instance-list/spec.md FR-008
 */
export default function ReadinessBadge({ status }: ReadinessBadgeProps) {
  const label = readyStateLabel(status.state)

  const tooltip =
    status.state === 'error' && status.reason
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
