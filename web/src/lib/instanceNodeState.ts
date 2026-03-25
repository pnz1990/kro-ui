// instanceNodeState.ts — maps instance conditions + child resources → per-node state.
//
// This is the ONLY place that knows how to derive a live node state from
// Kubernetes conditions and child resource presence.

import type { K8sObject } from './api'
import { isTerminating, getFinalizers, getDeletionTimestamp } from './k8s'
import type { DAGNode } from './dag'

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
 * 2. Build a presence map from children, keyed by lowercase kind.
 * 3. Enumerate every non-state, non-instance RGD node and emit an explicit
 *    entry: the child's derived state if present, or 'not-found' if absent.
 *
 * The `rgdNodes` parameter (GH #165 fix) ensures every DAG node has an entry
 * so that absent nodes receive the dag-node-live--notfound CSS class rather
 * than being silently unstyled. Pass `dagGraph.nodes` from the call site.
 */
export function buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
  rgdNodes: DAGNode[],
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

  // ── Step 2: build result from observed children ───────────────────────────
  // Key by lowercase kind; first child of each kind wins.
  for (const child of children) {
    const meta = child.metadata as Record<string, unknown> | undefined
    if (!meta) continue

    // Prefer the top-level .kind field; fall back to resource-id label (kro ≤0.2 quirk)
    const kindRaw =
      typeof child.kind === 'string' && child.kind
        ? child.kind
        : typeof (meta.labels as Record<string, unknown> | undefined)?.[
            'kro.run/resource-id'
          ] === 'string'
        ? String((meta.labels as Record<string, unknown>)['kro.run/resource-id'])
        : ''

    if (!kindRaw) continue

    const key = kindRaw.toLowerCase()
    if (key in result) continue // first child of each kind wins

    const name = typeof meta.name === 'string' ? meta.name : ''
    const namespace = typeof meta.namespace === 'string' ? meta.namespace : ''
    const { group, version } = parseApiVersion(child.apiVersion)

    const childTerminating = isTerminating(child)
    const childFinalizers = getFinalizers(child)
    const childDeletionTimestamp = getDeletionTimestamp(child)

    // Terminating children force error state over global presentState.
    const nodeState: NodeLiveState = childTerminating ? 'error' : presentState

    result[key] = {
      state: nodeState,
      kind: kindRaw,
      name,
      namespace,
      group,
      version,
      terminating: childTerminating || undefined,
      finalizers: childFinalizers.length > 0 ? childFinalizers : undefined,
      deletionTimestamp: childDeletionTimestamp,
    }
  }

  // ── Step 3: enumerate every non-state, non-instance RGD node ─────────────
  // Emit 'not-found' for nodes absent from the children result.
  // This guarantees every DAG node has an entry when the overlay is active,
  // so dag-node-live--notfound is applied (GH #165 fix).
  for (const node of rgdNodes) {
    if (node.nodeType === 'instance' || node.nodeType === 'state') continue
    const kindKey = (node.kind || node.label || '').toLowerCase()
    if (!kindKey) continue
    if (kindKey in result) continue // already set by an observed child

    result[kindKey] = {
      state: 'not-found',
      kind: node.kind || node.label || kindKey,
      name: '',
      namespace: '',
      group: '',
      version: '',
    }
  }

  return result
}
