// MetricsStrip.polling.test.ts — T016: 30-second interval + stop-on-unmount.
// Tests the real usePolling hook directly with a controlled fetcher.
// No vi.mock hoisting — safe to use vi.useFakeTimers here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePolling } from '@/hooks/usePolling'
import type { ControllerMetrics } from '@/lib/api'

describe('MetricsStrip polling contract (US2 — T016)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('fires fetch on mount, then at every 30 s interval', async () => {
    let callCount = 0
    const fetcher = vi.fn(async (): Promise<ControllerMetrics> => {
      callCount++
      return {
        watchCount: callCount,
        gvrCount: 1,
        queueDepth: 0,
        workqueueDepth: 0,
        scrapedAt: new Date().toISOString(),
      }
    })

    renderHook(() => usePolling(fetcher, [], { intervalMs: 30_000 }))

    // Flush the initial fetch.
    await act(async () => { await Promise.resolve() })
    expect(callCount).toBe(1)

    // 30 s → second fetch.
    await act(async () => { vi.advanceTimersByTime(30_000) })
    await act(async () => { await Promise.resolve() })
    expect(callCount).toBe(2)

    // 30 s more → third fetch.
    await act(async () => { vi.advanceTimersByTime(30_000) })
    await act(async () => { await Promise.resolve() })
    expect(callCount).toBe(3)
  })

  it('stops polling after unmount — no fetches fire after cleanup', async () => {
    let callCount = 0
    const fetcher = vi.fn(async (): Promise<ControllerMetrics> => {
      callCount++
      return {
        watchCount: 0,
        gvrCount: 0,
        queueDepth: 0,
        workqueueDepth: 0,
        scrapedAt: new Date().toISOString(),
      }
    })

    const { unmount } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 30_000 }),
    )

    // Initial fetch.
    await act(async () => { await Promise.resolve() })
    expect(callCount).toBe(1)

    // Unmount — timer cleared.
    unmount()

    // Advance 90 s — no additional fetches.
    await act(async () => { vi.advanceTimersByTime(90_000) })
    expect(callCount).toBe(1)
  })
})
