import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import {
  extractRGDName,
  extractRGDKind,
  extractResourceCount,
  extractCreationTimestamp,
  extractReadyStatus,
  formatAge,
} from '@/lib/format'
import { extractLabels } from '@/lib/catalog'
import StatusDot from './StatusDot'
import './CatalogCard.css'

interface CatalogCardProps {
  rgd: K8sObject
  /**
   * Instance count for this RGD.
   * - undefined: fetch in-flight (show loading indicator)
   * - null: fetch failed (show em-dash per §XII)
   * - number: resolved count
   * Issue #116: previously always null before fetch resolved, so count never appeared.
   */
  instanceCount: number | null | undefined
  /** List of RGD names that reference this RGD (chaining "used by"). */
  usedBy: string[]
  /** Callback when a label pill is clicked — activates the label filter. */
  onLabelClick: (label: string) => void
}

export default function CatalogCard({
  rgd,
  instanceCount,
  usedBy,
  onLabelClick,
}: CatalogCardProps) {
  const name = extractRGDName(rgd)
  const kind = extractRGDKind(rgd)
  const resourceCount = extractResourceCount(rgd)
  const createdAt = extractCreationTimestamp(rgd)
  const { state, reason, message } = extractReadyStatus(rgd)
  const labels = extractLabels(rgd)
  const encodedName = encodeURIComponent(name)

  // §XII: never render '?' for absent data.
  // undefined = loading (show …), null = failed (show —), number = count.
  const instanceDisplay =
    instanceCount === undefined ? '…' :
    instanceCount === null ? '—' :
    String(instanceCount)
  // Use 1 for plural check when undefined or null (avoid "1 instances")
  const instanceCountForPlural = typeof instanceCount === 'number' ? instanceCount : 2

  return (
    <article className="catalog-card" data-testid={`catalog-card-${name}`}>
      {/* Primary link — wraps header + meta (issue #65) */}
      <Link
        to={`/rgds/${encodedName}`}
        className="catalog-card__body-link"
        data-testid="btn-graph"
        aria-label={`View ${name} graph`}
      >
        <div className="catalog-card__header">
          <StatusDot state={state} reason={reason} message={message} />
          <h2 className="catalog-card__name" data-testid="catalog-card-name">
            {name}
          </h2>
        </div>

        <div className="catalog-card__meta">
          {kind && (
            <span className="catalog-card__kind" data-testid="catalog-card-kind">
              {kind}
            </span>
          )}
          <span className="catalog-card__stat" data-testid="catalog-card-resources">
            {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
          </span>
          <span className="catalog-card__stat" data-testid="catalog-card-instances">
            {instanceDisplay} instance{instanceCountForPlural !== 1 ? 's' : ''}
          </span>
          <span className="catalog-card__age">{formatAge(createdAt)}</span>
        </div>
      </Link>

      {Object.keys(labels).length > 0 && (
        <div className="catalog-card__labels" data-testid="catalog-card-labels">
          {Object.entries(labels).map(([k, v]) => (
            <button
              key={`${k}=${v}`}
              className="catalog-card__label-pill"
              onClick={() => onLabelClick(`${k}=${v}`)}
              title={`Filter by ${k}=${v}`}
            >
              {k}={v}
            </button>
          ))}
        </div>
      )}

      {usedBy.length > 0 && (
        <div className="catalog-card__used-by" data-testid="catalog-card-used-by">
          <span className="catalog-card__used-by-label">Used by:</span>
          <ul className="catalog-card__used-by-list">
            {usedBy.map((refName) => (
              <li key={refName}>
                <Link
                  to={`/rgds/${encodeURIComponent(refName)}`}
                  className="catalog-card__used-by-link"
                >
                  {refName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="catalog-card__actions">
        <Link
          to={`/rgds/${encodedName}?tab=instances`}
          className="catalog-card__btn"
          data-testid="btn-instances"
        >
          Instances
        </Link>
      </div>
    </article>
  )
}
