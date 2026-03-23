// instanceNodeState.ts — maps instance conditions + child resources → per-node state.
//
// This is the ONLY place that knows how to derive a live node state from
// Kubernetes conditions and child resource presence.

import type { K8sObject } from './api'
import { isTerminating, getFinalizers, getDeletionTimestamp } from './k8s'

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Live state for a single DAG node.
 *
 * | State       | Condition                                        |
 * |-------------|--------------------------------------------------|
 * | alive       | Child resource exists, no error conditions       |
 * | reconciling | Instance has Progressing=True condition          |
 * | error       | Instance has Ready=False condition               |
 * | not-found   | Resource not present in children list / unknown  |
 */
export type NodeLiveState = 'alive' | 'reconciling' | 'error' | 'not-found'

export interface NodeStateEntry {
  state: NodeLiveState
  kind: string
  name: string
  namespace: string
  /** Group, version from child resource apiVersion (may be empty for core) */
  group: string
  version: string
  /**
   * True if the child resource has metadata.deletionTimestamp set.
   * When true, `state` is overridden to 'error' so the DAG ring shows error colour.
   * Spec: 031-deletion-debugger FR-003
   */
  terminating?: boolean
  /** Child's finalizer list when terminating. Spec: 031-deletion-debugger FR-003 */
  finalizers?: string[]
  /** Raw deletionTimestamp ISO string when terminating. Spec: 031-deletion-debugger FR-003 */
  deletionTimestamp?: string
}

/** Map from node ID → NodeStateEntry. Built once per poll cycle. */
export type NodeStateMap = Record<string, NodeStateEntry>

// ── Helpers ────────────────────────────────────────────────────────────────

interface K8sCondition {
  type: string
  status: string
  reason?: string
  message?: string
  lastTransitionTime?: string
}

function getConditions(instance: K8sObject): K8sCondition[] {
  const status = instance.status as Record<string, unknown> | undefined
  if (!status) return []
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return []
  return conditions as K8sCondition[]
}

function hasCondition(conditions: K8sCondition[], type: string, statusVal: string): boolean {
  return conditions.some((c) => c.type === type && c.status === statusVal)
}

function parseApiVersion(apiVersion: unknown): { group: string; version: string } {
  if (typeof apiVersion !== 'string') return { group: '', version: 'v1' }
  const parts = apiVersion.split('/')
  if (parts.length === 2) return { group: parts[0], version: parts[1] }
  return { group: '', version: parts[0] ?? 'v1' }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * buildNodeStateMap — derives a NodeStateMap from the live instance data.
 *
 * Algorithm:
 * 1. Determine the global state from instance conditions:
 *    - Progressing=True  → all present nodes are 'reconciling'
 *    - Ready=False        → all present nodes are 'error'
 *    - Otherwise          → present nodes are 'alive'
 * 2. For each child resource, create an entry keyed by kind (lowercase).
 * 3. Nodes not represented in children remain 'not-found'.
 *
 * The caller (LiveDAG) maps node IDs to entries by resolving kind from the
 * DAGNode.kind field.
 */
export function buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
): NodeStateMap {
  const conditions = getConditions(instance)

  // Derive the global presence state from conditions.
  // Precedence: reconciling > error > alive
  let presentState: NodeLiveState = 'alive'
  if (hasCondition(conditions, 'Ready', 'False')) {
    presentState = 'error'
  }
  // Progressing=True wins over error — kro actively working
  if (hasCondition(conditions, 'Progressing', 'True')) {
    presentState = 'reconciling'
  }

  const result: NodeStateMap = {}

  for (const child of children) {
    const meta = child.metadata as Record<string, unknown> | undefined
    if (!meta) continue

    const kind = typeof child.kind === 'string' ? child.kind : ''
    const name = typeof meta.name === 'string' ? meta.name : ''
    const namespace = typeof meta.namespace === 'string' ? meta.namespace : ''
    const { group, version } = parseApiVersion(child.apiVersion)

    if (!kind) continue

    // Deletion state — check before deriving the node state
    // FR-003: terminating children override state to 'error'
    const childTerminating = isTerminating(child)
    const childFinalizers = getFinalizers(child)
    const childDeletionTimestamp = getDeletionTimestamp(child)

    // When a child is terminating, force error state so the DAG ring turns rose.
    // This takes precedence over the global presentState derived from conditions.
    const nodeState: NodeLiveState = childTerminating ? 'error' : presentState

    // Key by lowercase kind — allows case-insensitive lookup from DAGNode.kind
    const key = kind.toLowerCase()
    // If multiple children of same kind, first one wins (ordered by API response)
    if (!(key in result)) {
      result[key] = {
        state: nodeState,
        kind,
        name,
        namespace,
        group,
        version,
        terminating: childTerminating || undefined,
        finalizers: childFinalizers.length > 0 ? childFinalizers : undefined,
        deletionTimestamp: childDeletionTimestamp,
      }
    }
  }

  return result
}
