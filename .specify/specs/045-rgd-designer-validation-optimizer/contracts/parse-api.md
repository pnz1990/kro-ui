# UI Contract: `parseRGDYAML` and `YAMLImportPanel`

**Module**: `web/src/lib/generator.ts` (parser) + `web/src/components/YAMLImportPanel.tsx` (UI)
**Spec**: `045-rgd-designer-validation-optimizer` US8

---

## `parseRGDYAML` function contract

### Signature

```typescript
export function parseRGDYAML(yaml: string): ParseResult

export type ParseResult =
  | { ok: true; state: RGDAuthoringState }
  | { ok: false; error: string }
```

### Guarantees

- **Never throws** — all error conditions return `{ ok: false, error: string }`.
- **Pure** — no side effects, no React dependencies, no global state.
- **Idempotent** — calling `parseRGDYAML(generateRGDYAML(state))` for any valid
  state returns `{ ok: true, state: equivalent }` (round-trip fidelity).
- `STARTER_RGD_STATE` round-trips: `parseRGDYAML(generateRGDYAML(STARTER_RGD_STATE))`
  returns `{ ok: true }` with a state whose fields match `STARTER_RGD_STATE`
  (modulo fresh `id`/`_key` values).

### Error conditions (return `{ ok: false }`)

| Input condition | `error` message |
|----------------|-----------------|
| `yaml` does not contain `kind: ResourceGraphDefinition` | `'Not a ResourceGraphDefinition'` |
| `yaml` is empty or only whitespace | `'Empty input'` |
| `spec.schema` block is absent | `'Missing spec.schema'` |
| Any JavaScript exception during parse | `'Parse failed: <error message>'` |

### Field mapping (success path)

| YAML path | `RGDAuthoringState` field | Default when absent |
|-----------|--------------------------|---------------------|
| `metadata.name` | `rgdName` | `'my-rgd'` |
| `spec.schema.kind` | `kind` | `'MyApp'` |
| `spec.schema.apiVersion` | `apiVersion` | `'v1alpha1'` |
| `spec.schema.group` | `group` | `'kro.run'` |
| `spec.schema.scope: Cluster` | `scope: 'Cluster'` | `'Namespaced'` |
| `spec.schema.spec.*` | `specFields[]` | `[]` |
| `spec.schema.status.*` | `statusFields[]` | `[]` |
| `spec.resources[]` | `resources[]` | `[]` |

### Resource field mapping

| YAML field | `AuthoringResource` field | Logic |
|-----------|--------------------------|-------|
| `id` | `id` | direct |
| `externalRef.apiVersion` | `externalRef.apiVersion` | sets `resourceType = 'externalRef'` |
| `externalRef.kind` | `externalRef.kind` | — |
| `externalRef.metadata.namespace` | `externalRef.namespace` | optional |
| `externalRef.metadata.name` | `externalRef.name` | scalar ref |
| `externalRef.metadata.selector.matchLabels.*` | `externalRef.selectorLabels[]` | collection ref |
| `forEach[]` | `forEachIterators[]` | sets `resourceType = 'forEach'` |
| `template.apiVersion` | `apiVersion` | for managed/forEach |
| `template.kind` | `kind` | for managed/forEach |
| template body (lines after `kind:`) | `templateYaml` | raw verbatim |
| `includeWhen[0]` | `includeWhen` | first entry only |
| `readyWhen[]` | `readyWhen[]` | all entries |

### `parseSimpleSchemaStr` helper contract

```typescript
// Not exported — internal helper
function parseSimpleSchemaStr(raw: string): {
  type: string
  required: boolean
  defaultValue: string
  minimum: string
  maximum: string
  enum: string
  pattern: string
}
```

Input: a raw type string from `spec.schema.spec.*`, e.g.:
- `"integer | default=3 | minimum=1 | maximum=100"`
- `"string | required"`
- `"boolean"`
- `string` (unquoted, from some generators)

Processing:
1. Strip surrounding double-quotes if present.
2. Split on ` | `.
3. First token → `type`.
4. Remaining tokens: match `required`, `default=X`, `minimum=X`, `maximum=X`,
   `enum=X`, `pattern=X`. Unknown tokens are ignored.

Returns defaults (`required: false`, empty strings) for absent modifiers.

---

## `YAMLImportPanel` component contract

### Props

```typescript
interface YAMLImportPanelProps {
  /** Called when a valid YAML is parsed and the user clicks Apply. */
  onImport: (state: RGDAuthoringState) => void
}
```

### DOM contract

| Element | `data-testid` | Description |
|---------|-------------|-------------|
| Toggle button | `"import-yaml-toggle"` | Collapses/expands the panel |
| Textarea | `"import-yaml-input"` | Paste target for YAML |
| Apply button | `"import-yaml-apply"` | Triggers `parseRGDYAML` |
| Error span | `"import-parse-error"` | Shown only on `{ ok: false }` |

### Behaviour contract

| Scenario | Outcome |
|----------|---------|
| User clicks toggle (collapsed → expanded) | Panel body visible; textarea focused |
| User clicks toggle (expanded → collapsed) | Panel body hidden |
| User clicks Apply with valid RGD YAML | `onImport(parsedState)` called; panel collapses; textarea cleared; no error shown |
| User clicks Apply with invalid YAML | `onImport` NOT called; `data-testid="import-parse-error"` shown with `error` string; panel stays open |
| User clicks Apply with empty textarea | Same as invalid — error shown |
| After successful import | Panel collapses; form reflects new state; YAML preview updates |

### `aria` contract

- Toggle button: `aria-expanded={isOpen}`, `aria-controls="import-yaml-body"`
- Panel body: `id="import-yaml-body"`
- Error span: `role="alert"`, `aria-live="polite"`
- Textarea: `aria-label="Paste ResourceGraphDefinition YAML"`
