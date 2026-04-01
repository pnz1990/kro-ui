// InstanceHealthWidget — W-1 widget for the Overview SRE dashboard.
// Displays the health distribution of all CR instances as a segmented bar
// or SVG donut chart (toggled by the user, persisted in localStorage).
// Spec: .specify/specs/062-overview-sre-dashboard/

import type { HealthDistribution } from '@/lib/format'
import './InstanceHealthWidget.css'

export type ChartMode = 'bar' | 'donut'
export type { HealthDistribution }

interface InstanceHealthWidgetProps {
  distribution: HealthDistribution
  chartMode: ChartMode
  onChartModeChange: (mode: ChartMode) => void
}

type HealthKey = 'error' | 'degraded' | 'reconciling' | 'pending' | 'unknown' | 'ready'

// Ordered worst-first for display priority (bar) and donut segment order.
const HEALTH_ORDER: Array<{
  key: HealthKey
  label: string
  token: string
}> = [
  { key: 'error',       label: 'error',       token: 'var(--color-status-error)' },
  { key: 'degraded',    label: 'degraded',    token: 'var(--color-status-degraded)' },
  { key: 'reconciling', label: 'reconciling', token: 'var(--color-status-reconciling)' },
  { key: 'pending',     label: 'pending',     token: 'var(--color-status-pending)' },
  { key: 'unknown',     label: 'unknown',     token: 'var(--color-status-unknown)' },
  { key: 'ready',       label: 'ready',       token: 'var(--color-status-ready)' },
]

export default function InstanceHealthWidget({
  distribution,
  chartMode,
  onChartModeChange,
}: InstanceHealthWidgetProps) {
  const { total } = distribution

  // Empty state
  if (total === 0) {
    return (
      <div className="ihw" data-testid="instance-health-widget">
        <p className="ihw__empty">No instances found</p>
        <ChartToggle chartMode={chartMode} onChartModeChange={onChartModeChange} />
      </div>
    )
  }

  return (
    <div className="ihw" data-testid="instance-health-widget">
      <div className="ihw__total">{total.toLocaleString()} <span className="ihw__total-label">instances</span></div>

      {chartMode === 'bar' ? (
        <SegmentedBar distribution={distribution} />
      ) : (
        <DonutChart distribution={distribution} />
      )}

      <div className="ihw__counts">
        {HEALTH_ORDER.filter(({ key }) => distribution[key] > 0).map(({ key, label, token }) => (
          <span key={key} className="ihw__count-item">
            <span className="ihw__count-dot" style={{ background: token }} />
            <span className="ihw__count-num">{distribution[key]}</span>
            <span className="ihw__count-label">{label}</span>
          </span>
        ))}
      </div>

      <ChartToggle chartMode={chartMode} onChartModeChange={onChartModeChange} />
    </div>
  )
}

// ── Segmented Bar ──────────────────────────────────────────────────────

function SegmentedBar({ distribution }: { distribution: HealthDistribution }) {
  const { total } = distribution
  const segments = HEALTH_ORDER.filter(({ key }) => distribution[key] > 0)

  return (
    <div className="ihw__bar" role="img" aria-label="Instance health distribution bar">
      {segments.map(({ key, token }, i) => {
        const count = distribution[key]
        const pct = (count / total) * 100
        return (
          <div
            key={key}
            className={`ihw__bar-segment${i === 0 ? ' ihw__bar-segment--first' : ''}${i === segments.length - 1 ? ' ihw__bar-segment--last' : ''}`}
            style={{ flex: count, background: token, minWidth: pct < 2 ? '4px' : undefined }}
            title={`${count} ${key}`}
          />
        )
      })}
    </div>
  )
}

// ── SVG Donut ──────────────────────────────────────────────────────────

const DONUT_R = 48
const DONUT_CX = 60
const DONUT_CY = 60
const DONUT_STROKE = 18
const DONUT_C = 2 * Math.PI * DONUT_R

function DonutChart({ distribution }: { distribution: HealthDistribution }) {
  const { total } = distribution
  const segments = HEALTH_ORDER.filter(({ key }) => distribution[key] > 0)

  // Build cumulative angles (starting at -90° = 12 o'clock)
  let cumulative = 0
  const arcs = segments.map(({ key, token }) => {
    const count = distribution[key]
    const proportion = count / total
    const dash = proportion * DONUT_C
    const gap = DONUT_C - dash
    const rotation = -90 + cumulative * 360
    cumulative += proportion
    return { key, token, dash, gap, rotation }
  })

  return (
    <div className="ihw__donut-wrap">
      <svg
        className="ihw__donut-svg"
        viewBox={`0 0 120 120`}
        role="img"
        aria-label="Instance health distribution donut"
      >
        {/* Track */}
        <circle
          cx={DONUT_CX}
          cy={DONUT_CY}
          r={DONUT_R}
          fill="none"
          stroke="var(--color-border-subtle)"
          strokeWidth={DONUT_STROKE}
        />
        {arcs.map(({ key, token, dash, gap, rotation }) => (
          <circle
            key={key}
            cx={DONUT_CX}
            cy={DONUT_CY}
            r={DONUT_R}
            fill="none"
            style={{ stroke: token }}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation}, ${DONUT_CX}, ${DONUT_CY})`}
          />
        ))}
        <text
          x={DONUT_CX}
          y={DONUT_CY}
          textAnchor="middle"
          dominantBaseline="central"
          className="ihw__donut-center-text"
        >
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="ihw__donut-legend">
        {segments.map(({ key, token }) => (
          <span key={key} className="ihw__donut-legend-item">
            <span className="ihw__donut-legend-dot" style={{ background: token }} />
            <span className="ihw__donut-legend-count">{distribution[key]}</span>
            <span className="ihw__donut-legend-label">{key}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Chart toggle ───────────────────────────────────────────────────────

function ChartToggle({ chartMode, onChartModeChange }: { chartMode: ChartMode; onChartModeChange: (m: ChartMode) => void }) {
  return (
    <div className="ihw__toggle" role="group" aria-label="Chart type">
      <button
        type="button"
        className={`ihw__toggle-btn${chartMode === 'bar' ? ' ihw__toggle-btn--active' : ''}`}
        onClick={() => onChartModeChange('bar')}
        aria-pressed={chartMode === 'bar'}
      >
        Bar
      </button>
      <button
        type="button"
        className={`ihw__toggle-btn${chartMode === 'donut' ? ' ihw__toggle-btn--active' : ''}`}
        onClick={() => onChartModeChange('donut')}
        aria-pressed={chartMode === 'donut'}
      >
        Donut
      </button>
    </div>
  )
}
