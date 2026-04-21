// Instances — global cross-RGD instance search page.
// Fetches all instances across all RGDs via GET /api/v1/instances (fan-out).
// Provides search by name, namespace, kind, or RGD name.
// Also provides namespace dropdown filter and health state filter.
// Spec: .specify/specs/058-global-instance-search/spec.md
// Namespace filter: spec .specify/specs/062-instance-namespace-filter/spec.md
// Issue #365/#368: health filter is synced to/from the ?health= URL param so
// filtered views can be shared and survive page refresh.
// spec issue-536: multi-select + bulk YAML export (O1-O7).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAllInstances, getInstance } from '@/lib/api'
import type { InstanceSummary } from '@/lib/api'
import { formatAge } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { translateApiError } from '@/lib/errors'
import { cleanK8sObject, toYaml } from '@/lib/yaml'
import StatusDot from '@/components/StatusDot'
import './Instances.css'

// Derive a 4-state health value from the kro instance summary.
// Uses state (IN_PROGRESS = reconciling) first, then falls back to ready condition.
// This matches the 6-state model used in Overview/InstanceDetail.
function toHealthState(instance: InstanceSummary): 'ready' | 'reconciling' | 'error' | 'unknown' {
  // IN_PROGRESS → reconciling (always, regardless of Ready condition)
  if (instance.state === 'IN_PROGRESS') return 'reconciling'
  if (instance.ready === 'True') return 'ready'
  if (instance.ready === 'False') return 'error'
  return 'unknown'
}

// StatusDot now accepts 'reconciling' — map 4-state health to StatusDot state.
// Issue #366: reconciling maps to 'reconciling' (amber pulsing dot), not 'unknown'.
function toDotState(health: 'ready' | 'reconciling' | 'error' | 'unknown'): 'ready' | 'error' | 'unknown' | 'reconciling' {
  return health
}

type SortKey = 'name' | 'age' | 'rgd' | 'namespace' | 'health'
type SortDir = 'asc' | 'desc'
type HealthFilter = 'all' | 'ready' | 'reconciling' | 'error' | 'unknown'

/** Health priority for sorting: error (0) > reconciling (1) > unknown (2) > ready (3) */
const HEALTH_PRIORITY: Record<string, number> = {
  error: 0,
  reconciling: 1,
  unknown: 2,
  ready: 3,
}

function compareItems(a: InstanceSummary, b: InstanceSummary, key: SortKey, dir: SortDir): number {
  let cmp = 0
  switch (key) {
    case 'name':
      cmp = a.name.localeCompare(b.name)
      break
    case 'rgd':
      cmp = a.rgdName.localeCompare(b.rgdName)
      break
    case 'namespace':
      cmp = a.namespace.localeCompare(b.namespace)
      break
    case 'age': {
      const aMs = a.creationTimestamp ? Date.parse(a.creationTimestamp) : 0
      const bMs = b.creationTimestamp ? Date.parse(b.creationTimestamp) : 0
      cmp = bMs - aMs // newer first by default
      break
    }
    case 'health': {
      const aH = HEALTH_PRIORITY[toHealthState(a)] ?? 3
      const bH = HEALTH_PRIORITY[toHealthState(b)] ?? 3
      cmp = aH - bH // worst first by default
      break
    }
  }
  return dir === 'asc' ? cmp : -cmp
}

const PAGE_SIZE = 50

export default function InstancesPage() {
  usePageTitle('Instances')

  // Issue #365: health filter is synced to the ?health= URL param so that
  // filtered views survive refresh and can be shared. Read the param on mount;
  // write it back on every chip click via setSearchParams.
  const [searchParams, setSearchParams] = useSearchParams()
  const rawHealthParam = searchParams.get('health') as HealthFilter | null
  const validHealthFilters: HealthFilter[] = ['all', 'ready', 'reconciling', 'error', 'unknown']
  const healthFromUrl: HealthFilter =
    rawHealthParam && validHealthFilters.includes(rawHealthParam) ? rawHealthParam : 'all'

  const [items, setItems] = useState<InstanceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [nsFilter, setNsFilter] = useState('') // namespace dropdown
  const [healthFilter, setHealthFilter] = useState<HealthFilter>(healthFromUrl)
  const [sortKey, setSortKey] = useState<SortKey>('health')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  // spec issue-536: selection mode state (O1-O4)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // Stable instance key: namespace/name/rgdName uniquely identifies an instance
  function instanceKey(i: InstanceSummary) { return `${i.namespace}/${i.name}/${i.rgdName}` }

  // Sync healthFilter from URL on mount (handles direct navigation with ?health=).
  // Only runs once; subsequent changes are driven by chip clicks.
  useEffect(() => {
    setHealthFilter(healthFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — we only want to read the URL once at mount

  const fetchAll = useCallback(() => {
    setIsLoading(true)
    setError(null)
    const ac = new AbortController()
    listAllInstances({ signal: ac.signal })
      .then((res) => {
        setItems(res.items ?? [])
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          setError(String(err))
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoading(false)
      })
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const cleanup = fetchAll()
    return cleanup
  }, [fetchAll])

  // Derive unique namespace options from loaded instances
  const namespaceOptions = useMemo(() => {
    const ns = new Set(items.map((i) => i.namespace).filter(Boolean))
    return Array.from(ns).sort()
  }, [items])

  // Client-side filter: text search + namespace + health state
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      // Text search
      if (q && !(
        i.name.toLowerCase().includes(q) ||
        i.namespace.toLowerCase().includes(q) ||
        i.kind.toLowerCase().includes(q) ||
        i.rgdName.toLowerCase().includes(q)
      )) return false

      // Namespace filter
      if (nsFilter && i.namespace !== nsFilter) return false

      // Health state filter
      if (healthFilter !== 'all') {
        const health = toHealthState(i)
        if (health !== healthFilter) return false
      }

      return true
    })
  }, [items, query, nsFilter, healthFilter])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareItems(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir],
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'age' ? 'desc' : 'asc') // age: newest first; health: worst first (asc = error first)
    }
    setPage(0)
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="sort-indicator sort-indicator--inactive" aria-hidden="true">⇅</span>
    return <span className="sort-indicator" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Count instances in each health state for filter chips
  const healthCounts = useMemo(() => {
    const counts = { ready: 0, reconciling: 0, error: 0, unknown: 0 }
    for (const i of items) {
      const s = toHealthState(i)
      counts[s]++
    }
    return counts
  }, [items])

  // spec issue-536: Escape to exit selection mode (O4)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
        setSelectedKeys(new Set())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectionMode])

  // spec issue-536: visible (post-filter) instance keys for "Select all" (O2)
  const visibleKeys = useMemo(() => sorted.map((i) => instanceKey(i)), [sorted])
  const allVisible = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k))

  function handleToggleSelectAll() {
    if (allVisible) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(visibleKeys))
    }
  }

  // spec issue-536: bulk YAML export (O3)
  async function handleExportYAML() {
    const selected = sorted.filter((i) => selectedKeys.has(instanceKey(i)))
    if (selected.length === 0) return
    setIsExporting(true)
    try {
      const docs: string[] = []
      for (const instance of selected) {
        try {
          const obj = await getInstance(instance.namespace || '_', instance.name, instance.rgdName)
          const cleaned = cleanK8sObject(obj)
          docs.push(toYaml(cleaned))
        } catch {
          docs.push(`# Failed to fetch ${instance.namespace}/${instance.name}`)
        }
      }
      const yaml = docs.join('\n---\n')
      const today = new Date().toISOString().slice(0, 10)
      const filename = `kro-instances-${today}.yaml`
      const blob = new Blob([yaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }


  return (
    <div className="instances-page">
      <div className="instances-page__header">
        <div className="instances-page__heading-group">
          <h1 className="instances-page__heading">Instances</h1>
          <p className="instances-page__tagline">All live CR instances across all RGDs</p>
        </div>
        <div className="instances-page__toolbar">
          <input
            type="search"
            className="instances-page__search"
            placeholder="Search by name, namespace, kind, or RGD..."
            aria-label="Search instances"
            data-testid="instances-search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          />
          {namespaceOptions.length > 1 && (
            <select
              className="instances-page__ns-filter"
              value={nsFilter}
              onChange={(e) => { setNsFilter(e.target.value); setPage(0) }}
              aria-label="Filter by namespace"
              data-testid="instances-ns-filter"
            >
              <option value="">All namespaces</option>
              {namespaceOptions.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          )}
          {!isLoading && (
            <span className="instances-page__count" data-testid="instances-count">
              {filtered.length === items.length
                ? `${items.length} instances`
                : `${filtered.length} of ${items.length}`}
            </span>
          )}
          {/* spec issue-536: selection mode toggle (O1, O5) */}
          {!isLoading && !error && !selectionMode && (
            <button
              type="button"
              className="instances-page__select-btn"
              onClick={() => { setSelectionMode(true); setSelectedKeys(new Set()) }}
              data-testid="instances-select-btn"
            >
              Select
            </button>
          )}
        </div>
      </div>

      {/* spec issue-536: selection toolbar (O2) */}
      {selectionMode && (
        <div className="instances-page__selection-toolbar" data-testid="instances-selection-toolbar">
          <label className="instances-page__select-all" data-testid="instances-select-all">
            <input
              type="checkbox"
              checked={allVisible}
              onChange={handleToggleSelectAll}
              aria-label={allVisible ? 'Deselect all visible instances' : 'Select all visible instances'}
            />
            {allVisible ? `Deselect all (${visibleKeys.length})` : `Select all (${visibleKeys.length})`}
          </label>
          <span className="instances-page__selection-count" data-testid="instances-selection-count">
            {selectedKeys.size} selected
          </span>
          <button
            type="button"
            className="instances-page__export-btn"
            onClick={handleExportYAML}
            disabled={selectedKeys.size === 0 || isExporting}
            data-testid="instances-export-yaml"
          >
            {isExporting ? 'Exporting…' : 'Export YAML'}
          </button>
          <button
            type="button"
            className="instances-page__clear-btn"
            onClick={() => { setSelectionMode(false); setSelectedKeys(new Set()) }}
            data-testid="instances-selection-clear"
          >
            Clear
          </button>
        </div>
      )}

      {/* Health state filter chips */}
      {!isLoading && items.length > 0 && (
        <div className="instances-page__health-filters" role="group" aria-label="Filter by health state">
          {(['all', 'ready', 'reconciling', 'error', 'unknown'] as HealthFilter[]).map((state) => {
            const count = state === 'all' ? items.length : healthCounts[state as keyof typeof healthCounts] ?? 0
            const label = state === 'all' ? 'All' : state
            if (state !== 'all' && count === 0) return null
            return (
              <button
                key={state}
                type="button"
                className={`instances-page__health-chip instances-page__health-chip--${state}${healthFilter === state ? ' instances-page__health-chip--active' : ''}`}
                onClick={() => {
                  setHealthFilter(state)
                  setPage(0)
                  // Issue #365: sync to URL so the view can be shared/bookmarked.
                  // Remove the param entirely for "all" (cleaner URL).
                  if (state === 'all') {
                    setSearchParams((prev) => { prev.delete('health'); return prev }, { replace: true })
                  } else {
                    setSearchParams((prev) => { prev.set('health', state); return prev }, { replace: true })
                  }
                }}
                aria-pressed={healthFilter === state}
                data-testid={`instances-health-chip-${state}`}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {isLoading && (
        <p className="instances-page__loading" aria-busy="true">Loading instances...</p>
      )}

      {!isLoading && error !== null && (
        <div className="instances-page__error" role="alert">
          <p>{translateApiError(error)}</p>
          <button className="instances-page__retry" onClick={fetchAll}>Retry</button>
        </div>
      )}

      {!isLoading && error === null && sorted.length === 0 && (
        <p className="panel-empty">
          {query || nsFilter || healthFilter !== 'all'
            ? 'No instances match the current filters.'
            : 'No instances found across any RGD.'}
        </p>
      )}

      {!isLoading && error === null && sorted.length > 0 && (
        <>
          <table className="instances-table" data-testid="instances-table">
            <thead>
              <tr>
                {/* spec issue-536: checkbox column (O1, O7) */}
                {selectionMode && (
                  <th className="instances-table__th instances-table__th--check" aria-label="Select" />
                )}
                <th
                  className="instances-table__th instances-table__th--state"
                  onClick={() => handleSort('health')}
                  aria-sort={sortKey === 'health' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('health')}
                  title="Sort by health state (error first)"
                  style={{ cursor: 'pointer' }}
                >
                  {sortIndicator('health')}
                </th>
                <th
                  className="instances-table__th"
                  onClick={() => handleSort('name')}
                  aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('name')}
                >
                  Name {sortIndicator('name')}
                </th>
                <th
                  className="instances-table__th"
                  onClick={() => handleSort('namespace')}
                  aria-sort={sortKey === 'namespace' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('namespace')}
                >
                  Namespace {sortIndicator('namespace')}
                </th>
                <th className="instances-table__th">Kind</th>
                <th
                  className="instances-table__th"
                  onClick={() => handleSort('rgd')}
                  aria-sort={sortKey === 'rgd' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('rgd')}
                >
                  RGD {sortIndicator('rgd')}
                </th>
                <th
                  className="instances-table__th"
                  onClick={() => handleSort('age')}
                  aria-sort={sortKey === 'age' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort('age')}
                >
                  Age {sortIndicator('age')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const href = `/rgds/${encodeURIComponent(item.rgdName)}/instances/${encodeURIComponent(item.namespace || '_')}/${encodeURIComponent(item.name)}`
                const health = toHealthState(item)
                const dotState = toDotState(health)
                const age = item.creationTimestamp ? formatAge(item.creationTimestamp) : '—'
                const nsDisplay = item.namespace || '(cluster)'
                const key = instanceKey(item)
                const isSelected = selectedKeys.has(key)
                return (
                  <tr
                    key={`${item.rgdName}/${item.namespace}/${item.name}`}
                    className={`instances-table__row${isSelected ? ' instances-table__row--selected' : ''}`}
                    data-testid="instances-row"
                    onClick={selectionMode ? undefined : () => { window.location.href = href }}
                    style={{ cursor: selectionMode ? 'default' : 'pointer' }}
                  >
                    {/* spec issue-536: checkbox cell (O7 — fixed 32px width) */}
                    {selectionMode && (
                      <td className="instances-table__td instances-table__td--check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedKeys((prev) => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key)
                              else next.add(key)
                              return next
                            })
                          }}
                          aria-label={`Select instance ${item.name}`}
                          data-testid={`instances-row-check-${item.name}`}
                        />
                      </td>
                    )}
                    <td className="instances-table__td instances-table__td--state">
                      <StatusDot
                        state={dotState}
                        message={item.message}
                        reason={item.message ? (health === 'reconciling' ? 'Reconciling' : 'Not ready') : undefined}
                      />
                    </td>
                    <td className="instances-table__td instances-table__td--name">
                      <Link to={href} className="instances-table__link" tabIndex={-1}>
                        {item.name}
                      </Link>
                    </td>
                    <td className="instances-table__td instances-table__td--ns">
                      {nsDisplay}
                    </td>
                    <td className="instances-table__td instances-table__td--kind">
                      {item.kind || item.rgdName}
                    </td>
                    <td className="instances-table__td instances-table__td--rgd">
                      <Link
                        to={`/rgds/${encodeURIComponent(item.rgdName)}`}
                        className="instances-table__rgd-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.rgdName}
                      </Link>
                    </td>
                    <td className="instances-table__td instances-table__td--age">{age}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="instances-page__pagination" aria-label="Pagination">
              <button
                className="instances-page__page-btn"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹ Prev
              </button>
              <span className="instances-page__page-info">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                className="instances-page__page-btn"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
