// Pure functions for kro event stream processing.
// All functions are side-effect-free and testable in isolation.

import type { K8sObject } from './api'

// ── Types ────────────────────────────────────────────────────────────

/** A typed subset of a Kubernetes Event object. */
export interface KubeEvent {
  metadata: {
    name: string
    namespace: string
    uid: string
  }
  involvedObject: {
    kind: string
    name: string
    namespace: string
    uid: string
    apiVersion?: string
  }
  reason: string
  message: string
  type: 'Normal' | 'Warning' | string
  lastTimestamp: string
  firstTimestamp?: string
  count?: number
  source?: {
    component?: string
    host?: string
  }
  reportingComponent?: string
}

/** Anomaly type union. */
export type AnomalyType = 'stuck' | 'burst'

/** A detected anomaly for a kro instance. */
export interface Anomaly {
  type: AnomalyType
  instanceName: string
  /** Number of events that triggered this anomaly. */
  count: number
  /** Human-readable description of the anomaly. */
  message: string
}

// ── Coercion ─────────────────────────────────────────────────────────

/**
 * Coerces a raw K8sObject into a KubeEvent.
 * Returns null if the object is missing required fields.
 */
export function toKubeEvent(obj: K8sObject): KubeEvent | null {
  const meta = obj.metadata as Record<string, unknown> | undefined
  const involvedObject = obj.involvedObject as Record<string, unknown> | undefined
  if (!meta || !involvedObject) return null

  const name = meta.name as string | undefined
  const namespace = meta.namespace as string | undefined
  const uid = meta.uid as string | undefined
  const reason = obj.reason as string | undefined
  const lastTimestamp = (obj.lastTimestamp ?? obj.eventTime) as string | undefined

  if (!name || !namespace || !uid || !reason || !lastTimestamp) return null

  return {
    metadata: {
      name,
      namespace,
      uid,
    },
    involvedObject: {
      kind: (involvedObject.kind as string) ?? '',
      name: (involvedObject.name as string) ?? '',
      namespace: (involvedObject.namespace as string) ?? '',
      uid: (involvedObject.uid as string) ?? '',
      apiVersion: involvedObject.apiVersion as string | undefined,
    },
    reason,
    message: (obj.message as string) ?? '',
    type: (obj.type as string) ?? 'Normal',
    lastTimestamp,
    firstTimestamp: obj.firstTimestamp as string | undefined,
    count: obj.count as number | undefined,
    source: obj.source as KubeEvent['source'],
    reportingComponent: obj.reportingComponent as string | undefined,
  }
}

// ── Sort ─────────────────────────────────────────────────────────────

/** Sorts events newest-first by lastTimestamp. */
export function sortEvents(events: KubeEvent[]): KubeEvent[] {
  return [...events].sort((a, b) => {
    const ta = new Date(a.lastTimestamp).getTime()
    const tb = new Date(b.lastTimestamp).getTime()
    return tb - ta
  })
}

// ── Grouping ─────────────────────────────────────────────────────────

/**
 * Groups events by the involved object's name, which corresponds to the
 * kro instance name (or child resource name attributable to an instance).
 * Returns a Map ordered by the most recently active instance first.
 */
export function groupByInstance(events: KubeEvent[]): Map<string, KubeEvent[]> {
  const map = new Map<string, KubeEvent[]>()
  for (const evt of events) {
    const key = evt.involvedObject.name || '(unknown)'
    const group = map.get(key)
    if (group) {
      group.push(evt)
    } else {
      map.set(key, [evt])
    }
  }
  return map
}

// ── Anomaly detection ─────────────────────────────────────────────────

const TEN_MINUTES_MS = 10 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000
const STUCK_THRESHOLD = 5   // > 5 Progressing events without Ready in 10min
const BURST_THRESHOLD = 10  // > 10 Warning events in 1min

/**
 * Detects anomalous patterns in the event list.
 * Pure function — deterministic given the same events and `now` value.
 *
 * Anomaly types:
 * - **stuck**: > 5 Progressing events in 10 minutes without a Ready/Synced event
 * - **burst**: > 10 Warning events in 1 minute for the same instance
 *
 * @param events  The full flat event list (any sort order).
 * @param now     Epoch ms for "now" (default: Date.now()). Injected for testing.
 */
export function detectAnomalies(events: KubeEvent[], now = Date.now()): Anomaly[] {
  const anomalies: Anomaly[] = []
  const byInstance = groupByInstance(events)

  for (const [instanceName, instanceEvents] of byInstance) {
    // ── Stuck reconciliation ──────────────────────────────────────────
    const recent10 = instanceEvents.filter(
      e => now - new Date(e.lastTimestamp).getTime() < TEN_MINUTES_MS,
    )
    const progressingCount = recent10.filter(
      e =>
        e.reason === 'Progressing' ||
        e.reason === 'ReconcileStarted' ||
        e.reason === 'Reconciling',
    ).length
    const hasReady = recent10.some(
      e =>
        e.reason === 'Ready' ||
        e.reason === 'Synced' ||
        e.reason === 'ReconcileSucceeded' ||
        e.reason === 'Available',
    )

    if (progressingCount > STUCK_THRESHOLD && !hasReady) {
      anomalies.push({
        type: 'stuck',
        instanceName,
        count: progressingCount,
        message: `Instance ${instanceName} appears stuck — reconciling for 10+ minutes without completing`,
      })
    }

    // ── Error burst ───────────────────────────────────────────────────
    const recent1 = instanceEvents.filter(
      e => now - new Date(e.lastTimestamp).getTime() < ONE_MINUTE_MS,
    )
    const warningCount = recent1.filter(e => e.type === 'Warning').length

    if (warningCount > BURST_THRESHOLD) {
      anomalies.push({
        type: 'burst',
        instanceName,
        count: warningCount,
        message: `Error burst detected on instance ${instanceName} — ${warningCount} warnings in the last minute`,
      })
    }
  }

  return anomalies
}
