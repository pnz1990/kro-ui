import type { ReadyState } from '@/lib/format'
import { readyStateLabel } from '@/lib/format'
import './StatusDot.css'

interface StatusDotProps {
  state: ReadyState
  reason?: string
  message?: string
}

export default function StatusDot({ state, reason, message }: StatusDotProps) {
  const label = readyStateLabel(state)
  const tooltip = reason ? `${reason}: ${message ?? ''}` : label

  return (
    <span
      className={`status-dot status-dot--${state}`}
      data-testid="status-dot"
      role="img"
      aria-label={`Status: ${label}`}
      title={tooltip}
    />
  )
}
