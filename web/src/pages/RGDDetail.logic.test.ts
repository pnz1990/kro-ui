// RGDDetail.logic.test.ts — Pure logic tests for RGDDetail derived values.
// T032: lastIssuedRevision chip logic (spec 046-kro-v090-upgrade)
// T032b: extractLastRevision from @/lib/format — condition-message parsing (#416)
//
// These tests do NOT use React rendering (no document dependency),
// making them immune to the jsdom environment issues in RGDDetail.test.tsx.

import { describe, it, expect } from 'vitest'
import { extractLastRevision } from '@/lib/format'
import type { K8sObject } from '@/lib/api'

// ── helpers ───────────────────────────────────────────────────────────────

function makeRgd(status: Record<string, unknown>): K8sObject {
  return { metadata: {}, status } as unknown as K8sObject
}

function makeCondition(type: string, status: string, message = '') {
  return { type, status, message }
}

// Inline scope extraction logic (mirrors RGDDetail.tsx exactly).
function extractIsClusterScoped(rgd: Record<string, unknown>): boolean {
  const schemaObj = (rgd?.spec as Record<string, unknown> | undefined)
    ?.schema as Record<string, unknown> | undefined
  return (schemaObj?.scope as string | undefined) === 'Cluster'
}

// ── extractLastRevision — condition-message path (kro v0.9.0) ────────────

describe('extractLastRevision — condition-message path (kro v0.9.0, T032b / #416)', () => {
  it('extracts revision number from GraphRevisionsResolved condition message', () => {
    const rgd = makeRgd({
      conditions: [makeCondition('GraphRevisionsResolved', 'True', 'revision 1 compiled and active')],
    })
    expect(extractLastRevision(rgd)).toBe('1')
  })

  it('extracts multi-digit revision numbers', () => {
    const rgd = makeRgd({
      conditions: [makeCondition('GraphRevisionsResolved', 'True', 'revision 42 compiled and active')],
    })
    expect(extractLastRevision(rgd)).toBe('42')
  })

  it('is case-insensitive for the "revision" keyword', () => {
    const rgd = makeRgd({
      conditions: [makeCondition('GraphRevisionsResolved', 'True', 'Revision 5 compiled and active')],
    })
    expect(extractLastRevision(rgd)).toBe('5')
  })

  it('returns null when GraphRevisionsResolved status is not True', () => {
    const rgd = makeRgd({
      conditions: [makeCondition('GraphRevisionsResolved', 'Unknown', 'awaiting reconciliation')],
    })
    expect(extractLastRevision(rgd)).toBeNull()
  })

  it('returns null when GraphRevisionsResolved condition is absent', () => {
    const rgd = makeRgd({ conditions: [makeCondition('KindReady', 'True')] })
    expect(extractLastRevision(rgd)).toBeNull()
  })
})

describe('extractLastRevision — status.lastIssuedRevision fallback', () => {
  it('falls back to status.lastIssuedRevision when condition absent', () => {
    const rgd = makeRgd({ lastIssuedRevision: 3 })
    expect(extractLastRevision(rgd)).toBe('3')
  })

  it('prefers condition over status.lastIssuedRevision', () => {
    const rgd = makeRgd({
      conditions: [makeCondition('GraphRevisionsResolved', 'True', 'revision 7 compiled and active')],
      lastIssuedRevision: 3,
    })
    expect(extractLastRevision(rgd)).toBe('7')
  })

  it('returns null when lastIssuedRevision is 0 (chip absent per §XII)', () => {
    expect(extractLastRevision(makeRgd({ lastIssuedRevision: 0 }))).toBeNull()
  })

  it('returns null when lastIssuedRevision is non-numeric (graceful degradation §XII)', () => {
    expect(extractLastRevision(makeRgd({ lastIssuedRevision: 'three' }))).toBeNull()
    expect(extractLastRevision(makeRgd({ lastIssuedRevision: null }))).toBeNull()
    expect(extractLastRevision(makeRgd({ lastIssuedRevision: false }))).toBeNull()
  })

  it('returns null when status is empty', () => {
    expect(extractLastRevision(makeRgd({}))).toBeNull()
    expect(extractLastRevision({ metadata: {} } as unknown as K8sObject)).toBeNull()
  })
})

// ── isClusterScoped extraction (T022 / FR-020) ────────────────────────────

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
