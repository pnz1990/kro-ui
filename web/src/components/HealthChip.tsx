// HealthChip.tsx — Instance health summary chip for RGDCard.
//
// F-7: Shows a multi-segment bar with counts per health state.
// When all instances are ready: "{N} ready" in green.
// When there are non-ready instances: shows each non-ready count as a
// separate colored segment + the ready count, e.g.:
//   "2 ready  1 ⚠ degraded  1 ✗ error"
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
 * Priority: error > degraded > reconciling > pending > unknown > ready
 */
function overallState(s: HealthSummary): InstanceHealthState {
  if (s.error > 0) return 'error'
  if (s.degraded > 0) return 'degraded'
  if (s.reconciling > 0) return 'reconciling'
  if (s.pending > 0) return 'pending'
  if (s.unknown > 0) return 'unknown'
  return 'ready'
}

interface SegmentDef {
  state: InstanceHealthState
  icon: string
  label: string
}

const SEGMENTS: SegmentDef[] = [
  { state: 'error',       icon: '✗', label: 'error'       },
  { state: 'degraded',    icon: '⚠', label: 'degraded'    },
  { state: 'reconciling', icon: '↻', label: 'reconciling' },
  { state: 'pending',     icon: '…', label: 'pending'      },
  { state: 'unknown',     icon: '?', label: 'unknown'      },
]

/**
 * HealthChip — colored text pill showing aggregated instance health for an RGD.
 *
 * Renders:
 *   - Skeleton while loading
 *   - Nothing when fetch failed (summary null, loading false)
 *   - "no instances" when total === 0
 *   - "{total} ready" when all instances are ready (single green segment)
 *   - Multi-segment bar showing each non-zero state with icon + count when mixed
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

  // All ready — simple green label
  if (state === 'ready') {
    return (
      <span
        className="health-chip health-chip--ready"
        data-testid="health-chip"
        data-state="ready"
        aria-label={`Instance health: ${summary.total} ready`}
      >
        {summary.total} ready
      </span>
    )
  }

  // Mixed — render a segment per non-zero non-ready state + ready count
  const nonReadySegments = SEGMENTS.filter((seg) => summary[seg.state] > 0)

  return (
    <span
      className={`health-chip health-chip--${state} health-chip--bar`}
      data-testid="health-chip"
      data-state={state}
      aria-label={`Instance health: ${summary.ready} of ${summary.total} ready`}
    >
      {nonReadySegments.map((seg) => (
        <span
          key={seg.state}
          className={`health-chip__segment health-chip__segment--${seg.state}`}
          title={`${summary[seg.state]} ${seg.label}`}
        >
          {seg.icon} {summary[seg.state]}
        </span>
      ))}
      <span className="health-chip__segment health-chip__segment--ready">
        {summary.ready} ready
      </span>
    </span>
  )
}
