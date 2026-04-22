// InstanceHealthWidget — W-1 widget: SVG donut showing instance health distribution.
// Bar mode removed — donut only. No toggle.

import type { HealthDistribution } from '@/lib/format'
import type { HealthSample } from '@/hooks/useHealthTrend'
import HealthTrendSparkline from './HealthTrendSparkline'
import './InstanceHealthWidget.css'

export type ChartMode = 'bar' | 'donut'
export type { HealthDistribution }

interface InstanceHealthWidgetProps {
  distribution: HealthDistribution
  /** In-session health trend samples. When provided, renders a sparkline below
   *  the legend. Fewer than 2 samples show the sparkline's own placeholder. */
  samples?: HealthSample[]
}

type HealthKey = 'error' | 'degraded' | 'reconciling' | 'pending' | 'unknown' | 'ready'

const HEALTH_ORDER: Array<{ key: HealthKey; label: string; token: string }> = [
  { key: 'error',       label: 'Error',       token: 'var(--color-status-error)' },
  { key: 'degraded',    label: 'Degraded',    token: 'var(--color-status-degraded)' },
  { key: 'reconciling', label: 'Reconciling', token: 'var(--color-status-reconciling)' },
  { key: 'pending',     label: 'Pending',     token: 'var(--color-status-pending)' },
  { key: 'unknown',     label: 'Unknown',     token: 'var(--color-status-unknown)' },
  { key: 'ready',       label: 'Ready',       token: 'var(--color-status-ready)' },
]

const DONUT_R = 44
const DONUT_CX = 52
const DONUT_CY = 52
const DONUT_STROKE = 14
const DONUT_C = 2 * Math.PI * DONUT_R

export default function InstanceHealthWidget({ distribution, samples }: InstanceHealthWidgetProps) {
  const { total } = distribution
  const activeSegments = HEALTH_ORDER.filter(({ key }) => distribution[key] > 0)

  if (total === 0) {
    return (
      <div className="ihw ihw--empty" data-testid="instance-health-widget">
        <span className="ihw__empty">No instances</span>
      </div>
    )
  }

  // Build donut arcs
  let cumulative = 0
  const arcs = activeSegments.map(({ key, token }) => {
    const count = distribution[key]
    const proportion = count / total
    const dash = proportion * DONUT_C
    const gap = DONUT_C - dash
    const rotation = -90 + cumulative * 360
    cumulative += proportion
    return { key, token, dash, gap, rotation }
  })

  return (
    <div className="ihw" data-testid="instance-health-widget">
      <div className="ihw__top">
        <svg
          className="ihw__svg"
          viewBox="0 0 104 104"
          role="img"
          aria-label="Instance health distribution"
        >
        <circle
          cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
          fill="none"
          stroke="var(--color-border-subtle)"
          strokeWidth={DONUT_STROKE}
        />
        {arcs.map(({ key, token, dash, gap, rotation }) => (
          <circle
            key={key}
            cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R}
            fill="none"
            style={{ stroke: token }}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
            transform={`rotate(${rotation}, ${DONUT_CX}, ${DONUT_CY})`}
          />
        ))}
        <text x={DONUT_CX} y={DONUT_CY - 7} textAnchor="middle" className="ihw__center-num">
          {total.toLocaleString()}
        </text>
        <text x={DONUT_CX} y={DONUT_CY + 9} textAnchor="middle" className="ihw__center-label">
          instances
        </text>
      </svg>

      <div className="ihw__legend">
        {activeSegments.map(({ key, label, token }) => (
          <div key={key} className="ihw__legend-row">
            <span className="ihw__legend-dot" style={{ background: token }} />
            <span className="ihw__legend-count">{distribution[key].toLocaleString()}</span>
            <span className="ihw__legend-label">{label}</span>
          </div>
        ))}
      </div>
      </div>{/* end .ihw__top */}

      {/* In-session health trend sparkline — spec issue-712 O2 */}
      {samples !== undefined && (
        <div className="ihw__sparkline">
          <HealthTrendSparkline samples={samples} />
        </div>
      )}
    </div>
  )
}
