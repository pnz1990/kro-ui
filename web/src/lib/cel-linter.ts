// cel-linter.ts — Client-side CEL expression linter for kro Designer.
//
// Pure function, zero dependencies, no DOM access, no React imports.
// Detects syntax-level issues in kro CEL expressions used in readyWhen /
// includeWhen fields. Does NOT perform full CEL type inference — that would
// require the full CEL specification and is scoped out (see spec issue-721).
//
// Spec: .specify/specs/issue-721/spec.md

// ── Types ──────────────────────────────────────────────────────────────────

/** Severity of a CEL lint diagnostic. */
export type CELDiagnosticLevel = 'error' | 'warning'

/** A single lint diagnostic produced by lintCEL(). */
export interface CELDiagnostic {
  level: CELDiagnosticLevel
  message: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check for unclosed string literals in a CEL expression.
 * Handles single-quoted and double-quoted strings.
 * Recognises `r"..."` / `r'...'` raw string prefixes (CEL extension).
 * Does NOT handle triple-quoted strings (not used in kro CEL).
 */
function checkUnclosedStrings(expr: string): CELDiagnostic | null {
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]

    // Skip raw string prefix
    const isRaw = (ch === 'r' || ch === 'R') && i + 1 < expr.length &&
      (expr[i + 1] === '"' || expr[i + 1] === "'")
    if (isRaw) {
      i++  // skip 'r'
    }

    if (expr[i] === '"' || expr[i] === "'") {
      const quote = expr[i]
      i++
      let closed = false
      while (i < expr.length) {
        if (expr[i] === '\\') {
          i += 2  // skip escaped character
          continue
        }
        if (expr[i] === quote) {
          closed = true
          i++
          break
        }
        i++
      }
      if (!closed) {
        return {
          level: 'error',
          message: `Unclosed string literal (missing closing ${quote === '"' ? '"' : "'"})`,
        }
      }
      continue
    }

    i++
  }
  return null
}

/**
 * Check for unclosed ${...} kro template expressions.
 * kro CEL interpolation uses `${...}` — nesting is NOT supported.
 */
function checkUnclosedTemplates(expr: string): CELDiagnostic | null {
  let i = 0
  while (i < expr.length) {
    if (expr[i] === '$' && i + 1 < expr.length && expr[i + 1] === '{') {
      const closeIdx = expr.indexOf('}', i + 2)
      if (closeIdx === -1) {
        return {
          level: 'error',
          message: 'Unclosed template expression (missing closing })',
        }
      }
      i = closeIdx + 1
      continue
    }
    i++
  }
  return null
}

/**
 * Check for unclosed parentheses, brackets, and braces (non-template `{`).
 * A bare `{` that is not part of `${` is a CEL map literal — check it is closed.
 */
function checkUnclosedBrackets(expr: string): CELDiagnostic | null {
  type BracketKind = '(' | '[' | '{'
  const stack: BracketKind[] = []
  const closes: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const labels: Record<string, string> = { '(': ')', '[': ']', '{': '}' }

  let i = 0
  while (i < expr.length) {
    const ch = expr[i]

    // Skip strings to avoid false positives from brackets inside literals
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < expr.length) {
        if (expr[i] === '\\') { i += 2; continue }
        if (expr[i] === quote) { i++; break }
        i++
      }
      continue
    }

    // Skip ${...} template — treated atomically
    if (ch === '$' && i + 1 < expr.length && expr[i + 1] === '{') {
      const closeIdx = expr.indexOf('}', i + 2)
      if (closeIdx !== -1) {
        i = closeIdx + 1
        continue
      }
      // Unclosed template handled by checkUnclosedTemplates; skip to end
      break
    }

    if (ch === '(' || ch === '[') {
      stack.push(ch as BracketKind)
    } else if (ch === '{') {
      stack.push('{' as BracketKind)
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const expected = closes[ch]
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        return {
          level: 'error',
          message: `Unexpected '${ch}' — no matching opening bracket`,
        }
      }
      stack.pop()
    }

    i++
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1] as string
    const closing = labels[unclosed]
    return {
      level: 'error',
      message: `Unclosed '${unclosed}' (missing closing '${closing}')`,
    }
  }

  return null
}

/**
 * Warn when a readyWhen expression appears to be a bare string literal with no
 * comparison operator — e.g. `"running"` alone cannot produce a boolean value.
 *
 * Only applies to `context === 'readyWhen'`. `includeWhen` has the same semantics.
 */
function checkBareStringLiteral(expr: string, context: CELContext): CELDiagnostic | null {
  const trimmed = expr.trim()
  // A bare string literal: starts and ends with matching quote, no operators
  const isQuotedString =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)

  if (!isQuotedString) return null

  // If the inner content has no operators it's a bare string constant
  const inner = trimmed.slice(1, -1)
  const hasOperator = /[=!<>&|]/.test(inner)
  if (hasOperator) return null

  const fieldLabel = context === 'readyWhen' ? 'readyWhen' : 'includeWhen'
  return {
    level: 'warning',
    message: `${fieldLabel} must evaluate to a boolean; a bare string literal always returns a truthy value, not a comparison result`,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Context in which the CEL expression is used. Influences which checks apply. */
export type CELContext = 'readyWhen' | 'includeWhen'

/**
 * Lint a kro CEL expression and return an array of diagnostics.
 *
 * - Returns `[]` for empty or whitespace-only input (not an error).
 * - Never throws — malformed input produces best-effort diagnostics.
 * - All checks are syntax-level only; no type inference is performed.
 *
 * @param expr    The CEL expression string to lint.
 * @param context Where the expression is used (affects which warnings fire).
 */
export function lintCEL(expr: string, context: CELContext = 'readyWhen'): CELDiagnostic[] {
  if (!expr || expr.trim() === '') return []

  const diagnostics: CELDiagnostic[] = []

  // O2: Run each check; stop after first error (single-error UX is cleaner)
  const unclosedStr = checkUnclosedStrings(expr)
  if (unclosedStr) {
    diagnostics.push(unclosedStr)
    return diagnostics
  }

  const unclosedTpl = checkUnclosedTemplates(expr)
  if (unclosedTpl) {
    diagnostics.push(unclosedTpl)
    return diagnostics
  }

  const unclosedBrk = checkUnclosedBrackets(expr)
  if (unclosedBrk) {
    diagnostics.push(unclosedBrk)
    return diagnostics
  }

  const bareStr = checkBareStringLiteral(expr, context)
  if (bareStr) {
    diagnostics.push(bareStr)
  }

  return diagnostics
}
