// InstanceTable diff helpers test — tests the pure functions used by the
// spec diff panel (flattenSpec, buildDiff) without rendering components.
//
// GH #287: instance spec diff feature

import { describe, it, expect } from 'vitest'
import type { K8sObject } from '@/lib/api'

// Extract the pure helpers for unit testing.
// These are defined inline in InstanceTable.tsx — redefine them here for testing.

function flattenSpec(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj !== 'object' || obj === null) {
    return prefix ? { [prefix]: String(obj) } : {}
  }
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenSpec(v, path))
    } else {
      result[path] = Array.isArray(v) ? JSON.stringify(v) : String(v ?? '')
    }
  }
  return result
}

interface DiffRow {
  key: string
  aVal: string | undefined
  bVal: string | undefined
  differs: boolean
}

function buildDiff(a: K8sObject, b: K8sObject): DiffRow[] {
  const aSpec = flattenSpec((a.spec as Record<string, unknown>) ?? {})
  const bSpec = flattenSpec((b.spec as Record<string, unknown>) ?? {})
  const keys = Array.from(new Set([...Object.keys(aSpec), ...Object.keys(bSpec)])).sort()
  return keys.map((key) => ({
    key,
    aVal: aSpec[key],
    bVal: bSpec[key],
    differs: aSpec[key] !== bSpec[key],
  }))
}

describe('flattenSpec', () => {
  it('flattens a flat spec object', () => {
    const flat = flattenSpec({ replicas: 3, name: 'prod' })
    expect(flat).toEqual({ replicas: '3', name: 'prod' })
  })

  it('flattens nested spec fields with dotted keys', () => {
    const nested = flattenSpec({ config: { port: 8080, debug: false } })
    expect(nested).toEqual({ 'config.port': '8080', 'config.debug': 'false' })
  })

  it('serializes arrays as JSON', () => {
    const arr = flattenSpec({ regions: ['us-east-1', 'eu-west-1'] })
    expect(arr).toEqual({ regions: '["us-east-1","eu-west-1"]' })
  })

  it('serializes null values as empty string', () => {
    // null values use ?? '' before String() so they appear as '' not 'null'
    const nullVal = flattenSpec({ value: null })
    expect(nullVal).toEqual({ value: '' })
  })

  it('returns empty object for empty spec', () => {
    expect(flattenSpec({})).toEqual({})
    expect(flattenSpec(null)).toEqual({})
  })
})

describe('buildDiff', () => {
  function makeInstance(spec: Record<string, unknown>): K8sObject {
    return { metadata: { name: 'test', namespace: 'ns' }, spec }
  }

  it('reports no differences for identical specs', () => {
    const a = makeInstance({ replicas: 3, name: 'prod' })
    const b = makeInstance({ replicas: 3, name: 'prod' })
    const diff = buildDiff(a, b)
    expect(diff.every((r) => !r.differs)).toBe(true)
  })

  it('reports differences when values differ', () => {
    const a = makeInstance({ replicas: 3, env: 'prod' })
    const b = makeInstance({ replicas: 1, env: 'staging' })
    const diff = buildDiff(a, b)
    expect(diff.filter((r) => r.differs).map((r) => r.key)).toEqual(['env', 'replicas'])
  })

  it('reports a field as absent on one side when it only appears in one spec', () => {
    const a = makeInstance({ replicas: 3, extraField: 'only-in-a' })
    const b = makeInstance({ replicas: 3 })
    const diff = buildDiff(a, b)
    const extraRow = diff.find((r) => r.key === 'extraField')
    expect(extraRow).toBeDefined()
    expect(extraRow?.aVal).toBe('only-in-a')
    expect(extraRow?.bVal).toBeUndefined()
    expect(extraRow?.differs).toBe(true)
  })

  it('sorts keys alphabetically', () => {
    const a = makeInstance({ z: 1, a: 2, m: 3 })
    const b = makeInstance({ z: 1, a: 2, m: 3 })
    const diff = buildDiff(a, b)
    expect(diff.map((r) => r.key)).toEqual(['a', 'm', 'z'])
  })

  it('typed-prod vs typed-staging: replicas and port differ', () => {
    const prod = makeInstance({ appName: 'typed-prod', replicas: 3, port: 8080, enableTLS: true })
    const staging = makeInstance({ appName: 'typed-staging', replicas: 1, port: 8443, enableTLS: false })
    const diff = buildDiff(prod, staging)
    const diffKeys = diff.filter((r) => r.differs).map((r) => r.key)
    expect(diffKeys).toContain('replicas')
    expect(diffKeys).toContain('port')
    expect(diffKeys).toContain('appName')
    expect(diffKeys).toContain('enableTLS')
  })
})
