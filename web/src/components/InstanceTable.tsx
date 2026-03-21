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

/**
 * InstanceTable — renders all live CR instances of an RGD.
 *
 * Columns: name, namespace, age, readiness badge, open link.
 * Name is truncated at 63 chars with a title tooltip. FR-004, FR-005.
 *
 * Spec: .specify/specs/004-instance-list/spec.md
 */
export default function InstanceTable({ items, rgdName }: InstanceTableProps) {
  return (
    <table className="instance-table" data-testid="instance-table">
      <thead>
        <tr>
          <th className="instance-table__th">Name</th>
          <th className="instance-table__th">Namespace</th>
          <th className="instance-table__th">Age</th>
          <th className="instance-table__th">Ready</th>
          <th className="instance-table__th instance-table__th--action" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const meta = item.metadata as Record<string, unknown> | undefined
          const rawName = typeof meta?.name === 'string' ? meta.name : ''
          const namespace =
            typeof meta?.namespace === 'string' ? meta.namespace : ''
          const createdAt = extractCreationTimestamp(item)
          const age = createdAt ? formatAge(createdAt) : '—'
          const readyStatus = extractReadyStatus(item)
          const { display, full } = truncate(rawName)

          return (
            <tr
              key={`${namespace}/${rawName}`}
              className="instance-table__row"
              data-testid={`instance-row-${rawName}`}
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
                  to={`/rgds/${encodeURIComponent(rgdName)}/instances/${encodeURIComponent(namespace)}/${encodeURIComponent(rawName)}`}
                  className="instance-table__open-link"
                  data-testid="btn-open"
                  aria-label={`Open instance ${rawName}`}
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
