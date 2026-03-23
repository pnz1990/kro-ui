import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { extractInstanceHealth, formatAge, extractCreationTimestamp } from '@/lib/format'
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
    // Newest first by default (desc): higher timestamp = smaller age
    cmp = bMs - aMs
  } else if (key === 'ready') {
    const { state: aState } = extractInstanceHealth(a)
    const { state: bState } = extractInstanceHealth(b)
    // Worst first: error=0, reconciling=1, pending=2, unknown=3, ready=4
    const order: Record<string, number> = {
      error: 0, reconciling: 1, pending: 2, unknown: 3, ready: 4,
    }
    cmp = (order[aState] ?? 3) - (order[bState] ?? 3)
  }
  return dir === 'asc' ? cmp : -cmp
}

/**
 * InstanceTable — renders all live CR instances of an RGD.
 *
 * Columns: Name, Namespace, Age, Ready, Open link.
 * Sortable columns: Name (A→Z default), Age (newest first default),
 * Ready (worst first default — errors before healthy).
 * Paginated at PAGE_SIZE rows to stay within DOM bounds at 500+ instances.
 *
 * Issue #71: adds clickable column headers with sort indicators.
 * Issue #109: add pagination for 500+ instances (Constitution §XIII).
 * Spec: .specify/specs/004-instance-list/spec.md
 */
export default function InstanceTable({ items, rgdName }: InstanceTableProps) {
  // Default: Ready asc = errors first (worst-first per constitution §XIII)
  const [sortKey, setSortKey] = useState<SortKey>('ready')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Default directions when activating a column:
      //   age → newest first (desc), others → asc
      setSortDir(key === 'age' ? 'desc' : 'asc')
    }
    // Reset to first page on sort change
    setPage(0)
  }

  const sorted = [...items].sort((a, b) => compareItems(a, b, sortKey, sortDir))
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

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
      <table className="instance-table" data-testid="instance-table">
        <thead>
          <tr>
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

            return (
              <tr
                key={`${namespace}/${name}`}
                className="instance-table__row"
                data-testid={`instance-row-${name}`}
              >
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
                  {namespace}
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
            <span className="instance-table-pagination__count"> ({items.length} total)</span>
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
    </div>
  )
}
