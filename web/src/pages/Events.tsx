// Events.tsx — Smart event stream page for kro-relevant Kubernetes events.
//
// Implements spec 019-smart-event-stream.
// Extended by issue #66: adds filter input controls for instance and RGD.
//
// Data flow:
//   - Poll: listEvents(namespace, rgd) every 5s
//   - De-duplicate: new events merged into a Map keyed by metadata.uid
//   - Slice: most recent MAX_EVENTS (200) shown; "Load more" reveals older
//   - Views: "Stream" (chronological) / "By Instance" (grouped/collapsible)
//   - URL params: ?instance=X and ?rgd=Y set initial filter (and are kept in sync)
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
import { usePageTitle } from '@/hooks/usePageTitle'
import { translateApiError } from '@/lib/errors'
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
 * Fix #66: adds filter input UI (instance text input, RGD text input, clear button).
 */
export default function Events() {
  usePageTitle('Events')

  const [searchParams, setSearchParams] = useSearchParams()

  // ── Filter state — driven by URL params, controlled by inputs ────────────
  // These are the "committed" filters — they drive the API call and URL.
  const rgdFilter = searchParams.get('rgd') ?? ''
  const instanceFilter = searchParams.get('instance') ?? ''

  // Local input state — updates URL on blur / Enter / debounce.
  const [rgdInput, setRgdInput] = useState(rgdFilter)
  const [instanceInput, setInstanceInput] = useState(instanceFilter)

  // Sync inputs when URL params change externally (e.g. back-navigation).
  useEffect(() => { setRgdInput(rgdFilter) }, [rgdFilter])
  useEffect(() => { setInstanceInput(instanceFilter) }, [instanceFilter])

  function commitRgd(value: string) {
    const trimmed = value.trim()
    const next: Record<string, string> = {}
    if (trimmed) next.rgd = trimmed
    if (instanceFilter) next.instance = instanceFilter
    setSearchParams(next)
  }

  function commitInstance(value: string) {
    const trimmed = value.trim()
    const next: Record<string, string> = {}
    if (rgdFilter) next.rgd = rgdFilter
    if (trimmed) next.instance = trimmed
    setSearchParams(next)
  }

  function clearFilters() {
    setRgdInput('')
    setInstanceInput('')
    setSearchParams({})
  }

  const hasFilters = rgdFilter !== '' || instanceFilter !== ''

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

  // ── Reset event map when RGD filter changes (server-side filter) ──
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

  // ── Filter by ?instance= param (client-side) ─────────────────────
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

        {/* ── Filter bar (issue #66) ── */}
        <div className="events-page__filter-bar" data-testid="filter-bar">
          <div className="events-page__filter-field">
            <label htmlFor="events-rgd-filter" className="events-page__filter-label">
              RGD
            </label>
            <input
              id="events-rgd-filter"
              type="text"
              className="events-page__filter-input"
              placeholder="Filter by RGD name…"
              value={rgdInput}
              data-testid="rgd-filter-input"
              onChange={e => setRgdInput(e.target.value)}
              onBlur={e => commitRgd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRgd(rgdInput) }}
            />
          </div>
          <div className="events-page__filter-field">
            <label htmlFor="events-instance-filter" className="events-page__filter-label">
              Instance
            </label>
            <input
              id="events-instance-filter"
              type="text"
              className="events-page__filter-input"
              placeholder="Filter by instance name…"
              value={instanceInput}
              data-testid="instance-filter-input"
              onChange={e => setInstanceInput(e.target.value)}
              onBlur={e => commitInstance(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitInstance(instanceInput) }}
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              className="events-page__clear-filters-btn"
              onClick={clearFilters}
              data-testid="clear-filters-btn"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="events-page__controls">
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
          <span>{translateApiError(error)}</span>
          <button type="button" className="events-page__retry-btn" onClick={fetchAndMerge}>
            Retry
          </button>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && allEvents.length === 0 && !error && (
        <div className="events-page__loading" aria-live="polite" aria-busy="true" data-testid="events-loading">
          Loading events…
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="events-page__empty" data-testid="events-empty">
          <p className="events-page__empty-title">No kro-related events found</p>
          <p className="events-page__empty-hint">
            Events appear when kro resources are created, updated, or reconciled.
            Apply an RGD instance to start seeing events:
          </p>
          <code className="events-page__empty-cmd">kubectl apply -f my-instance.yaml</code>
          {hasFilters && (
            <p className="events-page__empty-hint">
              Active filters may be hiding results — try clearing them.
            </p>
          )}
          {lastRefresh && (
            <p className="events-page__empty-polling">
              Polling every 5s — last checked {formatSecondsAgo(lastRefresh)}
            </p>
          )}
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
