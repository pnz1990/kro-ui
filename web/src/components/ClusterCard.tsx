import type { ClusterSummary, ClusterHealth } from '@/lib/api'
import './ClusterCard.css'

interface ClusterCardProps {
  summary: ClusterSummary
  onSwitch: (context: string) => void
}

function healthLabel(health: ClusterHealth, degraded: number): string {
  switch (health) {
    case 'healthy': return 'Healthy'
    case 'degraded': return `${degraded} degraded`
    case 'unreachable': return 'Unreachable'
    case 'kro-not-installed': return 'kro not installed'
    case 'auth-failed': return 'Auth failed'
    default: return 'Unknown'
  }
}

export default function ClusterCard({ summary, onSwitch }: ClusterCardProps) {
  const { context, cluster, health, rgdCount, instanceCount, degradedInstances } = summary

  return (
    <button
      className="cluster-card"
      onClick={() => onSwitch(context)}
      aria-label={`Switch to cluster ${context}`}
    >
      <div className="cluster-card__header">
        <div className="cluster-card__titles">
          <span className="cluster-card__context">{context}</span>
          {cluster && cluster !== context && (
            <span className="cluster-card__cluster">{cluster}</span>
          )}
        </div>
        <span
          className={`cluster-card__health-dot cluster-card__health-dot--${health}`}
          aria-label={`Health: ${health}`}
          title={healthLabel(health, degradedInstances)}
        />
      </div>

      <div className="cluster-card__body">
        {health === 'healthy' || health === 'degraded' ? (
          <>
            <div className="cluster-card__stat">
              {rgdCount} RGDs
            </div>
            <div className="cluster-card__stat">
              {instanceCount} instances
            </div>
          </>
        ) : null}

        <div className="cluster-card__status">
          {health === 'degraded' && (
            <span className="cluster-card__degraded-badge">
              {healthLabel(health, degradedInstances)}
            </span>
          )}
          {(health === 'unreachable' || health === 'kro-not-installed' || health === 'auth-failed') && (
            <span className={`cluster-card__status-text cluster-card__status-text--${health}`}>
              {healthLabel(health, degradedInstances)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
