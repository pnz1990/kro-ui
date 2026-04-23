// CatalogCard — spec issue-534: selectable prop for bulk export mode.
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
  /** When true, the card is in selection mode: clicking the body toggles selection
   * instead of navigating to the RGD detail page. A checkbox overlay is shown.
   * spec issue-534 O1, O8.
   */
  selectable?: boolean
  /** Whether this card is currently selected (only relevant when selectable=true). */
  selected?: boolean
  /** Called when the user toggles the card's selection state. */
  onToggle?: (name: string, selected: boolean) => void
  /**
   * Pre-computed complexity score for this RGD (spec issue-768 28.2).
   * When > 0, shown as a numeric badge. Absent or 0 → badge hidden.
   */
  complexityScore?: number
}

export default function CatalogCard({
  rgd,
  instanceCount,
  usedBy,
  onLabelClick,
  selectable = false,
  selected = false,
  onToggle,
  complexityScore,
}: CatalogCardProps) {
  const name = extractRGDName(rgd)
  const kind = extractRGDKind(rgd)
  const resourceCount = extractResourceCount(rgd)
  const createdAt = extractCreationTimestamp(rgd)
  const { state, reason, message } = extractReadyStatus(rgd)
  const labels = extractLabels(rgd)
  const encodedName = encodeURIComponent(name)

  // §XII: never render '?' for absent data.
  // undefined = loading (show shimmer), null = failed (show —), number = count.
  // Issue #168: replace '…' literal with a shimmer element so users see progress.
  const instanceDisplay =
    instanceCount === null ? '—' :
    typeof instanceCount === 'number' ? String(instanceCount) :
    null  // undefined → render shimmer element below
  // Use 1 for plural check when undefined or null (avoid "1 instances")
  const instanceCountForPlural = typeof instanceCount === 'number' ? instanceCount : 2

  // Shared card body content (header + meta) — same in both modes.
  const cardBody = (
    <>
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
        {typeof complexityScore === 'number' && complexityScore > 0 && (
          <span
            className="catalog-card__complexity-badge"
            data-testid="complexity-badge"
            title={`Complexity score: ${complexityScore}`}
            aria-label={`Complexity ${complexityScore}`}
          >
            {complexityScore}
          </span>
        )}
        <span className="catalog-card__stat" data-testid="catalog-card-resources">
          {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
        </span>
        <span className="catalog-card__stat" data-testid="catalog-card-instances">
          {instanceCount === undefined ? (
            <span className="catalog-card__count-skeleton" aria-label="Loading instance count" />
          ) : (
            <>{instanceDisplay} instance{instanceCountForPlural !== 1 ? 's' : ''}</>
          )}
        </span>
        <span className="catalog-card__age">{formatAge(createdAt)}</span>
      </div>
    </>
  )

  return (
    <article
      className={`catalog-card${selected ? ' catalog-card--selected' : ''}`}
      data-testid={`catalog-card-${name}`}
    >
      {/* Checkbox overlay — shown in selection mode (spec O1).
          stopPropagation prevents the article click from double-firing. */}
      {selectable && (
        <input
          type="checkbox"
          className="catalog-card__checkbox"
          checked={selected}
          onChange={() => onToggle?.(name, !selected)}
          aria-label={`Select ${name}`}
          data-testid={`catalog-card-checkbox-${name}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Primary body — navigation vs selection depending on mode (spec O8). */}
      {selectable ? (
        <div
          role="button"
          tabIndex={0}
          className="catalog-card__body-link catalog-card__body-link--selectable"
          aria-pressed={selected}
          aria-label={`${selected ? 'Deselect' : 'Select'} ${name}`}
          onClick={() => onToggle?.(name, !selected)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle?.(name, !selected)
            }
          }}
          data-testid="btn-graph"
        >
          {cardBody}
        </div>
      ) : (
        <Link
          to={`/rgds/${encodedName}`}
          className="catalog-card__body-link"
          data-testid="btn-graph"
          aria-label={`View ${name} graph`}
        >
          {cardBody}
        </Link>
      )}

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
