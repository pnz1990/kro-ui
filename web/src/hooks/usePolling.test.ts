// usePolling.test.ts — unit tests for the polling hook.
// Uses vitest fake timers to control time precisely.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePolling } from './usePolling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    // Restore visibility state to 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  // ── T001: calls fetcher on mount ─────────────────────────────────────────

  it('T001: calls fetcher on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })
    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    // Initial loading state
    expect(result.current.loading).toBe(true)

    // Let the promise resolve — advance 0ms to flush microtasks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({ value: 1 })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // ── T002: calls fetcher again after intervalMs ────────────────────────────

  it('T002: calls fetcher again after intervalMs', async () => {
    let callCount = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++
      return { count: callCount }
    })

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    // Initial call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Advance 5s — second poll fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ count: 2 })

    // Advance another 5s — third poll fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  // ── T003: stops polling on unmount ────────────────────────────────────────

  it('T003: stops polling on unmount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 'ok' })

    const { unmount } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Unmount — the interval should be cleared
    unmount()

    // Advance time — no new calls should happen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // ── T004: sets error state on fetch failure ───────────────────────────────

  it('T004: sets error state on fetch failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.error).toBe('network error')
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  // ── T005: enabled=false prevents polling ──────────────────────────────────

  it('T005: enabled=false prevents initial fetch and polling', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000, enabled: false }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })

    expect(fetcher).not.toHaveBeenCalled()
  })

  // ── T006: lastRefresh is updated on successful fetch ─────────────────────

  it('T006: lastRefresh is set after successful fetch', async () => {
    const now = new Date('2026-03-21T12:00:00.000Z')
    vi.setSystemTime(now)

    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.lastRefresh).not.toBeNull()
    expect(result.current.lastRefresh?.getTime()).toBe(now.getTime())
  })

  // ── T007: manual pause stops polling (GH #719) ───────────────────────────

  it('T007: manual pause() stops the interval', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Pause
    act(() => {
      result.current.pause()
    })
    expect(result.current.paused).toBe(true)

    // Advance 20s — no new polls should fire while paused
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // ── T008: resume() restarts polling and triggers immediate fetch ──────────

  it('T008: resume() restarts polling and fetches immediately', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000 }),
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Pause
    act(() => {
      result.current.pause()
    })

    // Resume — should trigger an immediate re-fetch
    await act(async () => {
      result.current.resume()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.paused).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)

    // Polling continues after resume
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  // ── T009: visibilitychange hides tab → stops interval (GH #719) ──────────

  it('T009: auto-pause when tab becomes hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000, pauseOnHidden: true }),
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Simulate tab going hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Advance time — no polling while hidden
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  // ── T010: visibilitychange shows tab → resumes polling (GH #719) ─────────

  it('T010: auto-resume when tab becomes visible again', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000, pauseOnHidden: true }),
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Hide tab
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1) // still paused

    // Show tab — immediate fetch should fire
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(2) // resumed + immediate fetch

    // Interval resumes too
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  // ── T011: pauseOnHidden=false disables auto-pause behaviour ──────────────

  it('T011: pauseOnHidden=false — keeps polling when tab is hidden', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000, pauseOnHidden: false }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Simulate hidden tab
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Polling should continue when opt-out
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  // ── T012: manual pause takes precedence over auto-resume ─────────────────

  it('T012: manual pause is not overridden by tab becoming visible', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 })

    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 5000, pauseOnHidden: true }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Manually pause first
    act(() => {
      result.current.pause()
    })

    // Hide tab then show tab — auto-resume should NOT fire because user paused
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })

    // Still paused — no additional fetches
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.paused).toBe(true)
  })
})
