import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { listInstances } from '@/lib/api'
import {
  extractRGDName,
  extractRGDKind,
  extractResourceCount,
  extractCreationTimestamp,
  extractReadyStatus,
  aggregateHealth,
  formatAge,
} from '@/lib/format'
import type { HealthSummary } from '@/lib/format'
import StatusDot from './StatusDot'
import HealthChip from './HealthChip'
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

  // Async instance health chip — fire-and-forget, never blocks card render (FR-001, FR-004)
  const [chipSummary, setChipSummary] = useState<HealthSummary | null>(null)
  const [chipLoading, setChipLoading] = useState(true)

  useEffect(() => {
    if (!name) {
      setChipLoading(false)
      return
    }
    const ac = new AbortController()
    listInstances(name, undefined, { signal: ac.signal })
      .then((list) => {
        setChipSummary(aggregateHealth(list.items))
      })
      .catch(() => {
        // Silently swallow — chip simply absent on any error (constitution §XII)
      })
      .finally(() => {
        if (!ac.signal.aborted) setChipLoading(false)
      })
    return () => ac.abort()
  }, [name])

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
          <span className="rgd-card__resources">
            {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
          </span>
          <span className="rgd-card__age">{formatAge(createdAt)}</span>
        </div>
        <HealthChip summary={chipSummary} loading={chipLoading} />
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
