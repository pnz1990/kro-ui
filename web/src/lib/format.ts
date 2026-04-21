// format.ts — Pure utility functions for extracting and formatting
// Kubernetes resource data from unstructured K8sObject values.
//
// All functions are pure, never throw, and return safe defaults for
// missing or malformed data. This is the ONLY place that knows about
// kro-specific field paths (constitution §II).

import type { K8sObject } from './api'
import { isHealthyCondition } from './conditions'

// ── Types ────────────────────────────────────────────────────────────

/** Standard Kubernetes condition object shape. */
export interface K8sCondition {
  type: string
  status: string // 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: string
}

/** Tri-state status for UI rendering — extended with reconciling (issue #366). */
export type ReadyState = 'ready' | 'error' | 'unknown' | 'reconciling'

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

// ── Instance health (6-state) ─────────────────────────────────────────

/**
 * Six-state health enumeration for a kro instance.
 *
 * Priority order (worst → best): error > degraded > reconciling > pending > unknown > ready
 *
 * - error:       Ready=False or a negation-polarity condition is unhealthy
 * - degraded:    Ready=True (CR-level) but at least one child resource has
 *                Available=False or its own Ready=False. CR is technically ready
 *                but something is wrong underneath. Requires children data —
 *                only available on the instance detail page, not the card.
 * - reconciling: kro is actively reconciling (Progressing=True, GraphProgressing=True,
 *                or kro status.state === 'IN_PROGRESS')
 * - ready:       Ready=True, all children healthy (or children not checked)
 * - pending:     conditions present but all status=Unknown
 * - unknown:     conditions absent or empty array
 */
export type InstanceHealthState =
  | 'ready'
  | 'degraded'
  | 'reconciling'
  | 'error'
  | 'pending'
  | 'unknown'

/**
 * HEALTH_STATE_ICON — secondary visual signal for color-blind accessible health display.
 *
 * Icon characters are used alongside color (not instead of it) to satisfy
 * WCAG 2.1 SC 1.4.1 (Use of Color). Icons match the HealthChip segment icons
 * for consistency across all health displays in the UI.
 *
 * Single source of truth — import this map in all components that display
 * health state. Never define a local icon map in a component file.
 *
 * Spec: issue-580 / docs/design/30-health-system.md
 */
export const HEALTH_STATE_ICON: Record<InstanceHealthState, string> = {
  ready:       '✓',
  error:       '✗',
  degraded:    '⚠',
  reconciling: '↻',
  pending:     '…',
  unknown:     '?',
}

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
  degraded: number
  error: number
  reconciling: number
  pending: number
  unknown: number
}

const UNKNOWN_INSTANCE_HEALTH: InstanceHealth = { state: 'unknown', reason: '', message: '' }

/**
 * Extract a 6-state health value from an unstructured kro instance object.
 *
 * NOTE: This function only has access to the CR object (not its children), so
 * the 'degraded' state is NOT returned here — it requires children data and
 * is computed separately by the caller when available (InstanceDetail.tsx).
 * Use `applyDegradedState()` to overlay the degraded state after computing it.
 *
 * Derivation order (deterministic, left-to-right):
 *  1. Absent/non-array conditions → 'unknown'
 *  2. kro status.state === 'IN_PROGRESS' → 'reconciling'
 *     (kro v0.8.5 uses this field rather than a Progressing=True condition
 *     when a resource is waiting for readyWhen to be satisfied)
 *  3. Progressing=True OR GraphProgressing=True → 'reconciling'
 *     (kro v0.9.x+ condition; also kro v0.8.x during active reconciliation)
 *  4. Ready=True/False → 'ready'/'error'
 *  5. All conditions Unknown → 'pending'
 *  6. Otherwise → 'unknown'
 *
 * Never throws. `reason` and `message` are always strings.
 */
export function extractInstanceHealth(obj: K8sObject): InstanceHealth {
  const status = obj.status
  if (typeof status !== 'object' || status === null) return UNKNOWN_INSTANCE_HEALTH

  // Step 2: kro status.state === 'IN_PROGRESS' → reconciling.
  // kro v0.8.5 sets this field when readyWhen is unmet — does NOT emit
  // Progressing=True in that case, only ResourcesReady=False + Ready=False.
  const kroState = (status as Record<string, unknown>).state
  if (kroState === 'IN_PROGRESS') {
    return { state: 'reconciling', reason: 'InProgress', message: 'kro is reconciling this instance' }
  }

  const conditions = (status as Record<string, unknown>).conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return UNKNOWN_INSTANCE_HEALTH

  // Only work with valid condition objects
  const valid = conditions.filter((c): c is K8sCondition => isCondition(c))
  if (valid.length === 0) return UNKNOWN_INSTANCE_HEALTH

  // Step 3: Progressing=True OR GraphProgressing=True → reconciling.
  // GraphProgressing is the kro v0.8.x predecessor; support both for compat.
  const progressing = valid.find(
    (c) => (c.type === 'Progressing' || c.type === 'GraphProgressing') && c.status === 'True',
  )
  if (progressing) {
    return {
      state: 'reconciling',
      reason: progressing.reason ?? '',
      message: progressing.message ?? '',
    }
  }

  // Step 4a: Ready condition (the primary health signal for kro instances).
  const ready = valid.find((c) => c.type === 'Ready')
  if (ready) {
    if (isHealthyCondition('Ready', ready.status)) {
      return { state: 'ready', reason: ready.reason ?? '', message: ready.message ?? '' }
    }
    if (ready.status !== 'Unknown') {
      return { state: 'error', reason: ready.reason ?? '', message: ready.message ?? '' }
    }
  }

  // Step 4b: Check negation-polarity conditions (e.g. ReconciliationSuspended=True → error).
  // These are not covered by the Ready=False path above. Issue #220 (028-F3).
  for (const c of valid) {
    if (c.type === 'Ready' || c.status === 'Unknown') continue
    if (!isHealthyCondition(c.type, c.status)) {
      return { state: 'error', reason: c.reason ?? '', message: c.message ?? '' }
    }
  }

  // Step 5: All conditions have status=Unknown → pending
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
  const summary: HealthSummary = { total: 0, ready: 0, degraded: 0, error: 0, reconciling: 0, pending: 0, unknown: 0 }
  for (const item of items) {
    summary.total++
    const { state } = extractInstanceHealth(item)
    summary[state]++
  }
  return summary
}

/**
 * applyDegradedState — overlay the 'degraded' state onto an InstanceHealth
 * when the CR itself is ready but children have errors.
 *
 * Called from InstanceDetail.tsx after computing the NodeStateMap.
 * Only applies when:
 *   - base health is 'ready' (CR-level Ready=True)
 *   - hasChildError is true (at least one child has Available=False or error state)
 *
 * Returns a new InstanceHealth object — never mutates the input.
 */
export function applyDegradedState(health: InstanceHealth, hasChildError: boolean): InstanceHealth {
  if (health.state === 'ready' && hasChildError) {
    return {
      state: 'degraded',
      reason: 'ChildDegraded',
      message: 'One or more child resources have errors while the CR is ready',
    }
  }
  return health
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

  // Future timestamp or clock skew — treat as "just now"
  if (elapsedMs < 0) return 'just now'

  // < 5s: human-friendly "just now" rather than jarring "0s" or "1s"
  if (elapsedMs < 5 * SECOND) return 'just now'

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
    case 'reconciling':
      return '--color-status-reconciling'
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
    case 'reconciling':
      return 'Reconciling'
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

// ── kro v0.9.0 GraphRevisions ─────────────────────────────────────────

/**
 * extractLastRevision — reads the latest graph revision number from an RGD.
 *
 * kro v0.9.0 surfaces the revision in the GraphRevisionsResolved condition
 * message: "revision N compiled and active". Older kro versions used
 * status.lastIssuedRevision (number) which is checked as a fallback.
 *
 * Returns the revision as a string (e.g. "1") or null if unavailable.
 */
export function extractLastRevision(obj: K8sObject): string | null {
  const status = obj.status as Record<string, unknown> | undefined
  if (!status) return null

  // kro v0.9.0+: read from GraphRevisionsResolved condition message
  const conditions = status.conditions
  if (Array.isArray(conditions)) {
    const grCond = (conditions as Array<Record<string, unknown>>).find(
      (c) => c.type === 'GraphRevisionsResolved',
    )
    if (grCond?.status === 'True') {
      const match = String(grCond.message ?? '').match(/^revision\s+(\d+)/i)
      if (match) return match[1]
    }
  }

  // Fallback: status.lastIssuedRevision (future kro versions)
  const raw = status.lastIssuedRevision
  if (typeof raw === 'number' && raw > 0) return String(raw)

  return null
}



/**
 * Abbreviate a kubeconfig context name for display.
 *
 * - AWS EKS ARNs (`arn:aws:eks:…:accountId:cluster/name`):
 *   Returns `{first6}…{last3}/{clusterName}` (e.g. `319279…668/krombat`).
 *   The first 6 + last 3 digits of the account ID provide enough context to
 *   disambiguate two accounts that share the same cluster name. See issue #117.
 * - Short aliases (no `:`) → returned as-is
 * - Other long names → returned as-is (guessing last segment risks ambiguity)
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
    const accountId = eksMatch[1]
    const clusterName = eksMatch[2]
    // Show first 6 + last 3 digits of account ID to disambiguate. If the account
    // ID is short enough to fit entirely, show it all (no ellipsis needed).
    if (accountId.length <= 9) {
      return `${accountId}/${clusterName}`
    }
    const prefix = accountId.slice(0, 6)
    const suffix = accountId.slice(-3)
    return `${prefix}\u2026${suffix}/${clusterName}`
  }

  // Only abbreviate known formats. For unrecognized coloned formats (e.g.
  // OIDC contexts, manual aliases) return as-is — guessing the last segment
  // risks ambiguity. The full value is always on the title attribute.
  return ctx
}

// ── Namespace display ────────────────────────────────────────────────────────

/**
 * displayNamespace — translate the internal `_` cluster-scoped sentinel to the
 * human-readable string "cluster-scoped".
 *
 * kro-ui uses `_` as a URL routing sentinel for cluster-scoped instances
 * (e.g. /rgds/my-rgd/instances/_/my-instance). This sentinel must NEVER be
 * shown to users in rendered text. Every place that renders a namespace string
 * must call this function.
 *
 * Also handles the empty string case for graceful degradation.
 *
 * Per constitution §XIII §XII: "cluster-scoped" is the correct human-readable
 * label; `_` and `""` must never appear in UI text for namespace fields.
 */
export function displayNamespace(ns: string | undefined | null): string {
  if (!ns || ns === '_') return 'cluster-scoped'
  return ns
}

// ── Overview SRE Dashboard helpers (spec 062) ─────────────────────────
//
// These functions operate on InstanceSummary (the compact type returned
// by GET /api/v1/instances) rather than full K8sObject.  They are kept
// here so they can be unit-tested independently of React components.

import type { InstanceSummary } from './api'

/**
 * HealthDistribution — aggregate health counts across all instances.
 * Re-exported from format.ts so widget code imports from a single source.
 */
export interface HealthDistribution {
  total: number
  ready: number
  degraded: number
  error: number
  reconciling: number
  pending: number
  unknown: number
}

/**
 * TopErroringRGD — an RGD name and its count of error-state instances.
 */
export interface TopErroringRGD {
  rgdName: string
  errorCount: number
}

/**
 * healthFromSummary — derive a 4-state InstanceHealthState from a compact
 * InstanceSummary without needing the full conditions array.
 *
 * Mapping (deterministic, left-to-right):
 *   IN_PROGRESS state → 'reconciling'
 *   ready === 'True'  → 'ready'
 *   ready === 'False' → 'error'
 *   otherwise         → 'unknown'
 *
 * Note: 'degraded' and 'pending' are not derivable from InstanceSummary
 * alone (children data required for degraded; full conditions for pending).
 */
export function healthFromSummary(item: InstanceSummary): InstanceHealthState {
  if (item.state === 'IN_PROGRESS') return 'reconciling'
  if (item.ready === 'True') return 'ready'
  if (item.ready === 'False') return 'error'
  return 'unknown'
}

/**
 * buildHealthDistribution — aggregate health counts across all InstanceSummary
 * items using healthFromSummary.
 */
export function buildHealthDistribution(items: InstanceSummary[]): HealthDistribution {
  const dist: HealthDistribution = {
    total: 0, ready: 0, degraded: 0, error: 0,
    reconciling: 0, pending: 0, unknown: 0,
  }
  for (const item of items) {
    dist.total++
    dist[healthFromSummary(item)]++
  }
  return dist
}

/**
 * buildTopErroringRGDs — group error-state instances by rgdName, sort
 * descending by error count, return top N (default 5).
 */
export function buildTopErroringRGDs(items: InstanceSummary[], n = 5): TopErroringRGD[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (healthFromSummary(item) === 'error') {
      counts.set(item.rgdName, (counts.get(item.rgdName) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([rgdName, errorCount]) => ({ rgdName, errorCount }))
}

/** 5-minute threshold for the "may be stuck" heuristic. */
const STUCK_THRESHOLD_MS = 5 * 60 * 1000

/**
 * mayBeStuck — true when an instance is IN_PROGRESS and was created more
 * than 5 minutes ago. Uses creationTimestamp as a proxy for reconcile start.
 * This is a heuristic — the label communicates that intentionally.
 */
export function mayBeStuck(item: InstanceSummary): boolean {
  if (item.state !== 'IN_PROGRESS') return false
  if (!item.creationTimestamp) return false
  const elapsed = Date.now() - Date.parse(item.creationTimestamp)
  return elapsed > STUCK_THRESHOLD_MS
}

/**
 * countMayBeStuck — count of all IN_PROGRESS instances that may be stuck
 * (not capped — used for the W-4 secondary counter).
 */
export function countMayBeStuck(items: InstanceSummary[]): number {
  return items.filter(mayBeStuck).length
}

/**
 * getRecentlyCreated — top N instances sorted by creationTimestamp DESC.
 * Instances with missing timestamps are sorted to the end.
 */
export function getRecentlyCreated(items: InstanceSummary[], n = 5): InstanceSummary[] {
  return [...items]
    .sort((a, b) => {
      const ta = a.creationTimestamp ? Date.parse(a.creationTimestamp) : 0
      const tb = b.creationTimestamp ? Date.parse(b.creationTimestamp) : 0
      return tb - ta
    })
    .slice(0, n)
}

/**
 * getMayBeStuck — top N IN_PROGRESS instances that may be stuck, sorted
 * by creationTimestamp ASC (oldest first — longest-running reconcile).
 */
export function getMayBeStuck(items: InstanceSummary[], n = 5): InstanceSummary[] {
  return items
    .filter(mayBeStuck)
    .sort((a, b) => {
      const ta = a.creationTimestamp ? Date.parse(a.creationTimestamp) : Infinity
      const tb = b.creationTimestamp ? Date.parse(b.creationTimestamp) : Infinity
      return ta - tb
    })
    .slice(0, n)
}
