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
  /**
   * Number of instances of this RGD that are currently Terminating.
   * Optional — absent or 0 means no badge is shown (AC-015).
   * Spec: .specify/specs/031-deletion-debugger/ FR-007
   */
  terminatingCount?: number
  /**
   * Pre-computed health summary from Home.tsx's background fan-out.
   * When provided, RGDCard skips its own listInstances fetch (issue #235).
   */
  healthSummary?: HealthSummary
}

export default function RGDCard({ rgd, terminatingCount, healthSummary: healthSummaryProp }: RGDCardProps) {
  const name = extractRGDName(rgd)
  const kind = extractRGDKind(rgd)
  const resourceCount = extractResourceCount(rgd)
  const createdAt = extractCreationTimestamp(rgd)
  const { state, reason, message } = extractReadyStatus(rgd)

  const encodedName = encodeURIComponent(name)

  // Async instance health chip — fire-and-forget, never blocks card render (FR-001, FR-004).
  // When healthSummaryProp is provided (from Home.tsx fan-out), use it directly and skip
  // the per-card listInstances fetch. Falls back to its own fetch when prop is absent.
  const [fetchedSummary, setFetchedSummary] = useState<HealthSummary | null>(null)
  const [chipLoading, setChipLoading] = useState(Boolean(name))

  useEffect(() => {
    // If the parent passed a pre-computed summary, no need to fetch.
    if (healthSummaryProp !== undefined) {
      setChipLoading(false)
      return
    }
    if (!name) {
      setChipLoading(false)
      return
    }
    setChipLoading(true)
    const ac = new AbortController()
    listInstances(name, undefined, { signal: ac.signal })
      .then((list) => {
        setFetchedSummary(aggregateHealth(list.items ?? []))
      })
      .catch(() => {
        // Silently swallow — chip simply absent on any error (constitution §XII)
      })
      .finally(() => {
        if (!ac.signal.aborted) setChipLoading(false)
      })
    return () => ac.abort()
  }, [name, healthSummaryProp])

  // Use the prop when available (updated reactively), fall back to the fetched value.
  const chipSummary = healthSummaryProp ?? fetchedSummary

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
        {/* Health chip wrapper — fixed height so cards are uniform regardless
            of chip state (loading / null / "no instances" / "N ready").
            Without this, cards where the fetch returns null render shorter
            than their neighbours in the same grid row. */}
        <div className="rgd-card__chip-row">
          <HealthChip summary={chipSummary} loading={chipLoading} />
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
