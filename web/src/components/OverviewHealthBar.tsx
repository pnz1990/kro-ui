// OverviewHealthBar — aggregate instance health summary for the Overview page.
// Rendered below the page header, above the RGD card grid.
// Consumes the already-fetched healthSummaries map from Home.tsx
// (no additional API calls).
//
// Spec: .specify/specs/055-overview-health-summary/spec.md

import type { HealthSummary } from '@/lib/format'
import './OverviewHealthBar.css'

interface OverviewHealthBarProps {
  /** Map from rgdName → HealthSummary. Populated progressively as background fetches resolve. */
  summaries: Map<string, HealthSummary>
  /** Total RGD count — used to show "M of N RGDs loaded" while loading */
  totalRGDs: number
}

/**
 * Aggregate all per-RGD HealthSummary values into a single fleet-level total.
 * RGDs with no instances (total === 0) contribute to the "no instances" count.
 * Exported for unit testing.
 */
export function aggregateSummaries(summaries: Map<string, HealthSummary>): {
  ready: number
  reconciling: number
  degraded: number
  error: number
  pending: number
  noInstances: number
} {
  let ready = 0, reconciling = 0, degraded = 0, error = 0, pending = 0, noInstances = 0

  for (const s of summaries.values()) {
    if (s.total === 0) {
      noInstances++
    } else {
      ready += s.ready
      reconciling += s.reconciling
      degraded += s.degraded
      error += s.error
      pending += s.pending
    }
  }

  return { ready, reconciling, degraded, error, pending, noInstances }
}

export default function OverviewHealthBar({ summaries, totalRGDs }: OverviewHealthBarProps) {
  // Don't render until we have at least some summaries
  if (summaries.size === 0) return null

  const { ready, reconciling, degraded, error, pending, noInstances } = aggregateSummaries(summaries)
  const total = ready + reconciling + degraded + error + pending

  const isPartialLoad = summaries.size < totalRGDs

  return (
    <div
      className="overview-health-bar"
      data-testid="overview-health-bar"
      aria-label="Fleet instance health summary"
      role="status"
    >
      {total > 0 && (
        <>
          {ready > 0 && (
            <span className="overview-health-bar__chip overview-health-bar__chip--ready">
              {ready} ready
            </span>
          )}
          {reconciling > 0 && (
            <span className="overview-health-bar__chip overview-health-bar__chip--reconciling">
              {reconciling} reconciling
            </span>
          )}
          {degraded > 0 && (
            <span className="overview-health-bar__chip overview-health-bar__chip--degraded">
              {degraded} degraded
            </span>
          )}
          {error > 0 && (
            <span className="overview-health-bar__chip overview-health-bar__chip--error">
              {error} error
            </span>
          )}
          {pending > 0 && (
            <span className="overview-health-bar__chip overview-health-bar__chip--pending">
              {pending} pending
            </span>
          )}
        </>
      )}
      {noInstances > 0 && (
        <span className="overview-health-bar__chip overview-health-bar__chip--empty">
          {noInstances} no instances
        </span>
      )}
      {isPartialLoad && (
        <span className="overview-health-bar__loading" aria-live="polite">
          ({summaries.size} of {totalRGDs} loaded)
        </span>
      )}
    </div>
  )
}
