import type { ClusterSummary } from '@/lib/api'
import { abbreviateContext } from '@/lib/format'
import { Link } from 'react-router-dom'
import './FleetMatrix.css'

// RGDPresence represents a single cell in the matrix.
type RGDPresence = 'present' | 'degraded' | 'absent' | 'unknown'

interface MatrixCell {
  presence: RGDPresence
  rgdName?: string
}

interface FleetMatrixProps {
  clusters: ClusterSummary[]
  // rgdsByContext maps context name → list of {kind, health}
  rgdsByContext: Record<string, Array<{ kind: string; health: 'healthy' | 'degraded' }>>
}

function getPresence(
  context: string,
  kind: string,
  rgdsByContext: FleetMatrixProps['rgdsByContext'],
): MatrixCell {
  const rgds = rgdsByContext[context]
  if (!rgds) return { presence: 'unknown' }
  const match = rgds.find((r) => r.kind === kind)
  if (!match) return { presence: 'absent' }
  return { presence: match.health === 'degraded' ? 'degraded' : 'present' }
}

function allKinds(rgdsByContext: FleetMatrixProps['rgdsByContext']): string[] {
  const kinds = new Set<string>()
  for (const rgds of Object.values(rgdsByContext)) {
    for (const r of rgds) {
      if (r.kind) kinds.add(r.kind)
    }
  }
  return Array.from(kinds).sort()
}

export default function FleetMatrix({ clusters, rgdsByContext }: FleetMatrixProps) {
  const kinds = allKinds(rgdsByContext)

  if (kinds.length === 0) {
    return (
      <div className="fleet-matrix fleet-matrix--empty" data-testid="fleet-matrix-empty">
        <span className="fleet-matrix__empty-text">
          No ResourceGraphDefinitions found. Apply an RGD to any connected cluster to see it here.
        </span>
        {' '}
        <Link to="/author">Create your first RGD →</Link>
      </div>
    )
  }

  return (
    <div className="fleet-matrix" role="region" aria-label="RGD presence matrix">
      <div className="fleet-matrix__legend" aria-label="Matrix legend">
        <span className="fleet-matrix__legend-entry" title="This RGD has at least one healthy (Ready) instance in this cluster">
          <span className="fleet-matrix__dot fleet-matrix__dot--present" aria-hidden="true" />
          Present
        </span>
        <span className="fleet-matrix__legend-entry" title="This RGD has instances but at least one is in an error or reconciling state">
          <span className="fleet-matrix__dot fleet-matrix__dot--degraded" aria-hidden="true" />
          Degraded
        </span>
        <span className="fleet-matrix__legend-entry" title="No instances of this RGD exist in this cluster">
          <span className="fleet-matrix__absent-dash" aria-hidden="true">–</span>
          Absent
        </span>
      </div>
      <div className="fleet-matrix__scroll">
        <table className="fleet-matrix__table">
          <thead>
            <tr>
              <th className="fleet-matrix__th fleet-matrix__th--kind" scope="col">
                RGD kind
              </th>
              {clusters.map((c) => (
                <th key={c.context} className="fleet-matrix__th" scope="col"
                  title={c.context}
                >
                  {abbreviateContext(c.context)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kinds.map((kind) => (
              <tr key={kind}>
                <th className="fleet-matrix__td fleet-matrix__th--row" scope="row">
                  {kind}
                </th>
                {clusters.map((c) => {
                  const cell = getPresence(c.context, kind, rgdsByContext)
                  return (
                    <td
                      key={c.context}
                      className={`fleet-matrix__td fleet-matrix__cell fleet-matrix__cell--${cell.presence}`}
                      aria-label={`${kind} in ${c.context}: ${cell.presence}`}
                    >
                      {cell.presence === 'present' && (
                        <span className="fleet-matrix__dot fleet-matrix__dot--present" aria-hidden="true" />
                      )}
                      {cell.presence === 'degraded' && (
                        <span className="fleet-matrix__dot fleet-matrix__dot--degraded" aria-hidden="true" />
                      )}
                      {cell.presence === 'absent' && (
                        <span className="fleet-matrix__absent-dash" aria-hidden="true">–</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
