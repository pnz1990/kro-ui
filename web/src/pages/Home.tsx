// Overview — RGD cards grid with controller health metrics. Fetches GET /api/v1/rgds on mount.
// Uses VirtualGrid for windowed rendering at 5,000+ RGDs.
// Search input is debounced (300ms) to avoid per-keystroke filter churn.
// FR-007 (spec 031-deletion-debugger): background fetch of per-RGD terminating counts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { listRGDs, listInstances } from '@/lib/api'
import { extractRGDName } from '@/lib/format'
import { matchesSearch } from '@/lib/catalog'
import { isTerminating } from '@/lib/k8s'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import MetricsStrip from '@/components/MetricsStrip'
import RGDCard from '@/components/RGDCard'
import SearchBar from '@/components/SearchBar'
import SkeletonCard from '@/components/SkeletonCard'
import VirtualGrid from '@/components/VirtualGrid'
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

  // FR-007: Map from rgdName → terminating instance count.
  // Fetched in the background after the RGD list loads; absent = not yet fetched.
  const [terminatingCounts, setTerminatingCounts] = useState<Map<string, number>>(new Map())

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
        // FR-007: fire-and-forget background fetch of terminating counts.
        // Each RGD gets one listInstances call. Errors are silently ignored —
        // absent count = no badge (graceful degradation).
        const rgdNames = (res.items ?? []).map(extractRGDName).filter(Boolean)
        Promise.allSettled(
          rgdNames.map((name) =>
            listInstances(name, undefined, { signal: ac.signal }).then((list) => ({
              name,
              count: (list.items ?? []).filter(isTerminating).length,
            }))
          )
        ).then((results) => {
          if (ac.signal.aborted) return
          const counts = new Map<string, number>()
          for (const result of results) {
            if (result.status === 'fulfilled') {
              counts.set(result.value.name, result.value.count)
            }
          }
          setTerminatingCounts(counts)
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
  const filteredItems = useMemo(
    () => items.filter((rgd) => matchesSearch(rgd, debouncedQuery)),
    [items, debouncedQuery],
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
        {!isLoading && error === null && (
          <div className="home__toolbar">
            <SearchBar
              value={query}
              onSearch={setQuery}
              placeholder="Search by name or kind…"
            />
            {items.length > 0 && (
              <span className="home__count">
                {filteredItems.length} of {items.length}
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
          <p className="home__error-message">{error}</p>
          <button className="home__retry-btn" onClick={fetchRGDs}>
            Retry
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
