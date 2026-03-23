// Fleet — multi-cluster overview page.
// Fetches GET /api/v1/fleet/summary on mount.
// Cluster card clicks switch context and navigate to home (FR-004).
// Issue #72: adds manual refresh button + last-refreshed timestamp.
// Issue #62: deduplicates clusters pointing to the same server URL.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFleetSummary, switchContext } from '@/lib/api'
import type { ClusterSummary } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import ClusterCard from '@/components/ClusterCard'
import FleetMatrix from '@/components/FleetMatrix'
import SkeletonCard from '@/components/SkeletonCard'
import './Fleet.css'

/**
 * Deduplicate clusters that point to the same server URL (issue #62).
 *
 * When multiple kubeconfig contexts point to the same physical cluster,
 * we keep the first one and attach the other context names as aliases.
 * The shortest/friendliest name (fewest chars, or non-ARN) is preferred.
 *
 * Returns the deduplicated list; each entry now has an optional `aliases` field
 * listing the other context names that share the same server.
 */
function deduplicateClusters(
  clusters: ClusterSummary[],
): (ClusterSummary & { aliases?: string[] })[] {
  const seenByCluster = new Map<string, ClusterSummary & { aliases?: string[] }>()

  for (const c of clusters) {
    // Use `cluster` (server URL or cluster name) as the dedup key.
    // Fall back to context name if cluster is empty.
    const key = c.cluster || c.context

    if (!seenByCluster.has(key)) {
      seenByCluster.set(key, { ...c, aliases: [] })
    } else {
      const existing = seenByCluster.get(key)!
      existing.aliases = existing.aliases ?? []
      existing.aliases.push(c.context)

      // Prefer the shorter / friendlier display name
      if (c.context.length < existing.context.length) {
        const oldContext = existing.context
        existing.context = c.context
        existing.aliases = existing.aliases.filter((a) => a !== c.context)
        existing.aliases.push(oldContext)
      }
    }
  }

  return Array.from(seenByCluster.values())
}

/** Format a Date as "Xs ago" / "Xm ago" / "just now". */
function formatAgo(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

export default function Fleet() {
  usePageTitle('Fleet')
  const [clusters, setClusters] = useState<ClusterSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const navigate = useNavigate()

  // Re-render every 15s to update the "refreshed N ago" counter
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  const fetchFleet = useCallback(() => {
    setIsLoading(true)
    setError(null)
    getFleetSummary()
      .then((res) => {
        setClusters(res.clusters)
        setLastRefresh(new Date())
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchFleet()
  }, [fetchFleet])

  // Cluster card click: switch context then navigate home (FR-004).
  const handleSwitch = useCallback(
    (context: string) => {
      switchContext(context)
        .then(() => {
          navigate('/')
        })
        .catch(() => {
          // Best-effort: even if switch fails, navigate home so the user can
          // retry or see the current cluster state.
          navigate('/')
        })
    },
    [navigate],
  )

  // Deduplicate aliases before rendering (issue #62)
  const deduped = deduplicateClusters(clusters)

  // Build rgdsByContext map for the FleetMatrix (FR-005).
  const rgdsByContext: Record<string, Array<{ kind: string; health: 'healthy' | 'degraded' }>> =
    {}
  for (const c of deduped) {
    if (c.rgdKinds && c.rgdKinds.length > 0) {
      rgdsByContext[c.context] = c.rgdKinds.map((kind) => ({
        kind,
        health: c.health === 'degraded' ? 'degraded' : 'healthy',
      }))
    }
  }

  return (
    <div className="fleet">
      <div className="fleet__title-row">
        <div>
          <h1 className="fleet__heading">Fleet Overview</h1>
          {/* Issue #128: use <span> not <p> to avoid block-level margin inflation */}
          <span className="fleet__subheading">All kubeconfig contexts</span>
        </div>
        <div className="fleet__refresh-area">
          {lastRefresh && !isLoading && (
            <span className="fleet__refresh-hint" aria-live="polite">
              Updated {formatAgo(lastRefresh)}
            </span>
          )}
          <button
            type="button"
            className="fleet__refresh-btn"
            onClick={fetchFleet}
            disabled={isLoading}
            aria-label="Refresh fleet data"
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading && clusters.length === 0 && (
        <div className="fleet__grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && error !== null && (
        <div className="fleet__error" role="alert">
          <p className="fleet__error-message">{error}</p>
          <button className="fleet__retry-btn" onClick={fetchFleet}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && error === null && deduped.length === 0 && (
        <div className="fleet__empty">
          <p>No kubeconfig contexts found.</p>
        </div>
      )}

      {error === null && deduped.length > 0 && (
        <>
          <div className="fleet__grid">
            {deduped.map((c) => (
              <ClusterCard key={c.context} summary={c} onSwitch={handleSwitch} />
            ))}
          </div>

          <section className="fleet__matrix-section" aria-labelledby="fleet-matrix-heading">
            <h2 id="fleet-matrix-heading" className="fleet__section-heading">
              RGD Compare
            </h2>
            <p className="fleet__section-subheading">
              Which RGD kinds are deployed in which clusters
            </p>
            <FleetMatrix clusters={deduped} rgdsByContext={rgdsByContext} />
          </section>
        </>
      )}
    </div>
  )
}
