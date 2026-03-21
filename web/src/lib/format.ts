// format.ts — Pure utility functions for extracting and formatting
// Kubernetes resource data from unstructured K8sObject values.
//
// All functions are pure, never throw, and return safe defaults for
// missing or malformed data. This is the ONLY place that knows about
// kro-specific field paths (constitution §II).

import type { K8sObject } from './api'

// ── Types ────────────────────────────────────────────────────────────

/** Standard Kubernetes condition object shape. */
export interface K8sCondition {
  type: string
  status: string // 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: string
}

/** Tri-state status for UI rendering. */
export type ReadyState = 'ready' | 'error' | 'unknown'

/** Full extraction result — gives components everything they need. */
export interface ReadyStatus {
  state: ReadyState
  reason: string
  message: string
}

// ── Type guard ───────────────────────────────────────────────────────

/** Runtime type guard: narrows unknown to K8sCondition. */
function isCondition(v: unknown): v is K8sCondition {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.type === 'string' && typeof obj.status === 'string'
}

// ── Age formatting ───────────────────────────────────────────────────

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Convert an ISO 8601 timestamp to a kubectl-style relative age string.
 * Pure function, no side effects. Returns 'Unknown' for invalid input.
 */
export function formatAge(isoTimestamp: string): string {
  if (!isoTimestamp) return 'Unknown'

  const parsed = Date.parse(isoTimestamp)
  if (Number.isNaN(parsed)) return 'Unknown'

  const elapsedMs = Date.now() - parsed

  // Future timestamp or clock skew — show 0s, don't show negative
  if (elapsedMs < 0) return '0s'

  if (elapsedMs < MINUTE) {
    const s = Math.floor(elapsedMs / SECOND)
    return `${s}s`
  }
  if (elapsedMs < HOUR) {
    const m = Math.floor(elapsedMs / MINUTE)
    return `${m}m`
  }
  if (elapsedMs < DAY) {
    const h = Math.floor(elapsedMs / HOUR)
    return `${h}h`
  }

  const d = Math.floor(elapsedMs / DAY)
  return `${d}d`
}

// ── Status extraction ────────────────────────────────────────────────

const UNKNOWN_STATUS: ReadyStatus = { state: 'unknown', reason: '', message: '' }

/**
 * Extract the Ready condition from an unstructured K8s object.
 * Safely walks: obj.status.conditions[] → find type==='Ready'
 * Never throws. Returns { state: 'unknown' } for any malformed input.
 */
export function extractReadyStatus(obj: K8sObject): ReadyStatus {
  const status = obj.status
  if (typeof status !== 'object' || status === null) return UNKNOWN_STATUS

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions)) return UNKNOWN_STATUS

  const ready = conditions.find(
    (c: unknown): c is K8sCondition => isCondition(c) && c.type === 'Ready',
  )
  if (!ready) return UNKNOWN_STATUS

  const state: ReadyState =
    ready.status === 'True'
      ? 'ready'
      : ready.status === 'False'
        ? 'error'
        : 'unknown'

  return {
    state,
    reason: ready.reason ?? '',
    message: ready.message ?? '',
  }
}

/**
 * Map a ReadyState to its CSS custom property name from tokens.css.
 * Returns the variable name (e.g., '--color-status-ready'), never a hex value.
 */
export function readyStateColor(state: ReadyState): string {
  switch (state) {
    case 'ready':
      return '--color-status-ready'
    case 'error':
      return '--color-status-error'
    case 'unknown':
      return '--color-status-unknown'
  }
}

/**
 * Map a ReadyState to a human-readable label for accessibility and tooltips.
 */
export function readyStateLabel(state: ReadyState): string {
  switch (state) {
    case 'ready':
      return 'Ready'
    case 'error':
      return 'Not Ready'
    case 'unknown':
      return 'Unknown'
  }
}

// ── Field extraction helpers ─────────────────────────────────────────

/** Extract metadata.name as string, or '' if missing. */
export function extractRGDName(obj: K8sObject): string {
  const meta = obj.metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const name = (meta as Record<string, unknown>).name
  return typeof name === 'string' ? name : ''
}

/** Extract spec.schema.kind as string, or '' if missing. */
export function extractRGDKind(obj: K8sObject): string {
  const spec = obj.spec
  if (typeof spec !== 'object' || spec === null) return ''
  const schema = (spec as Record<string, unknown>).schema
  if (typeof schema !== 'object' || schema === null) return ''
  const kind = (schema as Record<string, unknown>).kind
  return typeof kind === 'string' ? kind : ''
}

/** Extract spec.resources.length as number, or 0 if missing/not-array. */
export function extractResourceCount(obj: K8sObject): number {
  const spec = obj.spec
  if (typeof spec !== 'object' || spec === null) return 0
  const resources = (spec as Record<string, unknown>).resources
  return Array.isArray(resources) ? resources.length : 0
}

/** Extract metadata.creationTimestamp as string, or '' if missing. */
export function extractCreationTimestamp(obj: K8sObject): string {
  const meta = obj.metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const ts = (meta as Record<string, unknown>).creationTimestamp
  return typeof ts === 'string' ? ts : ''
}
