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
 * Algorithm (order matters):
 *
 *   1. Actively failed phase → false
 *      status.phase ∈ {Failed, Error, CrashLoopBackOff, Unknown, Terminating}
 *
 *   2. Successfully ready phase → true
 *      status.phase ∈ {Running, Active, Succeeded, Bound, Complete, Available}
 *
 *   3. Active failure condition → false
 *      status.conditions has Ready=False or Available=False
 *
 *   4. Active success condition → true
 *      status.conditions has Ready=True or Available=True
 *
 *   5. No status, empty status, or status with no health indicators → true
 *      Resources like ConfigMap, Secret, and ServiceAccount do not emit
 *      status.conditions or status.phase. Their existence means success.
 *      Returning false would produce misleading "0/N healthy" badges for
 *      entirely functional collections of stateless resources.
 *
 * Pure function — no side effects.
 */
export function isItemReady(item: K8sObject): boolean {
  const status = item.status

  // Step 5 fast-path: no status at all → resource type doesn't report health → healthy
  if (typeof status !== 'object' || status === null) return true

  const s = status as Record<string, unknown>
  const phase = s.phase
  const conditions = s.conditions

  // Step 1: actively failed or not-yet-ready phase
  // Pending means the resource hasn't been scheduled/created yet — not healthy.
  const failedPhases = new Set(['Failed', 'Error', 'CrashLoopBackOff', 'Unknown', 'Terminating', 'Pending'])
  if (typeof phase === 'string' && failedPhases.has(phase)) return false

  // Step 2: successfully ready phase
  const readyPhases = new Set(['Running', 'Active', 'Succeeded', 'Bound', 'Complete', 'Available'])
  if (typeof phase === 'string' && readyPhases.has(phase)) return true

  // Steps 3+4: inspect conditions
  if (Array.isArray(conditions) && conditions.length > 0) {
    let hasHealthIndicator = false
    for (const c of conditions) {
      if (typeof c !== 'object' || c === null) continue
      const cond = c as Record<string, unknown>
      if (typeof cond.type !== 'string' || typeof cond.status !== 'string') continue

      const t = cond.type
      const st = cond.status
      if (t === 'Ready' || t === 'Available') {
        hasHealthIndicator = true
        if (st === 'False') return false   // Step 3: active failure
        if (st === 'True') return true     // Step 4: active success
      }
    }

    // Has conditions but none are Ready/Available — no health signal → healthy
    if (!hasHealthIndicator) return true
  }

  // Step 5: empty status or status with no recognized health fields → healthy
  // (Covers ConfigMap, Secret, ServiceAccount, and other stateless resource types)
  return true
}
