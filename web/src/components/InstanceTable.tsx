import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { extractReadyStatus, formatAge, extractCreationTimestamp } from '@/lib/format'
import ReadinessBadge from './ReadinessBadge'
import './InstanceTable.css'

interface InstanceTableProps {
  items: K8sObject[]
  rgdName: string
}

/** Max characters before truncation with ellipsis (FR-004, edge case). */
const MAX_NAME_LEN = 63

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
    const { state: aState } = extractReadyStatus(a)
    const { state: bState } = extractReadyStatus(b)
    // Worst first: error=0, reconciling=1, pending=2, alive=3, unknown=4
    const order: Record<string, number> = {
      error: 0, reconciling: 1, pending: 2, alive: 3, unknown: 4,
    }
    cmp = (order[aState] ?? 4) - (order[bState] ?? 4)
  }
  return dir === 'asc' ? cmp : -cmp
}

/**
 * InstanceTable — renders all live CR instances of an RGD.
 *
 * Columns: Name, Namespace, Age, Ready, Open link.
 * Sortable columns: Name (A→Z default), Age (newest first default),
 * Ready (worst first default — errors before healthy).
 *
 * Issue #71: adds clickable column headers with sort indicators.
 * Spec: .specify/specs/004-instance-list/spec.md
 */
export default function InstanceTable({ items, rgdName }: InstanceTableProps) {
  // Default: Ready asc = errors first (worst-first per constitution §XIII)
  const [sortKey, setSortKey] = useState<SortKey>('ready')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Default directions when activating a column:
      //   age → newest first (desc), others → asc
      setSortDir(key === 'age' ? 'desc' : 'asc')
    }
  }

  const sorted = [...items].sort((a, b) => compareItems(a, b, sortKey, sortDir))

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
        {sorted.map((item) => {
          const meta = item.metadata as Record<string, unknown> | undefined
          const name = typeof meta?.name === 'string' ? meta.name : ''
          const namespace =
            typeof meta?.namespace === 'string' ? meta.namespace : ''
          const createdAt = extractCreationTimestamp(item)
          const age = createdAt ? formatAge(createdAt) : '—'
          const readyStatus = extractReadyStatus(item)
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
  )
}
