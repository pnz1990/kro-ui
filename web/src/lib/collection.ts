// collection.ts — helpers for forEach collection item health evaluation.
//
// Isolated from component files per Constitution §IX:
// "Helper functions used by multiple components must live in @/lib/, not
// exported from component files."
//
// Fix #220 (011-F5): moved from web/src/components/CollectionPanel.tsx.

import type { K8sObject } from './api'

/**
 * Determine whether a collection item resource is "ready".
 *
 * Priority:
 *   1. status.phase — Running, Active, or Succeeded → true
 *   2. status.conditions — Ready=True or Available=True → true
 *   3. All other cases → false
 *
 * Pure function — no side effects.
 */
export function isItemReady(item: K8sObject): boolean {
  const status = item.status
  if (typeof status !== 'object' || status === null) return false

  const s = status as Record<string, unknown>

  // Phase check
  const phase = s.phase
  if (typeof phase === 'string') {
    if (phase === 'Running' || phase === 'Active' || phase === 'Succeeded') return true
    // Known non-ready phases — fall through to conditions check
  }

  // Conditions check
  const conditions = s.conditions
  if (Array.isArray(conditions)) {
    for (const c of conditions) {
      if (typeof c !== 'object' || c === null) continue
      const cond = c as Record<string, unknown>
      if (
        typeof cond.type === 'string' &&
        typeof cond.status === 'string' &&
        (cond.type === 'Ready' || cond.type === 'Available') &&
        cond.status === 'True'
      ) {
        return true
      }
    }
  }

  return false
}
