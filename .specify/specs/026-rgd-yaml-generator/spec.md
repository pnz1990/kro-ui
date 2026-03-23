# Feature Specification: RGD YAML Generator

**Feature Branch**: `026-rgd-yaml-generator`
**Created**: 2026-03-23
**Status**: Implemented
**Depends on**: `020-schema-doc-generator` (merged), `003-rgd-detail-dag` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §V (Simplicity),
§IX (Theme), §XIII (UX Standards)

---

## Context

kro-ui's Docs tab (spec `020`) already renders a static `ExampleYAML` block — a
read-only YAML skeleton with placeholder values. This is useful for a quick glance
but does nothing when a developer actually needs to create an instance: they must
still hand-edit the YAML, look up valid enum values, remember the apiVersion, and
handle required vs. optional fields manually.

This spec adds a **Generate** tab to the RGD detail page with three client-side
YAML generation modes. All generation is purely client-side — no new backend
endpoints, no mutating API calls. The cluster is used only to read the already-loaded
RGD schema.

---

## User Scenarios & Testing

### User Story 1 — Developer fills a form and gets a valid instance YAML (Priority: P1)

On the RGD detail page, a "Generate" tab (`?tab=generate`) shows an interactive
form with one input control per spec field. As the user fills in values, the
right-hand pane shows live-updated YAML. A "Copy YAML" button and a
"Copy kubectl apply" button (heredoc snippet) are provided.

**Why this priority**: The core use case. Developers know they want a
`WebApplication` with `name=hello image=nginx replicas=3` — they should not need
to know the apiVersion, group, or YAML structure.

**Independent Test**: Open any RGD's Generate tab. Confirm: each spec field maps
to one form row, changing a value updates the YAML preview immediately, and the
Copy YAML button writes valid YAML to clipboard.

**Acceptance Scenarios**:

1. **Given** a `WebApplication` RGD with spec fields `name: string`, `image: string`,
   `replicas: integer | default=2`, **When** the Generate tab opens, **Then** three
   form rows are visible — `name` (text input), `image` (text input),
   `replicas` (number input pre-filled with `2`)

2. **Given** field `replicas: integer | default=2`, **When** the user changes the
   value to `5`, **Then** the YAML preview updates immediately to show `replicas: 5`

3. **Given** field `env: string | enum=dev,staging,prod`, **When** rendered,
   **Then** `env` is a `<select>` with options `dev`, `staging`, `prod`

4. **Given** field `enabled: boolean | default=true`, **When** rendered,
   **Then** `enabled` is a checkbox, checked by default

5. **Given** field `tags: []string`, **When** rendered,
   **Then** a repeatable row UI allows adding/removing string items

6. **Given** the user clicks "Copy YAML", **Then** the clipboard contains the
   full YAML document (apiVersion, kind, metadata, spec) with no code-fence markers

7. **Given** the user clicks "Copy kubectl apply", **Then** the clipboard contains
   `kubectl apply -f - <<'EOF'\n<yaml>\nEOF`

8. **Given** no spec fields on the RGD, **When** the Generate tab renders,
   **Then** the YAML preview shows a valid minimal manifest with only
   `apiVersion`, `kind`, `metadata.name`, and a message "This RGD has no
   configurable fields"

---

### User Story 2 — Developer generates N instance manifests from a variable list (Priority: P2)

A "Batch" mode allows the user to enter one line of `key=value` pairs per manifest.
The generator produces one YAML document per line, separated by `---`.

**Independent Test**: Switch to Batch. Enter two `key=value` lines. Confirm: two
YAML documents separated by `---` appear in the preview.

**Acceptance Scenarios**:

1. **Given** batch input with 3 lines each providing `name=<value>`, **When**
   rendered, **Then** 3 YAML documents separated by `---` are shown

2. **Given** a batch line omits a field that has a schema default, **When** rendered,
   **Then** that field uses the schema default value

3. **Given** a malformed token (`=bad`), **When** encountered,
   **Then** a per-row error indicator shows `Line N: malformed token...`

4. **Given** the user clicks "Copy All", **Then** the clipboard contains all N
   documents as valid multi-document YAML

---

### User Story 3 — Developer authors a new RGD YAML skeleton (Priority: P2)

A "New RGD" mode lets the user define a CR kind name, spec fields with
SimpleSchema types and defaults, and resource templates. The output is a complete
`ResourceGraphDefinition` YAML scaffold.

**Independent Test**: Switch to "New RGD". Verify the pre-populated starter
(kind `MyApp`, one Deployment resource) shows a valid RGD YAML preview. Add a
spec field `replicas: integer | default=2` — confirm the YAML shows the correct
SimpleSchema string.

**Acceptance Scenarios**:

1. **Given** the user types `WebApp` in the Kind field, **Then** the YAML shows
   `kind: WebApp` under `spec.schema.kind`

2. **Given** the user adds a spec field `replicas: integer` with default `2`,
   **Then** the YAML shows `spec.schema.spec.replicas: "integer | default=2"`

3. **Given** the user adds a resource template with id `web` and kind `Deployment`,
   **Then** the YAML shows a resource block with
   `name: ${schema.metadata.name}-web` (CEL placeholder preserved unquoted)

4. **Given** clicking "Copy RGD YAML", **Then** the clipboard contains valid
   `kro.run/v1alpha1 ResourceGraphDefinition` YAML

5. **Given** the form is opened fresh, **Then** it is pre-populated with kind
   `MyApp` and one starter Deployment resource so the user sees a working example

---

### Edge Cases

- RGD has no spec fields → form shows "No configurable fields" message; YAML
  preview still includes valid `apiVersion`, `kind`, `metadata.name`
- RGD schema `kind` is empty → `metadata.name` pre-filled as `my-resource`
- Unknown field type → rendered as free-text `<input type="text">`
- `metadata.name` left empty → YAML preview uses `my-<kind-slug>` placeholder
- Batch mode with 0 rows → shows "Enter one set of values per line" empty state

---

## Requirements

### Functional Requirements

- **FR-001**: Generate tab accessible via `?tab=generate` on the RGD detail page
- **FR-002**: Form fields derived from already-loaded RGD schema — no additional
  API call
- **FR-003**: Each spec field type maps to an appropriate HTML input:
  - `string` (no enum) → `<input type="text">`
  - `string` with `| enum=` → `<select>`
  - `integer` / `number` → `<input type="number">`
  - `boolean` → `<input type="checkbox">`
  - `[]<type>` → repeatable rows with add/remove
  - Unknown / object / map → `<textarea>`
- **FR-004**: YAML preview updates synchronously on every form change
- **FR-005**: `metadata.name` is always an editable field, pre-filled with
  `my-<kind-slug>`
- **FR-006**: "Copy YAML" uses Clipboard API with 2s "Copied!" icon confirmation
- **FR-007**: "Copy kubectl apply" copies a heredoc snippet
- **FR-008**: Batch mode: one line = one YAML document; `key=value` token format
- **FR-009**: Batch documents separated by `---\n` in the output
- **FR-010**: RGD authoring produces valid `kro.run/v1alpha1 ResourceGraphDefinition`
  YAML with CEL `${...}` placeholders preserved unquoted
- **FR-011**: All form state is local React `useState` — no URL params for field
  values; only `?tab=generate` is preserved
- **FR-012**: Generate tab present in RGD detail tab bar as "Generate" (7th tab)

### Non-Functional Requirements

- **NFR-001**: Form → YAML preview round-trip < 16ms (synchronous, one render)
- **NFR-002**: TypeScript strict mode passes with 0 errors
- **NFR-003**: All CSS uses `tokens.css` custom properties — no inline hex/rgba
- **NFR-004**: No new npm dependencies
- **NFR-005**: `AuthoringResource._key` is a stable internal React key, never
  equal to the user-editable `id` field (prevents remount-on-keystroke bug)

### Key Components

- **`GenerateTab`** (`web/src/components/GenerateTab.tsx`): orchestrator; owns
  mode (form/batch/rgd) and derived YAML
- **`InstanceForm`** (`web/src/components/InstanceForm.tsx`): type-dispatched
  per-field form
- **`BatchForm`** (`web/src/components/BatchForm.tsx`): textarea + error list +
  count badge
- **`RGDAuthoringForm`** (`web/src/components/RGDAuthoringForm.tsx`): metadata +
  repeatable spec fields + repeatable resources
- **`YAMLPreview`** (`web/src/components/YAMLPreview.tsx`): `KroCodeBlock` +
  "Copy kubectl apply"
- **`generator.ts`** (`web/src/lib/generator.ts`): pure functions —
  `kindToSlug`, `generateInstanceYAML`, `generateBatchYAML`, `parseBatchRow`,
  `generateRGDYAML`

---

## Testing Requirements

### Unit Tests (implemented)

- `web/src/lib/generator.test.ts` — 33 tests covering all five functions,
  edge cases (falsy defaults, malformed batch tokens, CEL placeholder preservation,
  boolean/integer type coercion, array serialization)
- `web/src/components/GenerateTab.test.tsx` — 19 component tests covering
  all three modes, enum select, boolean checkbox, batch errors, count badge,
  Add Field / Add Resource / Remove actions

---

## Success Criteria

- **SC-001**: Generate tab renders without error for any RGD
- **SC-002**: Form correctly maps all spec field types to appropriate controls
- **SC-003**: YAML preview is always parseable YAML regardless of form state
- **SC-004**: Batch mode produces exactly N documents for N non-empty input rows
- **SC-005**: RGD authoring produces syntactically valid `ResourceGraphDefinition`
  YAML with unquoted CEL placeholders
- **SC-006**: TypeScript strict mode passes with 0 errors
- **SC-007**: No inline hex or `rgba()` in any component CSS
- **SC-008**: Resource rows use stable `_key` (not user-editable `id`) as React
  key — no remount on id edit
