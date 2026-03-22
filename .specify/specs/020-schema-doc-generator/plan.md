# Implementation Plan: RGD Schema Documentation Generator

**Spec**: `020-schema-doc-generator`
**Branch**: `020-schema-doc-generator`
**Created**: 2026-03-21

---

## Tech Stack

- **Frontend only** — no backend changes required
- React 19 + TypeScript (strict mode)
- Vitest + @testing-library/react for unit tests
- Plain CSS using `tokens.css` custom properties (no CSS framework)
- No new dependencies required

---

## Architecture

### Data Flow

```
RGDDetail (rgd: K8sObject)
  └─ DocsTab (rgd: K8sObject)
       ├─ FieldTable (fields: ParsedField[])         ← spec fields
       ├─ FieldTable (fields: ParsedField[])         ← status fields (with CEL)
       └─ ExampleYAML (schema: SchemaDoc)            ← generated manifest + copy

Schema data accessed from:
  rgd.spec.schema.kind         → CRD Kind
  rgd.spec.schema.apiVersion   → API version (default: "v1alpha1")
  rgd.spec.schema.group        → API group (default: "kro.run")
  rgd.spec.schema.spec         → Record<fieldName, SimpleSchema type string>
  rgd.spec.schema.status       → Record<fieldName, CEL expression string>
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `web/src/lib/schema.ts` | Pure `parseSimpleSchema(typeStr)` function — parses kro SimpleSchema strings into structured `ParsedField` objects. No React, no side effects. |
| `web/src/components/FieldTable.tsx` | Renders a table of fields with name, type badge, required/optional indicator, default value. Accepts `fields: ParsedField[]`. |
| `web/src/components/ExampleYAML.tsx` | Generates example YAML manifest from a `SchemaDoc`. Required fields as placeholders, optional fields commented out. Copy button. |
| `web/src/components/DocsTab.tsx` | Top-level Docs tab. Reads `rgd.spec.schema`, assembles `SchemaDoc`, renders spec/status field tables and example YAML. |
| `web/src/pages/RGDDetail.tsx` | Extended to add `"docs"` to the `TabId` union, tab bar button, and tab panel. |

---

## File Structure

### New Files

```
web/src/lib/schema.ts           # parseSimpleSchema + SchemaDoc types
web/src/lib/schema.test.ts      # unit tests for parseSimpleSchema
web/src/components/DocsTab.tsx  # Docs tab root component
web/src/components/DocsTab.css  # Docs tab styles
web/src/components/DocsTab.test.tsx  # unit tests
web/src/components/FieldTable.tsx    # spec/status field table
web/src/components/FieldTable.css    # field table styles
web/src/components/ExampleYAML.tsx   # example YAML generator + copy
web/src/components/ExampleYAML.css   # example YAML styles
```

### Modified Files

```
web/src/pages/RGDDetail.tsx     # add "docs" tab
```

---

## Key Types

```typescript
// web/src/lib/schema.ts

/** Parsed representation of a kro SimpleSchema type string. */
export interface ParsedType {
  /** Base type: 'string' | 'integer' | 'boolean' | 'number' | 'object' | 'array' | 'map' */
  type: string
  /** For array types ([]string), the item type */
  items?: string
  /** For map types (map[K]V), the key type */
  key?: string
  /** For map types (map[K]V), the value type */
  value?: string
  /** Default value string, if | default=X is present */
  default?: string
  /** True if | required modifier is present */
  required?: boolean
}

/** A single spec or status field extracted from spec.schema. */
export interface ParsedField {
  name: string
  /** Raw type string from schema (for status fields, the CEL expression) */
  raw: string
  /** Parsed type (undefined for status fields which have CEL expressions) */
  parsedType?: ParsedType
  /** True if this is a status field (CEL expression source) */
  isStatus?: boolean
  /** Inferred type for status fields (boolean for ${expr == value}, else string) */
  inferredType?: string
}

/** Assembled schema documentation object. */
export interface SchemaDoc {
  kind: string
  apiVersion: string
  group: string
  specFields: ParsedField[]
  statusFields: ParsedField[]
}
```

---

## SimpleSchema Parsing Rules

The `parseSimpleSchema(typeStr: string): ParsedType` function parses:

| Input | Output |
|-------|--------|
| `"string"` | `{ type: 'string' }` |
| `"integer"` | `{ type: 'integer' }` |
| `"boolean"` | `{ type: 'boolean' }` |
| `"number"` | `{ type: 'number' }` |
| `"[]string"` | `{ type: 'array', items: 'string' }` |
| `"[]integer"` | `{ type: 'array', items: 'integer' }` |
| `"map[string]string"` | `{ type: 'map', key: 'string', value: 'string' }` |
| `"integer \| default=2"` | `{ type: 'integer', default: '2' }` |
| `"string \| default="` | `{ type: 'string', default: '' }` |
| `"string \| required"` | `{ type: 'string', required: true }` |
| `"string \| required \| default=foo"` | `{ type: 'string', required: true, default: 'foo' }` |

Algorithm:
1. Split on ` | ` (space-pipe-space) to get parts
2. First part = base type string
3. If base type starts with `[]` → array type, items = rest
4. If base type starts with `map[` → map type, parse key/value from brackets
5. Remaining parts are modifiers: `default=X` → `default`, `required` → `required: true`

---

## Example YAML Generation Rules

For a `WebApplication` RGD with:
- `spec.name: string | required` 
- `spec.replicas: integer | default=2`
- `spec.image: string`

Generate:
```yaml
apiVersion: kro.run/v1alpha1
kind: WebApplication
metadata:
  name: my-webapplication
spec:
  name: ""     # required - string
  image: ""    # string
  # replicas: 2    # optional - integer (default: 2)
```

Rules:
- Required fields (explicit `| required` modifier OR fields without a default) → shown as active lines with `""` / `0` / `false` placeholders
- Fields with defaults → shown as commented-out lines with the default value
- `kind` lowercased and hyphenated for `metadata.name` placeholder

---

## Status Field Handling

Status fields have CEL expression values (e.g., `"${deployment.status.availableReplicas == 2}"`).

- They are listed in a separate "Status Fields" section
- Their "type" column shows an inferred type:
  - If the CEL expression contains `==`, `!=`, `>`, `<`, `>=`, `<=` → `boolean`
  - Otherwise → `string`
- The CEL expression is rendered via `KroCodeBlock` (no `title` prop)

---

## CSS Design Approach

All styles use tokens from `tokens.css`. Key patterns from other tabs:

- Section headings: same as `validation-tab__section-title` (16px, `--color-text-muted`)
- Field table: `border: 1px solid var(--color-border)`, `border-radius: var(--radius)`, striped rows
- Type badges: small `<code>` with `background: var(--color-surface-3)`, monospace font
- Required indicator: `•` dot in `--color-error` (rose)
- Optional indicator: `•` dot in `--color-text-faint`
- Default value: `--color-text-muted` with `font-family: var(--font-mono)`

---

## Tab Integration

Changes to `web/src/pages/RGDDetail.tsx`:

1. `TabId` union: add `"docs"`
2. `isValidTab()`: add `t === "docs"` branch
3. JSDoc comment: add `020-schema-doc-generator` spec reference
4. Tab bar: add `<button data-testid="tab-docs">Docs</button>` after Access button
5. Tab content: add `{activeTab === "docs" && <div className="rgd-tab-panel"><DocsTab rgd={rgd} /></div>}`
6. Import: `import DocsTab from "@/components/DocsTab"`

---

## Testing Strategy

### Unit Tests: `web/src/lib/schema.test.ts`

Tests for `parseSimpleSchema`:
- All primitive types
- All array variants
- All map variants
- `| default=X` modifier
- `| required` modifier
- Multiple modifiers combined
- Edge: empty default `| default=`
- Edge: unknown/custom types (pass through)

### Unit Tests: `web/src/components/DocsTab.test.tsx`

Tests for `DocsTab`:
- Renders one row per spec field
- Shows default value when present
- Shows required indicator for required fields
- Generates correct example YAML
- Copies example to clipboard on button click (mock `navigator.clipboard`)
- Handles schema with no spec fields (shows empty state message)
- Status fields rendered in separate section with CEL expressions

Tests for `FieldTable`:
- Renders correct number of rows
- Shows type correctly
- Shows required/optional indicator

Tests for `ExampleYAML`:
- Required fields in output (active lines)
- Optional fields with defaults commented out

---

## Constraints

- **FR-001**: No additional API call — all data from loaded `rgd` prop
- **FR-008**: All styles via `tokens.css` custom properties only
- **NFR-002**: TypeScript strict mode — no `any`, proper type guards throughout
- **Constitution §V**: No new dependencies
- **Constitution §IX**: No hardcoded colors

---

## Acceptance Checklist

- [ ] `parseSimpleSchema` handles all 5 type variants + modifiers
- [ ] Docs tab shows spec fields with name, type, required indicator, default
- [ ] Docs tab shows status fields with CEL expressions via `KroCodeBlock`
- [ ] Example YAML has required fields active, optional fields commented out
- [ ] Copy button copies raw YAML to clipboard
- [ ] `?tab=docs` URL param activates the Docs tab
- [ ] TypeScript strict mode: `bun run typecheck` passes with 0 errors
- [ ] `bun run test` passes all unit tests
