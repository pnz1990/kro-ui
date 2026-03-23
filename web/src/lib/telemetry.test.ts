// telemetry.test.ts — Unit tests for pure telemetry derivation functions.
//
// Tests spec 027-instance-telemetry-panel NFR-005.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractInstanceAge,
  extractTimeInState,
  countHealthyChildren,
  countWarningEvents,
} from './telemetry'
import type { ChildHealthSummary } from './telemetry'
import type { NodeStateMap } from './instanceNodeState'
import type { K8sList } from './api'

// ── extractInstanceAge ───────────────────────────────────────────────────

describe('extractInstanceAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns formatAge result when creationTimestamp is present', () => {
    // 2 hours before fake now → '2h'
    const instance = {
      metadata: { creationTimestamp: '2026-03-23T10:00:00Z' },
    }
    expect(extractInstanceAge(instance)).toBe('2h')
  })

  it('returns "Not reported" when creationTimestamp is absent', () => {
    const instance = { metadata: {} }
    expect(extractInstanceAge(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when metadata is absent', () => {
    const instance = {}
    expect(extractInstanceAge(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when metadata is null', () => {
    const instance = { metadata: null }
    expect(extractInstanceAge(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when creationTimestamp is an empty string', () => {
    const instance = { metadata: { creationTimestamp: '' } }
    expect(extractInstanceAge(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when creationTimestamp is not a string', () => {
    const instance = { metadata: { creationTimestamp: 12345 } }
    expect(extractInstanceAge(instance)).toBe('Not reported')
  })

  it('returns "0s" for a future timestamp (clock skew)', () => {
    const instance = {
      metadata: { creationTimestamp: '2026-03-23T13:00:00Z' },
    }
    expect(extractInstanceAge(instance)).toBe('0s')
  })

  it('returns days format for old instances', () => {
    // 3 days before fake now
    const instance = {
      metadata: { creationTimestamp: '2026-03-20T12:00:00Z' },
    }
    expect(extractInstanceAge(instance)).toBe('3d')
  })
})

// ── extractTimeInState ───────────────────────────────────────────────────

describe('extractTimeInState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns formatAge of Ready.lastTransitionTime when Ready condition is present', () => {
    // 30 minutes before fake now → '30m'
    const instance = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            lastTransitionTime: '2026-03-23T11:30:00Z',
          },
        ],
      },
    }
    expect(extractTimeInState(instance)).toBe('30m')
  })

  it('returns "Not reported" when Ready condition is absent', () => {
    const instance = {
      status: {
        conditions: [
          { type: 'Progressing', status: 'True', lastTransitionTime: '2026-03-23T11:00:00Z' },
        ],
      },
    }
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when conditions array is absent', () => {
    const instance = { status: {} }
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when status is absent', () => {
    const instance = {}
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when conditions is not an array', () => {
    const instance = { status: { conditions: 'not-array' } }
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when lastTransitionTime is absent from Ready condition', () => {
    const instance = {
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    }
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('returns "Not reported" when lastTransitionTime is empty string', () => {
    const instance = {
      status: {
        conditions: [
          { type: 'Ready', status: 'True', lastTransitionTime: '' },
        ],
      },
    }
    expect(extractTimeInState(instance)).toBe('Not reported')
  })

  it('works for Ready=False (error state)', () => {
    // 5 minutes before fake now → '5m'
    const instance = {
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            lastTransitionTime: '2026-03-23T11:55:00Z',
          },
        ],
      },
    }
    expect(extractTimeInState(instance)).toBe('5m')
  })
})

// ── countHealthyChildren ─────────────────────────────────────────────────

describe('countHealthyChildren', () => {
  function makeMap(entries: Array<{ kind: string; state: 'alive' | 'reconciling' | 'error' | 'not-found' }>): NodeStateMap {
    const map: NodeStateMap = {}
    for (const e of entries) {
      map[e.kind.toLowerCase()] = {
        state: e.state,
        kind: e.kind,
        name: `${e.kind.toLowerCase()}-1`,
        namespace: 'default',
        group: '',
        version: 'v1',
      }
    }
    return map
  }

  it('returns { healthy: N, total: N, hasError: false } when all entries are alive', () => {
    const map = makeMap([
      { kind: 'Deployment', state: 'alive' },
      { kind: 'Service', state: 'alive' },
      { kind: 'ConfigMap', state: 'alive' },
    ])
    const result: ChildHealthSummary = countHealthyChildren(map)
    expect(result).toEqual({ healthy: 3, total: 3, hasError: false })
  })

  it('returns { healthy: 0, total: 0, hasError: false } for empty map', () => {
    expect(countHealthyChildren({})).toEqual({ healthy: 0, total: 0, hasError: false })
  })

  it('counts reconciling children as healthy (present, non-error)', () => {
    const map = makeMap([
      { kind: 'Deployment', state: 'reconciling' },
      { kind: 'Service', state: 'alive' },
    ])
    expect(countHealthyChildren(map)).toEqual({ healthy: 2, total: 2, hasError: false })
  })

  it('counts error children in total but not healthy; hasError=true', () => {
    const map = makeMap([
      { kind: 'Deployment', state: 'error' },
      { kind: 'Service', state: 'alive' },
    ])
    const result = countHealthyChildren(map)
    expect(result.healthy).toBe(1)
    expect(result.total).toBe(2)
    expect(result.hasError).toBe(true)
  })

  it('returns hasError=false when no error entries', () => {
    const map = makeMap([
      { kind: 'Deployment', state: 'alive' },
      { kind: 'Service', state: 'reconciling' },
    ])
    expect(countHealthyChildren(map).hasError).toBe(false)
  })

  it('all entries are error → healthy=0, hasError=true', () => {
    const map = makeMap([
      { kind: 'Deployment', state: 'error' },
      { kind: 'Service', state: 'error' },
    ])
    expect(countHealthyChildren(map)).toEqual({ healthy: 0, total: 2, hasError: true })
  })

  it('not-found entries count toward total but not healthy, no hasError effect', () => {
    // Note: in practice NodeStateMap only contains children found on cluster;
    // 'not-found' can occur if buildNodeStateMap is called with a stale child.
    const map = makeMap([
      { kind: 'Deployment', state: 'not-found' },
      { kind: 'Service', state: 'alive' },
    ])
    const result = countHealthyChildren(map)
    expect(result.healthy).toBe(1)
    expect(result.total).toBe(2)
    expect(result.hasError).toBe(false)
  })
})

// ── countWarningEvents ───────────────────────────────────────────────────

describe('countWarningEvents', () => {
  function makeEvents(types: string[]): K8sList {
    return {
      items: types.map((t) => ({ type: t })),
      metadata: {},
    }
  }

  it('returns count of events with type=Warning', () => {
    const events = makeEvents(['Warning', 'Normal', 'Warning'])
    expect(countWarningEvents(events)).toBe(2)
  })

  it('returns 0 for empty items array', () => {
    expect(countWarningEvents({ items: [], metadata: {} })).toBe(0)
  })

  it('ignores events with type=Normal', () => {
    expect(countWarningEvents(makeEvents(['Normal', 'Normal']))).toBe(0)
  })

  it('handles missing items array gracefully', () => {
    // K8sList type says items: K8sObject[] but defensive handling is required
    const events = { metadata: {} } as unknown as K8sList
    expect(countWarningEvents(events)).toBe(0)
  })

  it('handles null items gracefully', () => {
    const events = { items: null, metadata: {} } as unknown as K8sList
    expect(countWarningEvents(events)).toBe(0)
  })

  it('returns 0 when all events are Warning=0 (all Normal)', () => {
    const events = makeEvents(['Normal'])
    expect(countWarningEvents(events)).toBe(0)
  })

  it('counts all Warnings in a large list (200+)', () => {
    const types = Array.from({ length: 200 }, (_, i) => (i % 4 === 0 ? 'Warning' : 'Normal'))
    // 200 items, every 4th is Warning → 50 warnings
    expect(countWarningEvents(makeEvents(types))).toBe(50)
  })
})
