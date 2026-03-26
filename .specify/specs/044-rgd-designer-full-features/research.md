# Research: 044-rgd-designer-full-features

**Date**: 2026-03-26
**Branch**: `044-rgd-designer-full-features`

---

## Overview

No major unknowns. The codebase is well-understood and all building blocks
exist. This document records every decision made during research so implementors
have a single reference.

---

## Decision 1: Template body authoring — plain `<textarea>` with string passthrough

**Decision**: Each resource row in `RGDAuthoringForm` gets an expandable
"Edit template" disclosure section containing a `<textarea>` that holds
the template body as a raw YAML string. The stored value is a `string`
(`templateYaml: string`) on `AuthoringResource`. During YAML generation,
the string is injected verbatim (indented) into the resource block. No
YAML parse/validate step is performed in real-time.

**Rationale**: There is no YAML parser in the frontend (no `js-yaml` or similar
— `package.json` has only `react`, `react-dom`, `react-router-dom`). Introducing
one would violate Constitution §V (no new dependencies). The existing `toYaml()`
helper in `web/src/lib/yaml.ts` is a serialiser, not a parser. The correct
approach is to treat `templateYaml` as a raw passthrough string, indented with 8
spaces when embedded inside the `template:` block in `generateRGDYAML`. CEL
expressions inside the textarea are preserved verbatim (no re-serialisation).

**Graceful degradation**: If the textarea content cannot be parsed to a JSON
object for the purpose of `rgdAuthoringStateToSpec` (DAG edge inference), the
DAG simply receives `template: {}` and renders the node without inferred edges
from that resource's body. The user sees a warning icon on that resource row
("Template not parseable for DAG — edges may be missing") but the YAML preview
continues to work.

**Alternatives considered**:
- Adding `js-yaml` as a dependency — rejected (violates Constitution §V).
- A structured form (key/value rows per template field) — rejected: too complex
  for the first iteration, doesn't cover nested objects, and fights against users
  who just want to paste their own YAML.
- Monaco editor or CodeMirror — rejected (heavy, external dependency).

---

## Decision 2: CEL expression inputs — plain `<input type="text">` with token spans overlay

**Decision**: `includeWhen`, `readyWhen`, and status field expression inputs are
plain `<input type="text">` elements. A lightweight CSS trick overlays a hidden
`<div>` with the same font/width that renders highlighted token spans (similar
to the "syntax-highlighted textarea" pattern). This gives syntax feedback
without introducing a library.

**Alternative (simpler)**: Use a plain `<input type="text">` with no highlighting
at all, but give it a monospace font and the `--color-surface-3` background so
it reads as "code-like". Add a subtle `CEL` label badge on the right.

**Decision (revised)**: Use the simpler approach — plain `<input type="text">`
with `font-family: var(--font-mono)` and a `CEL` badge. The full overlay
technique is complex (requires careful scroll sync) and the designer is already
gaining significant complexity. The `KroCodeBlock` rendering in the YAML preview
gives CEL feedback for the output. The input field is functional without it.

**Rationale**: Keeps the component simple. Real highlighting feedback is
available in the generated YAML preview. The `KroCodeBlock` already shows
the expression in context.

---

## Decision 3: Resource type mode toggle — three-way select

**Decision**: Each resource row has a `<select>` (or button group) with three
options: "Managed" | "Collection (forEach)" | "External ref". The selection is
stored as `resourceType: 'managed' | 'forEach' | 'externalRef'` on
`AuthoringResource`. Mode-specific fields are rendered conditionally below the
main row.

**Switching modes**: Switching preserves `id`, `apiVersion`, `kind` and the
template. Mode-specific fields (`forEach` iterators, `externalRef` fields) are
reset to empty when switching away.

---

## Decision 4: `forEach` iterators — repeatable `(variable, expression)` rows

**Decision**: `forEach` is stored as `forEachIterators: { _key, variable, expression }[]`
on `AuthoringResource`. The form shows repeatable rows with a variable name input
and an expression input. "+ Add iterator" adds a row. Minimum 1 row when in
forEach mode.

**Serialization**: Maps to:
```yaml
forEach:
  - variable: ${expression}
  - variable2: ${expression2}
```
The `variable` field is the YAML key; the `expression` string is the value.

---

## Decision 5: `externalRef` — scalar vs. collection via toggle

**Decision**: External ref mode shows: `apiVersion`, `kind`, `namespace` (optional),
and a radio: "By name" | "By selector". 
- "By name" shows a `name` text input.
- "By selector" shows repeatable `(label key, label value)` rows for
  `matchLabels`.

Stored on `AuthoringResource` as `externalRef: { apiVersion, kind, namespace, name, selectorLabels }`.

**DAG type determination**: If `name` is non-empty → `NodeTypeExternal`. If
`selectorLabels` has entries (and `name` is empty) → `NodeTypeExternalCollection`.
This matches exactly how `classifyResource` works in `dag.ts`.

---

## Decision 6: `rgdAuthoringStateToSpec` extension

**Decision**: The existing `rgdAuthoringStateToSpec` function in `generator.ts`
must be extended to map the new `AuthoringResource` fields to the spec shape that
`buildDAGGraph` expects:

- `forEach` → add `forEach: [{ [variable]: expression }]` to the resource entry
- `externalRef` → add `externalRef: { apiVersion, kind, metadata: { name?, namespace?, selector? } }`, omit `template`
- `includeWhen` → add `includeWhen: [expression]` (non-empty only)
- `readyWhen` → add `readyWhen: [expr1, expr2, ...]` (non-empty only)
- `templateYaml` → attempt to parse as a simple key-value YAML object to
  extract the `spec` sub-object. If parsing fails, fall back to `spec: {}`.
  Template CEL expressions from the body are used by `buildDAGGraph` for
  edge inference.

**Template YAML parsing for DAG**: Since there is no full YAML parser, use a
minimal approach: attempt `JSON.parse(yamlToJsonApprox(templateYaml))` where
`yamlToJsonApprox` does line-by-line key-value extraction for simple cases.
If it fails, fall back to `{}`. This is a best-effort edge-inference approach —
DAG correctness does not depend on it.

**Alternative**: Pass `templateYaml` as a raw string to `buildDAGGraph` and
let `extractExpressions` run on the raw text directly. Since `extractExpressions`
already works on strings (it's used in `walkTemplate`), passing the template
YAML string directly is simpler and more correct than trying to parse YAML.

**Revised decision**: Pass `template: { _raw: templateYaml }` and let
`walkTemplate` in `dag.ts` extract expressions from the raw YAML string.
`walkTemplate` already handles string values recursively. This avoids any parsing
at all.

---

## Decision 7: `generateRGDYAML` extension strategy

**Decision**: The existing string-concatenation approach in `generateRGDYAML`
is extended:
1. `scope: Cluster` → emitted after `kind:` line when scope is Cluster
2. `status:` fields → emitted as a new section under `spec.schema`
3. Per-resource `includeWhen`, `readyWhen` → emitted before `template:` / `forEach:`
4. `forEach` → emitted instead of `template:` for forEach-mode resources, but
   a `template:` block is still emitted after it (kro requires both)
5. `externalRef` → emitted instead of `template:` for externalRef-mode resources
6. Template body → the `templateYaml` string is indented and injected below
   `template:` header. If `templateYaml` is empty, fall back to `spec: {}`.
7. Spec field constraints → appended to the SimpleSchema string

**CEL placeholders**: Template body content is injected verbatim. The existing
convention (using `${...}` strings which remain unquoted in the line-by-line
string builder) is preserved.

---

## Decision 8: "Advanced options" UX — disclosure pattern

**Decision**: Each resource row has an "Advanced options ▾" toggle button
that reveals `includeWhen` and `readyWhen` fields. Initially collapsed. The
collapse state is local per-row (not persisted). Visual indicator: a small
badge on the row header shows "conditional" or "ready-gated" when non-empty.

---

## Decision 9: Status fields — separate section, identical UX to spec fields

**Decision**: A new "Status Fields" section is added between "Spec Fields"
and "Resources". Each row has: `name` (text input) + `expression` (CEL input).
Stored as `statusFields: { id, name, expression }[]` on `RGDAuthoringState`.

Serialisation:
```yaml
    status:
      fieldName: ${expression}
```
Placed under `spec.schema` after the `spec:` block (or directly after `kind:` if
no spec fields are defined).

---

## Decision 10: `scope` toggle — radio in Metadata section

**Decision**: A "Scope" radio with two options ("Namespaced" (default),
"Cluster") is added to the Metadata section. Stored as `scope: 'Namespaced' | 'Cluster'`
on `RGDAuthoringState`. When Namespaced, no `scope:` key is emitted. When
Cluster, `scope: Cluster` is emitted on the line after `kind:` in the schema.

---

## Decision 11: Spec field constraints — collapsible row expansion

**Decision**: Each spec field row gets a "▾" expand icon. Expanded state shows:
- `enum` (text input, comma-separated, applicable to `string`)
- `minimum` (number input, applicable to `integer`/`number`)
- `maximum` (number input, applicable to `integer`/`number`)
- `pattern` (text input, applicable to `string`)

These are appended to the SimpleSchema string in `buildSimpleSchemaStr`.
Non-empty values override each other per the SimpleSchema spec.

Stored as optional fields on `AuthoringField`: `enum?: string`, `minimum?: string`, `maximum?: string`, `pattern?: string`.

---

## Decision 12: No new components — extend existing form

**Decision**: Rather than creating new sub-components immediately, the changes
are delivered as extensions to `RGDAuthoringForm.tsx`. If the file grows beyond
~500 lines, split into sub-components. New TypeScript types live in
`generator.ts` alongside existing ones.

---

## Resolved unknowns

| Unknown | Resolution |
|---------|-----------|
| Is there a YAML parser already in the frontend? | No — only `toYaml` serialiser. Use raw string passthrough for template body. |
| Can `buildDAGGraph` accept raw template YAML string? | Yes — `walkTemplate` runs `extractExpressions` on any string, so `{ _raw: templateYaml }` works. |
| Does the kro CEL tokenizer work on `<input>` values? | Yes — `tokenize()` is a pure function on any string. For Phase 1 we use a plain `<input type="text">` with monospace styling (no overlay). |
| How does `classifyResource` determine externalCollection? | `externalRef.metadata.selector !== undefined` → externalCollection; `externalRef.metadata.name` → external. |
| Does `rgdAuthoringStateToSpec` need `forEach` for DAG? | Yes. The `classifyResource` function in dag.ts checks `forEach` presence to detect `NodeTypeCollection`. |
| What YAML serialization style for `forEach`? | Array of objects: `- varName: ${expr}`. Matches kro v0.8.5+ fixture format. |
