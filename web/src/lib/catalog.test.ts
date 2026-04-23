import { describe, it, expect } from 'vitest'
import {
  buildChainingMap,
  extractLabels,
  extractTemplateKinds,
  matchesSearch,
  matchesLabelFilter,
  collectAllLabels,
  sortCatalog,
  computeComplexityScore,
  countChainingReferences,
} from './catalog'
import type { K8sObject } from './api'

// ── Fixtures ─────────────────────────────────────────────────────────

function makeRGD(
  name: string,
  kind: string,
  templateKinds: string[] = [],
  labels: Record<string, string> = {},
  creationTimestamp = '2026-01-01T00:00:00Z',
): K8sObject {
  return {
    metadata: { name, labels, creationTimestamp },
    spec: {
      schema: { kind },
      resources: templateKinds.map((k) => ({ template: { kind: k } })),
    },
  }
}

// ── buildChainingMap ─────────────────────────────────────────────────

describe('buildChainingMap', () => {
  it('detects when RGD A references RGD B kind in its resources', () => {
    const database = makeRGD('database', 'Database')
    const app = makeRGD('full-stack-app', 'FullStackApp', ['Database'])

    const map = buildChainingMap([database, app])

    expect(map.get('database')).toEqual(['full-stack-app'])
    expect(map.has('full-stack-app')).toBe(false)
  })

  it('returns empty map when no chaining exists', () => {
    const a = makeRGD('service-a', 'ServiceA', ['Deployment', 'Service'])
    const b = makeRGD('service-b', 'ServiceB', ['Deployment'])

    const map = buildChainingMap([a, b])

    expect(map.size).toBe(0)
  })

  it('handles self-referencing RGD without infinite loop', () => {
    // An RGD whose template kind equals its own schema kind
    const selfRef = makeRGD('recursive', 'Recursive', ['Recursive'])

    const map = buildChainingMap([selfRef])

    // Self-references must be ignored
    expect(map.size).toBe(0)
    expect(map.has('recursive')).toBe(false)
  })

  it('handles multiple RGDs referencing the same RGD', () => {
    const db = makeRGD('database', 'Database')
    const appA = makeRGD('app-a', 'AppA', ['Database'])
    const appB = makeRGD('app-b', 'AppB', ['Database'])

    const map = buildChainingMap([db, appA, appB])

    const users = map.get('database') ?? []
    expect(users).toContain('app-a')
    expect(users).toContain('app-b')
    expect(users).toHaveLength(2)
  })

  it('handles an empty RGD list', () => {
    const map = buildChainingMap([])
    expect(map.size).toBe(0)
  })

  it('does not duplicate entries when the same kind appears multiple times', () => {
    const db = makeRGD('database', 'Database')
    // app has two resources both with kind=Database
    const app: K8sObject = {
      metadata: { name: 'app', labels: {} },
      spec: {
        schema: { kind: 'App' },
        resources: [{ template: { kind: 'Database' } }, { template: { kind: 'Database' } }],
      },
    }

    const map = buildChainingMap([db, app])
    const users = map.get('database') ?? []
    expect(users).toHaveLength(1)
    expect(users[0]).toBe('app')
  })
})

// ── extractLabels ─────────────────────────────────────────────────────

describe('extractLabels', () => {
  it('returns label map for a well-formed object', () => {
    const obj = makeRGD('x', 'X', [], { team: 'platform', tier: 'production' })
    expect(extractLabels(obj)).toEqual({ team: 'platform', tier: 'production' })
  })

  it('returns {} when metadata.labels is missing', () => {
    const obj: K8sObject = { metadata: { name: 'x' } }
    expect(extractLabels(obj)).toEqual({})
  })

  it('returns {} when metadata is missing', () => {
    const obj: K8sObject = {}
    expect(extractLabels(obj)).toEqual({})
  })
})

// ── extractTemplateKinds ─────────────────────────────────────────────

describe('extractTemplateKinds', () => {
  it('returns kinds from spec.resources[].template.kind', () => {
    const obj = makeRGD('x', 'X', ['Deployment', 'Service', 'ConfigMap'])
    expect(extractTemplateKinds(obj)).toEqual(['Deployment', 'Service', 'ConfigMap'])
  })

  it('returns [] when spec.resources is absent', () => {
    const obj: K8sObject = { spec: { schema: { kind: 'X' } } }
    expect(extractTemplateKinds(obj)).toEqual([])
  })

  it('skips resources without a template.kind', () => {
    const obj: K8sObject = {
      spec: {
        resources: [
          { template: { kind: 'Deployment' } },
          { template: {} }, // no kind
          { noTemplate: true }, // no template at all
          { template: { kind: '' } }, // empty string
        ],
      },
    }
    expect(extractTemplateKinds(obj)).toEqual(['Deployment'])
  })
})

// ── matchesSearch ─────────────────────────────────────────────────────

describe('matchesSearch', () => {
  it('matches by name (case-insensitive)', () => {
    const obj = makeRGD('user-database', 'UserDB')
    expect(matchesSearch(obj, 'database')).toBe(true)
    expect(matchesSearch(obj, 'DATABASE')).toBe(true)
  })

  it('matches by schema kind', () => {
    const obj = makeRGD('web-service', 'WebApp')
    expect(matchesSearch(obj, 'webapp')).toBe(true)
    expect(matchesSearch(obj, 'WebApp')).toBe(true)
  })

  it('matches by label value', () => {
    const obj = makeRGD('x', 'X', [], { team: 'platform' })
    expect(matchesSearch(obj, 'platform')).toBe(true)
  })

  it('returns true for empty query', () => {
    const obj = makeRGD('anything', 'Anything')
    expect(matchesSearch(obj, '')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    const obj = makeRGD('web-service', 'WebApp', [], { team: 'frontend' })
    expect(matchesSearch(obj, 'zzzzzz')).toBe(false)
  })
})

// ── matchesLabelFilter ────────────────────────────────────────────────

describe('matchesLabelFilter', () => {
  it('matches when all required labels are present', () => {
    const obj = makeRGD('x', 'X', [], { team: 'platform', tier: 'production' })
    expect(matchesLabelFilter(obj, ['team=platform', 'tier=production'])).toBe(true)
  })

  it('returns false when one required label is missing', () => {
    const obj = makeRGD('x', 'X', [], { team: 'platform' })
    expect(matchesLabelFilter(obj, ['team=platform', 'tier=production'])).toBe(false)
  })

  it('returns true for empty filter set', () => {
    const obj = makeRGD('x', 'X')
    expect(matchesLabelFilter(obj, [])).toBe(true)
  })

  it('returns false when label value does not match', () => {
    const obj = makeRGD('x', 'X', [], { team: 'security' })
    expect(matchesLabelFilter(obj, ['team=platform'])).toBe(false)
  })
})

// ── collectAllLabels ─────────────────────────────────────────────────

describe('collectAllLabels', () => {
  it('collects unique labels from all RGDs', () => {
    const a = makeRGD('a', 'A', [], { team: 'platform' })
    const b = makeRGD('b', 'B', [], { team: 'security', tier: 'production' })
    const result = collectAllLabels([a, b])
    expect(result).toContain('team=platform')
    expect(result).toContain('team=security')
    expect(result).toContain('tier=production')
    expect(result).toHaveLength(3)
  })

  it('deduplicates identical labels', () => {
    const a = makeRGD('a', 'A', [], { team: 'platform' })
    const b = makeRGD('b', 'B', [], { team: 'platform' })
    expect(collectAllLabels([a, b])).toEqual(['team=platform'])
  })

  it('returns [] for empty list', () => {
    expect(collectAllLabels([])).toEqual([])
  })
})

// ── sortCatalog ───────────────────────────────────────────────────────

describe('sortCatalog', () => {
  function makeEntry(name: string, kind: string, instanceCount: number | null, resources = 0, ts = '2026-01-01T00:00:00Z') {
    const rgd: K8sObject = {
      metadata: { name, creationTimestamp: ts },
      spec: {
        schema: { kind },
        resources: Array.from({ length: resources }, () => ({})),
      },
    }
    return { rgd, instanceCount }
  }

  /** Extract name without casting — reuses the library helper under test. */
  function nameOf(entry: { rgd: K8sObject }): string {
    const meta = entry.rgd.metadata
    if (typeof meta !== 'object' || meta === null) return ''
    const n = (meta as Record<string, unknown>).name
    return typeof n === 'string' ? n : ''
  }

  /** Extract schema kind without casting. */
  function kindOf(entry: { rgd: K8sObject }): string {
    const spec = entry.rgd.spec
    if (typeof spec !== 'object' || spec === null) return ''
    const schema = (spec as Record<string, unknown>).schema
    if (typeof schema !== 'object' || schema === null) return ''
    const k = (schema as Record<string, unknown>).kind
    return typeof k === 'string' ? k : ''
  }

  it('sorts by name A-Z', () => {
    const entries = [makeEntry('z-service', 'Z', 0), makeEntry('a-service', 'A', 0)]
    const result = sortCatalog(entries, 'name')
    expect(result[0].rgd.metadata).toMatchObject({ name: 'a-service' })
    expect(result[1].rgd.metadata).toMatchObject({ name: 'z-service' })
  })

  it('sorts by kind A-Z', () => {
    const entries = [makeEntry('x', 'Zebra', 0), makeEntry('y', 'Apple', 0)]
    const result = sortCatalog(entries, 'kind')
    expect(kindOf(result[0])).toBe('Apple')
    expect(kindOf(result[1])).toBe('Zebra')
  })

  it('sorts by instance count descending (most first)', () => {
    const entries = [
      makeEntry('a', 'A', 2),
      makeEntry('b', 'B', 10),
      makeEntry('c', 'C', 5),
    ]
    const result = sortCatalog(entries, 'instances')
    expect(result[0].instanceCount).toBe(10)
    expect(result[1].instanceCount).toBe(5)
    expect(result[2].instanceCount).toBe(2)
  })

  it('places null instance counts last when sorting by instances', () => {
    const entries = [
      makeEntry('a', 'A', null),
      makeEntry('b', 'B', 3),
    ]
    const result = sortCatalog(entries, 'instances')
    expect(result[0].instanceCount).toBe(3)
    expect(result[1].instanceCount).toBeNull()
  })

  it('sorts by resource count descending', () => {
    const entries = [
      makeEntry('a', 'A', 0, 1),
      makeEntry('b', 'B', 0, 5),
      makeEntry('c', 'C', 0, 3),
    ]
    const result = sortCatalog(entries, 'resources')
    expect(result.map(nameOf)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by newest first', () => {
    const entries = [
      makeEntry('old', 'Old', 0, 0, '2026-01-01T00:00:00Z'),
      makeEntry('new', 'New', 0, 0, '2026-03-01T00:00:00Z'),
    ]
    const result = sortCatalog(entries, 'newest')
    expect(nameOf(result[0])).toBe('new')
    expect(nameOf(result[1])).toBe('old')
  })

  it('does not mutate the original array', () => {
    const entries = [makeEntry('b', 'B', 0), makeEntry('a', 'A', 0)]
    const original = [...entries]
    sortCatalog(entries, 'name')
    expect(entries[0]).toBe(original[0])
    expect(entries[1]).toBe(original[1])
  })

  it('sorts by complexity descending (spec issue-768 O3)', () => {
    const entries = [
      { rgd: makeRGD('simple', 'Simple', []), instanceCount: 0, complexityScore: 1 },
      { rgd: makeRGD('complex', 'Complex', []), instanceCount: 0, complexityScore: 10 },
      { rgd: makeRGD('medium', 'Medium', []), instanceCount: 0, complexityScore: 5 },
    ]
    const result = sortCatalog(entries, 'complexity')
    expect(result.map((e) => (e.rgd.metadata as Record<string, unknown>)?.name))
      .toEqual(['complex', 'medium', 'simple'])
  })
})

// ── computeComplexityScore (spec issue-768 28.2 O1, O6) ──────────────

function makeRGDWithForEach(name: string, resources: Array<{ kind: string; forEach?: string }>): K8sObject {
  return {
    metadata: { name },
    spec: {
      schema: { kind: name + 'Kind' },
      resources: resources.map((r) =>
        r.forEach
          ? { template: { kind: r.kind }, forEach: r.forEach }
          : { template: { kind: r.kind } },
      ),
    },
  }
}

describe('computeComplexityScore', () => {
  it('returns 0 for an RGD with no resources', () => {
    const rgd: K8sObject = { metadata: { name: 'empty' }, spec: { schema: { kind: 'Empty' }, resources: [] } }
    expect(computeComplexityScore(rgd, 0)).toBe(0)
  })

  it('counts resources correctly (no forEach, no chaining)', () => {
    const rgd = makeRGDWithForEach('app', [{ kind: 'Deployment' }, { kind: 'Service' }])
    expect(computeComplexityScore(rgd, 0)).toBe(2)
  })

  it('adds 3 per forEach resource', () => {
    // 2 resources + 1 forEach: 2 + 3 = 5
    const rgd = makeRGDWithForEach('app', [
      { kind: 'Deployment' },
      { kind: 'Pod', forEach: 'items' },
    ])
    expect(computeComplexityScore(rgd, 0)).toBe(5)
  })

  it('adds 2 per chaining reference', () => {
    // 1 resource + 2 chains: 1 + 4 = 5
    const rgd = makeRGDWithForEach('app', [{ kind: 'Deployment' }])
    expect(computeComplexityScore(rgd, 2)).toBe(5)
  })

  it('combines resources + forEach + chaining', () => {
    // 3 resources + 2 forEach + 1 chaining: 3 + 6 + 2 = 11
    const rgd = makeRGDWithForEach('complex', [
      { kind: 'Deployment' },
      { kind: 'Pod', forEach: 'pods' },
      { kind: 'ConfigMap', forEach: 'configs' },
    ])
    expect(computeComplexityScore(rgd, 1)).toBe(11)
  })

  it('handles missing spec gracefully', () => {
    const rgd: K8sObject = { metadata: { name: 'no-spec' } }
    expect(computeComplexityScore(rgd, 0)).toBe(0)
  })
})

describe('countChainingReferences', () => {
  it('returns 0 when no template kinds match any other RGD schema', () => {
    const app = makeRGD('app', 'App', ['Deployment'])
    const db = makeRGD('db', 'Database', ['StatefulSet'])
    expect(countChainingReferences(app, [app, db])).toBe(0)
  })

  it('counts references to other RGD schema kinds', () => {
    const db = makeRGD('db', 'Database', [])
    const app = makeRGD('app', 'App', ['Database', 'Service'])
    expect(countChainingReferences(app, [app, db])).toBe(1)
  })

  it('does not count self-reference', () => {
    const self = makeRGD('self', 'Self', ['Self'])
    expect(countChainingReferences(self, [self])).toBe(0)
  })
})
