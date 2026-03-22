// Catalog — searchable RGD registry with filtering, sorting, and chaining detection.
// Fetches all RGDs on mount, then fires parallel instance-count requests.
// All search/filter/sort is client-side — no API call per keystroke.

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import CatalogCard from '@/components/CatalogCard'
import SearchBar from '@/components/SearchBar'
import LabelFilter from '@/components/LabelFilter'
import './Catalog.css'

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

  // instanceCounts maps rgdName → count | null (null = fetch failed)
  const [instanceCounts, setInstanceCounts] = useState<Map<string, number | null>>(new Map())

  const [searchQuery, setSearchQuery] = useState('')
  const [activeLabels, setActiveLabels] = useState<string[]>([])
  const [sortOption, setSortOption] = useState<SortOption>('name')

  // Fetch all RGDs once on mount
  const fetchRGDs = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setInstanceCounts(new Map())
    listRGDs()
      .then((res) => {
        setItems(res.items)
        // Fire parallel instance-count requests — failures are per-RGD
        for (const rgd of res.items) {
          const name = extractRGDName(rgd)
          if (!name) continue
          listInstances(name)
            .then((list) => {
              setInstanceCounts((prev) => new Map(prev).set(name, list.items.length))
            })
            .catch(() => {
              // Mark as null (unknown), never block the page
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
  const entries = useMemo(
    () =>
      items.map((rgd) => {
        const name = extractRGDName(rgd)
        const instanceCount = instanceCounts.has(name) ? (instanceCounts.get(name) ?? null) : null
        return { rgd, instanceCount }
      }),
    [items, instanceCounts],
  )

  // Apply search + label filter
  const filtered = useMemo(
    () =>
      entries.filter(
        ({ rgd }) =>
          matchesSearch(rgd, searchQuery) && matchesLabelFilter(rgd, activeLabels),
      ),
    [entries, searchQuery, activeLabels],
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
        <div className="catalog__grid catalog__grid--loading" aria-busy="true">
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

      {!isLoading && error === null && sorted.length === 0 && (
        <div className="catalog__empty" data-testid="catalog-empty">
          {items.length === 0 ? (
            <>
              <p>No ResourceGraphDefinitions found in this cluster.</p>
              <p className="catalog__empty-hint">
                Create one with{' '}
                <code>kubectl apply -f your-rgd.yaml</code>
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
      )}

      {!isLoading && error === null && sorted.length > 0 && (
        <div className="catalog__grid" data-testid="catalog-grid">
          {sorted.map(({ rgd, instanceCount }) => {
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
          })}
        </div>
      )}
    </div>
  )
}
