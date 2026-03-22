import { describe, it, expect } from 'vitest'
import { detectAnomalies, groupByInstance, sortEvents, toKubeEvent } from './events'
import type { KubeEvent } from './events'

// ── Test helpers ─────────────────────────────────────────────────────

/** Creates a minimal KubeEvent for testing. */
function makeEvent(overrides: Partial<KubeEvent> & { instanceName?: string }): KubeEvent {
  const instanceName = overrides.instanceName ?? 'my-instance'
  return {
    metadata: { name: 'evt-1', namespace: 'default', uid: Math.random().toString(36) },
    involvedObject: {
      kind: 'TestApp',
      name: instanceName,
      namespace: 'default',
      uid: 'involved-uid',
    },
    reason: overrides.reason ?? 'Reconciling',
    message: overrides.message ?? 'test message',
    type: overrides.type ?? 'Normal',
    lastTimestamp: overrides.lastTimestamp ?? new Date().toISOString(),
    ...(overrides.count !== undefined && { count: overrides.count }),
    ...(overrides.source !== undefined && { source: overrides.source }),
  }
}

/** Returns an ISO string for `msAgo` milliseconds in the past relative to `now`. */
function ago(now: number, msAgo: number): string {
  return new Date(now - msAgo).toISOString()
}

// ── toKubeEvent ───────────────────────────────────────────────────────

describe('toKubeEvent', () => {
  it('returns null for objects missing required fields', () => {
    expect(toKubeEvent({})).toBeNull()
    expect(toKubeEvent({ metadata: { name: 'x' } })).toBeNull()
  })

  it('coerces a valid raw K8sObject to KubeEvent', () => {
    const raw = {
      metadata: { name: 'evt', namespace: 'default', uid: 'abc' },
      involvedObject: { kind: 'Pod', name: 'pod-1', namespace: 'default', uid: 'xyz' },
      reason: 'Started',
      message: 'Container started',
      type: 'Normal',
      lastTimestamp: '2026-03-21T10:00:00Z',
    }
    const evt = toKubeEvent(raw)
    expect(evt).not.toBeNull()
    expect(evt!.metadata.name).toBe('evt')
    expect(evt!.reason).toBe('Started')
    expect(evt!.involvedObject.kind).toBe('Pod')
  })
})

// ── sortEvents ────────────────────────────────────────────────────────

describe('sortEvents', () => {
  it('returns events newest-first', () => {
    const now = Date.now()
    const events = [
      makeEvent({ lastTimestamp: ago(now, 60_000) }),   // 1min ago
      makeEvent({ lastTimestamp: ago(now, 5_000) }),    // 5s ago — newest
      makeEvent({ lastTimestamp: ago(now, 300_000) }),  // 5min ago
    ]
    const sorted = sortEvents(events)
    expect(new Date(sorted[0].lastTimestamp).getTime()).toBeGreaterThan(
      new Date(sorted[1].lastTimestamp).getTime(),
    )
    expect(new Date(sorted[1].lastTimestamp).getTime()).toBeGreaterThan(
      new Date(sorted[2].lastTimestamp).getTime(),
    )
  })

  it('does not mutate the original array', () => {
    const events = [
      makeEvent({ lastTimestamp: new Date(1000).toISOString() }),
      makeEvent({ lastTimestamp: new Date(2000).toISOString() }),
    ]
    const original = [...events]
    sortEvents(events)
    expect(events[0].lastTimestamp).toBe(original[0].lastTimestamp)
  })
})

// ── groupByInstance ───────────────────────────────────────────────────

describe('groupByInstance', () => {
  it('groups events by involvedObject.name', () => {
    const events = [
      makeEvent({ instanceName: 'alpha' }),
      makeEvent({ instanceName: 'beta' }),
      makeEvent({ instanceName: 'alpha' }),
    ]
    const groups = groupByInstance(events)
    expect(groups.size).toBe(2)
    expect(groups.get('alpha')).toHaveLength(2)
    expect(groups.get('beta')).toHaveLength(1)
  })
})

// ── detectAnomalies ───────────────────────────────────────────────────

describe('detectAnomalies', () => {
  const NOW = new Date('2026-03-21T10:00:00Z').getTime()

  it('returns no anomalies for a healthy event stream', () => {
    const events = [
      makeEvent({ reason: 'Reconciling', lastTimestamp: ago(NOW, 30_000) }),
      makeEvent({ reason: 'Ready', lastTimestamp: ago(NOW, 10_000) }),
    ]
    expect(detectAnomalies(events, NOW)).toHaveLength(0)
  })

  it('detects stuck reconciliation: >5 Progressing events without Ready in 10min', () => {
    // 6 Progressing events, no Ready — should trigger stuck anomaly.
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        reason: 'Progressing',
        lastTimestamp: ago(NOW, (i + 1) * 60_000), // 1–6 min ago
        instanceName: 'stuck-instance',
      }),
    )
    const anomalies = detectAnomalies(events, NOW)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].type).toBe('stuck')
    expect(anomalies[0].instanceName).toBe('stuck-instance')
    expect(anomalies[0].count).toBe(6)
    expect(anomalies[0].message).toContain('stuck-instance')
    expect(anomalies[0].message).toContain('stuck')
  })

  it('does NOT detect stuck when a Ready event exists', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeEvent({
          reason: 'Progressing',
          lastTimestamp: ago(NOW, (i + 1) * 60_000),
          instanceName: 'healthy-instance',
        }),
      ),
      // A Ready event clears the stuck condition.
      makeEvent({
        reason: 'Ready',
        lastTimestamp: ago(NOW, 5_000),
        instanceName: 'healthy-instance',
      }),
    ]
    const anomalies = detectAnomalies(events, NOW).filter(a => a.type === 'stuck')
    expect(anomalies).toHaveLength(0)
  })

  it('does NOT detect stuck when Progressing events are outside the 10min window', () => {
    // All Progressing events are older than 10 minutes.
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        reason: 'Progressing',
        lastTimestamp: ago(NOW, (11 + i) * 60_000), // 11–16 min ago
        instanceName: 'old-instance',
      }),
    )
    const anomalies = detectAnomalies(events, NOW).filter(a => a.type === 'stuck')
    expect(anomalies).toHaveLength(0)
  })

  it('detects error burst: >10 Warning events in 1 minute for the same instance', () => {
    // 12 Warning events in the last 30 seconds.
    const events = Array.from({ length: 12 }, (_, i) =>
      makeEvent({
        type: 'Warning',
        reason: 'Failed',
        lastTimestamp: ago(NOW, i * 2000), // 0–22 seconds ago
        instanceName: 'burst-instance',
      }),
    )
    const anomalies = detectAnomalies(events, NOW)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].type).toBe('burst')
    expect(anomalies[0].instanceName).toBe('burst-instance')
    expect(anomalies[0].count).toBe(12)
    expect(anomalies[0].message).toContain('burst-instance')
    expect(anomalies[0].message).toContain('12')
  })

  it('does NOT detect burst for exactly 10 Warning events (threshold is >10)', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({
        type: 'Warning',
        reason: 'Failed',
        lastTimestamp: ago(NOW, i * 1000),
        instanceName: 'borderline-instance',
      }),
    )
    const anomalies = detectAnomalies(events, NOW).filter(a => a.type === 'burst')
    expect(anomalies).toHaveLength(0)
  })

  it('does NOT detect burst when Warning events are outside the 1 minute window', () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      makeEvent({
        type: 'Warning',
        reason: 'Failed',
        lastTimestamp: ago(NOW, (2 + i) * 60_000), // 2–13 min ago
        instanceName: 'old-burst-instance',
      }),
    )
    const anomalies = detectAnomalies(events, NOW).filter(a => a.type === 'burst')
    expect(anomalies).toHaveLength(0)
  })

  it('detects multiple anomaly types for different instances', () => {
    const stuckEvents = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        reason: 'Progressing',
        lastTimestamp: ago(NOW, (i + 1) * 60_000),
        instanceName: 'instance-a',
      }),
    )
    const burstEvents = Array.from({ length: 12 }, (_, i) =>
      makeEvent({
        type: 'Warning',
        reason: 'Failed',
        lastTimestamp: ago(NOW, i * 1000),
        instanceName: 'instance-b',
      }),
    )
    const anomalies = detectAnomalies([...stuckEvents, ...burstEvents], NOW)
    expect(anomalies).toHaveLength(2)
    const stuck = anomalies.find(a => a.type === 'stuck')
    const burst = anomalies.find(a => a.type === 'burst')
    expect(stuck?.instanceName).toBe('instance-a')
    expect(burst?.instanceName).toBe('instance-b')
  })
})
