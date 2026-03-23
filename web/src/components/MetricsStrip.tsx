// MetricsStrip — compact horizontal strip showing kro controller operational counters.
// Polls GET /api/v1/kro/metrics every 30 seconds while mounted.
// Degrades independently of the rest of the page on fetch failure.

import { usePolling } from '@/hooks/usePolling'
import { getControllerMetrics } from '@/lib/api'
import type { ControllerMetrics } from '@/lib/api'
import './MetricsStrip.css'

// ── Counter cell ──────────────────────────────────────────────────────

interface CounterCellProps {
  label: string
  value: number | null | undefined
}

function CounterCell({ label, value }: CounterCellProps) {
  const display =
    value === null || value === undefined
      ? 'Not reported'
      : value.toLocaleString()

  return (
    <div className="metrics-strip__cell">
      <span className="metrics-strip__value" aria-label={label}>
        {display}
      </span>
      <span className="metrics-strip__label">{label}</span>
    </div>
  )
}

// ── Skeleton cell (loading state) ─────────────────────────────────────

function SkeletonCell() {
  return (
    <div className="metrics-strip__cell metrics-strip__cell--skeleton" aria-hidden="true">
      <span className="metrics-strip__skeleton-value" />
      <span className="metrics-strip__skeleton-label" />
    </div>
  )
}

// ── MetricsStrip ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000

export default function MetricsStrip() {
  const { data, error, loading } = usePolling<ControllerMetrics>(
    getControllerMetrics,
    [],
    { intervalMs: POLL_INTERVAL_MS },
  )

  // Initial loading state — no data yet, spinner skeleton
  if (loading && data === null) {
    return (
      <div className="metrics-strip metrics-strip--loading" aria-busy="true" aria-label="Loading controller metrics">
        <SkeletonCell />
        <SkeletonCell />
        <SkeletonCell />
        <SkeletonCell />
      </div>
    )
  }

  // Degraded state — fetch failed and we have no prior data to show
  if (error !== null && data === null) {
    return (
      <div className="metrics-strip metrics-strip--degraded" role="status">
        <span className="metrics-strip__degraded-msg">
          Controller metrics unavailable
        </span>
      </div>
    )
  }

  // Healthy (or stale-ok: error but prior data still shown silently)
  return (
    <div className="metrics-strip" role="status" aria-label="Controller metrics">
      <CounterCell label="Active watches" value={data?.watchCount} />
      <CounterCell label="GVRs served" value={data?.gvrCount} />
      <CounterCell label="Queue depth (kro)" value={data?.queueDepth} />
      <CounterCell label="Queue depth (client-go)" value={data?.workqueueDepth} />
    </div>
  )
}
