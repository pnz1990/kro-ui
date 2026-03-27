// instanceNodeState.ts — maps instance conditions + child resources → per-node state.
//
// This is the ONLY place that knows how to derive a live node state from
// Kubernetes conditions and child resource presence.
//
// Key design: the state map is keyed by kro.run/node-id label, NOT by
// resource kind. This is the same authoritative key used by resolveChildResourceInfo
// and avoids two classes of bugs:
//   1. Kube-generated resources (EndpointSlice, ReplicaSet, etc.) that are
//      returned by GetInstanceChildren but lack kro.run/node-id are silently
//      skipped — they don't pollute the state map or confuse the DAG overlay.
//   2. Nodes where the RGD id differs from the resource kind (e.g. id="appNamespace",
//      kind="Namespace") are correctly matched because the label is the id, not
//      the kind.
//   3. Two nodes of the same kind with different IDs (e.g. two ConfigMaps with
//      id="appConfig" and id="appStatus") both get their correct state.

import type { K8sObject } from './api'
import { isTerminating, getFinalizers, getDeletionTimestamp } from './k8s'
import type { DAGNode } from './dag'

const LABEL_NODE_ID = 'kro.run/node-id'

/** Read kro.run/node-id from a child resource's metadata labels. Returns '' if absent. */
function nodeIdLabel(child: K8sObject): string {
  const meta = child.metadata as Record<string, unknown> | undefined
  const labels = meta?.labels
  if (typeof labels !== 'object' || labels === null) return ''
  const val = (labels as Record<string, unknown>)[LABEL_NODE_ID]
  return typeof val === 'string' ? val : ''
}

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
 *    - kro status.state === 'IN_PROGRESS' → globalState = 'reconciling'
 *      (kro v0.8.5 uses this field when readyWhen is unmet — does not emit
 *      Progressing=True in this case, only ResourcesReady=False + Ready=False)
 *    - Progressing=True OR GraphProgressing=True → globalState = 'reconciling'
 *      (kro v0.9.x+ condition; GraphProgressing is the v0.8.x predecessor)
 *    - Ready=False → globalState = 'error'
 *    - Otherwise  → globalState = 'alive'
 *    Precedence: reconciling > error > alive
 * 2. Build a presence map from children, keyed by kro.run/node-id label.
 *    - Children lacking kro.run/node-id (kube-generated: EndpointSlice,
 *      ReplicaSet, etc.) are silently skipped — not kro-managed nodes.
 *    - First child for each node-id wins (handles rare duplicates).
 *    - Terminating children always get state 'error'.
 *    - When globalState is 'reconciling' or 'error', all present children
 *      inherit that global state (CR-level signal wins).
 *    - When globalState is 'alive', each child's own status.conditions are
 *      inspected individually via deriveChildState().
 * 3. Enumerate every non-state, non-instance RGD node and emit an explicit
 *    entry for absent nodes:
 *    - Node has includeWhen expressions → state = 'pending' (excluded by cond)
 *    - Node has no includeWhen          → state = 'not-found' (not yet created)
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
  // kro v0.8.5: status.state === 'IN_PROGRESS' when readyWhen is unmet.
  // Does NOT emit Progressing=True in this state — must check status.state directly.
  const kroState = (instance.status as Record<string, unknown> | undefined)?.state
  if (kroState === 'IN_PROGRESS') {
    globalState = 'reconciling'
  }
  // Progressing=True OR GraphProgressing=True wins — kro actively working.
  // GraphProgressing is the kro v0.8.x predecessor to Progressing.
  if (
    hasCondition(conditions, 'Progressing', 'True') ||
    hasCondition(conditions, 'GraphProgressing', 'True')
  ) {
    globalState = 'reconciling'
  }

  const result: NodeStateMap = {}

  // ── Step 2: build result from observed children, keyed by kro.run/node-id ──
  // Children without kro.run/node-id (kube-generated: EndpointSlice, ReplicaSet,
  // etc.) are skipped entirely — they are not kro-managed DAG nodes.
  // First child for each node-id wins (handles rare duplicate labels gracefully).
  for (const child of children) {
    const nodeId = nodeIdLabel(child)
    if (!nodeId) continue // not a kro-managed resource — skip
    if (nodeId in result) continue // first child for this node-id wins

    const meta = child.metadata as Record<string, unknown> | undefined
    if (!meta) continue

    const kindRaw = typeof child.kind === 'string' && child.kind ? child.kind : ''
    const name = typeof meta.name === 'string' ? meta.name : ''
    const namespace = typeof meta.namespace === 'string' ? meta.namespace : ''
    const { group, version } = parseApiVersion(child.apiVersion)

    const childTerminating = isTerminating(child)
    const childFinalizers = getFinalizers(child)
    const childDeletionTimestamp = getDeletionTimestamp(child)

    let nodeState: NodeLiveState
    if (childTerminating) {
      nodeState = 'error'
    } else if (globalState !== 'alive') {
      nodeState = globalState
    } else {
      nodeState = deriveChildState(getChildConditions(child))
    }

    result[nodeId] = {
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
  // (meaning it is actively excluded by a condition), or 'not-found' otherwise.
  //
  // Special case — NodeTypeExternal and NodeTypeExternalCollection:
  // External ref resources are pre-existing and never created (or labelled)
  // by kro. GetInstanceChildren only returns kro-labelled resources, so
  // external nodes will always be absent from the stateMap after step 2.
  // Showing 'not-found' (grey) for them is misleading when the CR is
  // Ready=True — if the instance is healthy, the external ref was successfully
  // accessed. Map external nodes to globalState instead so they reflect the
  // actual CR health:
  //   globalState=alive       → 'alive'  (green  — ref was accessed, instance ready)
  //   globalState=reconciling → 'reconciling'  (amber — kro is resolving the ref)
  //   globalState=error       → 'not-found'    (grey  — unknown if ref is reachable)
  for (const node of rgdNodes) {
    if (node.nodeType === 'instance' || node.nodeType === 'state') continue
    const nodeId = node.id  // use the RGD resource id, matching kro.run/node-id
    if (!nodeId) continue
    if (nodeId in result) continue // already set by an observed child

    const isExternalNode =
      node.nodeType === 'external' || node.nodeType === 'externalCollection'

    let nodeState: NodeLiveState
    if (isExternalNode) {
      // External refs are watched, not created — their health is inferred from
      // the CR-level state rather than from a kro.run/node-id label on the resource.
      nodeState = globalState === 'error' ? 'not-found' : globalState
    } else {
      const hasIncludeWhen = node.includeWhen.some((e) => e.trim() !== '')
      nodeState = hasIncludeWhen ? 'pending' : 'not-found'
    }

    result[nodeId] = {
      state: nodeState,
      kind: node.kind || node.label || nodeId,
      name: '',
      namespace: '',
      group: '',
      version: '',
    }
  }

  return result
}
