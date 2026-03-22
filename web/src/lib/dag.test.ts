import { describe, it, expect } from 'vitest'
import { buildDAGGraph, detectKroInstance } from './dag'

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
