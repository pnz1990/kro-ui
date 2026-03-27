# Research: 045 — RGD Designer Validation & Optimizer

**Branch**: `045-rgd-designer-validation-optimizer`
**Phase**: 0 — Research
**Date**: 2026-03-26

---

## Decision 1: Validation is advisory-only, never blocking

**Decision**: Validation messages are warnings/errors displayed inline but YAML
generation and copying are never disabled.

**Rationale**: The existing pattern (`templateUnparseable` warn-badge, `dagError`
catch) is advisory only. Blocking copy would prevent users from working around
false-positives and contradicts the graceful-degradation principle in Constitution §XII.
Consistency with the existing UX pattern is more important than strictness.

**Alternatives considered**: Disabling "Copy YAML" button when errors exist. Rejected
because a blocked button is more frustrating than a copyable invalid YAML with a warning.

---

## Decision 2: `validateRGDState` as a pure function in `generator.ts`

**Decision**: Add `validateRGDState(state: RGDAuthoringState): ValidationState` to
`web/src/lib/generator.ts` — the existing home for all authoring pure functions.

**Rationale**: `generator.ts` already owns `generateRGDYAML`, `rgdAuthoringStateToSpec`,
and all authoring types. Keeping validation co-located avoids a new file and keeps
the contract surface small. Validation is a pure read-only function — no React deps.

**Alternatives considered**: A separate `validator.ts` module. Rejected — this spec
does not introduce enough validator surface to justify a split. The function can
always be extracted later if it grows.

---

## Decision 3: Validation computed on every render (no debounce)

**Decision**: `validateRGDState` is called directly in `RGDAuthoringForm` on each
render without debouncing. The DAG preview debounce (300ms) is unchanged.

**Rationale**: Validation over ≤20 resources and ≤20 fields is O(N²) at worst
(duplicate detection with Set). With N < 100, this is <1ms per render and does
not need a debounce. Debouncing validation would delay error feedback noticeably.

**Alternatives considered**: Debounce validation at 100ms. Rejected — no measurable
benefit at realistic form sizes, and introduces a delay between user action and
error feedback.

---

## Decision 4: `--color-warning` token must be added to `tokens.css`

**Decision**: Add `--color-warning: #f59e0b` (dark) and `--color-warning: #d97706`
(light) to `tokens.css`. Update the two existing `var(--color-warning, ...)` fallbacks
in `RGDAuthoringForm.css` to use the new token directly.

**Rationale**: Constitution §IX mandates that all colors are defined as named tokens
in `tokens.css`. The existing `var(--color-warning, var(--color-text-muted))` fallback
is a pre-existing violation — warning badges currently render in muted gray instead of
amber. The value `#f59e0b` is already used for `--color-status-warning`,
`--color-reconciling`, `--color-ready-when`, and `--color-advisor-icon` in both
themes, so this introduces no new hue.

**Alternatives considered**: Use `--color-status-warning` directly. Rejected — the
semantic name "warning" is more appropriate for form validation context than a
status-badge-specific token. Aliasing via a named token keeps semantics clean.

---

## Decision 5: Inline validation message DOM pattern

**Decision**: Inline messages use a `<span>` with class `rgd-authoring-form__field-msg`
(error) or `rgd-authoring-form__field-msg--warn` (warning), placed directly below
the affected input. They carry `role="alert"` and `aria-live="polite"`. A `min-height`
reservation prevents layout shift.

**Rationale**: Constitution §IX requires WCAG AA compliance and accessible alerts.
Using `role="alert"` + `aria-live="polite"` announces messages to screen readers
without interrupting the user. `min-height` on the message container prevents sibling
elements from jumping as messages appear/disappear — matching the pattern already
used in the `034-generate-form-polish` spec for required field indicators.

**Alternatives considered**: Using `title` attribute only. Rejected — screen readers
don't consistently read `title`. Using `aria-live="assertive"`. Rejected — too
disruptive for warnings that appear while typing.

---

## Decision 6: `React.memo` on `YAMLPreview`

**Decision**: Wrap `YAMLPreview` in `React.memo` with the default shallow equality
check. No custom comparator needed.

**Rationale**: `YAMLPreview` takes `yaml: string` and `title?: string` — both
primitives. Shallow equality is exact equality for primitives. `React.memo` will
prevent re-renders when the YAML output hasn't changed (e.g. typing in a template
textarea that doesn't affect another resource's YAML output). This is the simplest
correct approach.

**Alternatives considered**: `useMemo` on the YAML string in `AuthorPage` (already
done). Adding `React.memo` as well on the consumer is the complementary step —
the memo on the string value prevents recomputation; the memo on the component
prevents reconciliation of the rendered code block.

---

## Decision 7: Validation summary badge location

**Decision**: The summary badge (`data-testid="validation-summary"`) is placed at
the top of the form body (below the first `<h2>` section header in
`RGDAuthoringForm.tsx`), above the Metadata section.

**Rationale**: It must be visible without scrolling for users with many resources.
Placing it at the very top of the form (above all sections) maximises discoverability.

**Alternatives considered**: Floating badge in the form header. Rejected — the
form has no persistent header; adding one would require layout changes beyond this spec.

---

## Known Constraints

- No new npm or Go dependencies (FR-009, constitution §V).
- No hardcoded hex or rgba in new CSS (FR-010, constitution §IX).
- TypeScript strict mode: 0 errors (NFR-001).
- `validateRGDState` must have 100% branch coverage in `generator.test.ts` (NFR-002).
- All validation is frontend-only — no backend changes needed.
- No E2E journey changes required (per spec Assumptions).

---

## Open Questions / Non-Issues

- **Q: Should validation run on mount (before the user has touched any field)?**
  A: No — required-field errors for `rgdName` and `kind` should only show after
  the field has been visited (blur) OR when the field is actually empty at page
  load. Since `STARTER_RGD_STATE` always has valid defaults (`'my-app'` and
  `'MyApp'`), no errors will show on a fresh load. Track-on-blur is acceptable UX
  but requires per-field `touched` state. Simpler: always validate but show empty-
  field errors only when the value has been explicitly cleared (field is empty AND
  state differs from starter default). Decision: show all issues unconditionally —
  the starter state satisfies all validators, so no false positives on load.

- **Q: Does duplicate detection cross resource `id` vs field `name` namespace?**
  A: No — resource IDs and spec field names are in separate namespaces in kro YAML.
  A resource `id: replicas` and a spec field `name: replicas` do not conflict.
