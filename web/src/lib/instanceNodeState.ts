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
 * status.conditions. Called for every present child when globalState is
 * 'alive' or 'reconciling'.
 *
 * Precedence (highest to lowest):
 *   Available=True                                   → 'alive'       (serving; wins over Progressing)
 *   Ready=True                                       → 'alive'       (readiness gate met)
 *   Ready=False or Available=False                   → 'error'
 *   Progressing=True, reason=NewReplicaSetAvailable  → 'alive'       (rollout complete, Available not yet set)
 *   Progressing=True (Available not True)            → 'reconciling' (rolling update, not yet serving)
 *   otherwise                                        → 'alive'
 *
 * Why Available=True wins over Progressing=True (PR #381):
 *   A Deployment with Available=True + Progressing=True is actively rolling out
 *   a new version but already serving traffic. kubectl considers this healthy.
 *   Showing amber is misleading — the resource IS healthy.
 *
 * Why Ready=True is an additional alive fast-path (GH #398):
 *   Some controllers set Ready=True without setting Available=True (e.g. custom
 *   controllers, StatefulSets). A resource with Ready=True is healthy.
 *
 * Why NewReplicaSetAvailable reason triggers alive (GH #398):
 *   After a Deployment rollout completes, Kubernetes sets
 *     Progressing=True reason=NewReplicaSetAvailable
 *   and keeps it True permanently. Available=True arrives shortly after, but
 *   there is a brief window where Progressing=True is set but Available hasn't
 *   arrived yet. In this window the old logic returned 'reconciling' (amber).
 *   NewReplicaSetAvailable means "rollout complete" — the Deployment is healthy.
 */
function deriveChildState(conditions: K8sCondition[]): NodeLiveState {
  // Fast path 1: if Available=True the resource is serving → green.
  if (hasCondition(conditions, 'Available', 'True')) {
    return 'alive'
  }
  // Fast path 2: Ready=True → green (covers controllers that don't emit Available).
  if (hasCondition(conditions, 'Ready', 'True')) {
    return 'alive'
  }
  if (
    hasCondition(conditions, 'Ready', 'False') ||
    hasCondition(conditions, 'Available', 'False')
  ) {
    return 'error'
  }
  // Progressing=True with reason=NewReplicaSetAvailable means rollout is complete —
  // Kubernetes keeps this condition True after a successful rollout. The resource
  // is healthy even though Available=True may not have arrived yet. GH #398.
  const progressingCond = conditions.find((c) => c.type === 'Progressing' && c.status === 'True')
  if (progressingCond?.reason === 'NewReplicaSetAvailable') {
    return 'alive'
  }
  // Progressing=True without Available=True → rolling update not yet serving
  if (progressingCond) {
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
 *    - When globalState is 'error' (CR-level Ready=False), all present children
 *      inherit that global error state — the graph as a whole has failed.
 *    - When globalState is 'reconciling' OR 'alive', each child's own
 *      status.conditions are inspected individually via deriveChildState().
 *      This means a Namespace or ConfigMap that is already created and healthy
 *      shows 'alive' (green) even while a downstream resource (e.g. an RDS
 *      DBInstance with readyWhen) is still being provisioned and keeps the CR
 *      in IN_PROGRESS / reconciling state.
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
  // kro v0.9.0 dependency-waiting: when a template CEL expression references a
  // dependency that isn't ready yet (e.g. vectordb.status.endpoint.address while RDS
  // is provisioning), kro sets Ready=False + ResourcesReady=False with reason=NotReady
  // and a message containing "waiting for node". This is NOT a graph error — it is
  // normal reconciliation while a slow dependency (RDS, IAM, etc.) comes up.
  // Without this check, every node shows red "Error" for the entire 8+ minutes it
  // takes for an RDS instance to become available. (GH report by Carlos, fix #XXX)
  if (globalState === 'error') {
    const resourcesReadyCond = conditions.find((c) => c.type === 'ResourcesReady')
    const msg = resourcesReadyCond?.message ?? ''
    const reason = resourcesReadyCond?.reason ?? ''
    // "waiting for node" appears when readyWhen is unmet OR when a template CEL
    // expression references a not-yet-available dependency field.
    // "NotReady" is the kro reason for both cases.
    if (
      reason === 'NotReady' ||
      msg.includes('waiting for node') ||
      msg.includes('waiting for readiness')
    ) {
      globalState = 'reconciling'
    }
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
    } else if (globalState === 'error') {
      // CR-level Ready=False means the graph as a whole has failed — propagate
      // error to every child so operators see the failure clearly on every node.
      nodeState = 'error'
    } else {
      // globalState is 'alive' or 'reconciling': judge each child on its own
      // conditions. A Namespace or ConfigMap that is already created and healthy
      // should show 'alive' (green), not 'reconciling' (amber), even while a
      // downstream resource (e.g. an RDS DBInstance with readyWhen) is still
      // being provisioned and keeps the CR in IN_PROGRESS.
      // deriveChildState returns 'reconciling' if the child itself has
      // Progressing=True, 'error' if it has Ready=False or Available=False,
      // and 'alive' otherwise (including stateless resources with no conditions).
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
  // Their state must be inferred from the CR-level signal:
  //
  //   globalState=alive       → 'alive'     (green  — ref was accessed, instance ready)
  //   globalState=reconciling → 'alive'     (green  — ref was READ before kro moved on;
  //                                           it exists. Showing amber is misleading since
  //                                           the ref itself is not what's reconciling.)
  //   globalState=error       → 'not-found' (grey   — unknown if ref is reachable; show
  //                                           grey not amber to avoid false alarm on the ref)
  //
  // This fixes the same class of bug as PR #379: external refs like `kroConfig`
  // (a ConfigMap externalRef) were showing amber while an unrelated downstream
  // resource (e.g. RDS DBInstance with readyWhen) was still provisioning.
  for (const node of rgdNodes) {
    if (node.nodeType === 'instance' || node.nodeType === 'state') continue
    const nodeId = node.id  // use the RGD resource id, matching kro.run/node-id
    if (!nodeId) continue
    if (nodeId in result) continue // already set by an observed child

    const isExternalNode =
      node.nodeType === 'external' || node.nodeType === 'externalCollection'

    let nodeState: NodeLiveState
    if (isExternalNode) {
      // External refs are watched, not created. If the CR failed (error), we
      // don't know if the ref is still reachable → show 'not-found' (grey).
      // For both 'alive' and 'reconciling', the ref was already resolved by kro
      // at an earlier reconciliation wave → show 'alive' (green).
      nodeState = globalState === 'error' ? 'not-found' : 'alive'
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
