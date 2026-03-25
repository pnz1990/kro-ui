// MetricsStrip.test.tsx — unit tests for all 4 render states.
// usePolling is mocked so tests control data/loading/error state directly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MetricsStrip from './MetricsStrip'
import type { ControllerMetrics } from '@/lib/api'

// ── Mock usePolling ───────────────────────────────────────────────────

vi.mock('@/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

import { usePolling } from '@/hooks/usePolling'

const mockUsePolling = usePolling as ReturnType<typeof vi.fn>
function setPollingState(state: {
  data: ControllerMetrics | null
  error: string | null
  loading: boolean
}) {
  mockUsePolling.mockReturnValue({
    ...state,
    refresh: vi.fn(),
    lastRefresh: null,
  })
}

// ── Fixtures ──────────────────────────────────────────────────────────

const fullMetrics: ControllerMetrics = {
  watchCount: 4,
  gvrCount: 3,
  queueDepth: 2,
  workqueueDepth: 1,
  scrapedAt: '2026-03-22T14:00:00Z',
}

const nullMetrics: ControllerMetrics = {
  watchCount: null,
  gvrCount: null,
  queueDepth: null,
  workqueueDepth: null,
  scrapedAt: '2026-03-22T14:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('MetricsStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('render state: loading — skeleton visible, no counter values', () => {
    setPollingState({ data: null, error: null, loading: true })
    const { container } = render(<MetricsStrip />)

    // Skeleton cells present
    expect(container.querySelectorAll('.metrics-strip__skeleton-value').length).toBe(4)
    // No real counter values
    expect(container.querySelectorAll('.metrics-strip__value').length).toBe(0)
    // Aria busy
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('render state: healthy — all 4 counter values displayed', () => {
    setPollingState({ data: fullMetrics, error: null, loading: false })
    render(<MetricsStrip />)

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Active watches')).toBeInTheDocument()
    expect(screen.getByText('GVRs served')).toBeInTheDocument()
    expect(screen.getByText('Queue depth (kro)')).toBeInTheDocument()
    expect(screen.getByText('Queue depth (client-go)')).toBeInTheDocument()
  })

  it('render state: degraded — error message shown, no counter cells', () => {
    setPollingState({ data: null, error: 'metrics source unreachable: connection refused', loading: false })
    const { container } = render(<MetricsStrip />)

    // The degraded message now includes actionable context (issue #97).
    // "connection refused" → "kro controller pod not found in this cluster" (L-11 fix).
    expect(screen.getByText(/Controller metrics unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/kro controller pod not found/)).toBeInTheDocument()
    expect(container.querySelectorAll('.metrics-strip__cell').length).toBe(0)
  })

  it('render state: null counter fields — "Not reported" for each null', () => {
    setPollingState({ data: nullMetrics, error: null, loading: false })
    render(<MetricsStrip />)

    const notReported = screen.getAllByText('Not reported')
    expect(notReported.length).toBe(4)
  })

  it('render state: mixed — some null, some numeric', () => {
    const mixed: ControllerMetrics = {
      watchCount: 7,
      gvrCount: null,
      queueDepth: 0,
      workqueueDepth: null,
      scrapedAt: '2026-03-22T14:00:00Z',
    }
    setPollingState({ data: mixed, error: null, loading: false })
    render(<MetricsStrip />)

    expect(screen.getByText('7')).toBeInTheDocument()
    // 0 is a real value — must not show "Not reported"
    expect(screen.getByText('0')).toBeInTheDocument()
    const notReported = screen.getAllByText('Not reported')
    expect(notReported.length).toBe(2)
  })

  it('stale-ok — shows last known values when error and data coexist', () => {
    setPollingState({ data: fullMetrics, error: 'transient error', loading: false })
    render(<MetricsStrip />)

    // Prior data still shown — no degraded message
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText('Controller metrics unavailable')).toBeNull()
  })

  it('calls usePolling with 30000ms interval', () => {
    setPollingState({ data: null, error: null, loading: true })
    render(<MetricsStrip />)

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.any(Function),
      [],
      expect.objectContaining({ intervalMs: 30_000 }),
    )
  })
})
