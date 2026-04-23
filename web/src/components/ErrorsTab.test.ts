// ErrorsTab.test.ts — Unit tests for groupErrorPatterns, aggregateTopMessages, and isHealthyCondition.
//
// Issue #159: ReconciliationSuspended=False must NOT appear in error patterns.
// The inversion logic (HEALTHY_WHEN_FALSE) is tested for both the condition health
// helper and the aggregation function.

import { describe, it, expect } from 'vitest'
import { groupErrorPatterns, aggregateTopMessages } from './ErrorsTab'
import { isHealthyCondition } from '@/lib/conditions'
import type { K8sObject } from '@/lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeInstance(
  name: string,
  conditions: Array<{ type: string; status: string; reason?: string; message?: string }>,
): K8sObject {
  return {
    apiVersion: 'kro.run/v1alpha1',
    kind: 'Dungeon',
    metadata: { name, namespace: 'default' },
    status: { conditions },
  }
}

// ── isHealthyCondition ─────────────────────────────────────────────────────

describe('isHealthyCondition', () => {
  describe('normal conditions (healthy = True)', () => {
    it('Reconciled=True → healthy', () => {
      expect(isHealthyCondition('Reconciled', 'True')).toBe(true)
    })

    it('Reconciled=False → not healthy', () => {
      expect(isHealthyCondition('Reconciled', 'False')).toBe(false)
    })

    it('Reconciled=Unknown → not healthy', () => {
      expect(isHealthyCondition('Reconciled', 'Unknown')).toBe(false)
    })

    it('Ready=True → healthy', () => {
      expect(isHealthyCondition('Ready', 'True')).toBe(true)
    })

    it('Ready=False → not healthy', () => {
      expect(isHealthyCondition('Ready', 'False')).toBe(false)
    })
  })

  describe('inverted conditions (healthy = False)', () => {
    // Issue #159: ReconciliationSuspended=False means reconciliation is ACTIVE → healthy
    it('ReconciliationSuspended=False → healthy (inversion)', () => {
      expect(isHealthyCondition('ReconciliationSuspended', 'False')).toBe(true)
    })

    it('ReconciliationSuspended=True → not healthy (suspended = problem)', () => {
      expect(isHealthyCondition('ReconciliationSuspended', 'True')).toBe(false)
    })

    it('ReconciliationSuspended=Unknown → not healthy', () => {
      expect(isHealthyCondition('ReconciliationSuspended', 'Unknown')).toBe(false)
    })
  })
})

// ── groupErrorPatterns ─────────────────────────────────────────────────────

describe('groupErrorPatterns', () => {
  it('returns empty array for instances with no failing conditions', () => {
    const instances = [
      makeInstance('a', [{ type: 'Reconciled', status: 'True' }]),
    ]
    expect(groupErrorPatterns(instances)).toEqual([])
  })

  it('groups instances by (conditionType, reason)', () => {
    const instances = [
      makeInstance('a', [{ type: 'Reconciled', status: 'False', reason: 'Error', message: 'boom' }]),
      makeInstance('b', [{ type: 'Reconciled', status: 'False', reason: 'Error', message: 'boom' }]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(1)
    expect(groups[0].conditionType).toBe('Reconciled')
    expect(groups[0].count).toBe(2)
  })

  // Issue #159: ReconciliationSuspended=False is healthy — must NEVER appear as an error
  it('excludes ReconciliationSuspended=False from error patterns', () => {
    const instances = [
      makeInstance('a', [
        { type: 'Reconciled', status: 'True' },
        { type: 'ReconciliationSuspended', status: 'False', reason: 'Active', message: 'Reconciliation is Active' },
      ]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(0)
  })

  it('includes ReconciliationSuspended=True as an error (reconciliation paused)', () => {
    const instances = [
      makeInstance('a', [
        { type: 'ReconciliationSuspended', status: 'True', reason: 'Suspended', message: 'Manually suspended' },
      ]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(1)
    expect(groups[0].conditionType).toBe('ReconciliationSuspended')
    expect(groups[0].reason).toBe('Suspended')
  })

  it('excludes True conditions (healthy for normal types)', () => {
    const instances = [
      makeInstance('a', [
        { type: 'Ready', status: 'True' },
        { type: 'Progressing', status: 'True' },
      ]),
    ]
    expect(groupErrorPatterns(instances)).toHaveLength(0)
  })

  it('includes False conditions for normal types (genuine errors)', () => {
    const instances = [
      makeInstance('a', [{ type: 'Ready', status: 'False', reason: 'PodFailed' }]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(1)
    expect(groups[0].conditionType).toBe('Ready')
  })

  it('includes Unknown conditions as errors', () => {
    const instances = [
      makeInstance('a', [{ type: 'Ready', status: 'Unknown' }]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(1)
    expect(groups[0].conditionType).toBe('Ready')
  })

  it('skips instances with absent metadata', () => {
    const badInstance = { apiVersion: 'v1', kind: 'X', metadata: {}, status: {} } as K8sObject
    expect(groupErrorPatterns([badInstance])).toHaveLength(0)
  })

  it('sorts groups by count desc', () => {
    const instances = [
      makeInstance('a', [{ type: 'Reconciled', status: 'False', reason: 'ErrA' }]),
      makeInstance('b', [{ type: 'Ready',      status: 'False', reason: 'ErrB' }]),
      makeInstance('c', [{ type: 'Ready',      status: 'False', reason: 'ErrB' }]),
    ]
    const groups = groupErrorPatterns(instances)
    expect(groups[0].conditionType).toBe('Ready')
    expect(groups[0].count).toBe(2)
    expect(groups[1].conditionType).toBe('Reconciled')
    expect(groups[1].count).toBe(1)
  })
})

// ── IN_PROGRESS skip ────────────────────────────────────────────────────────

describe('groupErrorPatterns — IN_PROGRESS instances are not aggregated', () => {
  function makeInProgressInstance(name: string): K8sObject {
    return {
      metadata: { name, namespace: 'default' },
      status: {
        state: 'IN_PROGRESS',
        conditions: [
          { type: 'InstanceManaged', status: 'True', reason: 'Managed' },
          { type: 'GraphResolved',   status: 'True', reason: 'Resolved' },
          { type: 'ResourcesReady',  status: 'False', reason: 'NotReady', message: 'awaiting resource readiness' },
          { type: 'Ready',           status: 'False', reason: 'NotReady', message: 'awaiting resource readiness' },
        ],
      },
    }
  }

  function makeProgressingInstance(name: string): K8sObject {
    return {
      metadata: { name, namespace: 'default' },
      status: {
        conditions: [
          { type: 'Progressing', status: 'True', reason: 'NewReplicaSet' },
          { type: 'Ready',       status: 'False', reason: 'Progressing' },
        ],
      },
    }
  }

  it('includes IN_PROGRESS instances with Ready=False — stuck reconciliation is actionable', () => {
    // Previously these were skipped (PR #286), but operators need to see
    // stuck instances (e.g. never-ready running for days) in the Errors tab.
    const instances = [
      makeInProgressInstance('never-ready-prod'),
      makeInProgressInstance('never-ready-staging'),
      makeInProgressInstance('never-ready-dev'),
    ]
    const groups = groupErrorPatterns(instances)
    // All 3 instances have Ready=False/NotReady — they appear in the Errors tab.
    expect(groups.length).toBeGreaterThan(0)
    const allNames = groups.flatMap((g) => g.instances.map((i) => i.name))
    expect(allNames).toContain('never-ready-prod')
    expect(allNames).toContain('never-ready-staging')
    expect(allNames).toContain('never-ready-dev')
  })

  it('skips instances with Progressing=True condition', () => {
    const instances = [makeProgressingInstance('rolling-update')]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(0)
  })

  it('includes genuinely errored instances (no Progressing condition); IN_PROGRESS instances also included now', () => {
    const instances = [
      makeInProgressInstance('reconciling-1'),  // included (stuck reconciling = actionable)
      {
        metadata: { name: 'broken', namespace: 'default' },
        status: {
          state: 'FAILED',
          conditions: [
            { type: 'Ready', status: 'False', reason: 'CrashLoopBackOff' },
          ],
        },
      } as K8sObject,
    ]
    const groups = groupErrorPatterns(instances)
    // Both instances have Ready=False — both appear in the Errors tab.
    const allNames = groups.flatMap((g) => g.instances.map((i) => i.name))
    expect(allNames).toContain('broken')
    expect(allNames).toContain('reconciling-1')
  })

  it('skips GraphProgressing=True instances (kro v0.8.x compat)', () => {
    const instances = [{
      metadata: { name: 'old-kro', namespace: 'default' },
      status: {
        conditions: [
          { type: 'GraphProgressing', status: 'True', reason: 'Reconciling' },
          { type: 'Ready',            status: 'False', reason: 'Reconciling' },
        ],
      },
    } as K8sObject]
    const groups = groupErrorPatterns(instances)
    expect(groups).toHaveLength(0)
  })
})

// ── aggregateTopMessages (spec issue-775, 30.2) ───────────────────────────

describe('aggregateTopMessages', () => {
  it('T-TM01: empty groups → empty result', () => {
    expect(aggregateTopMessages([])).toEqual([])
  })

  it('T-TM02: single-instance messages are filtered out (count ≤ 1)', () => {
    const groups = [
      { conditionType: 'Ready', reason: 'Err', message: 'only one instance', count: 1, instances: [] },
    ]
    expect(aggregateTopMessages(groups)).toEqual([])
  })

  it('T-TM03: messages with count > 1 appear in the result', () => {
    const groups = [
      { conditionType: 'Ready', reason: 'Err', message: 'timeout waiting for node X', count: 5, instances: [] },
      { conditionType: 'Ready', reason: 'Err', message: 'single failure', count: 1, instances: [] },
    ]
    const result = aggregateTopMessages(groups)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('timeout waiting for node X')
    expect(result[0].count).toBe(5)
  })

  it('T-TM04: sorted by count descending', () => {
    const groups = [
      { conditionType: 'Ready', reason: '', message: 'common error', count: 3, instances: [] },
      { conditionType: 'Ready', reason: '', message: 'very common error', count: 10, instances: [] },
      { conditionType: 'Ready', reason: '', message: 'less common', count: 2, instances: [] },
    ]
    const result = aggregateTopMessages(groups)
    expect(result[0].count).toBe(10)
    expect(result[1].count).toBe(3)
    expect(result[2].count).toBe(2)
  })

  it('T-TM05: topN limits the result', () => {
    const groups = Array.from({ length: 10 }, (_, i) => ({
      conditionType: 'Ready',
      reason: '',
      message: `error message ${i}`,
      count: 10 - i,
      instances: [],
    }))
    const result = aggregateTopMessages(groups, 3)
    expect(result).toHaveLength(3)
  })

  it('T-TM06: "(no message)" is excluded from aggregation', () => {
    const groups = [
      { conditionType: 'Ready', reason: '', message: '(no message)', count: 5, instances: [] },
    ]
    expect(aggregateTopMessages(groups)).toEqual([])
  })

  it('T-TM07: empty message string is excluded', () => {
    const groups = [
      { conditionType: 'Ready', reason: '', message: '', count: 5, instances: [] },
    ]
    expect(aggregateTopMessages(groups)).toEqual([])
  })
})
