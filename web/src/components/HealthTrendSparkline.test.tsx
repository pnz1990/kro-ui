// HealthTrendSparkline.test.tsx — unit tests for HealthTrendSparkline and useHealthTrend.
// Spec: .specify/specs/issue-539/spec.md O7

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import HealthTrendSparkline from './HealthTrendSparkline'
import { useHealthTrend } from '@/hooks/useHealthTrend'
import type { HealthSample } from '@/hooks/useHealthTrend'

// ── HealthTrendSparkline component tests ──────────────────────────────────────

function makeSample(overrides: Partial<HealthSample> = {}): HealthSample {
  return {
    timestamp: Date.now(),
    total: 5,
    ready: 5,
    error: 0,
    degraded: 0,
    reconciling: 0,
    pending: 0,
    unknown: 0,
    ...overrides,
  }
}

describe('HealthTrendSparkline', () => {
  // T001: empty state — no samples
  it('T001: renders "not enough data" when samples is empty', () => {
    render(<HealthTrendSparkline samples={[]} />)
    const el = screen.getByTestId('health-trend-sparkline')
    expect(el).toBeTruthy()
    expect(el.textContent).toMatch(/not enough data/i)
  })

  // T002: single sample state — still shows "not enough data"
  it('T002: renders "not enough data" with only 1 sample', () => {
    render(<HealthTrendSparkline samples={[makeSample()]} />)
    expect(screen.getByTestId('health-trend-sparkline').textContent).toMatch(/not enough data/i)
  })

  // T003: multi-sample renders SVG
  it('T003: renders SVG polyline with ≥2 samples', () => {
    const samples: HealthSample[] = [
      makeSample({ timestamp: 1000, total: 4, ready: 4 }),
      makeSample({ timestamp: 2000, total: 4, ready: 3, error: 1 }),
    ]
    const { container } = render(<HealthTrendSparkline samples={samples} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    const polylines = container.querySelectorAll('polyline')
    expect(polylines.length).toBeGreaterThanOrEqual(2)
  })

  // T004: aria-label presence
  it('T004: SVG has role=img and aria-label with health percentages', () => {
    const samples: HealthSample[] = [
      makeSample({ timestamp: 1000, total: 10, ready: 8, error: 2 }),
      makeSample({ timestamp: 2000, total: 10, ready: 8, error: 2 }),
    ]
    const { container } = render(<HealthTrendSparkline samples={samples} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    const label = svg?.getAttribute('aria-label') ?? ''
    expect(label).toMatch(/health trend/i)
    expect(label).toMatch(/samples/)
  })

  // T005: % calculations shown in legend
  it('T005: legend shows correct % ready and % error for last sample', () => {
    const samples: HealthSample[] = [
      makeSample({ timestamp: 1000, total: 10, ready: 10 }),
      makeSample({ timestamp: 2000, total: 10, ready: 7, error: 2, degraded: 1 }),
    ]
    render(<HealthTrendSparkline samples={samples} />)
    const el = screen.getByTestId('health-trend-sparkline')
    // Last sample: ready=7/10=70%, error+degraded=3/10=30%
    expect(el.textContent).toMatch(/70%/)
    expect(el.textContent).toMatch(/30%/)
  })

  // T006: zero-total sample is handled gracefully (no NaN)
  it('T006: zero-total sample does not cause NaN in SVG output', () => {
    const samples: HealthSample[] = [
      makeSample({ timestamp: 1000, total: 0, ready: 0 }),
      makeSample({ timestamp: 2000, total: 0, ready: 0 }),
    ]
    const { container } = render(<HealthTrendSparkline samples={samples} />)
    const html = container.innerHTML
    expect(html).not.toMatch(/NaN/)
  })

  // T007: sample count appears in caption
  it('T007: caption includes sample count', () => {
    const samples: HealthSample[] = [
      makeSample({ timestamp: 1000 }),
      makeSample({ timestamp: 2000 }),
      makeSample({ timestamp: 3000 }),
    ]
    render(<HealthTrendSparkline samples={samples} />)
    expect(screen.getByTestId('health-trend-sparkline').textContent).toMatch(/3 samples/)
  })
})

// ── useHealthTrend hook tests ─────────────────────────────────────────────────

const makeK8sInstance = (state: 'ready' | 'error' | 'reconciling' = 'ready') => {
  if (state === 'reconciling') {
    return { status: { state: 'IN_PROGRESS' } }
  }
  if (state === 'ready') {
    return {
      status: {
        conditions: [
          { type: 'Ready', status: 'True', reason: 'Ready', message: '' },
        ],
      },
    }
  }
  return {
    status: {
      conditions: [
        { type: 'Ready', status: 'False', reason: 'Error', message: 'failed' },
      ],
    },
  }
}

describe('useHealthTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // T008: starts with empty samples
  it('T008: starts with empty samples array', () => {
    const { result } = renderHook(() => useHealthTrend())
    expect(result.current.samples).toHaveLength(0)
  })

  // T009: record() appends a snapshot
  it('T009: record() appends a health snapshot', () => {
    vi.setSystemTime(1000)
    const { result } = renderHook(() => useHealthTrend())
    const items = [makeK8sInstance('ready'), makeK8sInstance('error')]
    act(() => {
      result.current.record(items)
    })
    expect(result.current.samples).toHaveLength(1)
    expect(result.current.samples[0].total).toBe(2)
    expect(result.current.samples[0].ready).toBe(1)
    expect(result.current.samples[0].error).toBe(1)
  })

  // T010: duplicate calls within 1s are ignored
  it('T010: duplicate record() calls within 1s are deduplicated', () => {
    vi.setSystemTime(1000)
    const { result } = renderHook(() => useHealthTrend())
    const items = [makeK8sInstance('ready')]
    act(() => {
      result.current.record(items)
      result.current.record(items) // same ms — should be ignored
    })
    expect(result.current.samples).toHaveLength(1)
  })

  // T011: separate calls after 1s accumulate
  it('T011: two record() calls >1s apart produce 2 samples', () => {
    vi.setSystemTime(1000)
    const { result } = renderHook(() => useHealthTrend())
    act(() => {
      result.current.record([makeK8sInstance('ready')])
    })
    vi.setSystemTime(3000)
    act(() => {
      result.current.record([makeK8sInstance('error')])
    })
    expect(result.current.samples).toHaveLength(2)
    expect(result.current.samples[0].ready).toBe(1)
    expect(result.current.samples[1].error).toBe(1)
  })
})
