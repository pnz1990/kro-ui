// resolveResourceName.ts — maps a DAG node label to a cluster resource name.
//
// Three-step resolution for resolveChildResourceInfo (fix #210):
//   1. Match child whose kro.run/node-id label equals nodeLabel (resource ID).
//      This is the authoritative key set by kro ≥ 0.8.0 on every managed resource.
//      Handles IDs that differ from kinds (e.g. "appNamespace" → Namespace) and
//      disambiguates multiple resources of the same kind (e.g. two ConfigMaps).
//   2. Match child whose kind (lowercased) equals kindHint derived from nodeLabel.
//      Fallback for kro < 0.8.0 that does not set kro.run/node-id labels.
//   3. Match child whose kind (lowercased) equals the optional nodeKind parameter.
//      Second fallback for kro < 0.8.0 when the node ID differs from its kind.
//   4. Inference: construct a name from instanceName + kindHint.

import type { K8sObject } from './api'

const LABEL_NODE_ID = 'kro.run/node-id'

/**
 * Derive a kind hint from a node label.
 * Strips trailing "CRs" or "CR" (case-sensitive) to get the raw kind hint.
 */
function kindHintFromLabel(label: string): string {
  if (label.endsWith('CRs')) return label.slice(0, -3)
  if (label.endsWith('CR')) return label.slice(0, -2)
  return label
}

/** Read kro.run/node-id from a child resource's metadata labels. Returns '' if absent. */
function nodeIdLabel(child: K8sObject): string {
  const meta = child.metadata as Record<string, unknown> | undefined
  const labels = meta?.labels
  if (typeof labels !== 'object' || labels === null) return ''
  const val = (labels as Record<string, unknown>)[LABEL_NODE_ID]
  return typeof val === 'string' ? val : ''
}

/** Extract ChildResourceInfo fields from an unstructured child object. */
function childToInfo(child: K8sObject): ChildResourceInfo {
  const meta = child.metadata as Record<string, unknown> | undefined
  const name = typeof meta?.name === 'string' ? meta.name : ''
  const namespace = typeof meta?.namespace === 'string' ? meta.namespace : ''
  const { group, version } = parseApiVersion(child.apiVersion)
  const kind = typeof child.kind === 'string' ? child.kind : ''
  return { kind, name, namespace, group, version }
}

/**
 * resolveResourceName — return the cluster resource name for a DAG node.
 *
 * @param nodeLabel    - The node's label/id (e.g. "databaseCR", "configmap")
 * @param instanceName - The CR instance name (e.g. "prod-01")
 * @param children     - The child resources returned by getInstanceChildren
 * @returns The resolved resource name (e.g. "prod-01-database")
 */
export function resolveResourceName(
  nodeLabel: string,
  instanceName: string,
  children: K8sObject[],
): string {
  // Step 1: match by kro.run/node-id (authoritative, kro ≥ 0.8.0)
  for (const child of children) {
    if (nodeIdLabel(child) === nodeLabel) {
      const meta = child.metadata as Record<string, unknown> | undefined
      const name = typeof meta?.name === 'string' ? meta.name : ''
      if (name) return name
    }
  }

  const kindHint = kindHintFromLabel(nodeLabel).toLowerCase()

  // Step 2: match by kind derived from node label (kro < 0.8.0 fallback)
  for (const child of children) {
    const childKind = typeof child.kind === 'string' ? child.kind.toLowerCase() : ''
    if (childKind === kindHint) {
      const meta = child.metadata as Record<string, unknown> | undefined
      const name = typeof meta?.name === 'string' ? meta.name : ''
      if (name) return name
    }
  }

  // Step 3: inference fallback — prepend instance name to the kind hint
  return `${instanceName}-${kindHint}`
}

/**
 * resolveResourceInfo — return kind, name, namespace, group, version
 * for a DAG node by scanning the children list.
 * Returns null when the child is not present in the list.
 */
export interface ChildResourceInfo {
  kind: string
  name: string
  namespace: string
  group: string
  version: string
}

function parseApiVersion(apiVersion: unknown): { group: string; version: string } {
  if (typeof apiVersion !== 'string') return { group: '', version: 'v1' }
  const parts = apiVersion.split('/')
  if (parts.length === 2) return { group: parts[0], version: parts[1] }
  return { group: '', version: parts[0] ?? 'v1' }
}

/**
 * resolveChildResourceInfo — resolve the full GVK + name + namespace for a DAG node.
 *
 * Match order (fix #210):
 *   1. child.metadata.labels["kro.run/node-id"] === nodeLabel  (kro ≥ 0.8.0, exact)
 *   2. child.kind.toLowerCase() === kindHint from nodeLabel     (kro < 0.8.0, by kind)
 *   3. child.kind.toLowerCase() === nodeKind?.toLowerCase()     (caller-supplied kind)
 *   4. Inference fallback
 *
 * @param nodeLabel    - DAG node label (= resource ID, e.g. "appNamespace")
 * @param instanceName - CR instance name for the inference fallback
 * @param children     - Child resources from getInstanceChildren
 * @param nodeKind     - Optional: DAGNode.kind (e.g. "Namespace") for step-3 fallback
 */
export function resolveChildResourceInfo(
  nodeLabel: string,
  instanceName: string,
  children: K8sObject[],
  nodeKind?: string,
): ChildResourceInfo | null {
  // Step 1: match by kro.run/node-id label (authoritative — kro ≥ 0.8.0)
  for (const child of children) {
    if (nodeIdLabel(child) === nodeLabel) {
      return childToInfo(child)
    }
  }

  const kindHint = kindHintFromLabel(nodeLabel).toLowerCase()

  // Step 2: match by kind derived from node label (kro < 0.8.0 fallback)
  for (const child of children) {
    const childKind = typeof child.kind === 'string' ? child.kind : ''
    if (childKind.toLowerCase() === kindHint) {
      return childToInfo(child)
    }
  }

  // Step 3: match by caller-supplied nodeKind (kro < 0.8.0, ID ≠ kind)
  if (nodeKind) {
    const kindLower = nodeKind.toLowerCase()
    for (const child of children) {
      const childKind = typeof child.kind === 'string' ? child.kind : ''
      if (childKind.toLowerCase() === kindLower) {
        return childToInfo(child)
      }
    }
  }

  // Step 4: inference fallback — use nodeKind if available for a better kind label
  const inferredKind = nodeKind ?? kindHint
  const inferredName = `${instanceName}-${kindHint}`
  return {
    kind: inferredKind,
    name: inferredName,
    namespace: '',
    group: '',
    version: 'v1',
  }
}
