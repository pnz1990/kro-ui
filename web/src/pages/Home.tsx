// Overview — RGD cards grid with controller health metrics. Fetches GET /api/v1/rgds on mount.
// Uses VirtualGrid for windowed rendering at 5,000+ RGDs.
// Search input is debounced (300ms) to avoid per-keystroke filter churn.
// FR-007 (spec 031-deletion-debugger): background fetch of per-RGD terminating counts.
// spec 069: RGD error banner — shows compile-error count, toggles error-only filter.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { listRGDs, listInstances } from '@/lib/api'
import { extractRGDName, extractReadyStatus } from '@/lib/format'
import { aggregateHealth } from '@/lib/format'
import type { HealthSummary } from '@/lib/format'
import { matchesSearch } from '@/lib/catalog'
import { isTerminating } from '@/lib/k8s'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import { translateApiError } from '@/lib/errors'
import MetricsStrip from '@/components/MetricsStrip'
import RGDCard from '@/components/RGDCard'
import SearchBar from '@/components/SearchBar'
import SkeletonCard from '@/components/SkeletonCard'
import VirtualGrid from '@/components/VirtualGrid'
import OverviewHealthBar from '@/components/OverviewHealthBar'
import type { HealthFilterState } from '@/components/OverviewHealthBar'
import './Home.css'

// RGDCard renders at a fixed ~130px height (header + meta + actions, no-wrap text).
const RGD_CARD_HEIGHT = 130

export default function Home() {
  usePageTitle('Overview')
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  // Health filter — set by clicking OverviewHealthBar chips (spec 060-health-filter).
  // When set, the card grid shows only RGDs with instances in that health state.
  const [healthFilter, setHealthFilter] = useState<HealthFilterState | null>(null)

  // spec 069: RGD compile-error filter — toggled by clicking the error banner.
  // When true, only error-state RGDs (Ready=False) are shown in the card grid.
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)

  // FR-007: Map from rgdName → terminating instance count.
  // Fetched in the background after the RGD list loads; absent = not yet fetched.
  const [terminatingCounts, setTerminatingCounts] = useState<Map<string, number>>(new Map())
  // Health summaries pre-computed alongside terminatingCounts — eliminates the
  // per-card listInstances call in RGDCard (issue #235).
  const [healthSummaries, setHealthSummaries] = useState<Map<string, HealthSummary>>(new Map())

  // Abort controller ref — cancels in-flight listInstances fan-out on unmount or re-fetch.
  const abortRef = useRef<AbortController | null>(null)

  const fetchRGDs = useCallback(() => {
    // Abort any in-flight fan-out from a previous call
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setIsLoading(true)
    setError(null)
    listRGDs()
      .then((res) => {
        if (ac.signal.aborted) return
        setItems(res.items ?? [])
        // FR-007: fire-and-forget background fetch of terminating counts and health summaries.
        // Each RGD gets one listInstances call. Errors are silently ignored —
        // absent count = no badge (graceful degradation).
        // Passing healthSummary to RGDCard avoids a redundant second listInstances
        // per card (issue #235).
        const rgdNames = (res.items ?? []).map(extractRGDName).filter(Boolean)
        Promise.allSettled(
          rgdNames.map((name) =>
            listInstances(name, undefined, { signal: ac.signal }).then((list) => ({
              name,
              count: (list.items ?? []).filter(isTerminating).length,
              health: aggregateHealth(list.items ?? []),
            }))
          )
        ).then((results) => {
          if (ac.signal.aborted) return
          const counts = new Map<string, number>()
          const summaries = new Map<string, HealthSummary>()
          for (const result of results) {
            if (result.status === 'fulfilled') {
              counts.set(result.value.name, result.value.count)
              summaries.set(result.value.name, result.value.health)
            }
          }
          setTerminatingCounts(counts)
          setHealthSummaries(summaries)
        })
        // allSettled never rejects — no .catch needed
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchRGDs()
    return () => { abortRef.current?.abort() }
  }, [fetchRGDs])

  // Client-side filter — reuses matchesSearch from catalog lib (no reimplementation).
  // Runs only after the debounce fires, not on every keystroke.
  // Also applies the healthFilter when a chip is active.
  const filteredItems = useMemo(() => {
    let result = items.filter((rgd) => matchesSearch(rgd, debouncedQuery))

    // spec 069: error-only filter — show only RGDs with compile errors (Ready=False).
    if (showOnlyErrors) {
      result = result.filter((rgd) => extractReadyStatus(rgd).state === 'error')
    }

    // Health filter (spec 060): show only RGDs with instances in the selected state.
    if (healthFilter !== null) {
      result = result.filter((rgd) => {
        const name = extractRGDName(rgd)
        const summary = healthSummaries.get(name)
        if (!summary) return false // not yet loaded — hide until resolved
        if (healthFilter === 'noInstances') return summary.total === 0
        return (summary[healthFilter as keyof typeof summary] as number) > 0
      })
    }

    return result
  }, [items, debouncedQuery, healthFilter, healthSummaries, showOnlyErrors])

  // spec 069: count RGDs with compile errors (Ready=False) from the loaded list.
  // Computed without async — extractReadyStatus reads already-fetched status fields.
  const errorRgdCount = useMemo(
    () => items.filter((rgd) => extractReadyStatus(rgd).state === 'error').length,
    [items],
  )

  const emptyState =
    debouncedQuery.trim() !== '' ? (
      <div className="home__empty">
        <p>No ResourceGraphDefinitions match &ldquo;{debouncedQuery}&rdquo;.</p>
        <button className="home__clear-search" onClick={() => setQuery('')}>
          Clear search
        </button>
      </div>
    ) : (
      <div className="home__empty home__empty--onboarding">
        <h2 className="home__empty-title">No ResourceGraphDefinitions found</h2>
        <p className="home__empty-desc">
          <strong>kro-ui</strong> is a read-only observability dashboard for{' '}
          <a href="https://kro.run" target="_blank" rel="noopener noreferrer">
            kro
          </a>{' '}
          — the Kubernetes Resource Orchestrator. A ResourceGraphDefinition (RGD)
          declares a graph of Kubernetes resources to manage as a unit.
        </p>
        <div className="home__empty-actions">
          <a
            href="https://kro.run/docs/getting-started"
            target="_blank"
            rel="noopener noreferrer"
            className="home__empty-cta"
          >
            Get started with kro
          </a>
          <a
            href="https://github.com/kubernetes-sigs/kro"
            target="_blank"
            rel="noopener noreferrer"
            className="home__empty-cta home__empty-cta--secondary"
          >
            kro on GitHub
          </a>
          <Link
            to="/author"
            className="home__empty-cta home__empty-cta--secondary"
            data-testid="home-new-rgd-link"
          >
            Open RGD Designer
          </Link>
        </div>
      </div>
    )

  return (
    <div className="home">
      <MetricsStrip />
      <div className="home__header">
        <div className="home__heading-group">
          <h1 className="home__heading">Overview</h1>
          <p className="home__tagline">
            Controller and RGD health at a glance
          </p>
        </div>
        {/* Issue #242: toolbar always rendered to prevent layout jump;
            SearchBar is disabled during loading so no input is accepted. */}
        {error === null && (
          <div className="home__toolbar">
            <SearchBar
              value={query}
              onSearch={setQuery}
              placeholder="Search by name or kind…"
              disabled={isLoading}
            />
            {!isLoading && items.length > 0 && (
              <span className="home__count">
                {filteredItems.length} of {items.length}
                {(healthFilter !== null || showOnlyErrors) && (
                  <button
                    type="button"
                    className="home__clear-filter"
                    onClick={() => { setHealthFilter(null); setShowOnlyErrors(false); }}
                    title="Clear all filters"
                    data-testid="clear-health-filter"
                  >
                    ×
                  </button>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="home__skeleton-grid" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && error !== null && (
        <div className="home__error" role="alert">
          <p className="home__error-message">{translateApiError(error)}</p>
          <button className="home__retry-btn" onClick={fetchRGDs}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && error === null && healthSummaries.size > 0 && (
        <OverviewHealthBar
          summaries={healthSummaries}
          totalRGDs={items.length}
          activeFilter={healthFilter}
          onFilter={(state) => { setHealthFilter(state); }}
        />
      )}

      {/* spec 069: RGD compile-error banner — shown when ≥1 RGD has a compile error.
          Clicking toggles the error-only filter so the operator can focus on broken RGDs. */}
      {!isLoading && error === null && errorRgdCount > 0 && (
        <div className="home__rgd-error-banner" data-testid="rgd-error-banner">
          <button
            type="button"
            className={`home__rgd-error-btn${showOnlyErrors ? ' home__rgd-error-btn--active' : ''}`}
            onClick={() => setShowOnlyErrors((v) => !v)}
            aria-pressed={showOnlyErrors}
            title={showOnlyErrors ? 'Show all RGDs' : 'Filter to RGDs with compile errors'}
          >
            <span className="home__rgd-error-count">{errorRgdCount}</span>
            {' '}
            {errorRgdCount === 1 ? 'RGD has a compile error' : 'RGDs have compile errors'}
            {showOnlyErrors && (
              <span className="home__rgd-error-clear"> — showing errors only ×</span>
            )}
          </button>
        </div>
      )}

      {!isLoading && error === null && (
        <VirtualGrid
          items={filteredItems}
          itemHeight={RGD_CARD_HEIGHT}
          renderItem={(rgd) => {
            const name = extractRGDName(rgd)
            return (
              <RGDCard
                key={name}
                rgd={rgd}
                terminatingCount={terminatingCounts.get(name)}
                healthSummary={healthSummaries.get(name)}
              />
            )
          }}
          emptyState={emptyState}
          className="home__virtual-grid"
        />
      )}
    </div>
  )
}
