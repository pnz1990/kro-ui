// Home — RGD cards grid. Fetches GET /api/v1/rgds on mount.
// Uses VirtualGrid for windowed rendering at 5,000+ RGDs.
// Search input is debounced (300ms) to avoid per-keystroke filter churn.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { listRGDs } from '@/lib/api'
import { extractRGDName } from '@/lib/format'
import { matchesSearch } from '@/lib/catalog'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDebounce } from '@/hooks/useDebounce'
import RGDCard from '@/components/RGDCard'
import SearchBar from '@/components/SearchBar'
import SkeletonCard from '@/components/SkeletonCard'
import VirtualGrid from '@/components/VirtualGrid'
import './Home.css'

// RGDCard renders at a fixed ~130px height (header + meta + actions, no-wrap text).
const RGD_CARD_HEIGHT = 130

export default function Home() {
  usePageTitle('')
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const fetchRGDs = useCallback(() => {
    setIsLoading(true)
    setError(null)
    listRGDs()
      .then((res) => {
        setItems(res.items)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchRGDs()
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
      <div className="home__empty">
        <p>No ResourceGraphDefinitions found in this cluster.</p>
        <a href="https://kro.run/docs" target="_blank" rel="noopener noreferrer">
          Learn about kro
        </a>
      </div>
    )

  return (
    <div className="home">
      <div className="home__header">
        <h1 className="home__heading">ResourceGraphDefinitions</h1>
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
          renderItem={(rgd) => <RGDCard key={extractRGDName(rgd)} rgd={rgd} />}
          emptyState={emptyState}
          className="home__virtual-grid"
        />
      )}
    </div>
  )
}
