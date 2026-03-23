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

/**
 * 5-state instance health for the overlay summary bar and any component that
 * needs to distinguish between Progressing (reconciling), all-Unknown (pending),
 * Ready=False (error), Ready=True (ready), and no conditions (unknown).
 *
 * Precedence (highest wins):
 *   reconciling — Progressing=True is present
 *   error       — Ready=False (and no Progressing=True)
 *   ready       — Ready=True
 *   pending     — conditions present but all status=Unknown
 *   unknown     — no conditions at all
 */
export type InstanceHealthState = 'ready' | 'reconciling' | 'error' | 'pending' | 'unknown'

export interface InstanceHealth {
  state: InstanceHealthState
}

/**
 * extractInstanceHealth — derives a 5-state health value from a K8s instance object.
 *
 * Never throws. Returns { state: 'unknown' } for any malformed input.
 */
export function extractInstanceHealth(obj: K8sObject): InstanceHealth {
  const status = obj.status
  if (typeof status !== 'object' || status === null) return { state: 'unknown' }

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return { state: 'unknown' }

  const conds = conditions.filter(isCondition)
  if (conds.length === 0) return { state: 'unknown' }

  // Progressing=True wins — kro is actively reconciling
  if (conds.some((c) => c.type === 'Progressing' && c.status === 'True')) {
    return { state: 'reconciling' }
  }
  // Ready=False → error
  if (conds.some((c) => c.type === 'Ready' && c.status === 'False')) {
    return { state: 'error' }
  }
  // Ready=True → ready
  if (conds.some((c) => c.type === 'Ready' && c.status === 'True')) {
    return { state: 'ready' }
  }
  // Conditions present but all status=Unknown → pending (waiting on dependency)
  if (conds.every((c) => c.status === 'Unknown')) {
    return { state: 'pending' }
  }
  return { state: 'unknown' }
}

// ── Type guard ───────────────────────────────────────────────────────

/** Runtime type guard: narrows unknown to K8sCondition. */
function isCondition(v: unknown): v is K8sCondition {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.type === 'string' && typeof obj.status === 'string'
}

// ── Instance health (5-state) ─────────────────────────────────────────

/**
 * Five-state health enumeration for a kro instance.
 *
 * Priority order (worst → best): error > reconciling > pending > unknown > ready
 *
 * - reconciling: kro is actively reconciling (Progressing=True)
 * - error:       Ready=False
 * - ready:       Ready=True
 * - pending:     conditions present but all status=Unknown
 * - unknown:     conditions absent or empty array
 */
export type InstanceHealthState =
  | 'ready'
  | 'reconciling'
  | 'error'
  | 'pending'
  | 'unknown'

/** Full extraction result for 5-state instance health. */
export interface InstanceHealth {
  state: InstanceHealthState
  reason: string
  message: string
}

/** Aggregated health counts across all instances of an RGD. */
export interface HealthSummary {
  total: number
  ready: number
  error: number
  reconciling: number
  pending: number
  unknown: number
}

const UNKNOWN_INSTANCE_HEALTH: InstanceHealth = { state: 'unknown', reason: '', message: '' }

/**
 * Extract a 5-state health value from an unstructured kro instance object.
 *
 * Derivation order (deterministic, left-to-right):
 *  1. Absent/non-array conditions → 'unknown'
 *  2. Progressing=True → 'reconciling' (checked before Ready)
 *  3. Ready=True/False → 'ready'/'error'
 *  4. All conditions Unknown → 'pending'
 *  5. Otherwise → 'unknown'
 *
 * Never throws. `reason` and `message` are always strings.
 */
export function extractInstanceHealth(obj: K8sObject): InstanceHealth {
  const status = obj.status
  if (typeof status !== 'object' || status === null) return UNKNOWN_INSTANCE_HEALTH

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return UNKNOWN_INSTANCE_HEALTH

  // Only work with valid condition objects
  const valid = conditions.filter((c): c is K8sCondition => isCondition(c))
  if (valid.length === 0) return UNKNOWN_INSTANCE_HEALTH

  // Step 2: Progressing=True → reconciling
  const progressing = valid.find((c) => c.type === 'Progressing' && c.status === 'True')
  if (progressing) {
    return {
      state: 'reconciling',
      reason: progressing.reason ?? '',
      message: progressing.message ?? '',
    }
  }

  // Step 3: Ready condition
  const ready = valid.find((c) => c.type === 'Ready')
  if (ready) {
    if (ready.status === 'True') {
      return { state: 'ready', reason: ready.reason ?? '', message: ready.message ?? '' }
    }
    if (ready.status === 'False') {
      return { state: 'error', reason: ready.reason ?? '', message: ready.message ?? '' }
    }
  }

  // Step 4: All conditions have status=Unknown → pending
  if (valid.every((c) => c.status === 'Unknown')) {
    return { state: 'pending', reason: '', message: '' }
  }

  return UNKNOWN_INSTANCE_HEALTH
}

/**
 * Aggregate health counts across a list of instances.
 * Used by RGDCard's async health chip.
 */
export function aggregateHealth(items: K8sObject[]): HealthSummary {
  const summary: HealthSummary = { total: 0, ready: 0, error: 0, reconciling: 0, pending: 0, unknown: 0 }
  for (const item of items) {
    summary.total++
    const { state } = extractInstanceHealth(item)
    summary[state]++
  }
  return summary
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

// ── Context name abbreviation ─────────────────────────────────────────

/**
 * Abbreviate a kubeconfig context name for display.
 *
 * - AWS EKS ARNs (`arn:aws:eks:…:cluster/name`) → `accountId/clusterName`
 * - Short aliases (no `:`) → returned as-is
 * - Other long names → last segment after `/`
 *
 * The full value is always accessible via a `title` attribute on the element.
 * See §XIII (Context/cluster disambiguation) and AGENTS.md anti-pattern #63.
 *
 * @param ctx Full kubeconfig context name
 * @returns Human-readable abbreviated label, always non-empty
 */
export function abbreviateContext(ctx: string): string {
  if (!ctx) return ctx

  // AWS EKS ARN: arn:aws:eks:<region>:<accountId>:cluster/<clusterName>
  const eksMatch = ctx.match(/^arn:aws:eks:[^:]+:([^:]+):cluster\/(.+)$/)
  if (eksMatch) {
    return `${eksMatch[1]}/${eksMatch[2]}`
  }

  // Only abbreviate known formats. For unrecognized coloned formats (e.g.
  // OIDC contexts, manual aliases) return as-is — guessing the last segment
  // risks ambiguity. The full value is always on the title attribute.
  return ctx
}
