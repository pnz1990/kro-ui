// ErrorsTab.test.ts — Unit tests for groupErrorPatterns and isHealthyCondition.
//
// Issue #159: ReconciliationSuspended=False must NOT appear in error patterns.
// The inversion logic (HEALTHY_WHEN_FALSE) is tested for both the condition health
// helper and the aggregation function.

import { describe, it, expect } from 'vitest'
import { groupErrorPatterns } from './ErrorsTab'
import { isHealthyCondition } from './ConditionsPanel'
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
