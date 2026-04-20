// dag-diff.test.ts — Unit tests for diffDAGGraphs() (spec 009-rgd-graph-diff).
//
// Tests cover all 6 required cases from spec.md Testing Requirements, plus
// edge cases and NFR-001 (performance).

import { describe, it, expect } from 'vitest'
import { buildDAGGraph } from './dag'
import type { DAGGraph } from './dag'
import { diffDAGGraphs } from './dag-diff'
import type { DiffGraph } from './dag-diff'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Minimal RGD spec with a given set of resources. */
function spec(resources: unknown[]) {
  return {
    schema: { kind: 'TestKind', apiVersion: 'v1alpha1' },
    resources,
  }
}

function resourceNode(id: string, kind = 'ConfigMap', extra?: Record<string, unknown>) {
  return {
    id,
    template: { apiVersion: 'v1', kind, metadata: { name: `${id}-name` } },
    ...extra,
  }
}

function conditionalNode(id: string, includeWhen: string[]) {
  return {
    id,
    template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: id } },
    includeWhen,
  }
}

function readyWhenNode(id: string, readyWhen: string[]) {
  return {
    id,
    template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: id } },
    readyWhen,
  }
}

function collectionNode(id: string, forEach: string) {
  return {
    id,
    forEach,
    template: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: id } },
  }
}

/** Build a graph from a resource list. */
function g(resources: unknown[]): DAGGraph {
  return buildDAGGraph(spec(resources))
}

/** Find a node by id in a DiffGraph (throws if absent). */
function findNode(dg: DiffGraph, id: string) {
  const n = dg.nodes.find((n) => n.id === id)
  if (!n) throw new Error(`Node ${id} not found in DiffGraph`)
  return n
}

/** Find an edge by from+to in a DiffGraph. */
function findEdge(dg: DiffGraph, from: string, to: string) {
  return dg.edges.find((e) => e.from === from && e.to === to)
}

// ── Required test cases (spec.md Testing Requirements) ───────────────────

describe('diffDAGGraphs', () => {
  // ── Case 1: node present in B but not A → added ───────────────────────

  it('classifies node present in B but not A as added', () => {
    const gA = g([resourceNode('ns')])
    const gB = g([resourceNode('ns'), resourceNode('deploy', 'Deployment')])

    const diff = diffDAGGraphs(gA, gB)
    const added = findNode(diff, 'deploy')
    expect(added.diffStatus).toBe('added')
    expect(added.prevCEL).toBeUndefined()
    expect(added.nextCEL).toBeUndefined()
  })

  // ── Case 2: node present in A but not B → removed ─────────────────────

  it('classifies node present in A but not B as removed', () => {
    const gA = g([resourceNode('ns'), resourceNode('deploy', 'Deployment')])
    const gB = g([resourceNode('ns')])

    const diff = diffDAGGraphs(gA, gB)
    const removed = findNode(diff, 'deploy')
    expect(removed.diffStatus).toBe('removed')
    expect(removed.prevCEL).toBeUndefined()
    expect(removed.nextCEL).toBeUndefined()
  })

  // ── Case 3: node with different CEL → modified ────────────────────────

  it('classifies node with different CEL as modified', () => {
    const gA = g([conditionalNode('ns', ['${schema.spec.enabled}'])])
    const gB = g([conditionalNode('ns', ['${schema.spec.enabled && schema.spec.ready}'])])

    const diff = diffDAGGraphs(gA, gB)
    const modified = findNode(diff, 'ns')
    expect(modified.diffStatus).toBe('modified')
    expect(modified.prevCEL).toBeDefined()
    expect(modified.nextCEL).toBeDefined()
    expect(modified.prevCEL!.includeWhen).toEqual(['${schema.spec.enabled}'])
    expect(modified.nextCEL!.includeWhen).toEqual(['${schema.spec.enabled && schema.spec.ready}'])
  })

  // ── Case 4: identical nodes → unchanged ──────────────────────────────

  it('classifies identical nodes as unchanged', () => {
    const resource = resourceNode('ns')
    const gA = g([resource])
    const gB = g([resource])

    const diff = diffDAGGraphs(gA, gB)
    const unchanged = findNode(diff, 'ns')
    expect(unchanged.diffStatus).toBe('unchanged')
    expect(unchanged.prevCEL).toBeUndefined()
    expect(unchanged.nextCEL).toBeUndefined()
  })

  // ── Case 5: new edge → added ──────────────────────────────────────────

  it('classifies new edge as added', () => {
    // In graphB, 'deploy' references 'ns' via CEL — creates an edge ns→deploy
    const gA = g([resourceNode('ns'), resourceNode('deploy', 'Deployment')])
    const gB = g([
      resourceNode('ns'),
      {
        id: 'deploy',
        template: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: '${ns.metadata.name}-deploy' }, // reference to ns
        },
      },
    ])

    const diff = diffDAGGraphs(gA, gB)
    const newEdge = findEdge(diff, 'ns', 'deploy')
    expect(newEdge).toBeDefined()
    expect(newEdge!.diffStatus).toBe('added')
  })

  // ── Case 6: removed edge → removed ───────────────────────────────────

  it('classifies removed edge as removed', () => {
    // graphA has ns→deploy edge; graphB removes the reference
    const gA = g([
      resourceNode('ns'),
      {
        id: 'deploy',
        template: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: '${ns.metadata.name}-deploy' }, // reference to ns
        },
      },
    ])
    const gB = g([resourceNode('ns'), resourceNode('deploy', 'Deployment')])

    const diff = diffDAGGraphs(gA, gB)
    const removedEdge = findEdge(diff, 'ns', 'deploy')
    expect(removedEdge).toBeDefined()
    expect(removedEdge!.diffStatus).toBe('removed')
  })

  // ── Edge case: node renamed between revisions = remove + add ─────────

  it('node renamed between revisions is treated as remove + add, not modified', () => {
    // Same kind, different id
    const gA = g([resourceNode('nsOld', 'Namespace')])
    const gB = g([resourceNode('nsNew', 'Namespace')])

    const diff = diffDAGGraphs(gA, gB)
    const removed = findNode(diff, 'nsOld')
    const added = findNode(diff, 'nsNew')
    expect(removed.diffStatus).toBe('removed')
    expect(added.diffStatus).toBe('added')
  })

  // ── Edge case: prevCEL/nextCEL correct for readyWhen ─────────────────

  it('returns correct prevCEL/nextCEL for modified node (readyWhen change)', () => {
    const gA = g([readyWhenNode('svc', ['${schema.spec.ready}'])])
    const gB = g([readyWhenNode('svc', ['${schema.spec.ready}', '${schema.spec.healthy}'])])

    const diff = diffDAGGraphs(gA, gB)
    const node = findNode(diff, 'svc')
    expect(node.diffStatus).toBe('modified')
    expect(node.prevCEL!.readyWhen).toEqual(['${schema.spec.ready}'])
    expect(node.nextCEL!.readyWhen).toEqual(['${schema.spec.ready}', '${schema.spec.healthy}'])
  })

  // ── Edge case: prevCEL/nextCEL correct for forEach change ────────────

  it('returns correct prevCEL/nextCEL for modified node (forEach change)', () => {
    const gA = g([collectionNode('items', '${schema.spec.regions}')])
    const gB = g([collectionNode('items', '${schema.spec.azs}')])

    const diff = diffDAGGraphs(gA, gB)
    const node = findNode(diff, 'items')
    expect(node.diffStatus).toBe('modified')
    expect(node.prevCEL!.forEach).toBe('${schema.spec.regions}')
    expect(node.nextCEL!.forEach).toBe('${schema.spec.azs}')
  })

  // ── NFR-001: performance — completes in <100ms for 20-node graphs ─────

  it('NFR-001: diffDAGGraphs completes in <100ms for 20-node graphs', () => {
    // Build 20 independent resource nodes in each graph
    const make20Resources = (suffix: string) =>
      Array.from({ length: 20 }, (_, i) => resourceNode(`res${i}${suffix}`, 'ConfigMap'))

    const gA = g(make20Resources('A'))
    const gB = g(make20Resources('B'))

    const start = performance.now()
    diffDAGGraphs(gA, gB)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  // ── Root node always present in both (schema node) ────────────────────

  it('root "schema" node is always classified as unchanged when kind is same', () => {
    const gA = g([resourceNode('ns')])
    const gB = g([resourceNode('ns'), resourceNode('deploy', 'Deployment')])

    const diff = diffDAGGraphs(gA, gB)
    const root = findNode(diff, 'schema')
    expect(root.diffStatus).toBe('unchanged')
  })

  // ── Empty graphs produce an empty diff ──────────────────────────────

  it('diffing empty graphs produces empty diff (just the schema root)', () => {
    const gA = g([])
    const gB = g([])

    const diff = diffDAGGraphs(gA, gB)
    // Only the schema root should exist
    expect(diff.nodes).toHaveLength(1)
    expect(diff.nodes[0].id).toBe('schema')
    expect(diff.nodes[0].diffStatus).toBe('unchanged')
    expect(diff.edges).toHaveLength(0)
  })

  // ── All edges unchanged when graphs are identical ─────────────────────

  it('all edges are unchanged when graphs are identical', () => {
    const resources = [
      resourceNode('ns'),
      {
        id: 'deploy',
        template: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: '${ns.metadata.name}-d' },
        },
      },
    ]
    const gA = g(resources)
    const gB = g(resources)

    const diff = diffDAGGraphs(gA, gB)
    for (const edge of diff.edges) {
      expect(edge.diffStatus).toBe('unchanged')
    }
  })

  // ── width/height come from graphB ─────────────────────────────────────

  it('DiffGraph width/height come from graphB', () => {
    const gA = g([resourceNode('ns')])
    const gB = g([resourceNode('ns'), resourceNode('deploy', 'Deployment'), resourceNode('svc', 'Service')])

    const diff = diffDAGGraphs(gA, gB)
    expect(diff.width).toBe(gB.width)
    expect(diff.height).toBe(gB.height)
  })
})
