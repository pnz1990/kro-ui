// resolveResourceName.test.ts — unit tests for resolveResourceName.
// Covers children-list lookup and CR suffix stripping fallback.

import { describe, it, expect } from 'vitest'
import { resolveResourceName } from './resolveResourceName'
import type { K8sObject } from './api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeChild(kind: string, name: string, namespace = 'default'): K8sObject {
  return {
    apiVersion: 'v1',
    kind,
    metadata: { name, namespace },
  }
}

describe('resolveResourceName', () => {
  // ── T020: returns name from children list when present ─────────────────

  it('T020: returns name from children list when a matching kind is found', () => {
    const children = [
      makeChild('Database', 'prod-01-database', 'prod-01'),
      makeChild('ConfigMap', 'prod-01-config', 'prod-01'),
    ]

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T021: infers name by stripping CR suffix when not in children ───────

  it('T021: infers name by stripping CR suffix when not in children list', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T022: infers name by stripping CRs suffix ─────────────────────────

  it('T022: infers name by stripping CRs suffix', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('databaseCRs', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T023: works when no CR suffix present ────────────────────────────────

  it('T023: uses label as-is when no CR/CRs suffix and not in children list', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('configmap', 'my-app', children)
    expect(result).toBe('my-app-configmap')
  })

  // ── T024: case-insensitive kind matching in children list ───────────────

  it('T024: matches kind case-insensitively in children list', () => {
    // Node label "databaseCR" → kind hint "database" (after strip)
    // Children contain "Database" (capitalised)
    const children = [
      makeChild('Database', 'prod-01-database', 'prod-01'),
    ]

    const result = resolveResourceName('databaseCR', 'prod-01', children)
    expect(result).toBe('prod-01-database')
  })

  // ── T025: returns instance-name only if label matches instance ──────────

  it('T025: handles schema/root node by returning instance name', () => {
    const children: K8sObject[] = []

    const result = resolveResourceName('schema', 'prod-01', children)
    // schema node → prepend instance name → "prod-01-schema" (or just instance name)
    // The spec says prepend instance name, so: prod-01-schema
    expect(result).toBe('prod-01-schema')
  })

  // ── T026: prefers first child match when multiple same-kind children ────

  it('T026: returns first matching child when multiple children of same kind', () => {
    const children = [
      makeChild('ConfigMap', 'my-app-cm-1', 'default'),
      makeChild('ConfigMap', 'my-app-cm-2', 'default'),
    ]

    const result = resolveResourceName('configmapCR', 'my-app', children)
    // Should return the first match
    expect(result).toBe('my-app-cm-1')
  })
})
