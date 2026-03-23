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
import StatusDot from './StatusDot'
import './RGDCard.css'

interface RGDCardProps {
  rgd: K8sObject
  /**
   * Number of instances of this RGD that are currently Terminating.
   * Optional — absent or 0 means no badge is shown (AC-015).
   * Spec: .specify/specs/031-deletion-debugger/ FR-007
   */
  terminatingCount?: number
}

export default function RGDCard({ rgd, terminatingCount }: RGDCardProps) {
  const name = extractRGDName(rgd)
  const kind = extractRGDKind(rgd)
  const resourceCount = extractResourceCount(rgd)
  const createdAt = extractCreationTimestamp(rgd)
  const { state, reason, message } = extractReadyStatus(rgd)

  const encodedName = encodeURIComponent(name)

  return (
    <article className="rgd-card" data-testid={`rgd-card-${name}`}>
      {/* Primary link wraps the full card body — issue #65 */}
      <Link
        to={`/rgds/${encodedName}`}
        className="rgd-card__body-link"
        data-testid="btn-graph"
        aria-label={`View ${name} graph`}
      >
        <div className="rgd-card__header">
          <StatusDot state={state} reason={reason} message={message} />
          <h2 className="rgd-card__name" data-testid="rgd-name">
            {name}
          </h2>
        </div>
        <div className="rgd-card__meta">
          {kind && (
            <span className="rgd-card__kind" data-testid="rgd-kind">
              {kind}
            </span>
          )}
          {/* FR-007: Terminating badge — only when count > 0 (AC-015) */}
          {terminatingCount != null && terminatingCount > 0 && (
            <span
              className="rgd-card__terminating-badge"
              title={`${terminatingCount} instance(s) terminating`}
              data-testid="rgd-terminating-badge"
            >
              ⊗ {terminatingCount}
            </span>
          )}
          <span className="rgd-card__resources">
            {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
          </span>
          <span className="rgd-card__age">{formatAge(createdAt)}</span>
        </div>
      </Link>
      <div className="rgd-card__actions">
        <Link
          to={`/rgds/${encodedName}?tab=instances`}
          className="rgd-card__btn"
          data-testid="btn-instances"
        >
          Instances
        </Link>
      </div>
    </article>
  )
}
