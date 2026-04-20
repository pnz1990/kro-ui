// Catalog — searchable RGD registry with filtering, sorting, and chaining detection.
// Fetches all RGDs on mount, then fires parallel instance-count requests.
// All search/filter/sort is client-side — no API call per keystroke.
// Issue #116: instanceCounts uses undefined="loading", null="failed", number="resolved".
// spec 070: status filter — all / ready / errors toggle for compile-state filtering.
// spec issue-534: selection mode for bulk YAML export.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { listRGDs, listInstances, getRGD } from '@/lib/api'
import { extractRGDName, extractReadyStatus } from '@/lib/format'
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
import { translateApiError } from '@/lib/errors'
import { cleanK8sObject, toYaml } from '@/lib/yaml'
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
  // spec 070: compile-status filter — 'all' | 'ready' | 'errors'
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'errors'>('all')

  // spec issue-534: selection mode state (O1, O7)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // Escape key handler to exit selection mode (spec O6)
  const catalogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
        setSelectedNames(new Set())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectionMode])

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

  // Apply search + label filter + status filter.
  // searchQuery is debounced: the filter only runs after the user pauses typing.
  // activeLabels are NOT debounced — label toggles are discrete clicks, not streams.
  const filtered = useMemo(
    () =>
      entries.filter(({ rgd }) => {
        if (!matchesSearch(rgd, debouncedQuery)) return false
        if (!matchesLabelFilter(rgd, activeLabels)) return false
        // spec 070: status filter
        if (statusFilter !== 'all') {
          const state = extractReadyStatus(rgd).state
          if (statusFilter === 'ready' && state !== 'ready') return false
          if (statusFilter === 'errors' && state !== 'error') return false
        }
        return true
      }),
    [entries, debouncedQuery, activeLabels, statusFilter],
  )

  // Apply sort
  const sorted = useMemo(() => sortCatalog(filtered, sortOption), [filtered, sortOption])

  function clearFilters() {
    setSearchQuery('')
    setActiveLabels([])
    setStatusFilter('all')
  }

  const hasFilters = searchQuery !== '' || activeLabels.length > 0 || statusFilter !== 'all'

  // ── Selection mode handlers (spec O1–O3) ─────────────────────────────────

  function handleEnterSelectionMode() {
    setSelectionMode(true)
    setSelectedNames(new Set())
  }

  function handleExitSelectionMode() {
    setSelectionMode(false)
    setSelectedNames(new Set())
  }

  function handleCardToggle(name: string, nowSelected: boolean) {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (nowSelected) next.add(name); else next.delete(name)
      return next
    })
  }

  // "Select all" toggles all currently-visible (post-filter) RGDs (spec O2)
  const visibleNames = useMemo(() => sorted.map(({ rgd }) => extractRGDName(rgd)), [sorted])
  const allVisible = visibleNames.length > 0 && visibleNames.every((n) => selectedNames.has(n))

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedNames(new Set(visibleNames))
    } else {
      setSelectedNames((prev) => {
        const next = new Set(prev)
        for (const n of visibleNames) next.delete(n)
        return next
      })
    }
  }

  // Export selected RGDs as multi-document YAML (spec O3–O5)
  async function handleExportYAML() {
    const names = Array.from(selectedNames)
    if (names.length === 0) return
    setIsExporting(true)
    try {
      const docs: string[] = []
      for (const name of names) {
        try {
          const rgd = await getRGD(name)
          const cleaned = cleanK8sObject(rgd)
          docs.push(toYaml(cleaned))
        } catch {
          // Skip failed fetches gracefully — include as comment
          docs.push(`# Failed to fetch ${name}`)
        }
      }
      const yaml = docs.join('\n---\n')
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (spec O5)
      const filename = `kro-rgds-${today}.yaml`
      const blob = new Blob([yaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="catalog" ref={catalogRef}>
      <div className="catalog__header">
        <div className="catalog__title-row">
          <h1 className="catalog__heading">RGD Catalog</h1>
          {!isLoading && !error && (
            <span className="catalog__count" aria-live="polite">
              {sorted.length} of {items.length}
            </span>
          )}
        </div>
        <p className="catalog__subtitle">Browse, filter, and discover all ResourceGraphDefinitions</p>

        <div className="catalog__toolbar">
          <SearchBar value={searchQuery} onSearch={setSearchQuery} />
          <LabelFilter
            labels={allLabels}
            activeLabels={activeLabels}
            onFilter={setActiveLabels}
          />
          {/* spec 070: compile-status filter — all / ready / errors */}
          <div className="catalog__status-filter" role="group" aria-label="Filter by compile status">
            {(['all', 'ready', 'errors'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`catalog__status-btn${statusFilter === v ? ' catalog__status-btn--active' : ''}`}
                onClick={() => setStatusFilter(v)}
                aria-pressed={statusFilter === v}
                data-testid={`catalog-status-${v}`}
              >
                {v === 'all' ? 'All' : v === 'ready' ? 'Ready' : 'Errors'}
              </button>
            ))}
          </div>

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

          {/* spec issue-534: selection mode toggle (O1) */}
          {!isLoading && !error && !selectionMode && (
            <button
              type="button"
              className="catalog__select-btn"
              onClick={handleEnterSelectionMode}
              data-testid="catalog-select-mode"
            >
              Select
            </button>
          )}
        </div>

        {/* spec issue-534: selection toolbar — shown when selectionMode=true (O1–O3) */}
        {selectionMode && (
          <div className="catalog__selection-toolbar" data-testid="catalog-selection-toolbar">
            <label className="catalog__select-all" data-testid="catalog-select-all">
              <input
                type="checkbox"
                checked={allVisible}
                onChange={(e) => handleSelectAll(e.target.checked)}
                aria-label="Select all visible RGDs"
              />
              Select all ({visibleNames.length})
            </label>
            {selectedNames.size > 0 && (
              <button
                type="button"
                className="catalog__export-btn"
                onClick={handleExportYAML}
                disabled={isExporting}
                aria-label={`Export ${selectedNames.size} selected RGDs`}
                data-testid="catalog-export-yaml"
              >
                {isExporting ? 'Exporting…' : `Export YAML (${selectedNames.size})`}
              </button>
            )}
            <button
              type="button"
              className="catalog__cancel-select-btn"
              onClick={handleExitSelectionMode}
              data-testid="catalog-cancel-select"
            >
              Done
            </button>
          </div>
        )}
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
          <p className="catalog__error-message">{translateApiError(error)}</p>
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
                selectable={selectionMode}
                selected={selectedNames.has(name)}
                onToggle={handleCardToggle}
              />
            )
          }}
          emptyState={
            <div className="catalog__empty" data-testid="catalog-empty">
              {hasFilters ? (
                <>
                  <p>No RGDs match your search.</p>
                  <button className="catalog__clear-filters-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : items.length === 0 ? (
                <>
                  <p>No ResourceGraphDefinitions found in this cluster.</p>
                  <p className="catalog__empty-hint">
                    Create one with{' '}
                    <code>kubectl apply -f your-rgd.yaml</code>
                    {' '}or use the{' '}
                    <Link to="/author" data-testid="catalog-new-rgd-link">
                      RGD Designer
                    </Link>.
                  </p>
                </>
              ) : (
                <p>No RGDs match your search.</p>
              )}
            </div>
          }
          className="catalog__virtual-grid"
        />
      )}
    </div>
  )
}
