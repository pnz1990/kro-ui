# Spec: issue-721 — Designer: CEL expression linter

## Design reference
- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer: CEL expression linter (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: When a user types in a `readyWhen` or `includeWhen` CEL input field, lint
diagnostics MUST appear within 500ms of the user stopping typing (debounced). A
`lintCEL(expr, schemaFields)` pure function drives the lint.

**O2**: The linter MUST detect and report the following error classes:
- Unclosed string literal (e.g. `"hello` — no closing `"`)
- Unclosed `${...}` expression (e.g. `${schema.spec.replicas` — no closing `}`)
- Invalid top-level bare literal without operator context (e.g. `"foo"` in a
  `readyWhen` context where a boolean result is expected)
- Empty expression string → no diagnostics (not an error)

**O3**: The linter MUST NOT require a server round-trip. All logic is client-side
pure TypeScript with zero new npm dependencies.

**O4**: Lint errors MUST be displayed as a small inline warning text below the
affected CEL input field. The text MUST reference `--color-status-error` token
for error styling and be accessible with `role="alert"` on the container.

**O5**: When the CEL expression passes all lint checks (or is empty), the warning
text MUST NOT be rendered in the DOM (not just hidden).

**O6**: The `lintCEL` function MUST be exported from `web/src/lib/cel-linter.ts`
and be pure (no side effects, no DOM access, no React imports).

**O7**: Unit tests in `web/src/lib/cel-linter.test.ts` MUST cover:
- Empty input → no diagnostics
- Valid kro CEL expr → no diagnostics
- Each error class in O2 → one diagnostic with `level: 'error'`

**O8**: The feature is only surfaced in the Designer form's `readyWhen` and
`includeWhen` input fields. No other components are changed.

---

## Zone 2 — Implementer's judgment

- **Debounce implementation**: use a simple `useEffect` + `setTimeout` (300ms)
  inside the Designer form. No separate hook required.
- **Diagnostic type**: `{ level: 'error' | 'warning'; message: string }`. A
  single-element array is the common case; empty array means clean.
- **Type checking depth**: shallow only. We detect syntax-level errors (unclosed
  brackets, unclosed strings, bare literals) but do NOT implement full CEL type
  inference. Full type inference requires the CEL specification and would balloon
  scope. The issue description says "type errors and undefined references" but the
  spec scopes to syntax errors as the minimum viable lint.
- **`includeWhen` vs `readyWhen`**: both use identical lint logic. `readyWhen`
  expects a boolean-result expression; the linter warns (not errors) when the
  expression does not contain an operator.
- **CSS**: use existing `.rgd-authoring-form__cel-wrap` container; add
  `.rgd-authoring-form__cel-error` for the inline error text.

---

## Zone 3 — Scoped out

- Full CEL type inference (comparing int to string, undefined variable detection
  against schema field names) — deferred to a follow-up item.
- Server-round-trip validation of CEL semantics.
- Lint for the `forEach` iterator field.
- Lint for status field CEL expressions (read-only view).
- Any new npm dependency.
