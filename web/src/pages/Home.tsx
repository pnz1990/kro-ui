// Overview SRE Dashboard — Home.tsx
// Spec: .specify/specs/062-overview-sre-dashboard/spec.md

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listAllInstances,
  listRGDs,
  getControllerMetrics,
  getCapabilities,
  listEvents,
} from '@/lib/api'
import type { AllInstancesResponse, ControllerMetrics, K8sList, KroCapabilities, K8sObject, InstanceSummary } from '@/lib/api'
import {
  buildHealthDistribution,
  buildTopErroringRGDs,
  countMayBeStuck,
  getRecentlyCreated,
  getMayBeStuck,
  extractReadyStatus,
  extractRGDName,
  formatAge,
  displayNamespace,
} from '@/lib/format'
import { buildErrorHint } from '@/components/RGDCard'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAlertContext } from '@/lib/alertContext'
import OverviewWidget from '@/components/OverviewWidget'
import InstanceHealthWidget from '@/components/InstanceHealthWidget'
import './Home.css'

function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* silent */ }
}

// keep lsGet/lsSet around — used for future preference keys
void lsGet; void lsSet

interface WidgetState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function initialWidget<T>(): WidgetState<T> {
  return { data: null, loading: true, error: null }
}

// ── Component ────────────────────────────────────────────────────────────

export default function Home() {
  usePageTitle('Overview')

  const [instancesState, setInstancesState] = useState<WidgetState<AllInstancesResponse>>(initialWidget)
  const [rgdsState, setRgdsState] = useState<WidgetState<K8sList>>(initialWidget)
  const [metricsState, setMetricsState] = useState<WidgetState<ControllerMetrics>>(initialWidget)
  const [capabilitiesState, setCapabilitiesState] = useState<WidgetState<KroCapabilities>>(initialWidget)
  const [eventsState, setEventsState] = useState<WidgetState<K8sList>>(initialWidget)

  const [isFetching, setIsFetching] = useState(false)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [lastAttemptFailed, setLastAttemptFailed] = useState(false)
  const [, setTick] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  // Health alert subscriptions — check transitions on each successful instance fetch
  const { checkTransitions } = useAlertContext()

  // ── Fetch orchestration ───────────────────────────────────────────────

  const fetchAll = useCallback(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const sig = { signal: ac.signal }

    setIsFetching(true)
    setInstancesState(s => ({ ...s, loading: true, error: null }))
    setRgdsState(s => ({ ...s, loading: true, error: null }))
    setMetricsState(s => ({ ...s, loading: true, error: null }))
    setCapabilitiesState(s => ({ ...s, loading: true, error: null }))
    setEventsState(s => ({ ...s, loading: true, error: null }))

    Promise.allSettled([
      listAllInstances(sig),
      listRGDs(),
      getControllerMetrics(),
      getCapabilities(),
      listEvents(undefined, undefined, sig),
    ]).then(([instances, rgds, metrics, caps, events]) => {
      if (ac.signal.aborted) return

      // AbortError means fetchAll was intentionally re-triggered (e.g. polling
      // interval fired while previous fetch was in-flight). This is NOT a data
      // failure — treat aborted promises as fulfilled-with-no-data so they don't
      // flip anyFailed and show the "Last attempt failed" banner. (#427 fix)
      const isAbort = (r: PromiseRejectedResult) =>
        r.reason instanceof DOMException && r.reason.name === 'AbortError'

      let anyFailed = false

      if (instances.status === 'fulfilled') {
        setInstancesState({ data: instances.value, loading: false, error: null })
        // Fire health alerts on state transitions (spec issue-540)
        checkTransitions(instances.value.items ?? [])
      } else if (!isAbort(instances)) {
        const msg = instances.reason instanceof Error ? instances.reason.message : String(instances.reason)
        setInstancesState(s => ({ ...s, loading: false, error: msg }))
        anyFailed = true
      }

      if (rgds.status === 'fulfilled') {
        setRgdsState({ data: rgds.value, loading: false, error: null })
      } else if (!isAbort(rgds)) {
        const msg = rgds.reason instanceof Error ? rgds.reason.message : String(rgds.reason)
        setRgdsState(s => ({ ...s, loading: false, error: msg }))
        anyFailed = true
      }

      if (metrics.status === 'fulfilled') {
        setMetricsState({ data: metrics.value, loading: false, error: null })
      } else if (!isAbort(metrics)) {
        const msg = metrics.reason instanceof Error ? metrics.reason.message : String(metrics.reason)
        setMetricsState(s => ({ ...s, loading: false, error: msg }))
        anyFailed = true
      }

      if (caps.status === 'fulfilled') {
        setCapabilitiesState({ data: caps.value, loading: false, error: null })
      } else if (!isAbort(caps)) {
        const msg = caps.reason instanceof Error ? caps.reason.message : String(caps.reason)
        setCapabilitiesState(s => ({ ...s, loading: false, error: msg }))
        anyFailed = true
      }

      if (events.status === 'fulfilled') {
        setEventsState({ data: events.value, loading: false, error: null })
      } else if (!isAbort(events)) {
        const msg = events.reason instanceof Error ? events.reason.message : String(events.reason)
        setEventsState(s => ({ ...s, loading: false, error: msg }))
        anyFailed = true
      }

      setLastAttemptFailed(anyFailed)
      // Only advance lastFetchedAt on full success — when anyFailed is true
      // the "Last attempt failed" banner replaces the "Updated X ago" label
      // (FR-005/FR-007). Updating the timestamp on failure would make the
      // "data may be stale" framing misleading.
      if (!anyFailed) setLastFetchedAt(new Date())
      setIsFetching(false)
    })
  }, [])

  useEffect(() => {
    fetchAll()
    return () => { abortRef.current?.abort() }
  }, [fetchAll])

  // ── Staleness tick (10s interval) ────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────

  const instances: InstanceSummary[] = instancesState.data?.items ?? []
  const rgdItems: K8sObject[] = rgdsState.data?.items ?? []
  const distribution = buildHealthDistribution(instances)
  const topErroring = buildTopErroringRGDs(instances)
  const stuckCount = countMayBeStuck(instances)
  const recentlyCreated = getRecentlyCreated(instances)
  const mayBeStuckList = getMayBeStuck(instances)

  // W-3: erroring RGDs
  const errorRGDs = rgdItems.filter(rgd => extractReadyStatus(rgd).state === 'error')

  const fullPageError = instancesState.error !== null && rgdsState.error !== null
    && !instancesState.loading && !rgdsState.loading

  const isOnboarding = !instancesState.loading && !rgdsState.loading
    && instancesState.error === null && rgdsState.error === null
    && (instancesState.data?.total ?? 0) === 0 && rgdItems.length === 0

  // kro health detection for onboarding empty state
  const kroRunning = isOnboarding && capabilitiesState.data !== null
  const kroNotDetected = isOnboarding && !capabilitiesState.loading && capabilitiesState.error !== null
  const kroStatusLoading = isOnboarding && capabilitiesState.loading

  function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + '…' : s
  }

  function eventBadgeClass(type: string, reason: string): string {
    if (type === 'Warning') return 'home__event-badge--warning'
    if (/condition/i.test(reason)) return 'home__event-badge--condition'
    return 'home__event-badge--normal'
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (fullPageError) {
    return (
      <div className="home">
        <HomeHeader isFetching={isFetching} lastFetchedAt={lastFetchedAt} lastAttemptFailed={lastAttemptFailed} onRefresh={fetchAll} />
        <div className="home__error" role="alert">
          <p className="home__error-message">Could not load cluster data — check that kro-ui can reach the cluster.</p>
          <button className="home__retry-btn" onClick={fetchAll}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      <HomeHeader isFetching={isFetching} lastFetchedAt={lastFetchedAt} lastAttemptFailed={lastAttemptFailed} onRefresh={fetchAll} />

      {isOnboarding && (
        <div className="home__onboarding" data-testid="onboarding-empty-state">
          <h2 className="home__onboarding-title">Welcome to kro-ui</h2>
          <p className="home__onboarding-desc">No ResourceGraphDefinitions or instances found on this cluster yet.</p>

          <div
            className={
              `home__onboarding-kro-status` +
              (kroRunning ? ' home__onboarding-kro-status--running' : '') +
              (kroNotDetected ? ' home__onboarding-kro-status--error' : '') +
              (kroStatusLoading ? ' home__onboarding-kro-status--loading' : '')
            }
            role="status"
            aria-live="polite"
            data-testid="onboarding-kro-status"
          >
            {kroStatusLoading && 'Checking kro status\u2026'}
            {kroRunning && `\u2713 kro is running${capabilitiesState.data?.version ? ` (${capabilitiesState.data.version})` : ''}`}
            {kroNotDetected && '\u26a0 kro not detected — check your kubeconfig context'}
          </div>

          <div className="home__onboarding-actions">
            <Link to="/author" className="home__onboarding-cta">Create your first RGD</Link>
            <a
              href="https://kro.run/docs/getting-started/quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="home__onboarding-link"
            >
              Get started with kro &rarr;
            </a>
          </div>
        </div>
      )}

      <div className="home__grid">

        <OverviewWidget title="Instance health" loading={instancesState.loading} error={instancesState.error} onRetry={fetchAll} className="home__w1" data-testid="widget-instances">
          <InstanceHealthWidget distribution={distribution} />
        </OverviewWidget>

        <OverviewWidget title="Controller metrics" loading={metricsState.loading || capabilitiesState.loading} error={metricsState.error ?? capabilitiesState.error} onRetry={fetchAll} className="home__w2" data-testid="widget-metrics">
          <MetricsWidget metrics={metricsState.data} kroVersion={capabilitiesState.data?.version} />
        </OverviewWidget>

        <OverviewWidget title="RGD compile errors" loading={rgdsState.loading} error={rgdsState.error} onRetry={fetchAll} className="home__w3" data-testid="widget-rgd-errors">
          <RGDErrorsWidget errorRGDs={errorRGDs} totalRGDs={rgdItems.length} />
        </OverviewWidget>

        <OverviewWidget title="Reconciling queue" loading={instancesState.loading} error={instancesState.error} onRetry={fetchAll} className="home__w4" data-testid="widget-reconciling">
          <ReconcilingWidget reconcilingCount={distribution.reconciling} stuckCount={stuckCount} />
        </OverviewWidget>

        <OverviewWidget title="Top erroring RGDs" loading={instancesState.loading} error={instancesState.error} onRetry={fetchAll} className="home__w5" data-testid="widget-top-erroring">
          <TopErroringWidget topErroring={topErroring} />
        </OverviewWidget>

        <OverviewWidget title="Recent events" loading={eventsState.loading} error={eventsState.error} onRetry={fetchAll} className="home__w6" data-testid="widget-events">
          <EventsWidget items={eventsState.data?.items ?? []} eventBadgeClass={eventBadgeClass} truncate={truncate} />
        </OverviewWidget>

        <OverviewWidget title="Recent activity" loading={instancesState.loading} error={instancesState.error} onRetry={fetchAll} className="home__w7" data-testid="widget-activity">
          <ActivityWidget recentlyCreated={recentlyCreated} mayBeStuck={mayBeStuckList} />
        </OverviewWidget>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

interface HomeHeaderProps {
  isFetching: boolean
  lastFetchedAt: Date | null
  lastAttemptFailed: boolean
  onRefresh: () => void
}

function HomeHeader({ isFetching, lastFetchedAt, lastAttemptFailed, onRefresh }: HomeHeaderProps) {
  return (
    <div className="home__header">
      <h1 className="home__heading">Overview</h1>
      <div className="home__header-controls">
        {!isFetching && lastAttemptFailed && (
          <span className="home__staleness home__staleness--failed" data-testid="overview-staleness">
            Last attempt failed — data may be stale
          </span>
        )}
        {!isFetching && !lastAttemptFailed && lastFetchedAt && (
          <span className="home__staleness" data-testid="overview-staleness">
            Updated {formatAge(lastFetchedAt.toISOString())}
          </span>
        )}
        <button
          type="button"
          className="home__refresh-btn"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? 'Refreshing...' : 'Refresh now'}
          data-testid="overview-refresh"
        >
          {isFetching ? '↻ Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  )
}

// ── W-2: Controller Metrics ────────────────────────────────────────────

interface MetricsWidgetProps {
  metrics: ControllerMetrics | null
  kroVersion: string | undefined
}

function MetricsWidget({ metrics, kroVersion }: MetricsWidgetProps) {
  function Cell({ label, value, title }: { label: string; value: number | null | undefined; title?: string }) {
    const isNotReported = value === null || value === undefined
    return (
      <div className="home__metrics-cell" title={title}>
        <span className={`home__metrics-value${isNotReported ? ' home__metrics-value--not-reported' : ''}`}>
          {isNotReported ? 'Not reported' : value!.toLocaleString()}
        </span>
        <span className="home__metrics-label">{label}</span>
      </div>
    )
  }
  return (
    <div className="home__metrics">
      <Cell label="Active watches" value={metrics?.watchCount} title="Kubernetes resources currently watched by kro" />
      <Cell label="GVRs served" value={metrics?.gvrCount} title="Resource types kro is currently managing" />
      <Cell label="Queue depth (kro)" value={metrics?.queueDepth} title="Reconciliation requests in kro's work queue" />
      <Cell label="Queue depth (client-go)" value={metrics?.workqueueDepth} title="Events in the client-go work queue" />
      {kroVersion && kroVersion !== 'unknown' && (
        <div className="home__metrics-version">kro {kroVersion}</div>
      )}
    </div>
  )
}

// ── W-3: RGD Compile Errors ────────────────────────────────────────────

interface RGDErrorsWidgetProps {
  errorRGDs: K8sObject[]
  totalRGDs: number
}

function RGDErrorsWidget({ errorRGDs, totalRGDs }: RGDErrorsWidgetProps) {
  if (errorRGDs.length === 0) {
    return (
      <p className="home__rgd-errors-clean">
        ✓ All {totalRGDs} RGD{totalRGDs !== 1 ? 's' : ''} compile cleanly
      </p>
    )
  }
  return (
    <div className="home__rgd-errors-list">
      {errorRGDs.map(rgd => {
        const name = extractRGDName(rgd)
        const { reason, message } = extractReadyStatus(rgd)
        const hint = buildErrorHint(reason, message)
        return (
          <Link key={name} to={`/rgds/${encodeURIComponent(name)}`} className="home__rgd-error-row">
            <span className="home__rgd-error-name">{name}</span>
            {hint && <span className="home__rgd-error-hint" title={hint}>{hint}</span>}
          </Link>
        )
      })}
    </div>
  )
}

// ── W-4: Reconciling Queue ─────────────────────────────────────────────

interface ReconcilingWidgetProps {
  reconcilingCount: number
  stuckCount: number
}

function ReconcilingWidget({ reconcilingCount, stuckCount }: ReconcilingWidgetProps) {
  if (reconcilingCount === 0) {
    return <p className="home__reconciling-clean">✓ No instances reconciling</p>
  }
  return (
    <div className="home__reconciling">
      <span className="home__reconciling-count">{reconcilingCount}</span>
      <span className="home__reconciling-label">instances actively reconciling</span>
      {stuckCount > 0 && (
        <p className="home__reconciling-stuck">
          {stuckCount} may be stuck &gt; 5 min
        </p>
      )}
    </div>
  )
}

// ── W-5: Top Erroring RGDs ─────────────────────────────────────────────

interface TopErroringWidgetProps {
  topErroring: Array<{ rgdName: string; errorCount: number }>
}

function TopErroringWidget({ topErroring }: TopErroringWidgetProps) {
  if (topErroring.length === 0) {
    return <p className="home__top-erroring-empty">No instance errors</p>
  }
  const maxCount = topErroring[0].errorCount
  return (
    <div className="home__top-erroring">
      {topErroring.map(({ rgdName, errorCount }, i) => (
        <Link
          key={rgdName}
          to={`/rgds/${encodeURIComponent(rgdName)}?tab=instances`}
          className="home__top-erroring-row"
        >
          <span className="home__top-erroring-rank">{i + 1}</span>
          <span className="home__top-erroring-name">{rgdName}</span>
          <span className="home__top-erroring-count">{errorCount}</span>
          <div className="home__top-erroring-bar-track">
            <div
              className="home__top-erroring-bar-fill"
              style={{ width: `${(errorCount / maxCount) * 100}%` }}
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

// ── W-6: Recent Events ─────────────────────────────────────────────────

/** Typed shape of a Kubernetes Event object as returned by the API. */
interface KubeEvent {
  reason?: string
  type?: string
  message?: string
  lastTimestamp?: string
  eventTime?: string
  metadata?: { creationTimestamp?: string }
  involvedObject?: { name?: string; namespace?: string }
}

interface EventsWidgetProps {
  items: K8sObject[]
  eventBadgeClass: (type: string, reason: string) => string
  truncate: (s: string, n: number) => string
}

function EventsWidget({ items, eventBadgeClass, truncate }: EventsWidgetProps) {
  const events = items.slice(0, 10)

  if (events.length === 0) {
    return <p className="home__events-empty">No recent kro events</p>
  }

  return (
    <div className="home__events">
      <div className="home__events-list">
        {events.map((ev, i) => {
          const e = ev as KubeEvent
          const reason = e.reason ?? ''
          const type = e.type ?? 'Normal'
          const message = e.message ?? ''
          const ts = e.lastTimestamp ?? e.eventTime ?? e.metadata?.creationTimestamp ?? ''
          const objName = e.involvedObject?.name ?? ''
          const badgeClass = eventBadgeClass(type, reason)

          return (
            <div key={i} className="home__event-row">
              <span className={`home__event-badge ${badgeClass}`} />
              <span className="home__event-ts">{ts ? formatAge(ts) : '—'}</span>
              <span className="home__event-reason">{reason || '—'}</span>
              <span
                className="home__event-obj"
                title={objName}
              >
                {truncate(objName, 40)}
              </span>
              <span
                className="home__event-msg"
                title={message}
              >
                {truncate(message, 80)}
              </span>
            </div>
          )
        })}
      </div>
      <Link to="/events" className="home__events-footer">View all events →</Link>
    </div>
  )
}

// ── W-7: Recent Activity ───────────────────────────────────────────────

interface ActivityWidgetProps {
  recentlyCreated: InstanceSummary[]
  mayBeStuck: InstanceSummary[]
}

function ActivityWidget({ recentlyCreated, mayBeStuck: stuckList }: ActivityWidgetProps) {
  return (
    <div className="home__activity">
      <div className="home__activity-panel">
        <h3 className="home__activity-panel-title">Recently created</h3>
        {recentlyCreated.length === 0 ? (
          <p className="home__activity-empty">No instances</p>
        ) : (
          <div className="home__activity-list">
            {recentlyCreated.map(item => (
              <Link
                key={`${item.namespace}/${item.name}`}
                to={`/rgds/${encodeURIComponent(item.rgdName)}/instances/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.name)}`}
                className="home__activity-row"
              >
                <span className="home__activity-name">{item.name}</span>
                <span className="home__activity-ns">{displayNamespace(item.namespace)}</span>
                <span className="home__activity-kind">{item.kind}</span>
                <span className="home__activity-age">{formatAge(item.creationTimestamp)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="home__activity-panel">
        <h3 className="home__activity-panel-title">May be stuck</h3>
        {stuckList.length === 0 ? (
          <p className="home__activity-empty home__activity-empty--ok">✓ No stuck instances</p>
        ) : (
          <div className="home__activity-list">
            {stuckList.map(item => (
              <Link
                key={`${item.namespace}/${item.name}`}
                to={`/rgds/${encodeURIComponent(item.rgdName)}/instances/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.name)}`}
                className="home__activity-row"
              >
                <span className="home__activity-name">{item.name}</span>
                <span className="home__activity-ns">{displayNamespace(item.namespace)}</span>
                <span className="home__activity-kind">{item.kind}</span>
                <span className="home__activity-age home__activity-age--stuck">
                  {formatAge(item.creationTimestamp)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
