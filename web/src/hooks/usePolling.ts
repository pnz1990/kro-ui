// Generic polling hook — used on instance detail and anywhere live data is needed.
// Phase 2: replace with SSE when the Go server supports it.
//
// Pause behaviour (GH #719):
//   - Auto-pause:   when `document.visibilityState === 'hidden'` (tab backgrounded).
//                   Prevents unnecessary List API calls and stops aria-live announcements
//                   for screen reader users focused on a different tab.
//                   Opt-out with `pauseOnHidden: false`.
//   - Manual pause: call `pause()` / `resume()` returned by the hook.
//   - On resume (either kind): a fetch fires immediately so data is fresh.

import { useState, useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  intervalMs?: number
  enabled?: boolean
  /** Automatically pause polling when the tab is hidden. Default: true. */
  pauseOnHidden?: boolean
}

interface UsePollingResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  /** True when polling is manually paused (does not reflect auto-pause). */
  paused: boolean
  refresh: () => void
  lastRefresh: Date | null
  /** Manually pause polling (e.g. via a UI toggle). */
  pause: () => void
  /** Resume manual pause and immediately re-fetch. */
  resume: () => void
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  { intervalMs = 5000, enabled = true, pauseOnHidden = true }: UsePollingOptions = {},
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  /** User-initiated pause state (independent of auto-pause). */
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Track manual pause in a ref so the visibilitychange listener can read it
  // without capturing a stale closure.
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const fetch_ = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Interval management helpers ──────────────────────────────────────────
  const stopInterval = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startInterval = useCallback(() => {
    stopInterval()
    if (intervalMs > 0) {
      timerRef.current = setInterval(fetch_, intervalMs)
    }
  }, [fetch_, intervalMs, stopInterval])

  // ── Main polling effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || paused) {
      stopInterval()
      if (!enabled) return
      return () => {}
    }
    // Reset stale data when dependencies change (e.g. navigating between
    // instances). Without this reset, the previous resource's data is briefly
    // shown for the new route while the first fetch is in-flight. Fixes #234.
    setData(null)
    setError(null)
    setLoading(true)
    fetch_()
    startInterval()
    return stopInterval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, intervalMs, fetch_, startInterval, stopInterval, ...deps])

  // ── Auto-pause on tab hide / resume on tab show (GH #719) ─────────────────
  useEffect(() => {
    if (!pauseOnHidden || !enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab backgrounded — stop interval but do NOT change manual-pause state
        stopInterval()
      } else {
        // Tab foregrounded — resume only if user has not manually paused
        if (!pausedRef.current) {
          fetch_()
          startInterval()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pauseOnHidden, enabled, fetch_, startInterval, stopInterval])

  // ── Manual pause / resume controls ───────────────────────────────────────
  const pause = useCallback(() => {
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    setPaused(false)
    // Immediate re-fetch on resume (the polling effect will restart the interval)
  }, [])

  return { data, error, loading, paused, refresh: fetch_, lastRefresh, pause, resume }
}
