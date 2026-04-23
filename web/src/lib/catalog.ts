// catalog.ts — Pure functions for the RGD catalog page.
//
// This module is the single place that knows about the cross-RGD
// chaining relationship and catalog-level metadata extraction.
// All functions are pure, never throw, and return safe defaults.

import type { K8sObject } from './api'

// ── Label extraction ─────────────────────────────────────────────────

/**
 * Extract metadata.labels as a plain string→string record.
 * Returns {} for any missing / malformed input.
 */
export function extractLabels(obj: K8sObject): Record<string, string> {
  const meta = obj.metadata
  if (typeof meta !== 'object' || meta === null) return {}
  const labels = (meta as Record<string, unknown>).labels
  if (typeof labels !== 'object' || labels === null) return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels as Record<string, unknown>)) {
    if (typeof v === 'string') result[k] = v
  }
  return result
}

// ── Resource template kind extraction ───────────────────────────────

/**
 * Extract the list of template kinds from spec.resources[].
 * Each resource may have `template.apiVersion`, `template.kind`, or
 * a nested `template.spec.type`. We only need the `kind` field.
 * Returns [] for any missing / malformed input.
 */
export function extractTemplateKinds(obj: K8sObject): string[] {
  const spec = obj.spec
  if (typeof spec !== 'object' || spec === null) return []
  const resources = (spec as Record<string, unknown>).resources
  if (!Array.isArray(resources)) return []

  const kinds: string[] = []
  for (const res of resources) {
    if (typeof res !== 'object' || res === null) continue
    const r = res as Record<string, unknown>
    const template = r.template
    if (typeof template !== 'object' || template === null) continue
    const t = template as Record<string, unknown>
    const kind = t.kind
    if (typeof kind === 'string' && kind !== '') {
      kinds.push(kind)
    }
  }
  return kinds
}

// ── Schema kind extraction ───────────────────────────────────────────

/**
 * Extract spec.schema.kind — the CRD kind that this RGD generates.
 */
function extractSchemaKind(obj: K8sObject): string {
  const spec = obj.spec
  if (typeof spec !== 'object' || spec === null) return ''
  const schema = (spec as Record<string, unknown>).schema
  if (typeof schema !== 'object' || schema === null) return ''
  const kind = (schema as Record<string, unknown>).kind
  return typeof kind === 'string' ? kind : ''
}

/**
 * Extract metadata.name — the RGD resource name.
 */
function extractName(obj: K8sObject): string {
  const meta = obj.metadata
  if (typeof meta !== 'object' || meta === null) return ''
  const name = (meta as Record<string, unknown>).name
  return typeof name === 'string' ? name : ''
}

// ── Chaining map ─────────────────────────────────────────────────────

/**
 * Build a "used by" relationship map from the full list of RGDs.
 *
 * For each RGD A, inspect its `spec.resources[].template.kind` values.
 * If any of those kinds matches another RGD B's `spec.schema.kind`, then
 * RGD B is referenced by (used in) RGD A.
 *
 * Returns Map<rgdName, string[]> where the value is the list of RGD names
 * that reference this RGD's generated kind.
 *
 * @example
 * // RGD "full-stack-app" has a resource with template.kind = "Database"
 * // RGD "database" has spec.schema.kind = "Database"
 * // Result: { "database" => ["full-stack-app"] }
 */
export function buildChainingMap(rgds: K8sObject[]): Map<string, string[]> {
  const map = new Map<string, string[]>()

  // Index: schemaKind → rgdName  (for O(1) lookups)
  const kindToRGDName = new Map<string, string>()
  for (const rgd of rgds) {
    const name = extractName(rgd)
    const kind = extractSchemaKind(rgd)
    if (name && kind) {
      kindToRGDName.set(kind, name)
    }
  }

  // Walk each RGD's resource template kinds and record "used by" links
  for (const rgd of rgds) {
    const referrerName = extractName(rgd)
    if (!referrerName) continue

    const templateKinds = extractTemplateKinds(rgd)
    for (const kind of templateKinds) {
      const referencedRGDName = kindToRGDName.get(kind)
      // Skip self-reference and missing mappings
      if (!referencedRGDName || referencedRGDName === referrerName) continue

      const existing = map.get(referencedRGDName) ?? []
      if (!existing.includes(referrerName)) {
        map.set(referencedRGDName, [...existing, referrerName])
      }
    }
  }

  return map
}

// ── Catalog filtering and sorting helpers ────────────────────────────

/**
 * Test whether an RGD matches a search query.
 * Case-insensitive substring match across name, schema kind, and label values.
 */
export function matchesSearch(obj: K8sObject, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()

  const name = extractName(obj).toLowerCase()
  if (name.includes(q)) return true

  const kind = extractSchemaKind(obj).toLowerCase()
  if (kind.includes(q)) return true

  const labels = extractLabels(obj)
  for (const [k, v] of Object.entries(labels)) {
    if (k.toLowerCase().includes(q) || v.toLowerCase().includes(q)) return true
  }

  return false
}

/**
 * Test whether an RGD has all the required labels (AND logic).
 * An empty filter set matches every RGD.
 *
 * @param activeLabels  Array of "key=value" strings that must all be present.
 */
export function matchesLabelFilter(obj: K8sObject, activeLabels: string[]): boolean {
  if (activeLabels.length === 0) return true
  const labels = extractLabels(obj)
  return activeLabels.every((kv) => {
    const [k, v] = kv.split('=')
    return labels[k] === v
  })
}

/**
 * Collect all unique "key=value" label strings from a list of RGDs.
 * Used to populate the LabelFilter dropdown.
 */
export function collectAllLabels(rgds: K8sObject[]): string[] {
  const set = new Set<string>()
  for (const rgd of rgds) {
    const labels = extractLabels(rgd)
    for (const [k, v] of Object.entries(labels)) {
      set.add(`${k}=${v}`)
    }
  }
  return Array.from(set).sort()
}

// ── Complexity score ─────────────────────────────────────────────────

/**
 * Count how many other RGDs reference this RGD via chaining
 * (i.e., how many referrers this RGD has in the catalog).
 * Returns 0 when the RGD is not referenced by any other RGD.
 */
export function countChainingReferences(obj: K8sObject, allRgds: K8sObject[]): number {
  const name = extractName(obj)
  if (!name) return 0
  const chainingMap = buildChainingMap(allRgds)
  return (chainingMap.get(name) ?? []).length
}

/** Multiplier for chaining depth in complexity formula. */
const CHAINING_WEIGHT = 2
/** Multiplier for forEach collections in complexity formula. */
const FOR_EACH_WEIGHT = 3

/**
 * Compute a complexity score for an RGD.
 *
 * Formula: resources.length + (chainingReferenceCount × 2) + (forEachCount × 3)
 *
 * - `resources.length`: base cost — every managed resource adds complexity
 * - `chainingReferenceCount × 2`: chained RGDs are harder to debug across boundaries
 * - `forEachCount × 3`: forEach collections expand N×, increasing blast radius
 *
 * Returns 0 for missing / malformed input.
 */
export function computeComplexityScore(obj: K8sObject, chainingReferenceCount = 0): number {
  const spec = obj.spec
  if (typeof spec !== 'object' || spec === null) return 0
  const resources = (spec as Record<string, unknown>).resources
  if (!Array.isArray(resources)) return 0

  const resourceCount = resources.length
  const forEachCount = resources.filter((r) => {
    if (typeof r !== 'object' || r === null) return false
    return 'forEach' in (r as Record<string, unknown>)
  }).length

  return resourceCount + chainingReferenceCount * CHAINING_WEIGHT + forEachCount * FOR_EACH_WEIGHT
}

// ── Sort options ─────────────────────────────────────────────────────

export type SortOption = 'name' | 'kind' | 'instances' | 'resources' | 'newest' | 'complexity'

/**
 * Sort an array of RGDs with their associated instance counts and complexity scores.
 * Returns a new sorted array — does not mutate the input.
 */
export function sortCatalog(
  entries: Array<{ rgd: K8sObject; instanceCount: number | null | undefined; complexityScore?: number }>,
  option: SortOption,
): Array<{ rgd: K8sObject; instanceCount: number | null | undefined; complexityScore?: number }> {
  const sorted = [...entries]
  sorted.sort((a, b) => {
    switch (option) {
      case 'name':
        return extractName(a.rgd).localeCompare(extractName(b.rgd))
      case 'kind':
        return extractSchemaKind(a.rgd).localeCompare(extractSchemaKind(b.rgd))
      case 'instances': {
        // undefined (loading) and null (failed) sort last; use -1 as sentinel
        const ai = a.instanceCount ?? -1
        const bi = b.instanceCount ?? -1
        return bi - ai
      }
      case 'resources': {
        const spec = (obj: K8sObject) => {
          const s = obj.spec as Record<string, unknown> | null | undefined
          return Array.isArray(s?.resources) ? s.resources.length : 0
        }
        return spec(b.rgd) - spec(a.rgd)
      }
      case 'newest': {
        const ts = (obj: K8sObject) => {
          const meta = obj.metadata as Record<string, unknown> | null | undefined
          const t = meta?.creationTimestamp
          return typeof t === 'string' ? t : ''
        }
        return ts(b.rgd).localeCompare(ts(a.rgd))
      }
      case 'complexity': {
        const sa = a.complexityScore ?? 0
        const sb = b.complexityScore ?? 0
        return sb - sa
      }
    }
  })
  return sorted
}
