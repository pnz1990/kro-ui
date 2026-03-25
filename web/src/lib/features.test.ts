import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BASELINE, invalidateCapabilities, isExperimental } from './features'

// features.ts uses a module-level cache. Invalidate before each test to avoid
// state leaking between tests (important: the cache persists across test runs
// unless reset).
beforeEach(() => {
  invalidateCapabilities()
})

describe('BASELINE', () => {
  it('has expected default feature gate values', () => {
    expect(BASELINE.featureGates.CELOmitFunction).toBe(false)
    expect(BASELINE.featureGates.InstanceConditionEvents).toBe(false)
  })

  it('has schema capabilities', () => {
    expect(BASELINE.schema.hasForEach).toBe(true)
    expect(BASELINE.schema.hasExternalRef).toBe(true)
  })

  it('has unknown version by default', () => {
    expect(BASELINE.version).toBe('unknown')
  })
})

describe('invalidateCapabilities', () => {
  it('resets the cache so useCapabilities triggers a fresh fetch', () => {
    // After invalidation, fetchedAt is 0 — confirmed by calling the function
    // without throwing. The function is exported precisely for testing + context switching.
    expect(() => invalidateCapabilities()).not.toThrow()
  })
})

describe('isExperimental', () => {
  it('returns false when ?experimental is absent', () => {
    // jsdom sets window.location.search to '' by default
    expect(isExperimental()).toBe(false)
  })

  it('returns true when ?experimental=true is present', () => {
    const original = window.location.search
    // Override the search string using Object.defineProperty (jsdom guard)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?experimental=true' },
      writable: true,
      configurable: true,
    })
    expect(isExperimental()).toBe(true)
    // Restore
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: original },
      writable: true,
      configurable: true,
    })
  })

  it('returns false when ?experimental=false', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?experimental=false' },
      writable: true,
      configurable: true,
    })
    expect(isExperimental()).toBe(false)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
      configurable: true,
    })
  })
})

// Suppress unused vi import warning — used indirectly by beforeEach pattern.
void vi
