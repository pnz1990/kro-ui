# Data Model: 026-rgd-yaml-generator

## Entities

### 1. `FieldValue` — runtime form state for one spec field

Represents the current value(s) a user has entered for a single spec field in the
InstanceForm.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Field name (matches `ParsedField.name`) |
| `value` | `string` | Scalar value for non-array fields |
| `items` | `string[]` | Item list for array fields (`type === 'array'`) |
| `isArray` | `boolean` | True when the field is an array type |

**State transitions**:
- Created on form initialization with `value = default` (or `""` for required fields)
- Updated on each user interaction (synchronous — no debounce)
- Destroyed when the Generate tab unmounts

**Validation rules**:
- No hard validation — the form is a generator, not a k8s API client
- `isArray` and `items` are always consistent with the `ParsedType.type === 'array'`
  determination made at initialization

---

### 2. `InstanceFormState` — complete form state for instance generation

Aggregates all `FieldValue` entries plus the `metadata.name` value.

| Field | Type | Description |
|-------|------|-------------|
| `metadataName` | `string` | Value of the `metadata.name` field |
| `fields` | `FieldValue[]` | One entry per `SchemaDoc.specFields` item |

**Initialization**: built from `SchemaDoc.specFields` at form mount time:
- `metadataName` = `my-<kind-slug>` (same slug as spec 020)
- For each spec field: `value` = `parsedType.default ?? ""` (using key-existence check for detection); `isArray` = `parsedType.type === 'array'`; `items` = `[]` initially for array fields

---

### 3. `BatchRow` — a parsed line from batch mode input

Produced by `parseBatchRow(line)`.

| Field | Type | Description |
|-------|------|-------------|
| `values` | `Record<string, string>` | Key-value pairs extracted from the line |
| `error` | `string \| undefined` | Non-null if line was malformed (e.g. starts with `=`) |
| `index` | `number` | 0-based line index for error display |

**State transitions**:
- Re-derived on every textarea `onChange` event (pure re-parse of the full text)
- No incremental update — full re-parse is <1ms for <100 rows

---

### 4. `RGDAuthoringState` — user-defined structure for new RGD scaffolding

Owned entirely by `RGDAuthoringForm`.

| Field | Type | Description |
|-------|------|-------------|
| `rgdName` | `string` | `metadata.name` for the RGD object |
| `kind` | `string` | `spec.schema.kind` — the user-defined CR kind |
| `group` | `string` | `spec.schema.group` (default: `kro.run`) |
| `apiVersion` | `string` | `spec.schema.apiVersion` (default: `v1alpha1`) |
| `specFields` | `AuthoringField[]` | List of spec fields to include in the schema |
| `resources` | `AuthoringResource[]` | List of resource templates to scaffold |

---

### 5. `AuthoringField` — a user-defined spec field in the RGD authoring form

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique row key (UUID or index-based) |
| `name` | `string` | Field name (user-typed) |
| `type` | `string` | SimpleSchema base type: `string` / `integer` / `boolean` / `[]string` / etc. |
| `defaultValue` | `string` | Optional default value (empty = required field) |
| `required` | `boolean` | If true, appends `| required` modifier; if false and `defaultValue` present, appends `| default=X` |

**Derives**: the SimpleSchema type string as `${type}${required ? ' | required' : defaultValue ? ` | default=${defaultValue}` : ''}`

---

### 6. `AuthoringResource` — a resource template entry in the RGD authoring form

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Resource `id` in kro (e.g. `web`, `db`, `svc`) |
| `apiVersion` | `string` | Template resource apiVersion (e.g. `apps/v1`) |
| `kind` | `string` | Template resource kind (e.g. `Deployment`) |

**Derives**: a resource template block with `metadata.name: ${schema.metadata.name}-<id>` and a stub `spec: {}`.

---

## Key Pure Functions (in `web/src/lib/generator.ts`)

### `generateInstanceYAML(schema: SchemaDoc, state: InstanceFormState): string`

**Input**: A `SchemaDoc` (from spec 020's `buildSchemaDoc`) and the current
`InstanceFormState`. **Output**: A YAML string for the instance manifest.

**Algorithm**:
1. Build a JS object: `{ apiVersion: "${group}/${apiVersion}", kind, metadata: { name: metadataName }, spec: {} }`
2. For each `FieldValue` in `state.fields`:
   - If `isArray`: set `spec[name] = items` (string array)
   - If `parsedType.type === 'boolean'`: set `spec[name] = value === 'true'` (boolean)
   - If `parsedType.type === 'integer'` or `'number'` and value is non-empty: set `spec[name] = Number(value)`
   - Otherwise: set `spec[name] = value`
3. If `spec` has no keys: omit `spec` section entirely
4. Call `toYaml(obj)` to serialize

---

### `generateRGDYAML(state: RGDAuthoringState): string`

**Input**: `RGDAuthoringState`. **Output**: A YAML string for a new RGD.

**Algorithm**: Build YAML via string construction (not `toYaml`) to preserve CEL
`${...}` placeholders as-is (not quoted by the serializer):

```
apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: <rgdName>
spec:
  schema:
    apiVersion: <apiVersion>
    kind: <kind>
    spec:
      <field.name>: "<simpleSchemaString>"
  resources:
    - id: <resource.id>
      template:
        apiVersion: <resource.apiVersion>
        kind: <resource.kind>
        metadata:
          name: ${schema.metadata.name}-<resource.id>
          namespace: ${schema.metadata.namespace}
        spec: {}
```

---

### `parseBatchRow(line: string): BatchRow`

**Input**: A single line of text from the batch textarea.
**Output**: `BatchRow` with `values` map and optional `error`.

---

### `kindToSlug(kind: string): string`

**Input**: A PascalCase kind string. **Output**: lowercase-hyphenated slug.
Shared between `generateInstanceYAML` (for default `metadata.name`) and
`RGDAuthoringForm` (for the RGD's own metadata.name suggestion).

This is the same logic as in `ExampleYAML.tsx` — extracted to `generator.ts` for
reuse. `ExampleYAML.tsx` retains its inline copy until spec 026 is merged, to
avoid touching merged code unnecessarily.

---

## State Transitions Diagram

```
RGDDetail loads
  └─> User clicks "Generate" tab
        └─> GenerateTab mounts
              ├─> mode = "form" (default)
              │     └─> InstanceForm mounts
              │           ├─> Initialize InstanceFormState from SchemaDoc
              │           └─> On each field change → re-derive YAML → YAMLPreview updates
              ├─> User switches to "Batch"
              │     └─> BatchForm mounts
              │           ├─> User types in textarea
              │           └─> Re-parse all rows → generate N YAML docs → YAMLPreview updates
              └─> User switches to "New RGD"
                    └─> RGDAuthoringForm mounts
                          ├─> Initialize with starter state (kind="MyApp", 1 resource)
                          └─> On any change → re-derive RGD YAML → YAMLPreview updates
```
