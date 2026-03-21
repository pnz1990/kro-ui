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
}

export default function RGDCard({ rgd }: RGDCardProps) {
  const name = extractRGDName(rgd)
  const kind = extractRGDKind(rgd)
  const resourceCount = extractResourceCount(rgd)
  const createdAt = extractCreationTimestamp(rgd)
  const { state, reason, message } = extractReadyStatus(rgd)

  const encodedName = encodeURIComponent(name)

  return (
    <article className="rgd-card" data-testid={`rgd-card-${name}`}>
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
        <span className="rgd-card__resources">
          {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
        </span>
        <span className="rgd-card__age">{formatAge(createdAt)}</span>
      </div>
      <div className="rgd-card__actions">
        <Link
          to={`/rgds/${encodedName}`}
          className="rgd-card__btn"
          data-testid="btn-graph"
        >
          Graph
        </Link>
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
