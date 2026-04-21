// HealthTrendSparkline — SVG sparkline showing instance health trend over session time.
//
// Renders two lines on a 240×40 viewBox:
//   - Green line: % ready (ready / total)
//   - Red line: % error+degraded ((error + degraded) / total)
//
// Spec: .specify/specs/issue-539/spec.md O1, O4, O6
// Design: docs/design/30-health-system.md §Future → ✅

import type { HealthSample } from '@/hooks/useHealthTrend'
import { formatAge } from '@/lib/format'
import './HealthTrendSparkline.css'

interface HealthTrendSparklineProps {
  samples: HealthSample[]
}

// SVG dimensions
const W = 240
const H = 40
const PAD_X = 2
const PAD_Y = 3

/** Map a proportion (0–1) to a Y coordinate in the SVG (top = 0% ready, bottom = 100%). */
function toY(proportion: number): number {
  return PAD_Y + (1 - proportion) * (H - PAD_Y * 2)
}

/** Map a sample index to an X coordinate. */
function toX(index: number, total: number): number {
  if (total <= 1) return W / 2
  return PAD_X + (index / (total - 1)) * (W - PAD_X * 2)
}

/** Convert samples to SVG polyline points string. */
function toPolyline(
  samples: HealthSample[],
  getValue: (s: HealthSample) => number,
): string {
  return samples
    .map((s, i) => {
      const proportion = s.total > 0 ? getValue(s) / s.total : 0
      return `${toX(i, samples.length).toFixed(1)},${toY(proportion).toFixed(1)}`
    })
    .join(' ')
}

export default function HealthTrendSparkline({ samples }: HealthTrendSparklineProps) {
  if (samples.length < 2) {
    return (
      <div className="health-trend" data-testid="health-trend-sparkline">
        <span className="health-trend__no-data">
          Not enough data — health trend will appear after the next refresh
        </span>
      </div>
    )
  }

  const readyPoints = toPolyline(samples, (s) => s.ready)
  const errorPoints = toPolyline(samples, (s) => s.error + s.degraded)

  const first = samples[0]
  const last = samples[samples.length - 1]
  const latestReady = last.total > 0 ? Math.round((last.ready / last.total) * 100) : 0
  const latestError = last.total > 0 ? Math.round(((last.error + last.degraded) / last.total) * 100) : 0

  // Time range caption
  const elapsedMs = last.timestamp - first.timestamp
  const captionParts: string[] = []
  if (elapsedMs > 0) {
    const elapsedSec = Math.round(elapsedMs / 1000)
    if (elapsedSec < 60) {
      captionParts.push(`${elapsedSec}s window`)
    } else {
      // Use formatAge for elapsed (create a fake date elapsedMs ago)
      const fakeDate = new Date(Date.now() - elapsedMs).toISOString()
      captionParts.push(`${formatAge(fakeDate)} window`)
    }
  }
  captionParts.push(`${samples.length} samples`)
  const caption = captionParts.join(' · ')

  const ariaLabel =
    `Instance health trend. ${samples.length} samples. ` +
    `Latest: ${latestReady}% ready, ${latestError}% error or degraded.`

  return (
    <div className="health-trend" data-testid="health-trend-sparkline">
      <div className="health-trend__chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="health-trend__svg"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="none"
        >
          {/* Baseline */}
          <line
            x1={PAD_X} y1={H - PAD_Y}
            x2={W - PAD_X} y2={H - PAD_Y}
            className="health-trend__baseline"
          />

          {/* Error + degraded line (red) */}
          <polyline
            points={errorPoints}
            className="health-trend__line health-trend__line--error"
            fill="none"
          />

          {/* Ready line (green) */}
          <polyline
            points={readyPoints}
            className="health-trend__line health-trend__line--ready"
            fill="none"
          />
        </svg>
      </div>

      <div className="health-trend__legend">
        <span className="health-trend__legend-item health-trend__legend-item--ready">
          <span className="health-trend__legend-swatch" aria-hidden="true" />
          Ready {latestReady}%
        </span>
        <span className="health-trend__legend-item health-trend__legend-item--error">
          <span className="health-trend__legend-swatch" aria-hidden="true" />
          Error/degraded {latestError}%
        </span>
        <span className="health-trend__caption">{caption}</span>
      </div>
    </div>
  )
}
