import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isTerminating,
  getDeletionTimestamp,
  getFinalizers,
  getKroFinalizers,
  getNonKroFinalizers,
  isDeletionEvent,
  formatRelativeTime,
  KRO_FINALIZER_PREFIX,
} from './k8s'
import type { K8sObject } from './api'

// Helper to build a minimal K8sObject for testing.
function obj(meta: Record<string, unknown>, extra: Record<string, unknown> = {}): K8sObject {
  return { metadata: meta, ...extra } as unknown as K8sObject
}

describe('isTerminating', () => {
  it('returns true when deletionTimestamp is a string', () => {
    expect(isTerminating(obj({ deletionTimestamp: '2026-01-01T00:00:00Z' }))).toBe(true)
  })

  it('returns false when deletionTimestamp is absent', () => {
    expect(isTerminating(obj({ name: 'foo' }))).toBe(false)
  })

  it('returns false when metadata is missing', () => {
    expect(isTerminating({} as K8sObject)).toBe(false)
  })
})

describe('getDeletionTimestamp', () => {
  it('returns the raw RFC3339 string', () => {
    const ts = '2026-01-01T12:00:00Z'
    expect(getDeletionTimestamp(obj({ deletionTimestamp: ts }))).toBe(ts)
  })

  it('returns undefined when absent', () => {
    expect(getDeletionTimestamp(obj({ name: 'foo' }))).toBeUndefined()
  })
})

describe('getFinalizers', () => {
  it('returns finalizer list', () => {
    expect(getFinalizers(obj({ finalizers: ['a', 'b'] }))).toEqual(['a', 'b'])
  })

  it('filters non-string elements', () => {
    expect(getFinalizers(obj({ finalizers: ['a', 42, null, 'b'] }))).toEqual(['a', 'b'])
  })

  it('returns empty array when no finalizers', () => {
    expect(getFinalizers(obj({}))).toEqual([])
  })

  it('returns empty array when metadata missing', () => {
    expect(getFinalizers({} as K8sObject)).toEqual([])
  })
})

describe('getKroFinalizers / getNonKroFinalizers', () => {
  const withMixed = obj({
    finalizers: ['kro.run/cleanup', 'other-controller/done', 'kro.run/resource'],
  })

  it('getKroFinalizers returns only kro.run/ prefixed entries', () => {
    expect(getKroFinalizers(withMixed)).toEqual(['kro.run/cleanup', 'kro.run/resource'])
  })

  it('getNonKroFinalizers returns only non-kro entries', () => {
    expect(getNonKroFinalizers(withMixed)).toEqual(['other-controller/done'])
  })

  it('KRO_FINALIZER_PREFIX is correct', () => {
    expect(KRO_FINALIZER_PREFIX).toBe('kro.run/')
  })
})

describe('isDeletionEvent', () => {
  it('returns true for known deletion reason', () => {
    expect(isDeletionEvent({ reason: 'Killing' } as unknown as K8sObject)).toBe(true)
    expect(isDeletionEvent({ reason: 'ResourceDeleted' } as unknown as K8sObject)).toBe(true)
  })

  it('returns false for non-deletion reason', () => {
    expect(isDeletionEvent({ reason: 'Created' } as unknown as K8sObject)).toBe(false)
  })

  it('returns false when reason is absent', () => {
    expect(isDeletionEvent({} as K8sObject)).toBe(false)
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats seconds ago', () => {
    expect(formatRelativeTime('2026-01-01T11:59:30Z')).toBe('30s ago')
  })

  it('formats minutes ago', () => {
    expect(formatRelativeTime('2026-01-01T11:45:00Z')).toBe('15m ago')
  })

  it('formats hours ago', () => {
    expect(formatRelativeTime('2026-01-01T10:00:00Z')).toBe('2h ago')
  })

  it('formats days ago', () => {
    expect(formatRelativeTime('2025-12-30T12:00:00Z')).toBe('2d ago')
  })

  it('returns raw string for invalid timestamp', () => {
    expect(formatRelativeTime('not-a-date')).toBe('not-a-date')
  })

  it('clamps negative diff (clock skew) to 0s ago', () => {
    // Future timestamp — diff is negative
    expect(formatRelativeTime('2026-01-01T13:00:00Z')).toBe('0s ago')
  })
})
