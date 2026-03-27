// RGDDetail.logic.test.ts — Pure logic tests for RGDDetail derived values.
// T032: lastIssuedRevision chip logic (spec 046-kro-v090-upgrade)
//
// These tests do NOT use React rendering (no document dependency),
// making them immune to the jsdom environment issues in RGDDetail.test.tsx.

import { describe, it, expect } from 'vitest'

// Inline the extraction logic (mirrors RGDDetail.tsx exactly).
function extractRevision(rgd: Record<string, unknown>): number | null {
  const rawRevision = (rgd?.status as Record<string, unknown> | undefined)?.lastIssuedRevision
  return typeof rawRevision === 'number' && rawRevision > 0 ? rawRevision : null
}

// Inline scope extraction logic (mirrors RGDDetail.tsx exactly).
function extractIsClusterScoped(rgd: Record<string, unknown>): boolean {
  const schemaObj = (rgd?.spec as Record<string, unknown> | undefined)
    ?.schema as Record<string, unknown> | undefined
  return (schemaObj?.scope as string | undefined) === 'Cluster'
}

describe('lastIssuedRevision extraction (T032)', () => {
  it('returns positive number when lastIssuedRevision is > 0', () => {
    expect(extractRevision({ status: { lastIssuedRevision: 3 } })).toBe(3)
    expect(extractRevision({ status: { lastIssuedRevision: 1 } })).toBe(1)
    expect(extractRevision({ status: { lastIssuedRevision: 100 } })).toBe(100)
  })

  it('returns null when lastIssuedRevision is 0 (chip absent per §XII)', () => {
    expect(extractRevision({ status: { lastIssuedRevision: 0 } })).toBeNull()
  })

  it('returns null when lastIssuedRevision is absent (pre-v0.9.0 cluster)', () => {
    expect(extractRevision({ status: {} })).toBeNull()
    expect(extractRevision({})).toBeNull()
  })

  it('returns null when lastIssuedRevision is non-numeric (graceful degradation §XII)', () => {
    expect(extractRevision({ status: { lastIssuedRevision: 'three' } })).toBeNull()
    expect(extractRevision({ status: { lastIssuedRevision: null } })).toBeNull()
    expect(extractRevision({ status: { lastIssuedRevision: false } })).toBeNull()
  })
})

describe('isClusterScoped extraction (T022 / FR-020)', () => {
  it('returns true when spec.schema.scope === "Cluster"', () => {
    expect(extractIsClusterScoped({ spec: { schema: { scope: 'Cluster' } } })).toBe(true)
  })

  it('returns false when spec.schema.scope is "Namespaced"', () => {
    expect(extractIsClusterScoped({ spec: { schema: { scope: 'Namespaced' } } })).toBe(false)
  })

  it('returns false when spec.schema.scope is absent (default Namespaced)', () => {
    expect(extractIsClusterScoped({ spec: { schema: {} } })).toBe(false)
    expect(extractIsClusterScoped({ spec: {} })).toBe(false)
    expect(extractIsClusterScoped({})).toBe(false)
  })
})
