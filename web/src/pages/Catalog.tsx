// Catalog — searchable RGD registry with filtering, sorting, and chaining detection.
// Fetches all RGDs on mount, then fires parallel instance-count requests.
// All search/filter/sort is client-side — no API call per keystroke.
// Issue #116: instanceCounts uses undefined="loading", null="failed", number="resolved".

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { listRGDs, listInstances } from '@/lib/api'
import { extractRGDName } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  buildChainingMap,
  collectAllLabels,
  matchesSearch,
  matchesLabelFilter,
  sortCatalog,
} from '@/lib/catalog'
import type { SortOption } from '@/lib/catalog'
import { useDebounce } from '@/hooks/useDebounce'
import CatalogCard from '@/components/CatalogCard'
import SearchBar from '@/components/SearchBar'
import LabelFilter from '@/components/LabelFilter'
import VirtualGrid from '@/components/VirtualGrid'
import './Catalog.css'

// CatalogCard is normalized to 160px height (min-height/max-height in CatalogCard.css).
const CATALOG_CARD_HEIGHT = 160

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'kind', label: 'Kind A–Z' },
  { value: 'instances', label: 'Most instances' },
  { value: 'resources', label: 'Resource count' },
  { value: 'newest', label: 'Newest first' },
]

export default function Catalog() {
  usePageTitle('Catalog')
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // instanceCounts maps rgdName → undefined (loading) | null (failed) | number (resolved).
  // undefined means "fetch in-flight" — card shows a loading indicator.
  // null means "fetch failed" — card shows em-dash.
  // Issue #116: was always null before fetch resolved, so count never appeared to load.
  const [instanceCounts, setInstanceCounts] = useState<Map<string, number | null | undefined>>(new Map())

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [activeLabels, setActiveLabels] = useState<string[]>([])
  const [sortOption, setSortOption] = useState<SortOption>('name')

  // Fetch all RGDs once on mount
  const fetchRGDs = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setInstanceCounts(new Map())
    listRGDs()
      .then((res) => {
        setItems(res.items ?? [])
        // Mark all RGDs as loading (undefined) before firing requests
        const loadingMap = new Map<string, number | null | undefined>()
        for (const rgd of res.items ?? []) {
          const name = extractRGDName(rgd)
          if (name) loadingMap.set(name, undefined)
        }
        setInstanceCounts(loadingMap)
        // Fire parallel instance-count requests — failures are per-RGD
        for (const rgd of res.items ?? []) {
          const name = extractRGDName(rgd)
          if (!name) continue
          listInstances(name)
            .then((list) => {
              setInstanceCounts((prev) => new Map(prev).set(name, (list.items ?? []).length))
            })
            .catch(() => {
              // Mark as null (failed), never block the page
              setInstanceCounts((prev) => new Map(prev).set(name, null))
            })
        }
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

  // Chaining map: built once when items change
  const chainingMap = useMemo(() => buildChainingMap(items), [items])

  // All available labels across all RGDs
  const allLabels = useMemo(() => collectAllLabels(items), [items])

  // Build entries with instance counts
  // undefined = still loading, null = failed, number = resolved
  const entries = useMemo(
    () =>
      items.map((rgd) => {
        const name = extractRGDName(rgd)
        const instanceCount = instanceCounts.has(name) ? instanceCounts.get(name) : undefined
        return { rgd, instanceCount }
      }),
    [items, instanceCounts],
  )

  // Apply search + label filter.
  // searchQuery is debounced: the filter only runs after the user pauses typing.
  // activeLabels are NOT debounced — label toggles are discrete clicks, not streams.
  const filtered = useMemo(
    () =>
      entries.filter(
        ({ rgd }) =>
          matchesSearch(rgd, debouncedQuery) && matchesLabelFilter(rgd, activeLabels),
      ),
    [entries, debouncedQuery, activeLabels],
  )

  // Apply sort
  const sorted = useMemo(() => sortCatalog(filtered, sortOption), [filtered, sortOption])

  function clearFilters() {
    setSearchQuery('')
    setActiveLabels([])
  }

  const hasFilters = searchQuery !== '' || activeLabels.length > 0

  return (
    <div className="catalog">
      <div className="catalog__header">
        <div className="catalog__title-row">
          <h1 className="catalog__heading">RGD Catalog</h1>
          {!isLoading && !error && (
            <span className="catalog__count" aria-live="polite">
              {sorted.length} of {items.length}
            </span>
          )}
        </div>

        <div className="catalog__toolbar">
          <SearchBar value={searchQuery} onSearch={setSearchQuery} />
          <LabelFilter
            labels={allLabels}
            activeLabels={activeLabels}
            onFilter={setActiveLabels}
          />
          <div className="catalog__sort">
            <label htmlFor="catalog-sort" className="catalog__sort-label">
              Sort:
            </label>
            <div className="catalog__sort-wrapper">
              <select
                id="catalog-sort"
                className="catalog__sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="catalog__grid--loading" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="catalog__skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {!isLoading && error !== null && (
        <div className="catalog__error" role="alert">
          <p className="catalog__error-message">{error}</p>
          <button className="catalog__retry-btn" onClick={fetchRGDs}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && error === null && (
        <VirtualGrid
          items={sorted}
          itemHeight={CATALOG_CARD_HEIGHT}
          renderItem={({ rgd, instanceCount }) => {
            const name = extractRGDName(rgd)
            return (
              <CatalogCard
                key={name}
                rgd={rgd}
                instanceCount={instanceCount}
                usedBy={chainingMap.get(name) ?? []}
                onLabelClick={(label) =>
                  setActiveLabels((prev) =>
                    prev.includes(label) ? prev : [...prev, label],
                  )
                }
              />
            )
          }}
          emptyState={
            <div className="catalog__empty" data-testid="catalog-empty">
              {items.length === 0 ? (
                <>
                  <p>No ResourceGraphDefinitions found in this cluster.</p>
                  <p className="catalog__empty-hint">
                    Create one with{' '}
                    <code>kubectl apply -f your-rgd.yaml</code>
                    {' '}or use the{' '}
                    <Link to="/author" data-testid="catalog-new-rgd-link">
                      in-app authoring tool
                    </Link>.
                  </p>
                </>
              ) : (
                <>
                  <p>No RGDs match your search.</p>
                  {hasFilters && (
                    <button className="catalog__clear-filters-btn" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </div>
          }
          className="catalog__virtual-grid"
        />
      )}
    </div>
  )
}
