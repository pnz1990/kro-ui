// MetricsStrip — compact horizontal strip showing kro controller operational counters.
// Polls GET /api/v1/kro/metrics every 30 seconds while mounted.
// Degrades independently of the rest of the page on fetch failure.

import { usePolling } from '@/hooks/usePolling'
import { getControllerMetrics } from '@/lib/api'
import type { ControllerMetrics } from '@/lib/api'
import { formatAge } from '@/lib/format'
import './MetricsStrip.css'

// ── Counter cell ──────────────────────────────────────────────────────

interface CounterCellProps {
  label: string
  value: number | null | undefined
  title?: string
}

function CounterCell({ label, value, title }: CounterCellProps) {
  const display =
    value === null || value === undefined
      ? 'Not reported'
      : value.toLocaleString()

  return (
    <div className="metrics-strip__cell" title={title}>
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

  // Degraded state — fetch failed and we have no prior data to show.
  // Surface context so the user knows whether this is a config issue or a
  // connectivity issue (issue #97).
  if (error !== null && data === null) {
    // usePolling stores errors as string | null — safe to use String() directly.
    const errMsg = String(error)
    let detail: string
    if (errMsg.includes('504') || errMsg.toLowerCase().includes('timeout')) {
      detail = 'metrics endpoint did not respond in time'
    } else if (errMsg.includes('502') || errMsg.toLowerCase().includes('bad gateway')) {
      detail = 'metrics endpoint returned an error'
    } else if (errMsg.includes('503') || errMsg.toLowerCase().includes('service unavailable')) {
      // Endpoint reachable but kro isn't exposing /metrics on that port yet
      detail = 'metrics endpoint returned 503 — check that kro is exposing /metrics'
    } else if (errMsg.toLowerCase().includes('connection refused') || errMsg.toLowerCase().includes('unreachable')) {
      // Network/DNS failure — kro controller pod not found or not reachable
      detail = 'kro controller pod not found in this cluster'
    } else {
      detail = 'metrics endpoint unavailable'
    }
    return (
      <div className="metrics-strip metrics-strip--degraded" role="status">
        <span className="metrics-strip__degraded-msg">
          Controller metrics unavailable — {detail}
        </span>
      </div>
    )
  }

  // Healthy (or stale-ok: error but prior data still shown silently)
  return (
    <div className="metrics-strip" role="status" aria-label="Controller metrics">
      <CounterCell
        label="Active watches"
        value={data?.watchCount}
        title="Number of Kubernetes resources currently being watched by the kro controller for change events"
      />
      <CounterCell
        label="GVRs served"
        value={data?.gvrCount}
        title="GVRs served — number of Kubernetes resource types (Group/Version/Resource) that kro is currently managing across all ResourceGraphDefinitions"
      />
      <CounterCell
        label="Queue depth (kro)"
        value={data?.queueDepth}
        title="Number of reconciliation requests waiting in kro's internal work queue — a sustained high value may indicate reconciliation bottlenecks"
      />
      <CounterCell
        label="Queue depth (client-go)"
        value={data?.workqueueDepth}
        title="Number of events waiting in the client-go work queue — this is the lower-level Kubernetes client event queue feeding the kro controller"
      />
      {data?.scrapedAt && (
        <span className="metrics-strip__updated">
          Updated {formatAge(data.scrapedAt)}
        </span>
      )}
    </div>
  )
}
