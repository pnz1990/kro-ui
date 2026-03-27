# Feature Specification: RGD Designer — Validation & Optimizer

**Feature Branch**: `045-rgd-designer-validation-optimizer`
**GH Issue**: (none — internal quality initiative)
**Created**: 2026-03-26
**Updated**: 2026-03-26 (US8 — bidirectional YAML import added)
**Status**: Draft
**Depends on**: `044-rgd-designer-full-features` (merged, PR #272)

---

## Context

The RGD Designer (`/author`) now supports all 5 kro node types after spec `044`.
However, it has virtually no form validation — incomplete or structurally invalid
configurations are silently skipped or pass through to the YAML preview with no
user feedback.

Concretely:

- Empty `rgdName` / `kind` produce invalid YAML silently
- Duplicate resource `id` values produce a kro validation error at apply time,
  but the designer shows no hint
- Duplicate spec/status field names are silently overwritten in generated YAML
- An `includeWhen` expression with unclosed `${` is emitted verbatim (kro CEL
  parse failure at runtime)
- A spec field with `minimum > maximum` produces an invalid schema string
- A forEach resource with no iterator produces `forEach: []` which kro rejects
- The YAML preview updates synchronously even during fast typing, causing
  excessive re-renders on large forms (20+ resources)

This spec adds a targeted validation layer and a small set of UX optimisations
to make the designer reliable enough for users to apply generated YAMLs without
needing a separate linting step.

It also adds **bidirectional YAML import** (US8): a user can paste an existing
`ResourceGraphDefinition` YAML into an import textarea and have the form fields
populated automatically, making the designer useful for editing existing RGDs —
not just authoring new ones from scratch.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Immediate feedback on required metadata (Priority: P1)

A new user opens the designer, clears the `Kind` field to type a new one, and
clicks "Copy YAML". Today: the YAML silently emits `kind: ""`. With this spec:
the `Kind` field shows an inline error ("Kind is required"), the Copy button is
visually indicated as producing invalid YAML (not blocked — copy still works so
the user can fix it externally).

**Why this priority**: Empty Kind or RGD name are the most common beginner
mistakes and produce the most confusing apply-time errors.

**Independent Test**: Clear the `Kind` field. Observe inline error message.
Check that the YAML preview still renders (not blocked). Re-type a valid PascalCase
kind and observe the error disappears.

**Acceptance Scenarios**:

1. **Given** the `Kind` input is empty, **When** it loses focus or the form is in
   that state, **Then** an inline error message "Kind is required" is shown beneath
   the input.
2. **Given** the `RGD Name` input is empty, **When** the field is empty, **Then**
   an inline error "RGD name is required" appears beneath it.
3. **Given** the `Kind` input contains lowercase characters (e.g. `webApp` instead
   of `WebApp`), **When** the user types, **Then** a soft warning (not error)
   "Kind should be PascalCase" appears (non-blocking).
4. **Given** the `RGD Name` contains characters that are not valid DNS subdomain
   characters (uppercase, spaces, underscores), **When** the field is in that state,
   **Then** a soft warning "RGD name should be a valid DNS subdomain (lowercase
   alphanumeric and hyphens)" appears.
5. **Given** any inline error or warning is shown, **Then** it MUST NOT prevent
   YAML generation or copying — validation is advisory only.

---

### User Story 2 — Duplicate resource ID detection (Priority: P1)

A platform engineer copies a resource row and forgets to rename the ID. They
get `duplicate key "deployment"` in kro's reconciler. With this spec: the
duplicate ID row is highlighted inline with "Duplicate resource ID".

**Why this priority**: Duplicate IDs are a silent hard failure in kro. The
generated YAML is structurally invalid.

**Independent Test**: Add two resources both with `id = deployment`. Observe
that both rows show "Duplicate resource ID" badge. Rename one. Badge disappears
immediately.

**Acceptance Scenarios**:

1. **Given** two resource rows share the same non-empty `id`, **When** the second
   row receives the duplicate ID, **Then** both rows show a "Duplicate ID" inline
   warning next to the ID input.
2. **Given** one of the two duplicate IDs is renamed, **Then** both warnings
   disappear immediately.
3. **Given** a resource with `id = ""` (empty), **Then** no duplicate warning is
   shown (empty ID is handled separately).

---

### User Story 3 — Duplicate spec/status field name detection (Priority: P1)

An engineer adds two spec fields both named `replicas`. The second silently
overwrites the first in generated YAML. With this spec: both rows show an
inline "Duplicate field name" warning.

**Acceptance Scenarios**:

1. **Given** two spec field rows have the same non-empty `name`, **Then** both
   show "Duplicate field name" inline below the name input.
2. **Given** two status field rows share a name, **Then** both show "Duplicate
   field name" inline.
3. **Given** one duplicate name is changed, **Then** both warnings clear.

---

### User Story 4 — Min ≤ max constraint validation (Priority: P2)

An engineer sets `minimum=10, maximum=5` on an integer spec field. The generated
SimpleSchema string `"integer | minimum=10 | maximum=5"` would fail kro schema
validation. With this spec: an inline warning "minimum must be ≤ maximum" is
shown on the expanded constraints panel.

**Acceptance Scenarios**:

1. **Given** a spec field has `minimum` and `maximum` both set, and `minimum >
   maximum`, **When** the constraint panel is visible, **Then** an inline
   warning "minimum must be ≤ maximum" is shown.
2. **Given** the constraint values are corrected, **Then** the warning disappears.
3. **Given** only one of minimum/maximum is set, **Then** no cross-field warning.

---

### User Story 5 — forEach iterator completeness check (Priority: P2)

An engineer switches a resource to "Collection (forEach)" but leaves the
iterator rows empty (variable + expression both blank). The generated YAML is
`forEach: []`, which kro rejects. With this spec: the resource card shows a
warning "forEach requires at least one iterator".

**Acceptance Scenarios**:

1. **Given** a resource is in forEach mode with no iterator rows, or all iterator
   rows have both `variable` and `expression` empty, **Then** the resource card
   header shows a "forEach needs an iterator" warning badge.
2. **Given** at least one iterator has a non-empty variable and expression,
   **Then** the warning disappears.

---

### User Story 6 — Overall validation summary badge (Priority: P2)

A user with several errors wants to know at a glance before copying the YAML.
With this spec: a compact badge below the form header shows "3 warnings" when
validation issues exist, or nothing (no badge) when clean.

**Acceptance Scenarios**:

1. **Given** one or more validation issues exist across the form, **When** the
   form renders, **Then** a badge "N warning(s)" (singular/plural) is visible
   at the top of the form below the section heading.
2. **Given** all issues are resolved, **Then** the badge disappears.
3. **Given** the badge is present, it is advisory only and does NOT disable the
   YAML copy button.

---

### User Story 7 — YAML preview performance: skip silent re-render on unchanged output (Priority: P3)

On a large form (15+ resources, 20+ spec fields), every keystroke in a template
textarea triggers a full `generateRGDYAML` run and a React re-render of the
entire `YAMLPreview` block. With this spec: `YAMLPreview` is memoised so it
only re-renders when the YAML string actually changes.

**Why this priority**: Not a correctness issue, but affects perceived
responsiveness on large forms without requiring a new dependency.

**Acceptance Scenarios**:

1. **Given** the YAML preview is wrapped with `React.memo`, **When** the parent
   re-renders without changing the YAML string, **Then** `YAMLPreview` does not
   re-render (verifiable via React DevTools or a render-count spy in tests).

---

### User Story 8 — Bidirectional YAML import: paste YAML to populate form (Priority: P1)

A platform engineer has an existing `ResourceGraphDefinition` YAML (from their
cluster, from a colleague, or from kro docs). They want to load it into the
designer to inspect or modify it. Today there is no way — the form is authoring-
only and output-only. With this spec: an "Import YAML" collapsible panel appears
above the form. The user pastes their YAML, clicks "Apply", and the form fields
are populated from the parsed content. The YAML preview immediately reflects the
imported state.

**Why this priority**: This is the single most impactful usability gap in the
designer. Without it, the tool is write-only. A returning user who made manual
changes to their YAML outside the designer cannot round-trip through the UI.

**Independent Test**: Copy the YAML output from a completed form. Clear the form
(refresh the page to reset to starter state). Paste the copied YAML into the
import panel. Click "Apply". Observe that all form fields (metadata, spec fields,
status fields, resources) are populated to match the original state. The YAML
preview immediately shows the same YAML that was pasted.

**Acceptance Scenarios**:

1. **Given** an "Import YAML" collapsible panel above the Metadata section,
   **When** the user clicks the panel header, **Then** it expands to reveal a
   `<textarea>` for pasting YAML and an "Apply" button.

2. **Given** the user pastes a valid `ResourceGraphDefinition` YAML and clicks
   "Apply", **Then** the form fields are populated:
   - `metadata.name` → `rgdName`
   - `spec.schema.kind` → `kind`
   - `spec.schema.apiVersion` → `apiVersion`
   - `spec.schema.group` (if present) → `group`
   - `spec.schema.scope` (if `Cluster`) → `scope = 'Cluster'`; otherwise `Namespaced`
   - `spec.schema.spec.*` → `specFields[]` (name + SimpleSchema type string parsed
     back to type/default/required/constraints)
   - `spec.schema.status.*` → `statusFields[]` (name + expression)
   - `spec.resources[]` → `resources[]` (id, apiVersion, kind, template body,
     includeWhen, readyWhen, forEach, externalRef — all 5 kro node types)

3. **Given** the pasted YAML is not a valid `ResourceGraphDefinition`
   (missing `kind: ResourceGraphDefinition`, unparseable structure, etc.),
   **When** the user clicks "Apply", **Then** an inline parse error is shown
   below the textarea and the form state is NOT changed.

4. **Given** a valid import is applied, **When** the panel is visible, **Then**
   the panel collapses automatically and the YAML preview updates immediately.

5. **Given** the pasted YAML contains fields the designer does not model
   (e.g., `spec.resources[].template.spec` with complex nested content),
   **When** imported, **Then** the template body content is preserved verbatim
   in the resource's `templateYaml` field (raw passthrough — graceful
   degradation, not an error).

6. **Given** the pasted YAML contains a resource with no `template` key and no
   `externalRef` key (unrecognised structure), **When** imported, **Then** the
   resource is imported as a `managed` type with empty `templateYaml` (best-effort
   — never crashes or skips the resource entirely).

7. **Given** a YAML is imported and then modified via the form, **When** the user
   opens the import panel again and pastes a different YAML, **Then** the form
   is fully replaced with the new import (import is always a full replace, not a
   merge).

---

### Edge Cases (US8)

- YAML with `spec.schema.spec` absent → `specFields = []`, no error
- YAML with `spec.resources` absent or empty → `resources = []`, no error
- Resource with `forEach` array but no `template` key → imported as forEach type
  with empty `templateYaml`
- Resource with `externalRef.metadata.selector` → imported as `externalRef` type
  with `selectorLabels` populated
- SimpleSchema string `"integer | required | minimum=1 | maximum=100"` → parsed
  back to `{ type: 'integer', required: true, minimum: '1', maximum: '100' }`
- SimpleSchema string with unknown modifiers (not produced by the designer) →
  treated as an opaque type string, stored verbatim in `type`, other constraint
  fields left empty (graceful degradation)
- YAML from `kubectl get rgd -o yaml` (has `status:`, `creationTimestamp:`, etc.)
  → only `spec.schema` and `spec.resources` fields are consumed, all others ignored
- Pasting YAML with CEL `${...}` expressions → preserved verbatim in template
  body and expression fields (never mangled)

---

- Kind = valid PascalCase but contains a number (`MyApp2`) → no warning (numbers
  are allowed in Kubernetes kind names)
- RGD name = `my--app` (consecutive hyphens) → warning (invalid DNS subdomain)
- Duplicate ID between a `managed` and an `externalRef` resource → both warned
- A forEach resource with one iterator where variable is filled but expression
  is empty → still shows the "needs iterator" warning (incomplete pair)
- Minimum = `0` (valid), maximum = `0` (valid, minimum === maximum) → no warning

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `RGDAuthoringForm` component MUST compute a `ValidationState`
  object from `RGDAuthoringState` and render inline validation messages adjacent
  to the affected inputs, with no blocking of YAML generation.
- **FR-002**: `ValidationState` MUST be computed by a pure function
  `validateRGDState(state: RGDAuthoringState): ValidationState` exported from
  `web/src/lib/generator.ts`.
- **FR-003**: `ValidationState` MUST carry: required-field errors (`rgdName`,
  `kind`), format warnings (`kind` PascalCase, `rgdName` DNS subdomain),
  duplicate resource ID warnings (keyed by resource `_key`), duplicate spec
  field name warnings (keyed by field `id`), duplicate status field name
  warnings (keyed by status field `id`), min > max constraint warnings (keyed
  by field `id`), and forEach-no-iterator warnings (keyed by resource `_key`).
- **FR-004**: Inline validation messages MUST appear beneath the affected input
  element and MUST use `role="alert"` with `aria-live="polite"`.
- **FR-005**: A summary warning count badge MUST be rendered at the top of the
  form (`data-testid="validation-summary"`) showing "N warning(s)" when N > 0,
  hidden otherwise.
- **FR-006**: The Copy YAML button (inside `YAMLPreview`) MUST NOT be disabled
  when validation issues exist — it MUST remain functional.
- **FR-007**: `YAMLPreview` MUST be wrapped in `React.memo` so it only
  re-renders when its `yaml` prop changes.
- **FR-008**: Validation MUST recompute on every state change without debounce
  (it is cheap — O(N) over form rows). The DAG preview remains debounced at
  300ms (unchanged).
- **FR-009**: No new npm or Go dependencies may be introduced.
- **FR-010**: All new CSS classes MUST use `tokens.css` custom properties; no
  hardcoded hex or `rgba()`.
- **FR-011**: A `parseRGDYAML(yaml: string): ParseResult` pure function MUST be
  exported from `web/src/lib/generator.ts`. It MUST return either
  `{ ok: true, state: RGDAuthoringState }` or `{ ok: false, error: string }`.
  It MUST never throw.
- **FR-012**: `parseRGDYAML` MUST use only the existing `web/src/lib/yaml.ts`
  helper and native `String` operations — no new npm dependencies.
  A hand-written line-by-line YAML parser scoped to the `ResourceGraphDefinition`
  structure is acceptable.
- **FR-013**: An "Import YAML" collapsible panel MUST be added to `AuthorPage`
  above the form. It MUST contain a `<textarea>` (`data-testid="import-yaml-input"`)
  and an "Apply" button (`data-testid="import-yaml-apply"`).
- **FR-014**: On "Apply", if `parseRGDYAML` returns `{ ok: true }`, the form
  state MUST be replaced with the parsed `RGDAuthoringState` and the panel MUST
  collapse. If `{ ok: false }`, an inline error message MUST be shown below the
  textarea and form state MUST NOT change.
- **FR-015**: The import is always a **full replace** of form state — it never
  merges with the existing state.
- **FR-016**: `parseRGDYAML` MUST generate new stable `id` / `_key` values for
  all imported rows (using the same `newFieldId` / `newResourceId` helpers as the
  form) so that React reconciliation works correctly after import.
- **FR-017**: A `POST /api/v1/rgds/validate` backend endpoint MUST accept a raw
  YAML string body, perform a `dryRun=All` SSA apply via the existing dynamic
  client, and return `DryRunResult` JSON: `{ valid: bool, error?: string }`. It
  MUST NOT persist any state. Response time MUST be within the 5s handler budget.
- **FR-018**: A "Validate against cluster" button MUST appear in `YAMLPreview`
  (`data-testid="dry-run-btn"`). On click it calls `POST /api/v1/rgds/validate`
  with the current YAML. Result is shown in `data-testid="dry-run-result"`. The
  result MUST be cleared whenever the `yaml` prop changes.
- **FR-019**: A `POST /api/v1/rgds/validate/static` backend endpoint MUST accept
  a raw YAML string body and perform **offline** validation using kro library
  packages: `pkg/simpleschema` (spec field type strings), `pkg/cel`
  (CEL expression syntax via `DefaultEnvironment()`), and a format check on
  resource IDs. It MUST NOT contact the Kubernetes API server. It MUST return
  `StaticValidationResult` JSON: `{ issues: StaticIssue[] }` where each issue
  carries `{ field: string, message: string }`.
- **FR-020**: The frontend MUST call `POST /api/v1/rgds/validate/static`
  automatically, debounced at 1 second after any YAML change, and display results
  in a "Deep validation" section in `RGDAuthoringForm` below the summary badge.
- **FR-021**: The `internal/validate/` Go package MUST encapsulate all kro library
  calls. Handlers MUST NOT import kro packages directly — they MUST call through
  `internal/validate/`. This ensures kro version upgrades require changes in only
  one package.
- **FR-022**: The kro dependency version is managed via a single `go.mod` line.
  `make tidy` MUST keep it in sync. No new `replace` directives or vendoring are
  introduced.

### Non-Functional Requirements

- **NFR-001**: TypeScript strict mode — 0 errors after all changes.
- **NFR-002**: `validateRGDState` MUST have 100% unit-test branch coverage
  (all validation paths exercised in `generator.test.ts`).
- **NFR-003**: Inline messages MUST meet WCAG AA contrast against the dark theme
  background.
- **NFR-004**: Adding a validation message MUST NOT shift the layout of other
  form elements (use `min-height` reservation or absolute positioning on the
  message element).
- **NFR-005**: `parseRGDYAML` MUST have unit-test branch coverage for all 5
  resource node types, all SimpleSchema modifier combinations, and the
  `{ ok: false }` error path.
- **NFR-006**: The `internal/validate/` package MUST have `go test -race` coverage
  for all validation paths (SimpleSchema parse error, valid schema, CEL parse error,
  valid CEL, ID format error, valid ID). Test MUST NOT require cluster connectivity.
- **NFR-007**: `internal/validate/` MUST compile and all its tests MUST pass with
  `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/validate/...`.

### Key Entities

- **`ValidationState`** — new type in `generator.ts`:
  ```typescript
  export interface ValidationIssue {
    type: 'error' | 'warning'
    message: string
  }
  export interface ValidationState {
    rgdName?: ValidationIssue
    kind?: ValidationIssue
    resourceIssues: Record<string, ValidationIssue>   // keyed by resource._key
    specFieldIssues: Record<string, ValidationIssue>  // keyed by AuthoringField.id
    statusFieldIssues: Record<string, ValidationIssue>// keyed by AuthoringStatusField.id
    totalCount: number
  }
  ```
- **`validateRGDState(state: RGDAuthoringState): ValidationState`** — pure
  function in `generator.ts`, no side effects.
- **`ParseResult`** — new type in `generator.ts`:
  ```typescript
  export type ParseResult =
    | { ok: true; state: RGDAuthoringState }
    | { ok: false; error: string }
  ```
- **`parseRGDYAML(yaml: string): ParseResult`** — pure function in `generator.ts`.
  Parses a `ResourceGraphDefinition` YAML string into `RGDAuthoringState`. Never
  throws. Returns `{ ok: false, error }` on invalid input.
- **`DryRunResult`** — new Go response type in `internal/api/types/response.go`:
  ```go
  type DryRunResult struct {
      Valid bool   `json:"valid"`
      Error string `json:"error,omitempty"`
  }
  ```
- **`StaticIssue`** — new Go type in `internal/api/types/response.go`:
  ```go
  type StaticIssue struct {
      Field   string `json:"field"`
      Message string `json:"message"`
  }
  type StaticValidationResult struct {
      Issues []StaticIssue `json:"issues"`
  }
  ```
- **`internal/validate/` package** — new Go package encapsulating all kro library
  validation. Exports:
  - `ValidateSimpleSchema(specFields map[string]string) []StaticIssue`
  - `ValidateCELExpressions(resources []map[string]any) []StaticIssue`
  - `ValidateResourceIDs(ids []string) []StaticIssue`

---

## Success Criteria *(mandatory)*

- **SC-001**: Clearing the `Kind` field shows "Kind is required" beneath it
  without crashing or clearing the YAML preview.
- **SC-002**: Adding two resources with the same `id` immediately shows "Duplicate
  ID" on both rows.
- **SC-003**: The validation summary badge shows the correct count for a form
  with 3 independent issues.
- **SC-004**: `validateRGDState` has full branch coverage in unit tests.
- **SC-005**: TypeScript strict mode passes with 0 errors.
- **SC-006**: `YAMLPreview` wrapped in `React.memo` — verified by test.
- **SC-007**: No new npm dependencies. No hardcoded hex/rgba in CSS.
- **SC-008**: Pasting the YAML output of a fully-filled form back into the
  import panel and clicking "Apply" reproduces the original `RGDAuthoringState`
  exactly (round-trip fidelity test in `generator.test.ts`).
- **SC-009**: Pasting invalid YAML (e.g., plain text) shows a parse error below
  the import textarea and leaves the form state unchanged.
- **SC-010**: Pasting YAML from `kubectl get rgd -o yaml` (with `status`,
  `creationTimestamp`, etc.) imports successfully — extra fields are ignored.
- **SC-011**: `POST /api/v1/rgds/validate` with valid YAML returns `{ valid: true }`;
  the frontend shows a green badge. With invalid YAML (broken CEL in a deployed
  RGD) returns `{ valid: false, error: "..." }`.
- **SC-012**: `POST /api/v1/rgds/validate/static` with `"badtype"` as a spec field
  type returns an issue with the field name and kro's error message. With valid
  schema fields returns `{ issues: [] }`.
- **SC-013**: `POST /api/v1/rgds/validate/static` with a broken CEL expression
  (`${x +++}`) returns an issue referencing the resource ID and kro's CEL error.
- **SC-014**: `POST /api/v1/rgds/validate/static` with a PascalCase resource ID
  (`MyDeployment`) returns an ID format issue.
- **SC-015**: `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/validate/...`
  passes without cluster connectivity.
- **SC-016**: Bumping kro to a hypothetical `v0.10.0` in `go.mod` + `make tidy` +
  `make build` is the complete upgrade procedure — no other files require changes.

---

## Assumptions

- `validateRGDState` is a pure function over `RGDAuthoringState` — it does not
  need to call `generateRGDYAML` or `buildDAGGraph`.
- Validation messages are advisory only; YAML generation continues regardless.
  This matches the pattern established by the `templateUnparseable` heuristic.
- PascalCase validation: `kind` matches `/^[A-Z][a-zA-Z0-9]*$/`.
- DNS subdomain validation: `rgdName` matches
  `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/`
  (RFC 1123 label, allowing dots for subdomain style as kro metadata.name).
- The `YAMLPreview` component currently takes a `yaml: string` and `title: string`
  prop. Wrapping it in `React.memo` requires no interface changes.
- No E2E journey changes are required — existing journeys do not test validation
  messages. New unit tests in `RGDAuthoringForm.test.tsx` and `generator.test.ts`
  cover all acceptance scenarios.
- **`parseRGDYAML` does not need a general-purpose YAML parser.** The
  `generateRGDYAML` function uses a deterministic fixed-indent string-construction
  format. The parser can rely on that known structure (fixed key positions, fixed
  indentation levels) using line-by-line string parsing rather than a full YAML
  grammar. This is acceptable because:
  (a) the designer round-trips its own output — it does not need to parse arbitrary
  third-party YAML; (b) kubectl YAML output for kro follows the same schema; (c)
  a general-purpose YAML parser would require a new npm dependency (§V prohibits
  this unless the alternative is significantly more complex — and a 150-line
  hand-written parser is not significantly more complex for this fixed schema).
- The `parseRGDYAML` function MUST handle YAML produced by both `generateRGDYAML`
  and `kubectl get rgd -o yaml`. The only structural difference is `kubectl` output
  includes `status:` and `creationTimestamp:` fields — these are ignored.
- **Dry-run apply is a write-direction operation** (`dryRun=All` against the
  Kubernetes API server), but it does NOT persist any state — the Kubernetes
  admission chain processes the object and returns validation errors without
  writing to etcd. This is the accepted trade-off for real semantic validation.
  The operation is explicitly scoped as non-persisting in the handler
  documentation and in the `DryRunResult` response schema.
- The dry-run endpoint accepts raw YAML as a request body, parses it into an
  `unstructured.Unstructured`, and calls `Apply` with `DryRun: []string{"All"}`.
  If the apply succeeds (HTTP 200/201 from the API server), kro's admission
  webhook accepted the object — it is structurally and semantically valid.
  If it fails, the Kubernetes API error message is returned verbatim.
- The dry-run handler does NOT require the RGD to already exist in the cluster.
  A `dryRun=All` apply on a non-existent resource tests the object against the
  admission webhook without requiring it to be present first.
- The 5s API handler timeout (Constitution §XI) applies to the dry-run handler.
  kro's admission webhook typically responds in < 500ms for small RGDs.
- **`pkg/simpleschema.ParseField`** (kro library) validates the full type+modifier
  string for each spec field. It is synchronous, pure, and requires no cluster
  connection. If it returns an error, the type string is invalid by kro's own rules.
- **`pkg/cel.DefaultEnvironment()`** (kro library) builds the standard kro CEL
  environment with all extensions. `env.Parse(expr)` validates CEL syntax without
  evaluation. This is also synchronous and requires no cluster connection.
- **Resource ID format**: kro requires `lowerCamelCase` IDs — `[a-z][a-zA-Z0-9]*`.
  IDs starting with uppercase, containing hyphens/underscores, or matching kro
  reserved words are rejected. The format rule is documented in kro's `pkg/graph`
  source (`validation.go`) but the relevant regex is `^[a-z][a-zA-Z0-9]*$`.
- **`internal/validate/` is the kro version firewall.** If `pkg/simpleschema` or
  `pkg/cel` APIs change between kro versions, only `internal/validate/` needs
  updating. The function signatures exported by `internal/validate/` are stable
  across kro versions — they deal in plain Go strings and the `StaticIssue` struct.

---

## User Story 9 — Dry-run compile check: validate YAML against the cluster (Priority: P2)

A platform engineer has authored an RGD with complex CEL expressions referencing
other resources (e.g., `${deployment.status.readyReplicas}`). The form-level
validation (US1–US6) cannot detect semantic errors — it does not evaluate CEL
or resolve cross-resource references. The only system that can is kro's own
admission webhook, which runs when the RGD is applied to the cluster.

With this spec: a "Validate" button appears in the YAML preview area. Clicking it
sends the current YAML to a new `POST /api/v1/rgds/validate` backend endpoint.
The server performs a `dryRun=All` apply via the dynamic client — this triggers
kro's admission webhook without persisting anything. The result is shown inline:
a green "Valid" badge if kro accepted it, or a red "Validation failed" panel with
kro's error message if it rejected it.

**Why P2** (not P1): Requires cluster connectivity and kro ≥ v0.4 to be useful.
The form-level P1 checks (US1–US6) catch the majority of structural mistakes
without any network round-trip. The dry-run check is the authoritative complement —
it catches what static analysis cannot (CEL semantics, schema type resolution,
dependency cycles).

**Why not P1**: A user with no cluster connected gets a misleading "unreachable"
error. The P1 checks work offline and are more useful for day-to-day authoring.

**Independent Test**: Author an RGD with a valid structure and click Validate →
green badge. Introduce a broken CEL expression (`${nonexistent.field}`) and click
Validate again → red panel with kro's error message. Confirm the form state is not
changed by either operation.

**Acceptance Scenarios**:

1. **Given** the YAML preview area, **When** the form is rendered, **Then** a
   "Validate against cluster" button (`data-testid="dry-run-btn"`) is visible
   next to the Copy kubectl apply button.

2. **Given** the user clicks "Validate against cluster", **When** the backend
   returns `{ valid: true }`, **Then** a green "✓ Valid" badge
   (`data-testid="dry-run-result"`) replaces any previous result.

3. **Given** the user clicks "Validate against cluster", **When** the backend
   returns `{ valid: false, error: "..." }`, **Then** a red "✗ Validation failed"
   panel (`data-testid="dry-run-result"`) with the error message text is shown.

4. **Given** the button is clicked, **When** the request is in-flight, **Then**
   the button shows a loading state ("Validating…") and is non-interactive.

5. **Given** the YAML changes (any form field edit) after a result is shown,
   **Then** the result badge/panel is cleared — stale results are never displayed.

6. **Given** the backend is unreachable or the cluster is disconnected, **When**
   the user clicks Validate, **Then** an error message "Could not reach cluster"
   is shown (not a crash, not a spinner that never resolves).

7. **Given** any validate result is shown (valid OR failed), **Then** the Copy
   YAML and Copy kubectl apply buttons remain fully functional — validation does
   not gate copying.

---

### Edge Cases (US9)

- Empty YAML (form in starter state before any edits) → backend parses and likely
  returns valid (starter state is a valid kro RGD skeleton) — shows green badge
- kro not installed in the cluster → `POST /api/v1/rgds/validate` returns 503;
  frontend shows "kro not available in this cluster"
- RGD name collision (an RGD with the same name already exists) → dry-run apply
  replaces/patches it in dry-run mode; this is correct behaviour — the result
  reflects what would happen on a real apply
- Network timeout (kro admission webhook slow > 5s) → 504 from backend; frontend
  shows "Validation timed out"

---

### User Story 10 — Offline deep validation via kro libraries (Priority: P1)

A platform engineer authors an RGD offline (no cluster connected, or in a
restricted environment where kro-ui cannot reach the API server). The form-level
checks (US1–US6) catch structural mistakes but miss:

- **CEL syntax errors** — `${deployment.status.readyReplica` (unclosed `${}`) or
  `${x +++ y}` (invalid CEL) — emitted verbatim today, rejected by kro at runtime
- **SimpleSchema type/constraint errors** — `"integer | enum=dev,prod"` (enum on
  a non-string field), `"badtype"` (unknown base type), `"string | minimum=1"` (minimum
  on a non-numeric field) — kro's `pkg/simpleschema` rejects these at apply time
- **Resource ID format violations** — kro requires IDs to be lowerCamelCase, not
  `PascalCase` or `kebab-case`; not a reserved keyword — the current regex only checks
  for duplicates, not format

With this spec: the backend exposes a new `POST /api/v1/rgds/validate/static` endpoint
that performs **offline validation using kro's own Go libraries** —
`pkg/simpleschema`, `pkg/cel`, and `pkg/graph/dag` — without touching the cluster
at all. The frontend calls this from `AuthorPage` whenever the YAML changes (debounced
at 1s), showing inline deep-validation issues alongside the existing form-level ones.

**Why P1** (higher than US9): Unlike the dry-run check, this works fully offline. A
user without cluster access still gets kro-accurate validation feedback. It uses the
same `github.com/kubernetes-sigs/kro` module already pinned in `go.mod` — the
dependency already exists. Upgrading kro is a one-line `go.mod` bump.

**Why separate from the form-level `validateRGDState` (US1–US6)**: The kro library
checks require Go/server-side code (`pkg/simpleschema`, `pkg/cel`). They cannot be
replicated in TypeScript without duplicating kro's validation logic — which would
diverge as kro evolves. Server-side = always in sync with the pinned kro version.

**Independent Test**: Type `"badtype"` as a spec field type → deep validation returns
an error for that field. Fix to `"string"` → error clears. Add a CEL expression
`${x +++` (broken syntax) to a resource template → deep validation returns a CEL
parse error for that resource. Fix the expression → error clears. All results appear
without clicking anything (auto-debounced).

**Acceptance Scenarios**:

1. **Given** the YAML output changes (any form field edit), **When** the debounce
   fires (1 second after last change), **Then** a `POST /api/v1/rgds/validate/static`
   request is sent automatically with the current YAML body.

2. **Given** the static validation returns issues, **Then** they are shown in a
   "Deep validation" section below the summary badge in `RGDAuthoringForm`, each
   issue showing the field path and kro's error message.

3. **Given** all issues are resolved and a new debounced call returns no issues,
   **Then** the "Deep validation" section disappears.

4. **Given** `spec.schema.spec` contains `"badtype"` as a field value, **When**
   static validation runs, **Then** an issue is reported: "Spec field 'fieldName':
   unknown type 'badtype'" with a reference to the field.

5. **Given** a resource template contains a malformed CEL expression
   (e.g. `${x +++}`), **When** static validation runs, **Then** an issue is
   reported: "Resource 'id': CEL parse error in expression '${x +++}': \<kro
   error message\>".

6. **Given** a resource `id` is `PascalCase` or contains a hyphen (e.g. `my-db`),
   **When** static validation runs, **Then** an issue is reported: "Resource 'id':
   invalid ID format — must be lowerCamelCase".

7. **Given** the static validation endpoint is unavailable (server error), **Then**
   the deep validation section shows "Static validation unavailable" and form-level
   validation (US1–US6) continues to work normally.

8. **Given** the kro module in `go.mod` is bumped to a newer version (`go get
   github.com/kubernetes-sigs/kro@vX.Y.Z && make tidy`), **Then** all static
   validation calls automatically use the new version's rules — no other code changes
   required.

---

### Edge Cases (US10)

- `spec.schema.spec` absent → no schema issues (empty specFields is valid)
- CEL expression is `${schema.spec.replicas}` (references schema, not another resource)
  → valid CEL, no error (schema self-reference is a first-class kro pattern)
- Resource template is entirely empty → no CEL errors reported (nothing to parse)
- `pkg/simpleschema.ParseField` panics on a pathological input → handler wraps in
  `recover()`, returns 500 with error text; frontend shows "Static validation unavailable"
- kro v0.9.0 `pkg/cel.DefaultEnvironment()` returns an error on init → logged as
  `WARN`, endpoint returns 503; frontend degrades gracefully
- Deep validation issues and form-level issues (US1–US6) may overlap — they are
  displayed in separate sections and do not deduplicate; the user sees both

---

### Dependency management (US10 — version upgrade path)

The kro library dependency is managed via a single line in `go.mod`:

```
github.com/kubernetes-sigs/kro v0.9.0
```

To upgrade when a new kro version ships:

```bash
GOPROXY=direct GONOSUMDB="*" go get github.com/kubernetes-sigs/kro@vX.Y.Z
make tidy
make build   # verify nothing broke
```

The `internal/validate/` package (new in US10) is the single point of contact
with kro library code. If kro renames or restructures an API between versions,
only `internal/validate/` needs updating — handlers and frontend are unaffected.

---
