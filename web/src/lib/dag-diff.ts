// dag-diff.ts — Pure diff function for two DAGGraph objects.
//
// Implements spec 009-rgd-graph-diff FR-001 through FR-005.
// Takes two DAGGraph values (built by buildDAGGraph) and returns a
// DiffGraph: a merged graph where every node and edge carries a
// DiffStatus classifying its fate between revision A and revision B.
//
// Key design decisions:
//   - Node identity is the node.id string (never fuzzy-matched).
//     A renamed node (same kind, different id) is treated as remove + add.
//   - Edge identity is the from+to id pair.
//   - Modified nodes expose prevCEL / nextCEL arrays capturing the
//     before/after values of includeWhen, readyWhen, forEach.
//   - The merged graph's layout is NOT recomputed here; callers are
//     expected to pass DiffGraph.nodes to layoutDAG themselves (or use
//     the pre-laid-out positions from graphB for the "base" positions and
//     add removed nodes from graphA at their original positions).
//
// Constitution §V: pure functions, no external deps.
// Constitution §IX: no CSS, no DOM — pure data transformation.

import type { DAGNode, DAGEdge, DAGGraph } from '@/lib/dag'

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * DiffStatus classifies whether a graph element was added, removed,
 * modified (structurally present in both but with different CEL), or
 * unchanged (identical in both revisions).
 */
export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

/**
 * A node in the merged diff graph.
 * Extends DAGNode with diff classification and before/after CEL snapshots.
 */
export interface DiffNode extends DAGNode {
  diffStatus: DiffStatus
  /**
   * CEL expression arrays from the revision-A node.
   * Only populated when diffStatus === 'modified'.
   * Covers: includeWhen, readyWhen, forEach.
   */
  prevCEL: {
    includeWhen: string[]
    readyWhen: string[]
    forEach: string | undefined
  } | undefined
  /**
   * CEL expression arrays from the revision-B node.
   * Only populated when diffStatus === 'modified'.
   */
  nextCEL: {
    includeWhen: string[]
    readyWhen: string[]
    forEach: string | undefined
  } | undefined
}

/**
 * A directed edge in the merged diff graph.
 */
export interface DiffEdge extends DAGEdge {
  diffStatus: Exclude<DiffStatus, 'modified'>  // edges have no "modified" state
}

/**
 * The merged diff graph.
 * Contains all nodes and edges from both revisions, each tagged with its status.
 * Layout coordinates come from graphB for surviving/added nodes, and graphA for
 * removed nodes.
 */
export interface DiffGraph {
  nodes: DiffNode[]
  edges: DiffEdge[]
  /** Width from graphB (the "new" revision defines the layout baseline). */
  width: number
  /** Height from graphB. */
  height: number
}

// ── CEL snapshot helpers ───────────────────────────────────────────────────

interface CELSnapshot {
  includeWhen: string[]
  readyWhen: string[]
  forEach: string | undefined
}

function celSnapshot(node: DAGNode): CELSnapshot {
  return {
    includeWhen: [...node.includeWhen],
    readyWhen: [...node.readyWhen],
    forEach: node.forEach,
  }
}

/**
 * Returns true when two CEL snapshots are identical.
 * Array comparison is order-sensitive (same order = same CEL).
 */
function celEqual(a: CELSnapshot, b: CELSnapshot): boolean {
  if (a.forEach !== b.forEach) return false
  if (a.includeWhen.length !== b.includeWhen.length) return false
  if (a.readyWhen.length !== b.readyWhen.length) return false
  for (let i = 0; i < a.includeWhen.length; i++) {
    if (a.includeWhen[i] !== b.includeWhen[i]) return false
  }
  for (let i = 0; i < a.readyWhen.length; i++) {
    if (a.readyWhen[i] !== b.readyWhen[i]) return false
  }
  return true
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * diffDAGGraphs — compute the diff between two DAGGraph revisions.
 *
 * @param graphA - The "before" revision (selected as Rev A in the UI).
 * @param graphB - The "after" revision (selected as Rev B in the UI).
 * @returns DiffGraph with all nodes and edges tagged by their DiffStatus.
 *
 * Node classification (spec FR-003):
 *   - present in B but not A → added
 *   - present in A but not B → removed
 *   - present in both, different CEL → modified (prevCEL + nextCEL populated)
 *   - present in both, identical CEL → unchanged
 *
 * Edge classification (spec FR-004):
 *   - present in B but not A → added
 *   - present in A but not B → removed
 *   - present in both → unchanged
 *
 * Layout coordinates:
 *   - added / modified / unchanged nodes: coordinates from graphB
 *   - removed nodes: coordinates from graphA (preserves approximate position)
 *
 * Performance: O(|nodes| + |edges|) for graph sizes up to 1 000 nodes.
 * NFR-001: must complete in <100ms for 20-node graphs (verified in dag-diff.test.ts).
 */
export function diffDAGGraphs(graphA: DAGGraph, graphB: DAGGraph): DiffGraph {
  // Build lookup maps
  const nodesA = new Map<string, DAGNode>(graphA.nodes.map((n) => [n.id, n]))
  const nodesB = new Map<string, DAGNode>(graphB.nodes.map((n) => [n.id, n]))

  const edgesA = new Set<string>(graphA.edges.map((e) => `${e.from}→${e.to}`))
  const edgesB = new Set<string>(graphB.edges.map((e) => `${e.from}→${e.to}`))

  const diffNodes: DiffNode[] = []
  const diffEdges: DiffEdge[] = []

  // ── Node diff ─────────────────────────────────────────────────────────

  // Pass 1: iterate B nodes — added, modified, unchanged
  for (const [id, nodeB] of nodesB) {
    const nodeA = nodesA.get(id)
    if (!nodeA) {
      // Present in B but not A → added
      diffNodes.push({ ...nodeB, diffStatus: 'added', prevCEL: undefined, nextCEL: undefined })
    } else {
      // Present in both — compare CEL
      const snapA = celSnapshot(nodeA)
      const snapB = celSnapshot(nodeB)
      if (celEqual(snapA, snapB)) {
        diffNodes.push({ ...nodeB, diffStatus: 'unchanged', prevCEL: undefined, nextCEL: undefined })
      } else {
        diffNodes.push({
          ...nodeB,
          diffStatus: 'modified',
          prevCEL: snapA,
          nextCEL: snapB,
        })
      }
    }
  }

  // Pass 2: iterate A nodes not in B → removed (keep A's layout coordinates)
  for (const [id, nodeA] of nodesA) {
    if (!nodesB.has(id)) {
      diffNodes.push({ ...nodeA, diffStatus: 'removed', prevCEL: undefined, nextCEL: undefined })
    }
  }

  // ── Edge diff ─────────────────────────────────────────────────────────

  // Pass 1: B edges — added or unchanged
  for (const edgeB of graphB.edges) {
    const key = `${edgeB.from}→${edgeB.to}`
    const status: DiffEdge['diffStatus'] = edgesA.has(key) ? 'unchanged' : 'added'
    diffEdges.push({ ...edgeB, diffStatus: status })
  }

  // Pass 2: A edges not in B → removed
  for (const edgeA of graphA.edges) {
    const key = `${edgeA.from}→${edgeA.to}`
    if (!edgesB.has(key)) {
      diffEdges.push({ ...edgeA, diffStatus: 'removed' })
    }
  }

  return {
    nodes: diffNodes,
    edges: diffEdges,
    width: graphB.width,
    height: graphB.height,
  }
}
