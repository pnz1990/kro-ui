// Generic polling hook — used on instance detail and anywhere live data is needed.
// Phase 2: replace with SSE when the Go server supports it.

import { useState, useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  intervalMs?: number
  enabled?: boolean
}

interface UsePollingResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => void
  lastRefresh: Date | null
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  { intervalMs = 5000, enabled = true }: UsePollingOptions = {},
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

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

  useEffect(() => {
    if (!enabled) return
    // Reset stale data when dependencies change (e.g. navigating between
    // instances). Without this reset, the previous resource's data is briefly
    // shown for the new route while the first fetch is in-flight. Fixes #234.
    setData(null)
    setError(null)
    setLoading(true)
    fetch_()
    if (intervalMs > 0) {
      timerRef.current = setInterval(fetch_, intervalMs)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, fetch_, ...deps])

  return { data, error, loading, refresh: fetch_, lastRefresh }
}
