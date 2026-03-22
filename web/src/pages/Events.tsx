// Events.tsx — Smart event stream page for kro-relevant Kubernetes events.
//
// Implements spec 019-smart-event-stream.
//
// Data flow:
//   - Poll: listEvents(namespace, rgd) every 5s
//   - De-duplicate: new events merged into a Map keyed by metadata.uid
//   - Slice: most recent MAX_EVENTS (200) shown; "Load more" reveals older
//   - Views: "Stream" (chronological) / "By Instance" (grouped/collapsible)
//   - URL params: ?instance=X and ?rgd=Y set initial filter
//   - Anomalies: detectAnomalies() computed from visible events, renders banners

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listEvents } from '@/lib/api'
import {
  toKubeEvent,
  sortEvents,
  groupByInstance,
  detectAnomalies,
} from '@/lib/events'
import type { KubeEvent } from '@/lib/events'
import EventRow from '@/components/EventRow'
import EventGroup from '@/components/EventGroup'
import AnomalyBanner from '@/components/AnomalyBanner'
import './Events.css'

// ── Constants ─────────────────────────────────────────────────────────

const MAX_EVENTS = 200
const PAGE_SIZE = 50
const POLL_INTERVAL_MS = 5000

// ── View mode ─────────────────────────────────────────────────────────

type ViewMode = 'stream' | 'grouped'

// ── Events page ───────────────────────────────────────────────────────

/**
 * Events — filtered, grouped, anomaly-detecting kro event stream.
 *
 * Spec: .specify/specs/019-smart-event-stream/ FR-001–FR-008, SC-001–SC-005
 */
export default function Events() {
  const [searchParams] = useSearchParams()
  const instanceFilter = searchParams.get('instance') ?? ''
  const rgdFilter = searchParams.get('rgd') ?? ''

  // ── De-duplication map: uid → KubeEvent ──────────────────────────
  const eventMapRef = useRef<Map<string, KubeEvent>>(new Map())
  const [allEvents, setAllEvents] = useState<KubeEvent[]>([])
  const [visibleCount, setVisibleCount] = useState(MAX_EVENTS)

  // ── Polling state ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // ── View mode toggle ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('stream')

  // ── Reset event map when RGD filter changes (instanceFilter is UI-only) ──
  useEffect(() => {
    eventMapRef.current = new Map()
    setAllEvents([])
    setLoading(true)
    setError(null)
  }, [rgdFilter])

  // ── Merge fetcher: adds new events into the de-dup map ───────────
  const fetchAndMerge = useCallback(async () => {
    try {
      const list = await listEvents(undefined, rgdFilter || undefined)
      const incoming = list?.items?.flatMap(item => {
        const evt = toKubeEvent(item)
        return evt ? [evt] : []
      }) ?? []

      const map = eventMapRef.current
      for (const evt of incoming) {
        map.set(evt.metadata.uid, evt)
      }

      // Keep the map bounded to avoid unbounded memory growth.
      // Trim oldest entries beyond 3× MAX_EVENTS.
      if (map.size > MAX_EVENTS * 3) {
        const sorted = sortEvents(Array.from(map.values()))
        const kept = sorted.slice(0, MAX_EVENTS * 3)
        eventMapRef.current = new Map(kept.map(e => [e.metadata.uid, e]))
      }

      const sorted = sortEvents(Array.from(eventMapRef.current.values()))
      setAllEvents(sorted)
      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [rgdFilter])

  // ── Polling effect ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!cancelled) fetchAndMerge()
    }
    run()
    const id = setInterval(run, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [fetchAndMerge])

  // ── Filter by ?instance= URL param ───────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!instanceFilter) return allEvents
    return allEvents.filter(e => e.involvedObject.name === instanceFilter)
  }, [allEvents, instanceFilter])

  // ── Slice to visible window ──────────────────────────────────────
  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  )
  const hasMore = filteredEvents.length > visibleCount

  // ── Anomaly detection ─────────────────────────────────────────────
  const anomalies = useMemo(() => detectAnomalies(visibleEvents), [visibleEvents])

  // ── Grouped events ────────────────────────────────────────────────
  const groupedEvents = useMemo(
    () => groupByInstance(visibleEvents),
    [visibleEvents],
  )

  // ── Render helpers ────────────────────────────────────────────────
  const isEmpty = !loading && !error && visibleEvents.length === 0

  return (
    <div className="events-page" data-testid="events-page">
      {/* ── Page header ── */}
      <div className="events-page__header">
        <div className="events-page__title-row">
          <h1 className="events-page__title">Events</h1>
          {lastRefresh && (
            <span className="events-page__refresh-hint" aria-live="polite">
              Updated {formatSecondsAgo(lastRefresh)}
            </span>
          )}
        </div>

        <div className="events-page__controls">
          {/* Active filters display */}
          {(instanceFilter || rgdFilter) && (
            <div className="events-page__filters" data-testid="active-filters">
              {instanceFilter && (
                <span className="events-page__filter-tag">instance: {instanceFilter}</span>
              )}
              {rgdFilter && (
                <span className="events-page__filter-tag">rgd: {rgdFilter}</span>
              )}
            </div>
          )}

          {/* View mode toggle */}
          <div className="events-page__view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`events-page__toggle-btn ${viewMode === 'stream' ? 'events-page__toggle-btn--active' : ''}`}
              onClick={() => setViewMode('stream')}
              aria-pressed={viewMode === 'stream'}
            >
              Stream
            </button>
            <button
              type="button"
              className={`events-page__toggle-btn ${viewMode === 'grouped' ? 'events-page__toggle-btn--active' : ''}`}
              onClick={() => setViewMode('grouped')}
              aria-pressed={viewMode === 'grouped'}
            >
              By Instance
            </button>
          </div>
        </div>
      </div>

      {/* ── Anomaly banners ── */}
      {anomalies.length > 0 && (
        <div className="events-page__anomalies" data-testid="anomaly-banners">
          {anomalies.map((anomaly, i) => (
            <AnomalyBanner
              key={`${anomaly.type}-${anomaly.instanceName}-${i}`}
              anomaly={anomaly}
            />
          ))}
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="events-page__error" role="alert" data-testid="events-error">
          Failed to fetch events: {error}
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && allEvents.length === 0 && !error && (
        <div className="events-page__loading" aria-live="polite" data-testid="events-loading">
          Loading events…
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="events-page__empty" data-testid="events-empty">
          No kro-related events found
        </div>
      )}

      {/* ── Event list ── */}
      {visibleEvents.length > 0 && (
        <div className="events-page__content">
          {viewMode === 'stream' ? (
            <div className="events-page__stream" data-testid="events-stream">
              <div className="event-stream-list">
                {visibleEvents.map(event => (
                  <EventRow key={event.metadata.uid} event={event} />
                ))}
              </div>
            </div>
          ) : (
            <div className="events-page__grouped" data-testid="events-grouped">
              {Array.from(groupedEvents.entries()).map(([instanceName, instanceEvents]) => (
                <EventGroup
                  key={instanceName}
                  instanceName={instanceName}
                  events={instanceEvents}
                />
              ))}
            </div>
          )}

          {/* ── Load more ── */}
          {hasMore && (
            <div className="events-page__load-more">
              <button
                type="button"
                className="events-page__load-more-btn"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                data-testid="load-more-btn"
              >
                Load more ({filteredEvents.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Utilities ────────────────────────────────────────────────────────

function formatSecondsAgo(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}
