import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { extractInstanceHealth, formatAge, extractCreationTimestamp, displayNamespace } from '@/lib/format'
import { isTerminating } from '@/lib/k8s'
import { toYaml } from '@/lib/yaml'
import InstanceYamlDiff from './InstanceYamlDiff'
import ReadinessBadge from './ReadinessBadge'
import './InstanceTable.css'

interface InstanceTableProps {
  items: K8sObject[]
  rgdName: string
}

/** Max characters before truncation with ellipsis (FR-004, edge case). */
const MAX_NAME_LEN = 63

/** Rows per page — keeps the DOM bounded at 500+ instances (Constitution §XIII). */
const PAGE_SIZE = 50

function truncate(s: string): { display: string; full: string } {
  if (s.length <= MAX_NAME_LEN) return { display: s, full: s }
  return { display: s.slice(0, MAX_NAME_LEN) + '…', full: s }
}

type SortKey = 'name' | 'age' | 'ready'
type SortDir = 'asc' | 'desc'

function rawName(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  return typeof meta?.name === 'string' ? meta.name : ''
}

/** Compare instances for a given sort key and direction. */
function compareItems(a: K8sObject, b: K8sObject, key: SortKey, dir: SortDir): number {
  let cmp = 0
  if (key === 'name') {
    cmp = rawName(a).localeCompare(rawName(b))
  } else if (key === 'age') {
    const aTs = extractCreationTimestamp(a)
    const bTs = extractCreationTimestamp(b)
    const aMs = aTs ? new Date(aTs).getTime() : 0
    const bMs = bTs ? new Date(bTs).getTime() : 0
    cmp = bMs - aMs
  } else if (key === 'ready') {
    const { state: aState } = extractInstanceHealth(a)
    const { state: bState } = extractInstanceHealth(b)
    const order: Record<string, number> = {
      error: 0, degraded: 1, reconciling: 2, pending: 3, unknown: 4, ready: 5,
    }
    cmp = (order[aState] ?? 3) - (order[bState] ?? 3)
  }
  return dir === 'asc' ? cmp : -cmp
}

// ── Spec diff helpers ─────────────────────────────────────────────────────

/** Flatten a spec object into key → stringified-value entries. */
function flattenSpec(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj !== 'object' || obj === null) {
    return prefix ? { [prefix]: String(obj) } : {}
  }
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenSpec(v, path))
    } else {
      // GH #401: render arrays as YAML (not compact JSON) for readability in the diff.
      result[path] = Array.isArray(v) ? toYaml(v).trimEnd() : String(v ?? '')
    }
  }
  return result
}

interface DiffRow {
  key: string
  aVal: string | undefined
  bVal: string | undefined
  differs: boolean
}

function buildDiff(a: K8sObject, b: K8sObject): DiffRow[] {
  const aSpec = flattenSpec((a.spec as Record<string, unknown>) ?? {})
  const bSpec = flattenSpec((b.spec as Record<string, unknown>) ?? {})
  const keys = Array.from(new Set([...Object.keys(aSpec), ...Object.keys(bSpec)])).sort()
  return keys.map((key) => ({
    key,
    aVal: aSpec[key],
    bVal: bSpec[key],
    differs: aSpec[key] !== bSpec[key],
  }))
}

// ── SpecDiffPanel ─────────────────────────────────────────────────────────

interface SpecDiffPanelProps {
  a: K8sObject
  b: K8sObject
  onClose: () => void
}

function instanceLabel(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  const name = typeof meta?.name === 'string' ? meta.name : '?'
  const ns = typeof meta?.namespace === 'string' ? meta.namespace : ''
  return ns ? `${displayNamespace(ns)}/${name}` : name
}

function SpecDiffPanel({ a, b, onClose }: SpecDiffPanelProps) {
  const rows = buildDiff(a, b)
  const diffCount = rows.filter((r) => r.differs).length
  const [showSame, setShowSame] = useState(false)

  const visible = showSame ? rows : rows.filter((r) => r.differs)

  return (
    <div className="spec-diff-panel" data-testid="spec-diff-panel">
      <div className="spec-diff-panel__header">
        <span className="spec-diff-panel__title">
          Spec diff —{' '}
          <span className={diffCount > 0 ? 'spec-diff-panel__count--diff' : 'spec-diff-panel__count--same'}>
            {diffCount === 0 ? 'specs are identical' : `${diffCount} field${diffCount === 1 ? '' : 's'} differ`}
          </span>
        </span>
        <label className="spec-diff-panel__toggle">
          <input
            type="checkbox"
            checked={showSame}
            onChange={(e) => setShowSame(e.target.checked)}
          />
          Show identical fields
        </label>
        <button
          type="button"
          className="spec-diff-panel__close"
          onClick={onClose}
          aria-label="Close diff panel"
        >
          Close diff
        </button>
      </div>

      <table className="spec-diff-table" data-testid="spec-diff-table">
        <thead>
          <tr>
            <th className="spec-diff-table__th spec-diff-table__th--field">Field</th>
            <th className="spec-diff-table__th spec-diff-table__th--value" title={instanceLabel(a)}>
              {instanceLabel(a)}
            </th>
            <th className="spec-diff-table__th spec-diff-table__th--value" title={instanceLabel(b)}>
              {instanceLabel(b)}
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={3} className="spec-diff-table__empty">
                {showSame
                  ? 'No spec fields found.'
                  : 'No differing fields. Enable "Show identical fields" to see all.'}
              </td>
            </tr>
          )}
          {visible.map((row) => (
            <tr
              key={row.key}
              className={`spec-diff-table__row${row.differs ? ' spec-diff-table__row--diff' : ' spec-diff-table__row--same'}`}
              data-testid={row.differs ? 'diff-row-differs' : 'diff-row-same'}
            >
              <td className="spec-diff-table__td spec-diff-table__td--field">
                <code>{row.key}</code>
              </td>
              <td className={`spec-diff-table__td spec-diff-table__td--value${row.differs ? ' spec-diff-table__td--differs' : ''}`}>
                {row.aVal !== undefined
                  ? <code>{row.aVal}</code>
                  : <span className="spec-diff-table__absent">—</span>
                }
              </td>
              <td className={`spec-diff-table__td spec-diff-table__td--value${row.differs ? ' spec-diff-table__td--differs' : ''}`}>
                {row.bVal !== undefined
                  ? <code>{row.bVal}</code>
                  : <span className="spec-diff-table__absent">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── InstanceTable ─────────────────────────────────────────────────────────

/**
 * InstanceTable — renders all live CR instances of an RGD.
 *
 * Columns: Name, Namespace, Age, Ready, Open link.
 * Sortable columns: Name (A→Z default), Age (newest first default),
 * Ready (worst first default — errors before healthy).
 * Paginated at PAGE_SIZE rows to stay within DOM bounds at 500+ instances.
 * "Terminating only" filter (spec 031-deletion-debugger FR-005).
 * Selection + spec diff (GH #287): when 2 rows are selected, a Compare button
 * opens a field-by-field spec diff panel.
 *
 * Issue #71: adds clickable column headers with sort indicators.
 * Issue #109: add pagination for 500+ instances (Constitution §XIII).
 * Issue #119: entire row is clickable — navigates to instance detail.
 * Spec: .specify/specs/004-instance-list/spec.md
 */
export default function InstanceTable({ items, rgdName }: InstanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('ready')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)
  const navigate = useNavigate()

  // FR-005: Terminating-only filter
  const [showTerminatingOnly, setShowTerminatingOnly] = useState(false)

  // FR-003 (spec 054-ux-gaps): name search filter
  const [nameFilter, setNameFilter] = useState('')

  // GH #287: row selection for spec diff
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [diffPair, setDiffPair] = useState<[K8sObject, K8sObject] | null>(null)

  // issue-537: full YAML diff — shows cleaned full YAML side-by-side with line highlights
  const [yamlDiffPair, setYamlDiffPair] = useState<[K8sObject, K8sObject] | null>(null)

  function itemKey(item: K8sObject): string {
    const meta = item.metadata as Record<string, unknown> | undefined
    const name = typeof meta?.name === 'string' ? meta.name : ''
    const ns = typeof meta?.namespace === 'string' ? meta.namespace : ''
    return `${ns}/${name}`
  }

  function handleCompare() {
    const keys = Array.from(selected)
    if (keys.length !== 2) return
    const a = items.find((i) => itemKey(i) === keys[0])
    const b = items.find((i) => itemKey(i) === keys[1])
    if (a && b) {
      setYamlDiffPair(null)
      setDiffPair([a, b])
    }
  }

  function handleYamlDiff() {
    const keys = Array.from(selected)
    if (keys.length !== 2) return
    const a = items.find((i) => itemKey(i) === keys[0])
    const b = items.find((i) => itemKey(i) === keys[1])
    if (a && b) {
      setDiffPair(null)
      setYamlDiffPair([a, b])
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'age' ? 'desc' : 'asc')
    }
    setPage(0)
  }

  const effectiveItems = showTerminatingOnly ? items.filter(isTerminating) : items

  // FR-003: apply name filter (case-insensitive substring)
  const nameQuery = nameFilter.trim().toLowerCase()
  const filteredItems = nameQuery
    ? effectiveItems.filter((item) => {
        const meta = item.metadata as Record<string, unknown> | undefined
        const name = typeof meta?.name === 'string' ? meta.name.toLowerCase() : ''
        return name.includes(nameQuery)
      })
    : effectiveItems

  const sorted = [...filteredItems].sort((a, b) => compareItems(a, b, sortKey, sortDir))
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Whether to show checkboxes — only when >1 instance total
  const showCheckboxes = items.length > 1

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) {
      return <span className="sort-indicator sort-indicator--inactive" aria-hidden="true">⇅</span>
    }
    return (
      <span className="sort-indicator" aria-hidden="true">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  function ariaSortAttr(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div className="instance-table-container">
      {/* Filters row */}
      <div className="instance-table-filters">
        {/* FR-003 (spec 054-ux-gaps): name search filter */}
        <div className="instance-filter-search">
          <input
            type="search"
            className="instance-filter-search__input"
            placeholder="Filter by name..."
            aria-label="Filter instances by name"
            data-testid="instance-name-filter"
            value={nameFilter}
            onChange={(e) => { setNameFilter(e.target.value); setPage(0) }}
          />
          {nameQuery && (
            <span className="instance-filter-search__count" aria-live="polite">
              {filteredItems.length} of {effectiveItems.length}
            </span>
          )}
        </div>

        <label className="instance-filter-terminating">
          <input
            type="checkbox"
            checked={showTerminatingOnly}
            onChange={(e) => { setShowTerminatingOnly(e.target.checked); setPage(0) }}
          />
          Terminating only
        </label>

        {/* Compare action — appears when exactly 2 rows selected */}
        {showCheckboxes && selected.size > 0 && (
          <span className="instance-table-compare-bar" data-testid="compare-bar">
            {selected.size === 2 ? (
              <>
                <button
                  type="button"
                  className="instance-table-compare-btn"
                  onClick={handleCompare}
                  data-testid="compare-btn"
                >
                  Compare specs
                </button>
                <button
                  type="button"
                  className="instance-table-compare-btn instance-table-compare-btn--yaml"
                  onClick={handleYamlDiff}
                  data-testid="compare-yaml-btn"
                >
                  Compare full YAML
                </button>
              </>
            ) : (
              <span className="instance-table-compare-hint">
                Select 1 more instance to compare
              </span>
            )}
            <button
              type="button"
              className="instance-table-compare-clear"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              data-testid="compare-clear"
            >
              Clear
            </button>
          </span>
        )}
      </div>

      {/* Diff panel — shown when Compare is active */}
      {diffPair && (
        <SpecDiffPanel
          a={diffPair[0]}
          b={diffPair[1]}
          onClose={() => { setDiffPair(null); setSelected(new Set()) }}
        />
      )}

      {/* Full YAML diff panel — shown when Compare full YAML is active (issue-537) */}
      {yamlDiffPair && (
        <InstanceYamlDiff
          a={yamlDiffPair[0]}
          b={yamlDiffPair[1]}
          onClose={() => { setYamlDiffPair(null); setSelected(new Set()) }}
        />
      )}

      {/* AC-009: Empty state when filter is active but no matches */}
      {showTerminatingOnly && effectiveItems.length === 0 ? (
        <p className="panel-empty">No instances are currently terminating.</p>
      ) : nameQuery && filteredItems.length === 0 ? (
        <p className="panel-empty">
          No instances match &ldquo;{nameFilter}&rdquo;.{' '}
          <button
            type="button"
            className="instance-filter-search__clear"
            onClick={() => { setNameFilter(''); setPage(0) }}
          >
            Clear filter
          </button>
        </p>
      ) : (
        <>
        <table className="instance-table" data-testid="instance-table">
        <thead>
          <tr>
            {showCheckboxes && (
              <th className="instance-table__th instance-table__th--check" aria-label="Select for comparison" />
            )}
            <th
              className="instance-table__th instance-table__th--sortable"
              aria-sort={ariaSortAttr('name')}
              onClick={() => handleSort('name')}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort('name') }}
            >
              Name {sortIndicator('name')}
            </th>
            <th className="instance-table__th">Namespace</th>
            <th
              className="instance-table__th instance-table__th--sortable"
              aria-sort={ariaSortAttr('age')}
              onClick={() => handleSort('age')}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort('age') }}
            >
              Age {sortIndicator('age')}
            </th>
            <th
              className="instance-table__th instance-table__th--sortable"
              aria-sort={ariaSortAttr('ready')}
              onClick={() => handleSort('ready')}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort('ready') }}
            >
              Ready {sortIndicator('ready')}
            </th>
            <th className="instance-table__th instance-table__th--action" />
          </tr>
        </thead>
        <tbody>
          {pageItems.map((item) => {
            const meta = item.metadata as Record<string, unknown> | undefined
            const name = typeof meta?.name === 'string' ? meta.name : ''
            const namespace =
              typeof meta?.namespace === 'string' ? meta.namespace : ''
            const createdAt = extractCreationTimestamp(item)
            const age = createdAt ? formatAge(createdAt) : '—'
            const readyStatus = extractInstanceHealth(item)
            const { display, full } = truncate(name)
            const key = itemKey(item)
            const isSelected = selected.has(key)

            return (
              <tr
                key={key}
                className={`instance-table__row${isSelected ? ' instance-table__row--selected' : ''}`}
                data-testid={`instance-row-${name}`}
                onClick={(e) => {
                  // Don't navigate if the click was on the selection checkbox or its td
                  if ((e.target as HTMLElement).closest('td.instance-table__td--check')) return
                  navigate(
                    `/rgds/${encodeURIComponent(rgdName)}/instances/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
                  )
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(
                      `/rgds/${encodeURIComponent(rgdName)}/instances/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
                    )
                  }
                }}
                aria-label={`Open instance ${name}`}
              >
                {showCheckboxes && (
                  <td className="instance-table__td instance-table__td--check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(key)) {
                            next.delete(key)
                          } else if (next.size < 2) {
                            next.add(key)
                          }
                          return next
                        })
                      }}
                      aria-label={`Select ${name} for comparison`}
                      data-testid={`select-${name}`}
                      disabled={selected.size === 2 && !isSelected}
                    />
                  </td>
                )}
                <td
                  className="instance-table__td instance-table__td--name"
                  data-testid="instance-name"
                  title={full !== display ? full : undefined}
                >
                  {display}
                </td>
                <td
                  className="instance-table__td"
                  data-testid="instance-namespace"
                >
                  {displayNamespace(namespace)}
                </td>
                <td className="instance-table__td" data-testid="instance-age">
                  {age}
                </td>
                <td className="instance-table__td">
                  <ReadinessBadge status={readyStatus} />
                </td>
                <td className="instance-table__td instance-table__td--action">
                  <Link
                    to={`/rgds/${encodeURIComponent(rgdName)}/instances/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`}
                    className="instance-table__open-link"
                    data-testid="btn-open"
                    aria-label={`Open instance ${name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="instance-table-pagination" data-testid="instance-table-pagination" role="navigation" aria-label="Pagination">
          <button
            className="instance-table-pagination__btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="instance-table-pagination__info">
            {safePage + 1} / {totalPages}
            <span className="instance-table-pagination__count"> ({effectiveItems.length} total)</span>
          </span>
          <button
            className="instance-table-pagination__btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
        </>
      )}
    </div>
  )
}
