// catalog.ts — Pure functions for the RGD catalog page.
//
// This module is the single place that knows about the cross-RGD
// chaining relationship and catalog-level metadata extraction.
// All functions are pure, never throw, and return safe defaults.

import type { K8sObject } from './api'

// ── Label extraction ─────────────────────────────────────────────────

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
