# Feature Specification: RGD YAML Generator

**Feature Branch**: `026-rgd-yaml-generator`
**Created**: 2026-03-23
**Status**: Draft
**Depends on**: `020-schema-doc-generator` (merged), `003-rgd-detail-dag` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §V (Simplicity),
§IX (Theme), §XIII (UX Standards)

---

## Context

kro-ui already has a static "Example Manifest" in the Docs tab (spec `020`) that
generates a copy-pasteable YAML skeleton from the RGD schema. This is useful but
passive — it does not help users understand which fields are valid, does not
validate the YAML as they fill it in, and produces only a minimal skeleton with
placeholder values.

This spec adds three related capabilities under a single "Generate" tab on the
RGD detail page:

1. **Interactive Instance YAML Form** — a form-based YAML editor where each spec
   field has an appropriate input control (text, number, boolean toggle, enum
   select, array editor). The form renders live YAML as the user types.

2. **RGD Authoring Assistant** — a guided UI for creating a new
   `ResourceGraphDefinition` YAML manifest from scratch: choose a kind name, add
   spec fields with their types, add resource templates with placeholder CEL
   expressions. Produces a valid RGD YAML skeleton ready to apply.

3. **Batch Instance Generator** — a template-mode where users define a list of
   variable bindings (e.g. `name=foo bar baz`) and the tool generates one YAML
   manifest per binding, as a multi-document YAML (`---` separated) suitable for
   `kubectl apply`.

All generation is purely **client-side** — no new backend endpoints. No mutating
API calls. The cluster is used only to read the RGD schema (already loaded on the
detail page).

---

## User Scenarios & Testing

### User Story 1 — Developer fills a form and gets a valid instance YAML (Priority: P1)

On the RGD detail page, a "Generate" tab shows a form with one input control per
spec field. As the user fills in values, the right-hand pane shows live-updated
YAML. A "Copy" button and a `kubectl apply` command snippet are provided.

**Why this priority**: The core use case. Developers know they want a
`WebApplication` with `name=hello image=nginx replicas=3` — they should not need
to know the apiVersion, group, or YAML structure. This form does it for them.

**Independent Test**: Open any RGD's Generate tab. Confirm: each spec field maps
to one form row, changing a value updates the YAML preview immediately, and the
Copy button writes valid YAML to clipboard.

**Acceptance Scenarios**:

1. **Given** a `WebApplication` RGD with spec fields `name: string`, `image: string`,
   `replicas: integer | default=2`, **When** the Generate tab opens, **Then** three
   form rows are visible — `name` (text input), `image` (text input),
   `replicas` (number input with value `2` pre-filled from default)

2. **Given** field `replicas: integer | default=2`, **When** the user changes the
   value to `5`, **Then** the YAML preview updates immediately to show `replicas: 5`

3. **Given** field `env: string | enum=dev,staging,prod`, **When** the Generate
   tab renders, **Then** `env` is rendered as a `<select>` with options `dev`,
   `staging`, `prod`

4. **Given** field `enabled: boolean | default=true`, **When** the Generate tab
   renders, **Then** `enabled` is rendered as a toggle/checkbox checked by default

5. **Given** field `tags: []string`, **When** the Generate tab renders, **Then**
   a multi-value text input allows adding/removing string items; the YAML shows
   the array syntax

6. **Given** the user clicks "Copy YAML", **When** executed, **Then** the clipboard
   contains the full YAML document (including `apiVersion`, `kind`, `metadata`,
   `spec`) with no code-fence markers

7. **Given** the YAML preview is visible, **When** the user clicks "Copy kubectl
   apply", **Then** the clipboard contains
   `kubectl apply -f - <<'EOF'\n<yaml>\nEOF`

8. **Given** a field marked `| required` with no default, **When** the form
   renders, **Then** the field shows a required indicator and the YAML line
   renders with the entered value (or empty placeholder if untouched)

9. **Given** a field with `| enum=` constraint, **When** the user submits the
   form (no-op — read-only tool), **Then** no validation error is shown for
   values not in the enum (the form controls naturally constrain to valid values
   via `<select>`)

10. **Given** no spec fields on the RGD, **When** the Generate tab renders,
    **Then** the YAML preview still shows a valid minimal manifest (only
    `apiVersion`, `kind`, `metadata.name`) and a message "This RGD has no
    configurable fields"

---

### User Story 2 — Developer generates N instance manifests from a variable list (Priority: P2)

A "Batch" mode on the Generate tab allows the user to enter a column-per-variable
table (or a newline-separated list for a single variable). The generator produces
one YAML document per row, separated by `---`, all ready to `kubectl apply`.

**Why this priority**: Platform teams frequently need to create the same resource
in multiple namespaces, with different names, or for different tenants. This is
the "for-each at apply time" use case.

**Independent Test**: Enter `name=alpha\nbeta\ngamma` in batch mode. Confirm: three
YAML documents separated by `---` appear in the output, each with the correct
name substituted.

**Acceptance Scenarios**:

1. **Given** the user switches to "Batch" mode, **When** rendered, **Then** a
   textarea appears where each line is a set of `key=value` pairs for that
   document (e.g. `name=alpha image=nginx`)

2. **Given** batch input with 3 lines each providing `name=<value>`, **When**
   the preview renders, **Then** 3 YAML documents separated by `---` are shown

3. **Given** a batch line provides only some spec fields, **When** rendered,
   **Then** missing fields use the schema default value (or empty placeholder
   if required)

4. **Given** the user clicks "Copy All", **When** executed, **Then** the
   clipboard contains all N documents concatenated with `---` separators as
   valid multi-document YAML

5. **Given** an invalid batch row (e.g. `=badformat`), **When** encountered,
   **Then** that row is skipped with a visible per-row error indicator
   (does not block copying valid rows)

---

### User Story 3 — Developer authors a new RGD YAML skeleton (Priority: P2)

A "New RGD" tab on the Generate page (or within the Generate tab) lets the user
interactively define: the new CR kind name, the API group, spec fields with their
types and defaults, and placeholder resource templates. The output is a complete
RGD YAML skeleton.

**Why this priority**: Lower than instance generation but high value for onboarding.
New kro users do not know the structure of a `ResourceGraphDefinition` YAML — this
wizard scaffolds one from their intent.

**Independent Test**: Set kind=`MyApp`, add one field `name: string`, add one
resource template (kind `Deployment`, id `web`). Confirm: the generated YAML is a
valid RGD structure with the correct `spec.schema`, `spec.resources[0]` skeleton,
and `${schema.spec.name}` placeholder in the template metadata.

**Acceptance Scenarios**:

1. **Given** the user is on the "New RGD" authoring mode, **When** they type
   `WebApp` in the Kind field, **Then** the YAML preview shows `kind: WebApp`
   under `spec.schema.kind`

2. **Given** the user adds a spec field `replicas` of type `integer` with
   default `2`, **When** added, **Then** the YAML preview shows
   `spec.schema.spec.replicas: "integer | default=2"`

3. **Given** the user adds a resource template with id `web` and kind
   `Deployment`, **When** added, **Then** the YAML preview shows:
   ```yaml
   spec:
     resources:
       - id: web
         template:
           apiVersion: apps/v1
           kind: Deployment
           metadata:
             name: ${schema.metadata.name}-web
   ```

4. **Given** the user has defined a kind and at least one spec field, **When**
   they click "Copy RGD YAML", **Then** the clipboard contains a valid
   `ResourceGraphDefinition` YAML with the `kro.run/v1alpha1` apiVersion

5. **Given** the RGD authoring form is empty, **When** rendered, **Then** a
   placeholder kind `MyApp` and a starter resource `web` (Deployment) are
   pre-populated so the user sees a working example immediately

6. **Given** the user renames the kind from `MyApp` to `Platform`, **When**
   changed, **Then** the `spec.schema.kind` in the YAML preview updates and
   the `metadata.name` in resource templates updates to use
   `${schema.metadata.name}-<id>` with the new kind name context

---

### Edge Cases

- RGD has no spec fields (only status projections) → form shows "No configurable
  fields" message; YAML preview still includes valid `apiVersion`, `kind`,
  `metadata.name` with a placeholder
- RGD schema `kind` is empty → use the RGD's own `metadata.name` as the fallback
  kind (graceful degradation — never render `?` or `undefined`)
- Field type is unknown/unparseable → render as free-text input with no type
  constraint
- Very large number of spec fields (20+) → form scrolls within its panel; YAML
  preview remains visible via sticky positioning or split-pane layout
- `metadata.name` input is left empty → YAML preview uses `my-<kind-slug>` as
  placeholder (same as ExampleYAML in spec 020)
- Batch mode with 0 rows → show empty state "Enter one set of values per line to
  generate multiple manifests"

---

## Requirements

### Functional Requirements

- **FR-001**: Generate tab MUST be accessible via `?tab=generate` URL parameter
  on the RGD detail page
- **FR-002**: Form fields MUST be derived from the already-loaded RGD schema
  (`spec.schema.spec`) — no additional API call (same as DocsTab, FR-001 of spec
  020)
- **FR-003**: Each spec field type MUST map to an appropriate HTML input:
  - `string` (no enum) → `<input type="text">`
  - `string` with `| enum=` → `<select>` with one `<option>` per enum value
  - `integer` / `number` → `<input type="number">`
  - `boolean` → `<input type="checkbox">` or toggle
  - `[]<type>` → repeatable row with add/remove controls
  - Unknown / object / map → `<textarea>` (raw YAML value)
- **FR-004**: YAML preview MUST update synchronously (no debounce) as the user
  changes form values. Uses the existing `toYaml` utility (`web/src/lib/yaml.ts`)
  or plain string construction.
- **FR-005**: `metadata.name` MUST always be an editable field in the form, pre-filled
  with `my-<kind-slug>` (same slug logic as spec 020 `ExampleYAML`)
- **FR-006**: "Copy YAML" button MUST use the Clipboard API and show a brief
  "Copied!" confirmation (same UX as spec 020 `KroCodeBlock`)
- **FR-007**: "Copy kubectl apply" button MUST produce a heredoc snippet:
  `kubectl apply -f - <<'EOF'\n<yaml>\nEOF`
- **FR-008**: Batch mode MUST accept free-text input: one line = one manifest;
  each line is space-separated `key=value` pairs
- **FR-009**: Batch mode documents MUST be separated by `---\n` in the output
- **FR-010**: RGD authoring mode MUST generate a valid `ResourceGraphDefinition`
  YAML with `apiVersion: kro.run/v1alpha1`, `kind: ResourceGraphDefinition`,
  the user-defined `spec.schema`, and at least one `spec.resources[]` entry
- **FR-011**: All form state is local (React `useState`) — no URL params for
  form field values; only the `?tab=generate` param is preserved
- **FR-012**: Generate tab MUST be present on the RGD detail page tab bar as
  "Generate" between "Docs" and existing tabs
- **FR-013**: New RGD authoring MUST be reachable from the catalog or home page
  via a "New RGD" action button (in addition to the Generate tab)

### Non-Functional Requirements

- **NFR-001**: Form → YAML preview round-trip MUST be <16ms (one frame) — no
  async operations in the critical path
- **NFR-002**: TypeScript strict mode MUST pass
- **NFR-003**: All styles MUST use `tokens.css` custom properties — no inline hex,
  no `rgba()` literals in component CSS
- **NFR-004**: No new npm dependencies — implemented with plain React + DOM APIs
- **NFR-005**: Generate tab MUST be fully usable at 500+ RGDs on the cluster
  (no global list fetch in this component)

### Key Components

- **`GenerateTab`** (`web/src/components/GenerateTab.tsx`): top-level component
  for the Generate tab; owns mode state (form / batch / new-rgd) and the YAML
  output. Renders `InstanceForm`, `BatchForm`, or `RGDAuthoringForm` based on mode.
- **`InstanceForm`** (`web/src/components/InstanceForm.tsx`): interactive form
  for instance manifest generation. One row per spec field with type-appropriate
  input. Derives fields from `SchemaDoc` (reuses `buildSchemaDoc` from spec 020).
- **`BatchForm`** (`web/src/components/BatchForm.tsx`): textarea-driven batch
  manifest generator. Parses rows into per-document value maps.
- **`RGDAuthoringForm`** (`web/src/components/RGDAuthoringForm.tsx`): guided
  form to scaffold a new `ResourceGraphDefinition` YAML. Owns kind, group,
  spec-field list, and resource-template list.
- **`YAMLPreview`** (`web/src/components/YAMLPreview.tsx`): shared read-only YAML
  display with "Copy YAML" and "Copy kubectl apply" buttons. Wraps `KroCodeBlock`.
- **`generateInstanceYAML`** (`web/src/lib/generator.ts`): pure function —
  takes `SchemaDoc` + a `Record<string, string>` of field values → returns YAML
  string. Reuses slug logic from spec 020 `ExampleYAML`.
- **`generateRGDYAML`** (`web/src/lib/generator.ts`): pure function — takes
  authoring form state → returns RGD YAML string.
- **`parseBatchRow`** (`web/src/lib/generator.ts`): pure function — parses a
  single batch row string into a `Record<string, string>` key-value map.

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/generator.test.ts
describe("generateInstanceYAML", () => {
  it("generates valid YAML with required fields filled", () => { ... })
  it("omits optional fields with defaults when value matches default", () => { ... })
  it("includes metadata.name from form input", () => { ... })
  it("uses kind-slug for metadata.name placeholder when name is empty", () => { ... })
  it("renders boolean field as 'true'/'false' string in YAML", () => { ... })
  it("renders array field as YAML list block", () => { ... })
})

describe("parseBatchRow", () => {
  it("parses 'name=foo image=nginx' → { name: 'foo', image: 'nginx' }", () => { ... })
  it("handles value with spaces: 'name=hello world' → { name: 'hello world' }", () => { ... })
  it("skips malformed token '=bad' → excludes from result map", () => { ... })
  it("parses empty string → empty map", () => { ... })
})

describe("generateRGDYAML", () => {
  it("produces apiVersion: kro.run/v1alpha1 and kind: ResourceGraphDefinition", () => { ... })
  it("includes spec.schema.kind from form input", () => { ... })
  it("includes spec.schema.spec fields with SimpleSchema type strings", () => { ... })
  it("includes spec.resources[0] with id and template placeholder", () => { ... })
})

// web/src/components/GenerateTab.test.tsx
describe("GenerateTab", () => {
  it("renders form with one row per spec field", () => { ... })
  it("renders enum field as select with correct options", () => { ... })
  it("renders boolean field as checkbox", () => { ... })
  it("updates YAML preview on field change", () => { ... })
  it("renders mode tabs: Form / Batch / New RGD", () => { ... })
  it("switches to batch mode on tab click", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Generate tab is accessible via `?tab=generate` on every RGD detail
  page and renders without error for any RGD
- **SC-002**: Form correctly maps all spec field types to appropriate controls
- **SC-003**: YAML preview is always valid YAML (parseable) regardless of current
  form state
- **SC-004**: Batch mode produces exactly N documents for N non-empty input rows
- **SC-005**: RGD authoring produces a syntactically valid `ResourceGraphDefinition`
  YAML that can be applied to a kro cluster
- **SC-006**: TypeScript strict mode passes with 0 errors
- **SC-007**: No inline hex or `rgba()` literals in any component CSS
