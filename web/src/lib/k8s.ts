// k8s.ts — Typed accessors for raw Kubernetes unstructured objects.
//
// This is the ONLY place that casts from `unknown` to typed values.
// All deletion helper functions are defined here and imported by components.
// Never copy-paste these helpers into component files.
//
// Spec: .specify/specs/031-deletion-debugger/

import type { K8sObject } from './api'

// ── Metadata types ─────────────────────────────────────────────────────────

export interface OwnerReference {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
  blockOwnerDeletion?: boolean
}

export interface KubernetesMetadata {
  name?: string
  namespace?: string
  uid?: string
  resourceVersion?: string
  creationTimestamp?: string
  /** RFC3339 timestamp. Set = object is in Terminating state. */
  deletionTimestamp?: string
  deletionGracePeriodSeconds?: number
  /** List of finalizer strings blocking deletion. May be absent (treat as []). */
  finalizers?: string[]
  labels?: Record<string, string>
  annotations?: Record<string, string>
  ownerReferences?: OwnerReference[]
  generation?: number
}

// ── Metadata extractor ─────────────────────────────────────────────────────

/**
 * extractMetadata — safely extracts typed metadata from an unstructured object.
 *
 * This is the ONLY place that touches `unknown` values via typeof narrowing.
 * Never use `as` casts directly on `unknown` fields.
 */
export function extractMetadata(obj: K8sObject): KubernetesMetadata {
  const rawMeta = obj.metadata
  if (!rawMeta || typeof rawMeta !== 'object') return {}
  const m = rawMeta as Record<string, unknown>

  const finalizers: string[] | undefined = Array.isArray(m.finalizers)
    ? (m.finalizers as unknown[]).filter((f): f is string => typeof f === 'string')
    : undefined

  const ownerReferences: OwnerReference[] | undefined = Array.isArray(m.ownerReferences)
    ? (m.ownerReferences as unknown[]).flatMap((ref): OwnerReference[] => {
        if (!ref || typeof ref !== 'object') return []
        const r = ref as Record<string, unknown>
        if (typeof r.apiVersion !== 'string') return []
        if (typeof r.kind !== 'string') return []
        if (typeof r.name !== 'string') return []
        if (typeof r.uid !== 'string') return []
        return [{
          apiVersion: r.apiVersion,
          kind: r.kind,
          name: r.name,
          uid: r.uid,
          controller: typeof r.controller === 'boolean' ? r.controller : undefined,
          blockOwnerDeletion: typeof r.blockOwnerDeletion === 'boolean' ? r.blockOwnerDeletion : undefined,
        }]
      })
    : undefined

  const labels: Record<string, string> | undefined =
    m.labels && typeof m.labels === 'object' && !Array.isArray(m.labels)
      ? (m.labels as Record<string, unknown>) as Record<string, string>
      : undefined

  const annotations: Record<string, string> | undefined =
    m.annotations && typeof m.annotations === 'object' && !Array.isArray(m.annotations)
      ? (m.annotations as Record<string, unknown>) as Record<string, string>
      : undefined

  return {
    name: typeof m.name === 'string' ? m.name : undefined,
    namespace: typeof m.namespace === 'string' ? m.namespace : undefined,
    uid: typeof m.uid === 'string' ? m.uid : undefined,
    resourceVersion: typeof m.resourceVersion === 'string' ? m.resourceVersion : undefined,
    creationTimestamp: typeof m.creationTimestamp === 'string' ? m.creationTimestamp : undefined,
    deletionTimestamp: typeof m.deletionTimestamp === 'string' ? m.deletionTimestamp : undefined,
    deletionGracePeriodSeconds:
      typeof m.deletionGracePeriodSeconds === 'number' ? m.deletionGracePeriodSeconds : undefined,
    finalizers,
    labels,
    annotations,
    ownerReferences,
    generation: typeof m.generation === 'number' ? m.generation : undefined,
  }
}

// ── Deletion state helpers ─────────────────────────────────────────────────

/**
 * isTerminating — returns true if the object has a deletionTimestamp set.
 *
 * A set deletionTimestamp means a DELETE request was accepted and the object
 * is blocked from removal by one or more finalizers.
 */
export function isTerminating(obj: K8sObject): boolean {
  const m = obj.metadata
  if (!m || typeof m !== 'object') return false
  return typeof (m as Record<string, unknown>).deletionTimestamp === 'string'
}

/**
 * getDeletionTimestamp — returns the raw RFC3339 deletionTimestamp string, or undefined.
 */
export function getDeletionTimestamp(obj: K8sObject): string | undefined {
  const m = obj.metadata
  if (!m || typeof m !== 'object') return undefined
  const ts = (m as Record<string, unknown>).deletionTimestamp
  return typeof ts === 'string' ? ts : undefined
}

/**
 * getFinalizers — returns the list of finalizer strings.
 * Always returns an array (never undefined or null).
 * Uses Array.isArray + element-level type narrowing (never bare `as` cast).
 */
export function getFinalizers(obj: K8sObject): string[] {
  const m = obj.metadata
  if (!m || typeof m !== 'object') return []
  const fins = (m as Record<string, unknown>).finalizers
  if (!Array.isArray(fins)) return []
  return fins.filter((f): f is string => typeof f === 'string')
}

/**
 * getKroFinalizers — returns finalizers that start with 'kro.run/'.
 */
export function getKroFinalizers(obj: K8sObject): string[] {
  return getFinalizers(obj).filter((f) => f.startsWith('kro.run/'))
}

/**
 * getNonKroFinalizers — returns finalizers that do NOT start with 'kro.run/'.
 */
export function getNonKroFinalizers(obj: K8sObject): string[] {
  return getFinalizers(obj).filter((f) => !f.startsWith('kro.run/'))
}

// ── Deletion event classification ──────────────────────────────────────────

/**
 * DELETION_REASONS — canonical set of Kubernetes event reason strings that
 * indicate deletion-related activity.
 *
 * Includes both kro-specific reasons (ResourceDeleted, FinalizerRemoved, etc.)
 * and Kubernetes core reasons (Killing, FailedKillPod, etc.).
 */
export const DELETION_REASONS: ReadonlySet<string> = new Set([
  'Killing',
  'Deleted',
  'FailedDelete',
  'SuccessfulDelete',
  'DeletionFailed',
  'FailedKillPod',
  'ResourceDeleted',
  'FinalizerRemoved',
  'DeletionBlocked',
  'Terminating',
  'PreStopHookFailed',
])

/**
 * isDeletionEvent — returns true if the event's reason is in DELETION_REASONS.
 *
 * Returns false if reason is absent or not a string (graceful degradation).
 */
export function isDeletionEvent(event: K8sObject): boolean {
  const reason = event.reason
  if (typeof reason !== 'string') return false
  return DELETION_REASONS.has(reason)
}

// ── Relative time formatting ───────────────────────────────────────────────

/**
 * formatRelativeTime — converts an RFC3339 timestamp to a human-readable
 * relative time string ("Ns ago", "Nm ago", "Nh ago", "Nd ago").
 *
 * Falls back to the raw string if the timestamp cannot be parsed.
 * Does not use Intl.RelativeTimeFormat to ensure consistent output.
 */
export function formatRelativeTime(isoTimestamp: string): string {
  let diffMs: number
  try {
    const parsed = new Date(isoTimestamp)
    if (isNaN(parsed.getTime())) return isoTimestamp
    diffMs = Date.now() - parsed.getTime()
  } catch {
    return isoTimestamp
  }

  // Clamp to 0 — don't show negative times (clock skew)
  if (diffMs < 0) diffMs = 0

  const totalSeconds = Math.floor(diffMs / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s ago`

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m ago`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h ago`

  const totalDays = Math.floor(totalHours / 24)
  return `${totalDays}d ago`
}
