// cel-linter.test.ts — Unit tests for the kro CEL expression linter.
//
// Spec: .specify/specs/issue-721/spec.md §O7

import { describe, it, expect } from 'vitest'
import { lintCEL } from './cel-linter'

// ── Empty / clean inputs ───────────────────────────────────────────────────

describe('lintCEL — empty / clean inputs', () => {
  it('returns no diagnostics for empty string', () => {
    expect(lintCEL('')).toEqual([])
  })

  it('returns no diagnostics for whitespace-only string', () => {
    expect(lintCEL('   ')).toEqual([])
  })

  it('returns no diagnostics for a simple boolean comparison', () => {
    expect(lintCEL('${schema.spec.replicas} >= 1')).toEqual([])
  })

  it('returns no diagnostics for a nested template expression', () => {
    expect(lintCEL('${web.status.availableReplicas} >= ${schema.spec.minReplicas}')).toEqual([])
  })

  it('returns no diagnostics for a quoted string comparison', () => {
    expect(lintCEL('${pod.status.phase} == "Running"')).toEqual([])
  })

  it('returns no diagnostics for a logical AND expression', () => {
    expect(lintCEL('${a.status.ready} && ${b.status.ready}')).toEqual([])
  })

  it('returns no diagnostics for a CEL function call', () => {
    expect(lintCEL('size(${items}) > 0')).toEqual([])
  })

  it('returns no diagnostics for kro hash function call', () => {
    expect(lintCEL('hash.fnv64a(${schema.spec.name})')).toEqual([])
  })

  it('returns no diagnostics for a boolean literal', () => {
    expect(lintCEL('true')).toEqual([])
  })

  it('returns no diagnostics for includeWhen condition', () => {
    expect(lintCEL('${schema.spec.enableCache}', 'includeWhen')).toEqual([])
  })
})

// ── Unclosed string literals ───────────────────────────────────────────────

describe('lintCEL — unclosed string literals', () => {
  it('detects unclosed double-quoted string', () => {
    const diags = lintCEL('"hello')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
    expect(diags[0].message).toMatch(/unclosed string literal/i)
  })

  it('detects unclosed single-quoted string', () => {
    const diags = lintCEL("'hello")
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
  })

  it('does not flag closed double-quoted string (in comparison)', () => {
    // Use a comparison so bare-string warning does not apply
    expect(lintCEL('"hello" == ${phase}')).toEqual([])
  })

  it('does not flag closed single-quoted string (in comparison)', () => {
    expect(lintCEL("'hello' == ${phase}")).toEqual([])
  })

  it('handles escaped quote inside string', () => {
    // Expression is a comparison — no bare string warning
    expect(lintCEL('"hello\\"world" == ${val}')).toEqual([])
  })

  it('detects unclosed string after a closed one', () => {
    const diags = lintCEL('"closed" + "open')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
  })

  it('does not flag raw string r"..."', () => {
    expect(lintCEL('r"hello"')).toEqual([])
  })
})

// ── Unclosed ${...} templates ──────────────────────────────────────────────

describe('lintCEL — unclosed ${...} templates', () => {
  it('detects unclosed ${...}', () => {
    const diags = lintCEL('${schema.spec.replicas')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
    expect(diags[0].message).toMatch(/unclosed template/i)
  })

  it('does not flag closed ${...}', () => {
    expect(lintCEL('${schema.spec.replicas}')).toEqual([])
  })

  it('detects unclosed ${ with no content', () => {
    const diags = lintCEL('${')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
  })

  it('does not flag when ${ is inside a string (comparison context)', () => {
    // "${schema" inside quotes is a string, not a template — use comparison
    expect(lintCEL('"${schema.spec.x}" == "other"')).toEqual([])
  })
})

// ── Unclosed brackets ──────────────────────────────────────────────────────

describe('lintCEL — unclosed brackets', () => {
  it('detects unclosed parenthesis', () => {
    const diags = lintCEL('size(${items}')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
    expect(diags[0].message).toMatch(/unclosed.*\(/i)
  })

  it('detects unclosed square bracket', () => {
    const diags = lintCEL('${list}[0')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
    expect(diags[0].message).toMatch(/unclosed.*\[/i)
  })

  it('does not flag balanced brackets', () => {
    expect(lintCEL('size(${items}) > 0')).toEqual([])
  })

  it('does not flag balanced square brackets', () => {
    expect(lintCEL('${list}[0] == "ok"')).toEqual([])
  })

  it('detects unexpected closing bracket', () => {
    const diags = lintCEL('${a} > 1)')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
    expect(diags[0].message).toMatch(/unexpected/i)
  })
})

// ── Bare string literal warning ────────────────────────────────────────────

describe('lintCEL — bare string literal warning', () => {
  it('warns on bare double-quoted string in readyWhen context', () => {
    const diags = lintCEL('"Running"', 'readyWhen')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('warning')
    expect(diags[0].message).toMatch(/boolean/i)
  })

  it('warns on bare single-quoted string in readyWhen context', () => {
    const diags = lintCEL("'Running'", 'readyWhen')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('warning')
  })

  it('warns on bare string in includeWhen context', () => {
    const diags = lintCEL('"enabled"', 'includeWhen')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('warning')
  })

  it('does not warn when string is in a comparison', () => {
    expect(lintCEL('"Running" == ${phase}')).toEqual([])
  })

  it('does not warn for boolean literals', () => {
    expect(lintCEL('true', 'readyWhen')).toEqual([])
    expect(lintCEL('false', 'readyWhen')).toEqual([])
  })
})

// ── Error takes precedence over warning ───────────────────────────────────

describe('lintCEL — error takes precedence', () => {
  it('returns error (not warning) when string is unclosed', () => {
    const diags = lintCEL('"unclosed', 'readyWhen')
    expect(diags).toHaveLength(1)
    expect(diags[0].level).toBe('error')
  })
})
