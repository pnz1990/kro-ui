// OverviewHealthBar — aggregate instance health summary for the Overview page.
// Rendered below the page header, above the RGD card grid.
// Consumes the already-fetched healthSummaries map from Home.tsx
// (no additional API calls).
//
// Chips are clickable when onFilter is provided — clicking a chip filters the
// Overview card grid to show only RGDs with instances in that health state.
// Clicking the active chip clears the filter.
//
// Spec: .specify/specs/055-overview-health-summary/spec.md
// Filter interaction: spec .specify/specs/060-health-filter/spec.md

import type { HealthSummary } from '@/lib/format'
import './OverviewHealthBar.css'

/** Health state keys that can be used as filter values. */
export type HealthFilterState = 'ready' | 'reconciling' | 'degraded' | 'error' | 'pending' | 'noInstances'

interface OverviewHealthBarProps {
  /** Map from rgdName → HealthSummary. Populated progressively as background fetches resolve. */
  summaries: Map<string, HealthSummary>
  /** Total RGD count — used to show "M of N RGDs loaded" while loading */
  totalRGDs: number
  /** Currently active filter state — chip is highlighted when set. */
  activeFilter?: HealthFilterState | null
  /** Called when a chip is clicked. Passes null to clear. */
  onFilter?: (state: HealthFilterState | null) => void
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

export default function OverviewHealthBar({ summaries, totalRGDs, activeFilter, onFilter }: OverviewHealthBarProps) {
  // Don't render until we have at least some summaries
  if (summaries.size === 0) return null

  const { ready, reconciling, degraded, error, pending, noInstances } = aggregateSummaries(summaries)
  const total = ready + reconciling + degraded + error + pending

  const isPartialLoad = summaries.size < totalRGDs

  /** Renders one chip — as a button when onFilter is provided, span otherwise. */
  function Chip({ state, count, label }: { state: HealthFilterState; count: number; label: string }) {
    const isActive = activeFilter === state
    const className = [
      'overview-health-bar__chip',
      `overview-health-bar__chip--${state === 'noInstances' ? 'empty' : state}`,
      isActive ? 'overview-health-bar__chip--active' : '',
      onFilter ? 'overview-health-bar__chip--clickable' : '',
    ].filter(Boolean).join(' ')

    if (onFilter) {
      return (
        <button
          type="button"
          className={className}
          onClick={() => onFilter(isActive ? null : state)}
          aria-pressed={isActive}
          title={isActive ? `Clear filter: ${label}` : `Filter to RGDs with ${label} instances`}
          data-testid={`health-filter-${state}`}
        >
          {count} {label}
        </button>
      )
    }
    return (
      <span className={className}>
        {count} {label}
      </span>
    )
  }

  return (
    <div
      className="overview-health-bar"
      data-testid="overview-health-bar"
      aria-label="Fleet instance health summary"
      role={onFilter ? 'group' : 'status'}
    >
      {total > 0 && (
        <>
          {ready > 0 && <Chip state="ready" count={ready} label="ready" />}
          {reconciling > 0 && <Chip state="reconciling" count={reconciling} label="reconciling" />}
          {degraded > 0 && <Chip state="degraded" count={degraded} label="degraded" />}
          {error > 0 && <Chip state="error" count={error} label="error" />}
          {pending > 0 && <Chip state="pending" count={pending} label="pending" />}
        </>
      )}
      {noInstances > 0 && <Chip state="noInstances" count={noInstances} label="no instances" />}
      {isPartialLoad && (
        <span className="overview-health-bar__loading" aria-live="polite">
          ({summaries.size} of {totalRGDs} loaded)
        </span>
      )}
    </div>
  )
}
