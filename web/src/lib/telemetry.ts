// telemetry.ts — Pure derivation functions for per-instance telemetry metrics.
//
// All functions are pure: no side effects, no React hooks, no API calls.
// They accept already-fetched data as arguments and return computed display values.
//
// Implements spec 027-instance-telemetry-panel FR-003 through FR-006.

import type { K8sObject, K8sList } from '@/lib/api'
import type { NodeStateMap } from '@/lib/instanceNodeState'
import { formatAge } from '@/lib/format'

// ── Types ────────────────────────────────────────────────────────────

/**
 * Health summary for the children of a kro instance.
 * Derived from the pre-computed NodeStateMap (not from raw children).
 */
export interface ChildHealthSummary {
  /** Count of NodeStateMap entries with state 'alive' or 'reconciling'. */
  healthy: number
  /** Total count of entries in the NodeStateMap (children found on cluster). */
  total: number
  /** True when at least one entry has state 'error'. */
  hasError: boolean
}

// ── extractInstanceAge ───────────────────────────────────────────────

/**
 * Returns a kubectl-style relative age string for the instance.
 *
 * Reads `metadata.creationTimestamp` and passes it through `formatAge()`.
 * Returns `'Not reported'` when the field is absent or the metadata is missing.
 *
 * FR-003: "Age" cell — uses formatAge(); shows "Not reported" if absent.
 */
export function extractInstanceAge(instance: K8sObject): string {
  const meta = instance.metadata
  if (typeof meta !== 'object' || meta === null) return 'Not reported'

  const ts = (meta as Record<string, unknown>).creationTimestamp
  if (typeof ts !== 'string' || ts === '') return 'Not reported'

  const result = formatAge(ts)
  // formatAge returns 'Unknown' for invalid timestamps — map to 'Not reported'
  return result === 'Unknown' ? 'Not reported' : result
}

// ── extractTimeInState ───────────────────────────────────────────────

/**
 * Returns a kubectl-style relative age string for the time since the
 * `Ready` condition last changed.
 *
 * Reads `status.conditions` → finds type='Ready' → reads `lastTransitionTime`.
 * Returns `'Not reported'` when the Ready condition is absent or conditions
 * array is missing.
 *
 * FR-004: "Time in state" cell — uses formatAge(Ready.lastTransitionTime);
 * falls back to "Not reported" if the Ready condition is absent.
 */
export function extractTimeInState(instance: K8sObject): string {
  const status = instance.status
  if (typeof status !== 'object' || status === null) return 'Not reported'

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions)) return 'Not reported'

  const ready = (conditions as Array<Record<string, unknown>>).find(
    (c) => typeof c.type === 'string' && c.type === 'Ready',
  )
  if (!ready) return 'Not reported'

  const ltt = ready.lastTransitionTime
  if (typeof ltt !== 'string' || ltt === '') return 'Not reported'

  const result = formatAge(ltt)
  return result === 'Unknown' ? 'Not reported' : result
}

// ── countHealthyChildren ─────────────────────────────────────────────

/**
 * Counts healthy vs total children in the NodeStateMap.
 *
 * "Healthy" means state === 'alive' or state === 'reconciling'.
 * The denominator is the total number of entries in the map (children
 * present on the cluster, keyed by kind.toLowerCase()).
 *
 * FR-005: "Children" cell — count NodeStateMap entries by state.
 */
export function countHealthyChildren(nodeStateMap: NodeStateMap): ChildHealthSummary {
  const entries = Object.values(nodeStateMap)
  const total = entries.length

  let healthy = 0
  let hasError = false

  for (const entry of entries) {
    if (entry.state === 'alive' || entry.state === 'reconciling') {
      healthy++
    }
    if (entry.state === 'error') {
      hasError = true
    }
  }

  return { healthy, total, hasError }
}

// ── countWarningEvents ───────────────────────────────────────────────

/**
 * Counts Kubernetes events with type === 'Warning'.
 *
 * Handles missing or undefined `items` gracefully — returns 0.
 * Large event lists (200+) are processed as a pure reduce; no DOM nodes
 * are created proportional to the list size.
 *
 * FR-006: "Warnings" cell — count events where type === 'Warning'.
 */
export function countWarningEvents(events: K8sList): number {
  const items = events?.items
  if (!Array.isArray(items)) return 0

  return items.reduce((count, event) => {
    const t = (event as Record<string, unknown>).type
    return t === 'Warning' ? count + 1 : count
  }, 0)
}

// ── countFailedConditions ─────────────────────────────────────────────

/**
 * Counts instance conditions that are in a non-healthy state.
 *
 * A condition is "warning-worthy" when its `status` is `False` or `Unknown`
 * AND its type is NOT `Ready` (the Ready condition is already surfaced
 * prominently via the health pill and reconciling banner).
 *
 * Returns the count of non-healthy non-Ready conditions.
 * Returns 0 when `status.conditions` is absent or not an array.
 *
 * Spec: .specify/specs/059-condition-warnings/spec.md
 */
export function countFailedConditions(instance: K8sObject): number {
  const status = (instance as Record<string, unknown>)?.status
  if (typeof status !== 'object' || status === null) return 0

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions)) return 0

  return conditions.reduce((count, cond) => {
    if (typeof cond !== 'object' || cond === null) return count
    const c = cond as Record<string, unknown>
    // Skip the Ready condition — it's already surfaced in the health pill
    if (c.type === 'Ready') return count
    // Count conditions with status=False or status=Unknown
    if (c.status === 'False' || c.status === 'Unknown') return count + 1
    return count
  }, 0)
}
