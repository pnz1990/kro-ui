// resolveResourceName.ts — maps a DAG node label to a cluster resource name.
//
// Two-step resolution (spec FR-007):
//   1. Look up the children list for a resource whose kind matches the node label.
//   2. If not found, strip the "CR" / "CRs" suffix from the label and prepend
//      the instance name with a hyphen.

import type { K8sObject } from './api'

/**
 * Derive a kind hint from a node label.
 * Strips trailing "CRs" or "CR" (case-sensitive) to get the raw kind hint.
 */
function kindHintFromLabel(label: string): string {
  if (label.endsWith('CRs')) return label.slice(0, -3)
  if (label.endsWith('CR')) return label.slice(0, -2)
  return label
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
  const kindHint = kindHintFromLabel(nodeLabel).toLowerCase()

  // Step 1: scan the children list for a kind match (case-insensitive)
  for (const child of children) {
    const childKind = typeof child.kind === 'string' ? child.kind.toLowerCase() : ''
    if (childKind === kindHint) {
      const meta = child.metadata as Record<string, unknown> | undefined
      const name = typeof meta?.name === 'string' ? meta.name : ''
      if (name) return name
    }
  }

  // Step 2: fallback — prepend instance name to the kind hint
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

export function resolveChildResourceInfo(
  nodeLabel: string,
  instanceName: string,
  children: K8sObject[],
): ChildResourceInfo | null {
  const kindHint = kindHintFromLabel(nodeLabel).toLowerCase()

  for (const child of children) {
    const childKind = typeof child.kind === 'string' ? child.kind : ''
    if (childKind.toLowerCase() === kindHint) {
      const meta = child.metadata as Record<string, unknown> | undefined
      const name = typeof meta?.name === 'string' ? meta.name : ''
      const namespace = typeof meta?.namespace === 'string' ? meta.namespace : ''
      const { group, version } = parseApiVersion(child.apiVersion)
      return { kind: childKind, name, namespace, group, version }
    }
  }

  // Not found in children — return inferred info
  const inferredName = `${instanceName}-${kindHint}`
  return {
    kind: kindHint,
    name: inferredName,
    namespace: '',
    group: '',
    version: 'v1',
  }
}
