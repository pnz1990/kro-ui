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
 * | State       | Condition                                                    |
 * |-------------|--------------------------------------------------------------|
 * | alive       | Child resource exists, no error conditions                   |
 * | reconciling | Child/CR has Progressing=True condition                      |
 * | error       | Child/CR has Ready=False or Available=False, or terminating  |
 * | pending     | Node has includeWhen expr(s) and is absent (excluded by cond)|
 * | not-found   | Resource absent from children list, no includeWhen exprs     |
 */
export type NodeLiveState = 'alive' | 'reconciling' | 'error' | 'pending' | 'not-found'

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

/**
 * getChildConditions — reads `status.conditions` from a child K8sObject.
 * Mirrors getConditions() but takes any child resource (not just the CR).
 */
function getChildConditions(child: K8sObject): K8sCondition[] {
  const status = child.status as Record<string, unknown> | undefined
  if (!status) return []
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return []
  return conditions as K8sCondition[]
}

/**
 * deriveChildState — derives a NodeLiveState from a child resource's own
 * status.conditions. Only called when the CR-level globalState is 'alive'.
 *
 * Precedence (highest to lowest):
 *   Ready=False or Available=False → 'error'
 *   Progressing=True               → 'reconciling'
 *   otherwise                      → 'alive'
 */
function deriveChildState(conditions: K8sCondition[]): NodeLiveState {
  if (
    hasCondition(conditions, 'Ready', 'False') ||
    hasCondition(conditions, 'Available', 'False')
  ) {
    return 'error'
  }
  if (hasCondition(conditions, 'Progressing', 'True')) {
    return 'reconciling'
  }
  return 'alive'
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
 *    - Progressing=True → globalState = 'reconciling'
 *    - Ready=False      → globalState = 'error'
 *    - Otherwise        → globalState = 'alive'
 * 2. Build a presence map from children, keyed by lowercase kind.
 *    - Terminating children always get state 'error'.
 *    - When globalState is 'reconciling' or 'error', all present children
 *      inherit that global state (CR-level signal wins).
 *    - When globalState is 'alive', each child's own status.conditions are
 *      inspected individually via deriveChildState() — enabling per-node
 *      health differentiation even when the CR itself is healthy.
 * 3. Enumerate every non-state, non-instance RGD node and emit an explicit
 *    entry for absent nodes:
 *    - Node has includeWhen expressions → state = 'pending' (excluded by cond)
 *    - Node has no includeWhen          → state = 'not-found' (not yet created)
 *
 * The `rgdNodes` parameter (GH #165 fix) ensures every DAG node has an entry
 * so that absent nodes receive the correct CSS class rather than being
 * silently unstyled. Pass `dagGraph.nodes` from the call site.
 */
export function buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
  rgdNodes: DAGNode[],
): NodeStateMap {
  const conditions = getConditions(instance)

  // Derive the global state from CR-level conditions.
  // Precedence: reconciling > error > alive
  let globalState: NodeLiveState = 'alive'
  if (hasCondition(conditions, 'Ready', 'False')) {
    globalState = 'error'
  }
  // Progressing=True wins over error — kro actively working
  if (hasCondition(conditions, 'Progressing', 'True')) {
    globalState = 'reconciling'
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

    // Terminating children force error state regardless of global or per-node state.
    // When globalState is 'reconciling' or 'error', it propagates to all present nodes.
    // When globalState is 'alive', inspect the child's own conditions for per-node state.
    let nodeState: NodeLiveState
    if (childTerminating) {
      nodeState = 'error'
    } else if (globalState !== 'alive') {
      nodeState = globalState
    } else {
      nodeState = deriveChildState(getChildConditions(child))
    }

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
  // Absent nodes receive 'pending' when the node has includeWhen expressions
  // (meaning it is actively excluded by a condition), or 'not-found' otherwise
  // (meaning the resource hasn't been created yet).
  // This guarantees every DAG node has an entry when the overlay is active.
  for (const node of rgdNodes) {
    if (node.nodeType === 'instance' || node.nodeType === 'state') continue
    const kindKey = (node.kind || node.label || '').toLowerCase()
    if (!kindKey) continue
    if (kindKey in result) continue // already set by an observed child

    const hasIncludeWhen = node.includeWhen.some((e) => e.trim() !== '')
    result[kindKey] = {
      state: hasIncludeWhen ? 'pending' : 'not-found',
      kind: node.kind || node.label || kindKey,
      name: '',
      namespace: '',
      group: '',
      version: '',
    }
  }

  return result
}
