import { describe, it, expect } from 'vitest'
import {
  buildDAGGraph,
  detectKroInstance,
  detectCollapseGroups,
  findChainedRgdName,
  buildChainSubgraph,
  forEachLabel,
  nodeBadge,
  COLLECTION_NODE_HEIGHT,
  FOREACH_LABEL_MAX_CHARS,
  type NodeType,
  type DAGNode,
} from './dag'

// ── Helpers ───────────────────────────────────────────────────────────────

function minimalSpec(resources: unknown[] = []) {
  return {
    schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'test.dev' },
    resources,
  }
}

// ── T002: Template resource → NodeTypeResource ────────────────────────────

describe('buildDAGGraph', () => {
  it('T002: classifies template resource as NodeTypeResource', () => {
    const spec = minimalSpec([
      {
        id: 'appNamespace',
        template: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: '${schema.spec.appName}' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    expect(graph.nodes).toHaveLength(2)
    const root = graph.nodes.find((n) => n.id === 'schema')
    const res = graph.nodes.find((n) => n.id === 'appNamespace')
    expect(root?.nodeType).toBe('instance')
    expect(res?.nodeType).toBe('resource')
    expect(res?.kind).toBe('Namespace')
  })

  // ── T003: Template + forEach → NodeTypeCollection ─────────────────────

  it('T003: classifies template+forEach resource as NodeTypeCollection', () => {
    const spec = minimalSpec([
      {
        id: 'appReplicas',
        forEach: '${schema.spec.items}',
        template: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: '${schema.spec.appName}' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'appReplicas')
    expect(node?.nodeType).toBe('collection')
    expect(node?.forEach).toBe('${schema.spec.items}')
  })

  // ── T004: externalRef.metadata.name → NodeTypeExternal ───────────────

  it('T004: classifies externalRef.metadata.name as NodeTypeExternal', () => {
    const spec = minimalSpec([
      {
        id: 'existingDb',
        externalRef: {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'postgres', namespace: 'default' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'existingDb')
    expect(node?.nodeType).toBe('external')
    expect(node?.kind).toBe('Service')
  })

  // ── T005: externalRef.metadata.selector → NodeTypeExternalCollection ──

  it('T005: classifies externalRef.metadata.selector as NodeTypeExternalCollection', () => {
    const spec = minimalSpec([
      {
        id: 'workers',
        externalRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            selector: { matchLabels: { role: 'worker' } },
            namespace: 'default',
          },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'workers')
    expect(node?.nodeType).toBe('externalCollection')
  })

  // ── T006: includeWhen → isConditional=true, nodeType still 'resource' ─

  it('T006: marks includeWhen resources with isConditional=true (not a separate type)', () => {
    const spec = minimalSpec([
      {
        id: 'appConfig',
        includeWhen: ['${schema.spec.enableConfig}'],
        template: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: '${schema.spec.appName}-config' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'appConfig')
    expect(node?.isConditional).toBe(true)
    expect(node?.nodeType).toBe('resource') // NOT a separate type per FR-004
    expect(node?.includeWhen).toEqual(['${schema.spec.enableConfig}'])
  })

  // ── T006c: contagious includeWhen propagation ─────────────────────────

  it('T006c: marks downstream dependents of a conditional node as isConditional=true (contagious exclusion)', () => {
    // parentDeploy has includeWhen; childConfig references ${parentDeploy.metadata.name}
    // so it depends on parentDeploy. When parent is excluded, child should also be
    // rendered as conditional (contagious exclusion — upstream kro semantics).
    const spec = minimalSpec([
      {
        id: 'parentDeploy',
        includeWhen: ['${schema.spec.enableParent}'],
        template: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: '${schema.spec.name}-deploy' },
          spec: {},
        },
      },
      {
        id: 'childConfig',
        template: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: '${schema.spec.name}-config' },
          data: { deployName: '${parentDeploy.metadata.name}' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const parent = graph.nodes.find((n) => n.id === 'parentDeploy')
    const child = graph.nodes.find((n) => n.id === 'childConfig')
    expect(parent?.isConditional).toBe(true)
    // Contagious: child references parent → child is also conditional
    expect(child?.isConditional).toBe(true)
    // An edge must exist from parentDeploy → childConfig
    const edge = graph.edges.find((e) => e.from === 'parentDeploy' && e.to === 'childConfig')
    expect(edge).toBeDefined()
  })

  // ── T006b: state: block → NodeTypeState ('state') — issue #94/#95 ─────

  it('T006b: classifies state: block (no template) as NodeTypeState', () => {
    const spec = minimalSpec([
      {
        id: 'dungeonInit',
        state: {
          fields: {
            heroHP: '${200}',
            bossHP: '${400}',
          },
          storeName: 'game',
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'dungeonInit')
    expect(node?.nodeType).toBe('state')
  })

  it('T006c: state node kind falls back to nodeId (never "?") — §XII fix #94', () => {
    const spec = minimalSpec([
      {
        id: 'combatResolve',
        state: {
          fields: { heroHP: '${0}' },
          storeName: 'game',
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'combatResolve')
    // state node has no template.kind → falls back to nodeId
    expect(node?.kind).toBe('combatResolve')
    expect(node?.kind).not.toBe('?')
    expect(node?.kind).not.toBe('')
  })

  it('T006d: state node CEL expressions extracted from state.fields', () => {
    const spec = minimalSpec([
      {
        id: 'tickDoT',
        includeWhen: ['${schema.spec.attackSeq > 0}'],
        state: {
          fields: {
            heroHP: '${kstate(schema.status.game, "heroHP", 0) - 5}',
          },
          storeName: 'game',
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'tickDoT')
    expect(node?.nodeType).toBe('state')
    expect(node?.isConditional).toBe(true)
    // CEL expressions from state.fields should be collected
    expect(node?.celExpressions.length).toBeGreaterThan(0)
  })

  // ── T007: CEL cross-reference → edge from dependency to dependent ─────

  it('T007: creates edges for direct CEL references between resources', () => {
    const spec = minimalSpec([
      {
        id: 'resourceA',
        template: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: '${schema.spec.appName}' },
        },
      },
      {
        id: 'resourceB',
        template: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: '${schema.spec.appName}-cfg',
            namespace: '${resourceA.metadata.name}',
          },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    // There should be an edge from resourceA to resourceB
    const edge = graph.edges.find(
      (e) => e.from === 'resourceA' && e.to === 'resourceB',
    )
    expect(edge).toBeDefined()
  })

  // ── T008: Determinism — same input → same positions ───────────────────

  it('T008: is deterministic — same input produces same node positions', () => {
    const spec = minimalSpec([
      {
        id: 'ns',
        template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: '${schema.spec.appName}' } },
      },
      {
        id: 'cm',
        template: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: '${schema.spec.appName}', namespace: '${ns.metadata.name}' },
        },
      },
    ])

    const g1 = buildDAGGraph(spec)
    const g2 = buildDAGGraph(spec)

    for (const n1 of g1.nodes) {
      const n2 = g2.nodes.find((n) => n.id === n1.id)
      expect(n2).toBeDefined()
      expect(n1.x).toBe(n2!.x)
      expect(n1.y).toBe(n2!.y)
    }
    expect(g1.width).toBe(g2.width)
    expect(g1.height).toBe(g2.height)
  })

  // ── T009: Unknown structure → 'resource' fallback, never 'specPatch' ──

  it('T009: does NOT produce a specPatch node type for any input', () => {
    const spec = minimalSpec([
      {
        id: 'weirdResource',
        // No template, no externalRef — unknown structure
        someUnknownField: { value: 'test' },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'weirdResource')
    expect(node?.nodeType).toBe('resource') // fallback
    // Ensure 'specPatch' never appears in any node
    for (const n of graph.nodes) {
      expect(n.nodeType).not.toBe('specPatch' as never)
    }
  })

  // ── T010: Empty resources → only root node, no edges ─────────────────

  it('T010: empty spec.resources returns only root instance node with no edges', () => {
    const specNull = { schema: { kind: 'App', apiVersion: 'v1alpha1' }, resources: null }
    const specEmpty = minimalSpec([])

    const g1 = buildDAGGraph(specNull as Record<string, unknown>)
    expect(g1.nodes).toHaveLength(1)
    expect(g1.nodes[0].nodeType).toBe('instance')
    expect(g1.edges).toHaveLength(0)

    const g2 = buildDAGGraph(specEmpty)
    expect(g2.nodes).toHaveLength(1)
    expect(g2.edges).toHaveLength(0)
  })

  // ── T011: Root node always present with correct fields ────────────────

  it('T011: root instance node is always present with nodeType instance and id schema', () => {
    const spec = {
      schema: { kind: 'MyApp', apiVersion: 'v1alpha1', group: 'my.dev' },
      resources: [
        {
          id: 'ns',
          template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: '${schema.spec.name}' } },
        },
      ],
    }
    const graph = buildDAGGraph(spec)
    const root = graph.nodes.find((n) => n.id === 'schema')
    expect(root).toBeDefined()
    expect(root?.nodeType).toBe('instance')
    expect(root?.id).toBe('schema')
    expect(root?.kind).toBe('MyApp')
  })
})

// ── detectKroInstance ─────────────────────────────────────────────────────

function makeRGD(schemaKind: string, name = 'test-rgd') {
  return {
    metadata: { name },
    spec: { schema: { kind: schemaKind, apiVersion: 'v1alpha1' }, resources: [] },
  }
}

describe('detectKroInstance', () => {
  // T012: returns true for matching RGD schema kind
  it('T012: returns true when kind matches an existing RGD schema kind', () => {
    const rgds = [makeRGD('Database'), makeRGD('WebApplication')]
    expect(detectKroInstance('Database', rgds)).toBe(true)
    expect(detectKroInstance('WebApplication', rgds)).toBe(true)
  })

  // T013: returns false for native k8s kinds
  it('T013: returns false for native Kubernetes kinds not in RGD list', () => {
    const rgds = [makeRGD('Database')]
    expect(detectKroInstance('Deployment', rgds)).toBe(false)
    expect(detectKroInstance('Service', rgds)).toBe(false)
    expect(detectKroInstance('ConfigMap', rgds)).toBe(false)
  })

  // T014: returns false when rgds is empty
  it('T014: returns false when rgds list is empty', () => {
    expect(detectKroInstance('Database', [])).toBe(false)
    expect(detectKroInstance('', [])).toBe(false)
  })

  // T015: is case-sensitive
  it('T015: is case-sensitive — does not match lowercase or mismatched case', () => {
    const rgds = [makeRGD('Database')]
    expect(detectKroInstance('database', rgds)).toBe(false)
    expect(detectKroInstance('DATABASE', rgds)).toBe(false)
    expect(detectKroInstance('Database', rgds)).toBe(true)
  })
})

// ── #58: kind fallback — never render '?' ─────────────────────────────────

describe('buildDAGGraph — kind fallback (issue #58)', () => {
  it('uses id as kind when template.kind is absent', () => {
    const spec = minimalSpec([
      {
        id: 'dungeonInit',
        template: {
          apiVersion: 'dungeon.run/v1alpha1',
          // kind is absent — should fall back to node id
          metadata: { name: '${schema.spec.name}' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'dungeonInit')
    expect(node?.kind).toBe('dungeonInit')
    expect(node?.kind).not.toBe('')
    expect(node?.kind).not.toBe('?')
  })

  it('uses id as kind when template.kind is a CEL expression (non-string literal)', () => {
    const spec = minimalSpec([
      {
        id: 'combatResolve',
        template: {
          apiVersion: 'dungeon.run/v1alpha1',
          kind: '${schema.spec.actionKind}', // CEL expression — still a string, accepted as-is
          metadata: { name: '${schema.spec.name}' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'combatResolve')
    // CEL string is returned as-is (not empty), not replaced with nodeId
    expect(node?.kind).toBe('${schema.spec.actionKind}')
  })

  it('uses externalRef.kind when template is absent and externalRef is present', () => {
    const spec = minimalSpec([
      {
        id: 'existingSecret',
        externalRef: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name: 'my-secret' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'existingSecret')
    expect(node?.kind).toBe('Secret')
  })

  it('uses id as kind when externalRef.kind is absent', () => {
    const spec = minimalSpec([
      {
        id: 'orphanRef',
        externalRef: {
          apiVersion: 'v1',
          // kind absent
          metadata: { name: 'my-resource' },
        },
      },
    ])
    const graph = buildDAGGraph(spec)
    const node = graph.nodes.find((n) => n.id === 'orphanRef')
    expect(node?.kind).toBe('orphanRef')
    expect(node?.kind).not.toBe('')
  })
})

// ── detectCollapseGroups ──────────────────────────────────────────────────

describe('detectCollapseGroups', () => {
  // Helper: build a resource with a given kind and top-level template keys
  function makeResource(
    id: string,
    kind: string,
    keys: string[] = ['spec', 'metadata'],
    opts: { apiVersion?: string; forEach?: string } = {},
  ) {
    const template: Record<string, unknown> = {
      apiVersion: opts.apiVersion ?? 'apps/v1',
      kind,
    }
    for (const k of keys) template[k] = {}
    const r: Record<string, unknown> = { id, template }
    if (opts.forEach !== undefined) r.forEach = opts.forEach
    return r
  }

  it('returns empty array for undefined spec', () => {
    expect(detectCollapseGroups(undefined)).toEqual([])
  })

  it('returns empty array for null spec', () => {
    expect(detectCollapseGroups(null)).toEqual([])
  })

  it('returns empty array for non-object spec', () => {
    expect(detectCollapseGroups('string')).toEqual([])
    expect(detectCollapseGroups(42)).toEqual([])
  })

  it('returns empty array for spec with no resources', () => {
    expect(detectCollapseGroups({})).toEqual([])
    expect(detectCollapseGroups({ resources: [] })).toEqual([])
  })

  it('returns empty array for RGD with all unique kinds', () => {
    const spec = minimalSpec([
      makeResource('svc', 'Service'),
      makeResource('dep', 'Deployment'),
      makeResource('cm', 'ConfigMap'),
    ])
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('detects 3 Deployments of same apiVersion as a single candidate group', () => {
    const spec = minimalSpec([
      makeResource('d1', 'Deployment'),
      makeResource('d2', 'Deployment'),
      makeResource('d3', 'Deployment'),
    ])
    const groups = detectCollapseGroups(spec)
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('Deployment')
    expect(groups[0].apiVersion).toBe('apps/v1')
    expect(groups[0].nodeIds).toHaveLength(3)
    expect(groups[0].nodeIds).toContain('d1')
    expect(groups[0].nodeIds).toContain('d2')
    expect(groups[0].nodeIds).toContain('d3')
  })

  it('detects 2 ConfigMaps with >=70% key overlap as a candidate group', () => {
    // Both have keys: spec, metadata, data — 100% overlap
    const spec = minimalSpec([
      makeResource('cm1', 'ConfigMap', ['metadata', 'data'], { apiVersion: 'v1' }),
      makeResource('cm2', 'ConfigMap', ['metadata', 'data'], { apiVersion: 'v1' }),
    ])
    const groups = detectCollapseGroups(spec)
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('ConfigMap')
    expect(groups[0].nodeIds).toEqual(['cm1', 'cm2'])
  })

  it('does NOT flag 2 ConfigMaps with <70% key overlap', () => {
    // cm1 has keys: [a,b,c,d,e], cm2 has keys: [f,g,h,i,j]
    // intersection=0, union=10, Jaccard=0 < 0.70
    const spec = minimalSpec([
      makeResource('cm1', 'ConfigMap', ['a', 'b', 'c', 'd', 'e'], { apiVersion: 'v1' }),
      makeResource('cm2', 'ConfigMap', ['f', 'g', 'h', 'i', 'j'], { apiVersion: 'v1' }),
    ])
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('excludes NodeTypeCollection nodes (forEach present) from analysis', () => {
    const spec = minimalSpec([
      makeResource('d1', 'Deployment', ['metadata', 'spec'], { forEach: '${schema.spec.items}' }),
      makeResource('d2', 'Deployment', ['metadata', 'spec']),
    ])
    // Only d2 qualifies (d1 is NodeTypeCollection); group needs ≥2 → no group
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('excludes NodeTypeExternal nodes from analysis', () => {
    // externalRef resources should not be included even if same kind
    const spec = minimalSpec([
      {
        id: 'ext1',
        externalRef: { apiVersion: 'v1', kind: 'Service', metadata: { name: 'svc1' } },
      },
      {
        id: 'ext2',
        externalRef: { apiVersion: 'v1', kind: 'Service', metadata: { name: 'svc2' } },
      },
    ])
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('groups by apiVersion+kind, not kind alone', () => {
    // Same kind "Deployment" but different apiVersions → separate groups → neither has ≥2
    const spec = minimalSpec([
      makeResource('d1', 'Deployment', ['metadata', 'spec'], { apiVersion: 'apps/v1' }),
      makeResource('d2', 'Deployment', ['metadata', 'spec'], { apiVersion: 'apps/v2alpha1' }),
    ])
    // Two groups of 1 each → no output
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('handles missing template field gracefully (no throw)', () => {
    // Resource with no template and no externalRef classifies as 'resource' but has no kind
    const spec = minimalSpec([
      { id: 'r1' },
      { id: 'r2' },
    ])
    expect(() => detectCollapseGroups(spec)).not.toThrow()
    // No kind resolvable → no groups
    expect(detectCollapseGroups(spec)).toEqual([])
  })

  it('handles missing apiVersion in template — groups on kind alone with empty apiVersion', () => {
    const spec = minimalSpec([
      {
        id: 'r1',
        template: { kind: 'Deployment', metadata: {}, spec: {} },
      },
      {
        id: 'r2',
        template: { kind: 'Deployment', metadata: {}, spec: {} },
      },
      {
        id: 'r3',
        template: { kind: 'Deployment', metadata: {}, spec: {} },
      },
    ])
    const groups = detectCollapseGroups(spec)
    expect(groups).toHaveLength(1)
    expect(groups[0].apiVersion).toBe('')
    expect(groups[0].kind).toBe('Deployment')
    expect(groups[0].nodeIds).toHaveLength(3)
  })

  it('returns multiple groups when multiple qualifying sets exist', () => {
    const spec = minimalSpec([
      makeResource('d1', 'Deployment'),
      makeResource('d2', 'Deployment'),
      makeResource('d3', 'Deployment'),
      makeResource('cm1', 'ConfigMap', ['metadata', 'data'], { apiVersion: 'v1' }),
      makeResource('cm2', 'ConfigMap', ['metadata', 'data'], { apiVersion: 'v1' }),
    ])
    const groups = detectCollapseGroups(spec)
    expect(groups).toHaveLength(2)
    const depGroup = groups.find((g) => g.kind === 'Deployment')
    const cmGroup = groups.find((g) => g.kind === 'ConfigMap')
    expect(depGroup).toBeDefined()
    expect(depGroup?.nodeIds).toHaveLength(3)
    expect(cmGroup).toBeDefined()
    expect(cmGroup?.nodeIds).toHaveLength(2)
  })

  it('excludes resources that already have a forEach field', () => {
    // d1 has forEach (NodeTypeCollection) → excluded; d2+d3 are resources
    const spec = minimalSpec([
      makeResource('d1', 'Deployment', ['metadata', 'spec'], { forEach: '${schema.spec.items}' }),
      makeResource('d2', 'Deployment', ['metadata', 'spec']),
      makeResource('d3', 'Deployment', ['metadata', 'spec']),
    ])
    // Only d2 and d3 qualify — group of 2, 100% key overlap → qualifies
    const groups = detectCollapseGroups(spec)
    expect(groups).toHaveLength(1)
    expect(groups[0].nodeIds).not.toContain('d1')
    expect(groups[0].nodeIds).toContain('d2')
    expect(groups[0].nodeIds).toContain('d3')
  })
})

// ── T006: findChainedRgdName ──────────────────────────────────────────────

describe('findChainedRgdName (spec 025)', () => {
  const rgds = [
    { metadata: { name: 'database-rgd' }, spec: { schema: { kind: 'Database' }, resources: [] } },
    { metadata: { name: 'cache-rgd' }, spec: { schema: { kind: 'Cache' }, resources: [] } },
  ]

  it('returns undefined for empty kind', () => {
    expect(findChainedRgdName('', rgds)).toBeUndefined()
  })

  it('returns undefined for empty rgds list', () => {
    expect(findChainedRgdName('Database', [])).toBeUndefined()
  })

  it('returns RGD metadata.name on exact kind match', () => {
    expect(findChainedRgdName('Database', rgds)).toBe('database-rgd')
    expect(findChainedRgdName('Cache', rgds)).toBe('cache-rgd')
  })

  it('returns undefined when kind does not match any RGD', () => {
    expect(findChainedRgdName('Deployment', rgds)).toBeUndefined()
    expect(findChainedRgdName('database', rgds)).toBeUndefined() // case-sensitive
  })

  it('returns first match when multiple RGDs share the same schema kind', () => {
    const dupeRgds = [
      { metadata: { name: 'first-rgd' }, spec: { schema: { kind: 'Database' }, resources: [] } },
      { metadata: { name: 'second-rgd' }, spec: { schema: { kind: 'Database' }, resources: [] } },
    ]
    expect(findChainedRgdName('Database', dupeRgds)).toBe('first-rgd')
  })

  it('never throws for malformed RGD objects (missing metadata, spec, schema)', () => {
    const malformed = [
      {},
      { metadata: null },
      { metadata: { name: 'x' }, spec: null },
      { metadata: { name: 'y' }, spec: { schema: null } },
      { metadata: { name: 'z' }, spec: { schema: { kind: 42 } } }, // kind not a string
    ]
    expect(() => findChainedRgdName('Anything', malformed)).not.toThrow()
    expect(findChainedRgdName('Anything', malformed)).toBeUndefined()
  })
})

// ── T007: buildChainSubgraph ──────────────────────────────────────────────

describe('buildChainSubgraph (spec 025)', () => {
  const childRgdSpec = {
    schema: { kind: 'ChainChild', apiVersion: 'v1alpha1' },
    resources: [
      { id: 'configMap', template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'cm' } } },
      { id: 'serviceAccount', template: { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: 'sa' } } },
    ],
  }
  const rgds = [
    { metadata: { name: 'chain-child' }, spec: childRgdSpec },
  ]

  it('returns null when rgdName is not found', () => {
    expect(buildChainSubgraph('nonexistent', rgds)).toBeNull()
    expect(buildChainSubgraph('', rgds)).toBeNull()
    expect(buildChainSubgraph('chain-child', [])).toBeNull()
  })

  it('returns a valid DAGGraph with root instance node when found', () => {
    const graph = buildChainSubgraph('chain-child', rgds)
    expect(graph).not.toBeNull()
    expect(graph!.nodes[0].nodeType).toBe('instance')
    expect(graph!.nodes[0].id).toBe('schema')
  })

  it('returns graph with correct number of nodes (root + 2 resources)', () => {
    const graph = buildChainSubgraph('chain-child', rgds)
    expect(graph!.nodes).toHaveLength(3)
  })

  it('detects nested chainable nodes recursively when rgds is passed back', () => {
    // chain-child has a resource of kind Database, and there is a database-rgd
    const nestedRgdSpec = {
      schema: { kind: 'ChainChild', apiVersion: 'v1alpha1' },
      resources: [
        { id: 'db', template: { apiVersion: 'v1', kind: 'Database', metadata: { name: 'db' } } },
      ],
    }
    const nestedRgds = [
      { metadata: { name: 'chain-child-nested' }, spec: nestedRgdSpec },
      { metadata: { name: 'database-rgd' }, spec: { schema: { kind: 'Database' }, resources: [] } },
    ]
    const graph = buildChainSubgraph('chain-child-nested', nestedRgds)
    expect(graph).not.toBeNull()
    const dbNode = graph!.nodes.find((n) => n.id === 'db')
    expect(dbNode?.isChainable).toBe(true)
    expect(dbNode?.chainedRgdName).toBe('database-rgd')
  })
})

// ── T008: buildDAGGraph with rgds (chain detection) ───────────────────────

describe('buildDAGGraph chain detection (spec 025)', () => {
  const rgds = [
    { metadata: { name: 'database-rgd' }, spec: { schema: { kind: 'Database' }, resources: [] } },
  ]

  it('root node always has isChainable=false even when its kind matches an RGD', () => {
    // Edge case: a Database RGD has root kind Database — root is still never chainable
    const spec = { schema: { kind: 'Database', apiVersion: 'v1alpha1' }, resources: [] }
    const graph = buildDAGGraph(spec, rgds)
    const root = graph.nodes.find((n) => n.id === 'schema')
    expect(root?.isChainable).toBe(false)
    expect(root?.chainedRgdName).toBeUndefined()
  })

  it('non-root node whose kind matches an RGD gets isChainable=true and correct chainedRgdName', () => {
    const spec = minimalSpec([
      { id: 'db', template: { apiVersion: 'v1', kind: 'Database', metadata: { name: 'db' } } },
    ])
    const graph = buildDAGGraph(spec, rgds)
    const node = graph.nodes.find((n) => n.id === 'db')
    expect(node?.isChainable).toBe(true)
    expect(node?.chainedRgdName).toBe('database-rgd')
  })

  it('non-root node with no matching RGD has isChainable=false', () => {
    const spec = minimalSpec([
      { id: 'ns', template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'ns' } } },
    ])
    const graph = buildDAGGraph(spec, rgds)
    const node = graph.nodes.find((n) => n.id === 'ns')
    expect(node?.isChainable).toBe(false)
    expect(node?.chainedRgdName).toBeUndefined()
  })

  it('all nodes have isChainable=false when called without rgds (backward compat)', () => {
    const spec = minimalSpec([
      { id: 'db', template: { apiVersion: 'v1', kind: 'Database', metadata: { name: 'db' } } },
    ])
    const graph = buildDAGGraph(spec) // no rgds
    for (const node of graph.nodes) {
      expect(node.isChainable).toBe(false)
      expect(node.chainedRgdName).toBeUndefined()
    }
  })

  it('multiple chainable and non-chainable nodes are correctly classified', () => {
    const spec = minimalSpec([
      { id: 'db', template: { apiVersion: 'v1', kind: 'Database', metadata: { name: 'db' } } },
      { id: 'ns', template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'ns' } } },
    ])
    const graph = buildDAGGraph(spec, rgds)
    const dbNode = graph.nodes.find((n) => n.id === 'db')
    const nsNode = graph.nodes.find((n) => n.id === 'ns')
    expect(dbNode?.isChainable).toBe(true)
    expect(nsNode?.isChainable).toBe(false)
  })
})

// ── forEachLabel ──────────────────────────────────────────────────────────

describe('forEachLabel', () => {
  it('returns empty string for undefined', () => {
    expect(forEachLabel(undefined)).toBe('')
  })
  it('returns empty string for empty string', () => {
    expect(forEachLabel('')).toBe('')
  })
  it('returns expression unchanged when at or below max chars', () => {
    const expr = '${schema.spec.regions}'
    expect(forEachLabel(expr)).toBe(expr)
  })
  it('returns expression unchanged when exactly at max chars', () => {
    const expr = 'a'.repeat(FOREACH_LABEL_MAX_CHARS)
    expect(forEachLabel(expr)).toBe(expr)
  })
  it('truncates expressions longer than max chars with ellipsis', () => {
    const expr = 'a'.repeat(FOREACH_LABEL_MAX_CHARS + 5)
    const result = forEachLabel(expr)
    expect(result.length).toBe(FOREACH_LABEL_MAX_CHARS)
    expect(result.endsWith('…')).toBe(true)
  })
})

// ── nodeBadge ─────────────────────────────────────────────────────────────

describe('nodeBadge', () => {
  function makeNode(overrides: Partial<DAGNode>): DAGNode {
    return {
      id: 'test', label: 'test', nodeType: 'resource' as NodeType,
      kind: 'ConfigMap', isConditional: false, hasReadyWhen: false,
      isChainable: false, celExpressions: [], includeWhen: [], readyWhen: [],
      x: 0, y: 0, width: 180, height: 48, ...overrides,
    }
  }
  it('returns null for resource nodes', () => { expect(nodeBadge(makeNode({ nodeType: 'resource' }))).toBeNull() })
  it('returns null for instance (root) nodes', () => { expect(nodeBadge(makeNode({ nodeType: 'instance' }))).toBeNull() })
  it('returns ∀ for collection nodes', () => { expect(nodeBadge(makeNode({ nodeType: 'collection' }))).toBe('∀') })
  it('returns ⬡ for external nodes', () => { expect(nodeBadge(makeNode({ nodeType: 'external' }))).toBe('⬡') })
  it('returns ⬡ for externalCollection nodes', () => { expect(nodeBadge(makeNode({ nodeType: 'externalCollection' }))).toBe('⬡') })
  it('returns ? for conditional nodes regardless of type', () => {
    expect(nodeBadge(makeNode({ nodeType: 'collection', isConditional: true }))).toBe('?')
    expect(nodeBadge(makeNode({ nodeType: 'resource', isConditional: true }))).toBe('?')
  })
})

// ── COLLECTION_NODE_HEIGHT and forEach format ─────────────────────────────

describe('buildDAGGraph — collection node height and forEach format', () => {
  function minimalSpec(resources: unknown[] = []) {
    return { schema: { kind: 'WebApp', apiVersion: 'v1alpha1', group: 'test.dev' }, resources }
  }

  it('assigns COLLECTION_NODE_HEIGHT to collection nodes (legacy string format)', () => {
    const spec = minimalSpec([{
      id: 'col', forEach: '${schema.spec.items}',
      template: { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'pod' } },
    }])
    const node = buildDAGGraph(spec).nodes.find((n) => n.id === 'col')
    expect(node?.nodeType).toBe('collection')
    expect(node?.height).toBe(COLLECTION_NODE_HEIGHT)
    expect(COLLECTION_NODE_HEIGHT).toBeGreaterThan(48)
  })

  it('assigns COLLECTION_NODE_HEIGHT to collection nodes (kro v0.8.5+ array format)', () => {
    const spec = minimalSpec([{
      id: 'regionConfig',
      forEach: [{ region: '${schema.spec.regions}' }],
      template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: '${region}-cfg' } },
    }])
    const node = buildDAGGraph(spec).nodes.find((n) => n.id === 'regionConfig')
    expect(node?.nodeType).toBe('collection')
    expect(node?.height).toBe(COLLECTION_NODE_HEIGHT)
    expect(node?.forEach).toBe('region: ${schema.spec.regions}')
  })

  it('assigns standard NODE_HEIGHT (48) to non-collection nodes', () => {
    const spec = minimalSpec([{
      id: 'ns', template: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'x' } },
    }])
    const node = buildDAGGraph(spec).nodes.find((n) => n.id === 'ns')
    expect(node?.height).toBe(48)
  })

  it('collection node is taller than resource node', () => {
    const spec = minimalSpec([
      { id: 'col', forEach: [{ r: '${schema.spec.x}' }],
        template: { apiVersion: 'v1', kind: 'Pod', metadata: { name: 'p' } } },
      { id: 'res', template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'c' } } },
    ])
    const g = buildDAGGraph(spec)
    expect(g.nodes.find((n) => n.id === 'col')!.height)
      .toBeGreaterThan(g.nodes.find((n) => n.id === 'res')!.height)
  })
})
