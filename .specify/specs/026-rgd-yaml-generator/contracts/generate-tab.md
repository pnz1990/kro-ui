# Component API Contracts: 026-rgd-yaml-generator

This document defines the TypeScript prop interfaces and function signatures
for all new components and library functions in spec 026.

---

## `web/src/lib/generator.ts`

### `kindToSlug(kind: string): string`

```typescript
/**
 * Convert a PascalCase kind string to a lowercase-hyphenated slug.
 *
 * Examples:
 *   "WebApplication" → "web-application"
 *   "MyApp"          → "my-app"
 *   "ConfigMap"      → "config-map"
 *   ""               → ""
 */
export function kindToSlug(kind: string): string
```

---

### `generateInstanceYAML`

```typescript
export interface FieldValue {
  name: string
  value: string        // scalar value (used when isArray === false)
  items: string[]      // array items (used when isArray === true)
  isArray: boolean
}

export interface InstanceFormState {
  metadataName: string
  fields: FieldValue[]
}

/**
 * Generate a Kubernetes instance manifest YAML string from a SchemaDoc
 * and current form state.
 *
 * - Uses toYaml() for value serialization
 * - Omits the spec section entirely if there are no spec fields
 * - Converts boolean string values ("true"/"false") to actual booleans
 * - Converts integer/number string values to numeric types
 * - Array fields become YAML list blocks
 */
export function generateInstanceYAML(
  schema: SchemaDoc,
  state: InstanceFormState,
): string
```

---

### `parseBatchRow`

```typescript
export interface BatchRow {
  values: Record<string, string>
  error: string | undefined
  index: number
}

/**
 * Parse a single batch input line into a key-value map.
 *
 * Line format: space-separated key=value tokens
 * First '=' in each token is the delimiter.
 * Tokens with no key (eqIdx <= 0) are skipped and produce an error.
 *
 * Empty line → { values: {}, error: undefined, index: ... }
 * Malformed token → sets error; valid tokens in the same line are still parsed
 */
export function parseBatchRow(line: string, index: number): BatchRow
```

---

### `generateBatchYAML`

```typescript
/**
 * Generate a multi-document YAML string from a batch input textarea value.
 *
 * Each non-empty line becomes one YAML document separated by '---\n'.
 * Missing field values fall back to schema defaults, then to type placeholders.
 * Malformed rows are skipped (their error is surfaced via the returned BatchRow[]).
 *
 * Returns:
 *   yaml: the full multi-document YAML string (empty string if no valid rows)
 *   rows: parsed BatchRow[] for error display in the UI
 */
export function generateBatchYAML(
  batchText: string,
  schema: SchemaDoc,
): { yaml: string; rows: BatchRow[] }
```

---

### `generateRGDYAML`

```typescript
export interface AuthoringField {
  id: string          // unique row key
  name: string        // field name in spec.schema.spec
  type: string        // SimpleSchema base type
  defaultValue: string
  required: boolean
}

export interface AuthoringResource {
  id: string          // resource id in spec.resources[]
  apiVersion: string  // e.g. "apps/v1"
  kind: string        // e.g. "Deployment"
}

export interface RGDAuthoringState {
  rgdName: string
  kind: string
  group: string
  apiVersion: string
  specFields: AuthoringField[]
  resources: AuthoringResource[]
}

/**
 * Generate a ResourceGraphDefinition YAML scaffold from authoring form state.
 *
 * Uses string construction (not toYaml) to preserve CEL ${...} placeholders
 * as-is in the template metadata fields.
 *
 * Produces valid kro.run/v1alpha1 ResourceGraphDefinition YAML.
 */
export function generateRGDYAML(state: RGDAuthoringState): string
```

---

## `web/src/components/YAMLPreview.tsx`

```typescript
export interface YAMLPreviewProps {
  /** The YAML content to display and offer for copying. */
  yaml: string
  /** Title shown in the code block header (e.g. "Instance Manifest"). */
  title?: string
}

/**
 * YAMLPreview — read-only YAML display with Copy YAML and Copy kubectl-apply buttons.
 *
 * Wraps KroCodeBlock for the syntax-highlighted display.
 * Adds a secondary "Copy kubectl apply" button that copies a heredoc snippet:
 *   kubectl apply -f - <<'EOF'\n<yaml>\nEOF
 *
 * Uses the same copy confirmation pattern as KroCodeBlock (icon swap, 2s reset).
 */
export default function YAMLPreview(props: YAMLPreviewProps): JSX.Element
```

---

## `web/src/components/InstanceForm.tsx`

```typescript
export interface InstanceFormProps {
  /** Schema for the RGD — provides field list, types, defaults, kind, apiVersion. */
  schema: SchemaDoc
  /** Current form state — controlled by parent (GenerateTab). */
  state: InstanceFormState
  /** Called on any field change with the updated state. */
  onChange: (state: InstanceFormState) => void
}

/**
 * InstanceForm — interactive form for generating a Kubernetes instance manifest.
 *
 * Renders one input row per spec field with a type-appropriate control:
 *   string (no enum)   → <input type="text">
 *   string with enum   → <select>
 *   integer / number   → <input type="number">
 *   boolean            → <input type="checkbox">
 *   array              → repeatable rows with add/remove
 *   object / map / ?   → <textarea>
 *
 * First row is always metadata.name (text input, pre-filled with kind-slug).
 * Calls onChange synchronously on every input event.
 */
export default function InstanceForm(props: InstanceFormProps): JSX.Element
```

---

## `web/src/components/BatchForm.tsx`

```typescript
export interface BatchFormProps {
  /** Schema for the RGD — used to apply defaults for missing values. */
  schema: SchemaDoc
  /** Current textarea content — controlled by parent (GenerateTab). */
  batchText: string
  /** Called on textarea change. */
  onBatchTextChange: (text: string) => void
  /** Parsed rows (from generateBatchYAML) — for error display. */
  rows: BatchRow[]
}

/**
 * BatchForm — textarea-driven batch manifest generator.
 *
 * Shows a <textarea> for batch input and a per-row error indicator list.
 * Displays a row count badge when rows > 0.
 * Shows an empty-state message when batchText is empty.
 */
export default function BatchForm(props: BatchFormProps): JSX.Element
```

---

## `web/src/components/RGDAuthoringForm.tsx`

```typescript
export interface RGDAuthoringFormProps {
  /** Current authoring state — controlled by parent (GenerateTab). */
  state: RGDAuthoringState
  /** Called on any change to the authoring state. */
  onChange: (state: RGDAuthoringState) => void
}

/**
 * RGDAuthoringForm — guided form for scaffolding a new ResourceGraphDefinition.
 *
 * Sections:
 *   1. Metadata — RGD name, kind, group, apiVersion
 *   2. Spec Fields — repeatable rows of (name, type, default/required toggle)
 *      with "Add Field" button
 *   3. Resources — repeatable rows of (id, apiVersion, kind)
 *      with "Add Resource" button and "Remove" per row
 *
 * Pre-populated with starter values: kind="MyApp", one resource (id="web", Deployment).
 */
export default function RGDAuthoringForm(props: RGDAuthoringFormProps): JSX.Element
```

---

## `web/src/components/GenerateTab.tsx`

```typescript
type GenerateMode = "form" | "batch" | "rgd"

export interface GenerateTabProps {
  /** The already-loaded RGD object — used to build SchemaDoc. FR-002. */
  rgd: K8sObject
}

/**
 * GenerateTab — top-level component for the "Generate" tab on RGDDetail.
 *
 * Owns:
 *   - mode: GenerateMode (form / batch / rgd)
 *   - InstanceFormState (for form mode)
 *   - batchText + BatchRow[] (for batch mode)
 *   - RGDAuthoringState (for rgd mode)
 *   - derived YAML string for each mode
 *
 * Renders a mode switcher (3 pills: "Instance Form" / "Batch" / "New RGD"),
 * the active mode's input component, and a YAMLPreview on the right.
 *
 * Layout: horizontal split (input left, preview right) on wide viewports;
 * stacked (input top, preview bottom) on narrow (<768px).
 */
export default function GenerateTab(props: GenerateTabProps): JSX.Element
```

---

## Integration point: `web/src/pages/RGDDetail.tsx`

```typescript
// Addition to TabId union:
type TabId = "graph" | "instances" | "yaml" | "validation" | "access" | "docs" | "generate"

// Addition to isValidTab:
// t === "generate" → return true

// Addition to tab bar (after "Docs" button):
<button
  data-testid="tab-generate"
  className="rgd-tab-btn"
  role="tab"
  aria-selected={activeTab === "generate"}
  onClick={() => setTab("generate")}
  type="button"
>
  Generate
</button>

// Addition to tab content (after "docs" block):
{activeTab === "generate" && (
  <div className="rgd-tab-panel">
    <GenerateTab rgd={rgd} />
  </div>
)}
```
