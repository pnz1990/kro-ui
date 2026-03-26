# Feature Specification: RGD Designer — Full kro Feature Coverage

**Feature Branch**: `044-rgd-designer-full-features`
**GH Issue**: #270
**Created**: 2026-03-26
**Status**: Draft
**Depends on**: `042-rgd-designer-nav` (merged, PR #206)

---

## Context

The current RGD Designer (`/author`) covers ~20% of kro's feature surface. It
supports flat metadata, scalar/array spec fields, and resource templates with
only `id`/`apiVersion`/`kind` — generating `spec: {}` bodies that are never
deployable on their own.

Every real kro RGD requires at minimum: a `status` section, per-resource CEL
template content, and usually at least one of `readyWhen`, `includeWhen`,
`forEach`, or `externalRef`. None of these are authorable today.

This spec closes all critical and high-severity gaps identified in GH #270,
making the designer capable of producing complete, deployable RGDs that cover
all 5 kro node types.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Author a complete deployable RGD (Priority: P1)

A platform engineer wants to define a `WebApp` abstraction with a Deployment
and a Service. They open the RGD Designer, fill in the schema, give the
Deployment a `replicas` field from the schema spec, and the Service a
`selector` that references the Deployment. They copy the generated YAML,
apply it to a cluster, and `kubectl apply` succeeds without validation errors.

**Why this priority**: This is the baseline for making the designer useful
at all. Every real RGD has template body content.

**Independent Test**: Open `/author`, add a Deployment resource, expand its
template editor, type `spec:\n  replicas: ${schema.spec.replicas}`, observe
YAML updates. Copy and validate with `kubectl apply --dry-run=client`.

**Acceptance Scenarios**:

1. **Given** a resource row in the designer, **When** the user clicks "Edit
   template", **Then** a CEL-highlighted textarea expands inline showing the
   current template YAML for that resource.
2. **Given** the user edits the template textarea, **When** they type any text,
   **Then** the YAML preview updates with the new template content within 300ms
   (debounced along with the rest of form state).
3. **Given** a valid template with CEL expressions referencing another resource,
   **When** the DAG preview renders, **Then** directed edges appear between the
   dependent nodes.
4. **Given** the user has typed partial YAML in the template that is not valid
   YAML, **When** it cannot be parsed, **Then** the template field shows an
   inline warning but does NOT crash the page or invalidate the YAML preview
   (graceful degradation: last-valid state is preserved in the preview).

---

### User Story 2 — Define status outputs with CEL expressions (Priority: P1)

A platform engineer wants to surface `endpoint: ${service.spec.clusterIP}` on
their custom CR's status so users can read the endpoint without looking up the
Service. They add a status field in the designer and type a CEL expression.

**Why this priority**: Without status fields, the abstraction returns nothing
useful to callers. This is the #2 critical gap.

**Independent Test**: Open `/author`, add a status field named `endpoint` with
expression `${service.spec.clusterIP}`, verify YAML shows
`status:\n  endpoint: ${service.spec.clusterIP}` under `spec.schema`.

**Acceptance Scenarios**:

1. **Given** a new "Status Fields" section in the designer form, **When** the
   user clicks "+ Add Status Field", **Then** a row appears with a name input
   and a CEL expression input.
2. **Given** a status field row with name `endpoint` and expression
   `${service.spec.clusterIP}`, **When** the YAML is generated, **Then** it
   contains `status:\n  endpoint: ${service.spec.clusterIP}` under
   `spec.schema`.
3. **Given** the expression input uses the kro CEL tokenizer, **When** text is
   typed, **Then** CEL tokens are highlighted using the same color scheme as
   the existing `KroCodeBlock` component.
4. **Given** a status field where the expression references a resource ID that
   exists in the resources section, **When** the DAG preview renders, **Then**
   the schema root node shows the status dependency (edge or annotation).

---

### User Story 3 — Add `includeWhen` conditional to a resource (Priority: P1)

An engineer is building an RGD with optional monitoring. They want a
`ServiceMonitor` resource that is only created when `schema.spec.monitoring`
is `true`. They add `includeWhen` to that resource row.

**Why this priority**: `includeWhen` is kro's headline conditional feature.
Without it, authors cannot create conditional subgraphs.

**Independent Test**: Add a resource, expand its advanced options, set
`includeWhen` to `${schema.spec.monitoring}`, verify generated YAML has
`includeWhen: [${schema.spec.monitoring}]` and the DAG node shows the `?`
conditional indicator.

**Acceptance Scenarios**:

1. **Given** a resource row, **When** the user clicks "Advanced options",
   **Then** an `includeWhen` CEL expression input is revealed.
2. **Given** `includeWhen: ${schema.spec.monitoring}` is entered, **When** YAML
   is generated, **Then** it contains `includeWhen:\n  - ${schema.spec.monitoring}`
   under the resource.
3. **Given** a resource has `includeWhen` set, **When** the live DAG renders,
   **Then** the node shows the `?` conditional indicator (dashed border or `?`
   badge) consistent with the existing Graph tab display.

---

### User Story 4 — Add `readyWhen` to gate dependent resources (Priority: P1)

An engineer's RGD has a database that takes time to be ready. They need the
dependent application deployment to wait until `${db.status.endpoint != ""}`.
They add a `readyWhen` expression to the database resource.

**Acceptance Scenarios**:

1. **Given** a resource row's advanced options, **When** the user adds a
   `readyWhen` entry, **Then** the generated YAML has
   `readyWhen:\n  - ${expr}` under that resource.
2. **Given** multiple `readyWhen` rows, **When** generated, **Then** each
   appears as a separate array entry.

---

### User Story 5 — Define a `forEach` collection (Priority: P1)

An engineer wants to create one ConfigMap per region. They toggle a resource
from "Managed" to "Collection (forEach)", enter iterator variable `region` and
expression `${schema.spec.regions}`, and the live DAG node changes to the
forEach (triangle) style.

**Acceptance Scenarios**:

1. **Given** a resource row toggled to "forEach" mode, **When** the user
   provides variable name `region` and expression `${schema.spec.regions}`,
   **Then** the generated YAML has:
   ```yaml
   forEach:
     - region: ${schema.spec.regions}
   ```
2. **Given** a forEach resource, **When** the live DAG renders, **Then** the
   node is styled as `NodeTypeCollection` (triangle / `forEach collection` badge)
   matching the existing Graph tab style.
3. **Given** two forEach iterator pairs are defined (cartesian product mode),
   **When** YAML is generated, **Then** both entries appear in the `forEach`
   array.
4. **Given** a forEach resource, **When** the user toggles back to "Managed",
   **Then** the `forEach` field is removed from the generated YAML.

---

### User Story 6 — Add an `externalRef` node (Priority: P1)

An engineer needs to reference a pre-existing `platform-config` ConfigMap and
use `${platformConfig.data.?region}` in a downstream resource. They toggle a
resource to "External reference" mode, enter apiVersion/kind/name/namespace.

**Acceptance Scenarios**:

1. **Given** a resource toggled to "External ref" mode, **When** the user fills
   in apiVersion `v1`, kind `ConfigMap`, name `platform-config`, namespace
   `platform-system`, **Then** the generated YAML has:
   ```yaml
   - id: platformConfig
     externalRef:
       apiVersion: v1
       kind: ConfigMap
       metadata:
         name: platform-config
         namespace: platform-system
   ```
2. **Given** an external ref resource, **When** the live DAG renders, **Then**
   the node is styled as `NodeTypeExternal` (circle / `o external reference` badge).
3. **Given** the user enters selector labels instead of a name (external
   collection mode), **Then** the generated YAML uses
   `metadata.selector.matchLabels` and the DAG node is styled as
   `NodeTypeExternalCollection`.

---

### User Story 7 — Set `scope: Cluster` (Priority: P2)

An engineer building a `Tenant` CRD needs cluster-scoped instances. They select
"Cluster" in the scope selector; the generated YAML adds `scope: Cluster` to
`spec.schema`.

**Acceptance Scenarios**:

1. **Given** a Namespaced/Cluster radio in the Metadata section, **When** the
   user selects "Cluster", **Then** `scope: Cluster` appears in the YAML.
2. **Given** scope is "Namespaced" (default), **When** generated, **Then** no
   `scope` field appears in the YAML (default, omit for cleanliness).

---

### User Story 8 — Validation constraints on spec fields (Priority: P2)

An engineer wants `replicas: integer | default=3 minimum=1 maximum=100`.
Expanding the spec field row reveals `min` and `max` inputs.

**Acceptance Scenarios**:

1. **Given** an integer field with `min=1` and `max=100` set, **When** YAML is
   generated, **Then** it contains `"integer | default=3 minimum=1 maximum=100"`.
2. **Given** a string field with `enum=dev,staging,prod`, **When** YAML is
   generated, **Then** it contains `"string | enum=dev,staging,prod"`.

---

### Edge Cases

- Empty `includeWhen` / `readyWhen` inputs → those fields are omitted from YAML
- A forEach expression that evaluates to a non-array at runtime → not
  validated in the designer (runtime concern), YAML still generated verbatim
- Resource toggled between modes (managed → forEach → externalRef) → each toggle
  resets the mode-specific fields, preserving only `id`, `apiVersion`, `kind`
- Template YAML parse failure → last valid template state kept in YAML preview;
  no crash; inline error shown
- Status field with no expression → omitted from generated YAML
- `scope: Cluster` and namespace omitted from a template resource → the designer
  shows a warning hint but does not block YAML generation

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each resource row in the designer MUST have an expandable
  "Edit template" section showing a `<textarea>` pre-filled with the resource's
  current template YAML (CEL `${...}` highlighted via kro CEL tokenizer).
- **FR-002**: Template edits MUST be reflected in the YAML preview within 300ms
  (included in the existing debounce).
- **FR-003**: A new "Status Fields" section MUST be added to the form below
  "Spec Fields", with "+ Add Status Field" adding rows of `(name, celExpression)`.
- **FR-004**: Status fields MUST be serialised as `spec.schema.status:` in the
  generated YAML, one key per field with the raw expression string as the value.
- **FR-005**: Each resource row MUST have expandable "Advanced options"
  revealing `includeWhen` (single CEL expression input) and `readyWhen`
  (repeatable CEL expression rows).
- **FR-006**: Non-empty `includeWhen` MUST be serialised as
  `includeWhen:\n  - <expr>` under the resource in generated YAML.
- **FR-007**: Non-empty `readyWhen` entries MUST be serialised as
  `readyWhen:\n  - <expr1>\n  - <expr2>` under the resource.
- **FR-008**: Each resource row MUST have a "Resource type" toggle with three
  options: "Managed" (default), "Collection (forEach)", "External ref".
- **FR-009**: In "Collection (forEach)" mode, the resource row shows one or
  more `(variable, expression)` iterator pairs. At least one pair is required.
- **FR-010**: The `forEach` field MUST be serialised as:
  `forEach:\n  - <var>: <expr>` (one entry per pair).
- **FR-011**: In "Collection (forEach)" mode, the live DAG MUST render the
  node with `NodeTypeCollection` styling (triangle badge / forEach indicator).
- **FR-012**: In "External ref" mode, the resource row shows fields:
  `apiVersion`, `kind`, `name` (or `selector` for collection), `namespace`
  (optional).
- **FR-013**: When `name` is provided, `externalRef.metadata.name` is
  serialised. When `selector` labels are provided (key=value pairs),
  `externalRef.metadata.selector.matchLabels` is serialised.
- **FR-014**: In "External ref" mode, the live DAG MUST render the node as
  `NodeTypeExternal` (name-based) or `NodeTypeExternalCollection` (selector-based).
- **FR-015**: The Metadata section MUST include a Scope toggle:
  `Namespaced` (default, no `scope` key emitted) / `Cluster` (emits
  `scope: Cluster`).
- **FR-016**: Spec field rows MUST expose optional constraint inputs:
  `enum` (comma-separated string), `minimum` (integer), `maximum` (integer),
  `pattern` (string regex). Non-empty values are appended to the SimpleSchema
  string.
- **FR-017**: The CEL expression inputs for `includeWhen`, `readyWhen`, and
  status field values MUST use inline syntax highlighting via the existing kro
  CEL tokenizer (same as `KroCodeBlock`).
- **FR-018**: The `rgdAuthoringStateToSpec` function MUST be extended to
  correctly pass `forEach`, `externalRef`, `includeWhen` data to `buildDAGGraph`
  so the live DAG reflects all node types.
- **FR-019**: The `generateRGDYAML` function MUST be extended to serialise
  all new fields: `scope`, `status`, `includeWhen`, `readyWhen`, `forEach`,
  `externalRef`, resource template body, and spec field constraints.
- **FR-020**: All form state changes MUST remain in local React `useState` —
  no URL params, no localStorage.
- **FR-021**: No new npm or Go dependencies may be introduced.

### Non-Functional Requirements

- **NFR-001**: TypeScript strict mode — 0 errors after all changes.
- **NFR-002**: All CSS uses `tokens.css` custom properties — no hardcoded hex/rgba.
- **NFR-003**: Form → YAML preview round-trip < 16ms for simple forms (≤5
  resources, ≤10 spec fields) — synchronous after debounce settles.
- **NFR-004**: No component crashes on invalid/partial input (template parse
  failures, empty expressions, empty iterator variables).
- **NFR-005**: All new form sections must be keyboard-accessible (Tab navigation,
  Enter to confirm, Escape to collapse).

### Key Entities

- **`RGDAuthoringState`** — extended to include `statusFields`, `scope`, and
  extended `resources` (template body, `includeWhen`, `readyWhen`, resource type,
  `forEach` iterators, `externalRef` fields).
- **`AuthoringResource`** — extended with `resourceType`, `templateYaml`,
  `includeWhen`, `readyWhen`, `forEach`, `externalRef`.
- **`AuthoringStatusField`** — new type: `{ id, name, expression }`.
- **`AuthoringField`** — extended with optional `enum`, `minimum`, `maximum`,
  `pattern` constraints.

---

## Success Criteria *(mandatory)*

- **SC-001**: A user can produce a YAML with all 5 kro node types using only
  the designer form — no manual YAML editing required.
- **SC-002**: The generated YAML for a Deployment + Service WebApp example
  passes `kubectl apply --dry-run=client` on a cluster with kro installed.
- **SC-003**: The live DAG correctly renders `NodeTypeCollection` nodes when a
  resource has `forEach`, and `NodeTypeExternal`/`NodeTypeExternalCollection`
  for `externalRef` resources.
- **SC-004**: All new inputs are fully keyboard-accessible with no focus traps.
- **SC-005**: TypeScript strict mode passes with 0 errors.
- **SC-006**: No new npm dependencies; no inline hex/rgba in CSS.

---

## Assumptions

- The existing `buildDAGGraph` function (in `web/src/lib/dag.ts`) already handles
  all 5 node types when given correctly-shaped spec data. It requires only that
  `rgdAuthoringStateToSpec` produces the correct shape for new resource types.
- The existing kro CEL tokenizer (`web/src/lib/highlighter.ts`) can be used
  directly on `<textarea>` or `<input>` values to produce inline spans. A
  lightweight wrapper component (e.g. `CelInput`) may be needed to overlay
  highlights on an `<input type="text">` while keeping it editable — or a
  plain `<textarea>` with a token-class backdrop pattern.
- Template YAML parsing in the browser uses `js-yaml` if already present, or
  a minimal parser. Check `package.json` before introducing a dependency.
- `rgdAuthoringStateToSpec` is the only bridge between form state and DAG
  preview — extending it is the sole change needed to fix DAG node types.
- The right-column two-pane layout (live DAG + YAML preview) from spec `042`
  remains unchanged — only the left form column grows.
