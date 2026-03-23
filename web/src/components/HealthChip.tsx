// HealthChip.tsx — Compact instance health summary chip for RGDCard.
//
// Shows "{ready} / {total} ready", "{total} ready", or "no instances"
// depending on the aggregated health across all instances of an RGD.
//
// Spec: .specify/specs/028-instance-health-rollup/spec.md US1 FR-001–FR-004

import type { HealthSummary, InstanceHealthState } from '@/lib/format'
import './HealthChip.css'

interface HealthChipProps {
  /** Aggregated health summary. null = loading / fetch not complete. */
  summary: HealthSummary | null
  /** true = show skeleton placeholder while the fetch is in flight. */
  loading?: boolean
}

/**
 * Derive the overall (worst) state from a HealthSummary.
 * Priority: error > reconciling > pending > unknown > ready
 */
function overallState(s: HealthSummary): InstanceHealthState {
  if (s.error > 0) return 'error'
  if (s.reconciling > 0) return 'reconciling'
  if (s.pending > 0) return 'pending'
  if (s.unknown > 0) return 'unknown'
  return 'ready'
}

/**
 * HealthChip — colored text pill showing aggregated instance health for an RGD.
 *
 * Renders:
 *   - Skeleton while loading
 *   - Nothing when fetch failed (summary null, loading false)
 *   - "no instances" when total === 0
 *   - "{total} ready" when all instances are ready
 *   - "{ready} / {total} ready" otherwise
 *
 * Spec: .specify/specs/028-instance-health-rollup/ FR-001, FR-002, FR-003, FR-004
 */
export default function HealthChip({ summary, loading = false }: HealthChipProps) {
  if (summary === null) {
    if (loading) {
      return <span className="health-chip health-chip--skeleton" aria-hidden="true" />
    }
    return null
  }

  if (summary.total === 0) {
    return (
      <span
        className="health-chip health-chip--empty"
        data-testid="health-chip"
        data-state="empty"
      >
        no instances
      </span>
    )
  }

  const state = overallState(summary)
  const label =
    summary.ready === summary.total
      ? `${summary.total} ready`
      : `${summary.ready} / ${summary.total} ready`

  return (
    <span
      className={`health-chip health-chip--${state}`}
      data-testid="health-chip"
      data-state={state}
      aria-label={`Instance health: ${label}`}
    >
      {label}
    </span>
  )
}
