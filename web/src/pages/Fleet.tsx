// Fleet — multi-cluster overview page.
// Fetches GET /api/v1/fleet/summary on mount.
// Cluster card clicks switch context and navigate to home (FR-004).

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFleetSummary, switchContext } from '@/lib/api'
import type { ClusterSummary } from '@/lib/api'
import ClusterCard from '@/components/ClusterCard'
import FleetMatrix from '@/components/FleetMatrix'
import SkeletonCard from '@/components/SkeletonCard'
import './Fleet.css'

export default function Fleet() {
  const [clusters, setClusters] = useState<ClusterSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const fetchFleet = useCallback(() => {
    setIsLoading(true)
    setError(null)
    getFleetSummary()
      .then((res) => {
        setClusters(res.clusters)
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

  // Build rgdsByContext map for the FleetMatrix (FR-005).
  const rgdsByContext: Record<string, Array<{ kind: string; health: 'healthy' | 'degraded' }>> =
    {}
  for (const c of clusters) {
    if (c.rgdKinds && c.rgdKinds.length > 0) {
      rgdsByContext[c.context] = c.rgdKinds.map((kind) => ({
        kind,
        health: c.health === 'degraded' ? 'degraded' : 'healthy',
      }))
    }
  }

  return (
    <div className="fleet">
      <h1 className="fleet__heading">Fleet Overview</h1>
      <p className="fleet__subheading">All kubeconfig contexts</p>

      {isLoading && (
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

      {!isLoading && error === null && clusters.length === 0 && (
        <div className="fleet__empty">
          <p>No kubeconfig contexts found.</p>
        </div>
      )}

      {!isLoading && error === null && clusters.length > 0 && (
        <>
          <div className="fleet__grid">
            {clusters.map((c) => (
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
            <FleetMatrix clusters={clusters} rgdsByContext={rgdsByContext} />
          </section>
        </>
      )}
    </div>
  )
}
