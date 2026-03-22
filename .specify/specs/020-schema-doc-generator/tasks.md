# Tasks: RGD Schema Documentation Generator

**Spec**: `020-schema-doc-generator`
**Plan**: `plan.md`
**Status**: Completed

---

## Phase 1 — Core Library

### T-001: Create `web/src/lib/schema.ts`

**File**: `web/src/lib/schema.ts`
**Dependencies**: none

Create the pure `parseSimpleSchema` function and supporting types.

Exports:
- `interface ParsedType` — structured representation of a SimpleSchema type string
- `interface ParsedField` — a single field with name + parsed type (or CEL for status)
- `interface SchemaDoc` — assembled schema for a whole RGD
- `function parseSimpleSchema(typeStr: string): ParsedType` — pure parser
- `function buildSchemaDoc(rgd: K8sObject): SchemaDoc` — assembles full SchemaDoc from an RGD object
- `function inferStatusType(celExpr: string): string` — infers 'boolean' or 'string' from a CEL expression

Parsing rules (from plan.md):
- Split on ` | ` separators
- First segment = base type
- `[]<type>` → `{ type: 'array', items: '<type>' }`
- `map[K]V` → `{ type: 'map', key: 'K', value: 'V' }`
- Modifier `default=X` → `default: 'X'` (X may be empty string)
- Modifier `required` → `required: true`

- [ ] Define and export `ParsedType` interface
- [ ] Define and export `ParsedField` interface
- [ ] Define and export `SchemaDoc` interface
- [ ] Implement `parseSimpleSchema(typeStr: string): ParsedType`
- [ ] Implement `inferStatusType(celExpr: string): string`
- [ ] Implement `buildSchemaDoc(rgd: K8sObject): SchemaDoc`
- [ ] TypeScript strict: no `any`, proper type guards
- [X] **COMPLETED**

---

### T-002: Create `web/src/lib/schema.test.ts`

**File**: `web/src/lib/schema.test.ts`
**Dependencies**: T-001

Unit tests for `parseSimpleSchema` and `buildSchemaDoc`.

- [ ] Test: `parseSimpleSchema('string')` → `{ type: 'string' }`
- [ ] Test: `parseSimpleSchema('integer')` → `{ type: 'integer' }`
- [ ] Test: `parseSimpleSchema('boolean')` → `{ type: 'boolean' }`
- [ ] Test: `parseSimpleSchema('number')` → `{ type: 'number' }`
- [ ] Test: `parseSimpleSchema('[]string')` → `{ type: 'array', items: 'string' }`
- [ ] Test: `parseSimpleSchema('[]integer')` → `{ type: 'array', items: 'integer' }`
- [ ] Test: `parseSimpleSchema('map[string]string')` → `{ type: 'map', key: 'string', value: 'string' }`
- [ ] Test: `parseSimpleSchema('integer | default=2')` → `{ type: 'integer', default: '2' }`
- [ ] Test: `parseSimpleSchema('string | default=')` → `{ type: 'string', default: '' }`
- [ ] Test: `parseSimpleSchema('string | required')` → `{ type: 'string', required: true }`
- [ ] Test: `parseSimpleSchema('string | required | default=foo')` → `{ type: 'string', required: true, default: 'foo' }`
- [ ] Test: `inferStatusType('${x == 2}')` → `'boolean'`
- [ ] Test: `inferStatusType('${x.status.phase}')` → `'string'`
- [ ] Test: `buildSchemaDoc(rgd)` returns correct kind/apiVersion/specFields/statusFields
- [X] **COMPLETED**

---

## Phase 2 — Sub-components

### T-003: Create `web/src/components/FieldTable.tsx` + `FieldTable.css`

**Files**: `web/src/components/FieldTable.tsx`, `web/src/components/FieldTable.css`
**Dependencies**: T-001

Renders a table of `ParsedField[]`.

Columns:
- **Field** — field name (plain text, copyable)
- **Type** — type badge (monospace code element)
- **Required** — colored dot: rose for required, faint for optional
- **Default** — default value in muted monospace, or dash

For status fields:
- **Field** — field name
- **Type** — inferred type badge
- **Source** — CEL expression rendered via `KroCodeBlock` (small, inline)

Props:
```typescript
interface FieldTableProps {
  fields: ParsedField[]
  variant: 'spec' | 'status'
}
```

- [ ] Define `FieldTableProps` interface
- [ ] Implement `FieldTable` component for `variant='spec'`
- [ ] Implement `FieldTable` component for `variant='status'`
- [ ] Use tokens: `--color-border`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-error`, `--font-mono`
- [ ] Required dot: `--color-error` (rose)
- [ ] Optional dot: `--color-text-faint`
- [ ] `data-testid="field-table"` on root, `data-testid="field-row"` on each row
- [ ] CSS: striped rows via `:nth-child(even)` with `--color-surface-2`
- [X] **COMPLETED**

---

### T-004: Create `web/src/components/ExampleYAML.tsx` + `ExampleYAML.css`

**Files**: `web/src/components/ExampleYAML.tsx`, `web/src/components/ExampleYAML.css`
**Dependencies**: T-001

Generates and displays a copyable example YAML manifest.

Props:
```typescript
interface ExampleYAMLProps {
  schema: SchemaDoc
}
```

Generation algorithm:
1. Build YAML string from `schema.kind`, `schema.apiVersion`, `schema.group`
2. `metadata.name` = `my-<kind-lowercased-hyphenated>`
3. For each spec field:
   - Has default → commented line: `  # <name>: <default>    # optional - <type> (default: <default>)`
   - No default → active line: `  <name>: <placeholder>    # <required|> - <type>`
   - Placeholders: `""` for string, `0` for integer/number, `false` for boolean, `[]` for array, `{}` for map
4. Render via `KroCodeBlock` with `title="Example Manifest"`

- [ ] Define `ExampleYAMLProps` interface
- [ ] Implement `generateExampleYAML(schema: SchemaDoc): string` pure function
- [ ] Render via `KroCodeBlock` (copy button built-in)
- [ ] `data-testid="example-yaml"` on root div
- [ ] CSS: minimal wrapper, inherits KroCodeBlock styles
- [X] **COMPLETED**

---

## Phase 3 — Docs Tab

### T-005: Create `web/src/components/DocsTab.tsx` + `DocsTab.css`

**Files**: `web/src/components/DocsTab.tsx`, `web/src/components/DocsTab.css`
**Dependencies**: T-001, T-003, T-004

Top-level Docs tab component.

Props:
```typescript
interface DocsTabProps {
  rgd: K8sObject
}
```

Sections:
1. **API Reference** header with `kind` and `apiVersion` shown as badges
2. **Spec Fields** section — `<FieldTable variant="spec" fields={...} />` or empty state
3. **Status Fields** section (only if statusFields.length > 0) — `<FieldTable variant="status" fields={...} />`
4. **Example Manifest** section — `<ExampleYAML schema={schemaDoc} />`

Empty state for no spec fields: `"This API has no configurable fields — all behavior is derived from status"`

- [ ] Implement `DocsTab` component
- [ ] Use `buildSchemaDoc(rgd)` from `@/lib/schema`
- [ ] Section structure with headings matching `validation-tab__section-title` style
- [ ] Empty spec fields message shown correctly
- [ ] `data-testid="docs-tab"` on root
- [ ] CSS uses only `--color-*`, `--font-*`, `--radius-*`, `--transition-*` tokens
- [X] **COMPLETED**

---

## Phase 4 — Tab Integration

### T-006: Update `web/src/pages/RGDDetail.tsx`

**File**: `web/src/pages/RGDDetail.tsx`
**Dependencies**: T-005

Add Docs tab to the RGDDetail page.

Changes:
- Extend `TabId` union: add `"docs"`
- Extend `isValidTab()`: add `t === "docs"` branch
- Add `import DocsTab from "@/components/DocsTab"`
- Add tab bar button: `<button data-testid="tab-docs" ...>Docs</button>` (after Access)
- Add tab panel: `{activeTab === "docs" && <div className="rgd-tab-panel"><DocsTab rgd={rgd} /></div>}`
- Update JSDoc to include `020-schema-doc-generator` spec ref

- [ ] Extend `TabId` type
- [ ] Extend `isValidTab()`
- [ ] Add import
- [ ] Add tab button
- [ ] Add tab panel content
- [ ] Update JSDoc comment
- [X] **COMPLETED**

---

## Phase 5 — Tests

### T-007: Create `web/src/components/DocsTab.test.tsx`

**File**: `web/src/components/DocsTab.test.tsx`
**Dependencies**: T-005, T-006

Unit tests for `DocsTab`, `FieldTable`, and `ExampleYAML`.

Test fixtures:
```typescript
function makeRGD(spec: Record<string, string>, status: Record<string, string>)
```

DocsTab tests:
- [ ] Renders one row per spec field
- [ ] Shows default value when present
- [ ] Shows required indicator for required fields (via optional/required)
- [ ] Generates correct example YAML (required fields active, optional commented)
- [ ] Clipboard mock: clicks copy button → writes YAML to clipboard
- [ ] Empty spec fields → shows empty state message
- [ ] Status fields rendered in separate section
- [ ] Status CEL expressions visible in status section

ExampleYAML tests:
- [ ] Required fields appear as active YAML lines
- [ ] Optional fields with defaults appear as comments

FieldTable tests:
- [ ] Renders correct number of rows
- [ ] Shows `data-testid="field-row"` for each field

- [X] **COMPLETED**

---

## Phase 6 — Validation

### T-008: TypeScript type check

- [ ] Run `bun run typecheck` (from `web/` directory)
- [ ] Fix any type errors
- [ ] Verify 0 errors
- [X] **COMPLETED**

---

### T-009: Run unit tests

- [ ] Run `bun run test` (from `web/` directory)
- [ ] All new tests pass
- [ ] No regressions in existing tests
- [X] **COMPLETED**

---

## Execution Order

```
T-001 → T-002              (schema lib + tests)
T-001 → T-003              (FieldTable)
T-001 → T-004              (ExampleYAML)
T-003 + T-004 → T-005      (DocsTab)
T-005 → T-006              (RGDDetail tab integration)
T-005 + T-006 → T-007      (component tests)
T-007 → T-008 → T-009      (validation)
```

T-002 and T-003 and T-004 can run in parallel after T-001.
