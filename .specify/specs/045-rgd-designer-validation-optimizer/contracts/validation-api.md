# UI Contract: `validateRGDState`

**Module**: `web/src/lib/generator.ts`
**Spec**: `045-rgd-designer-validation-optimizer`

---

## Function signature

```typescript
export function validateRGDState(state: RGDAuthoringState): ValidationState
```

---

## Input

`RGDAuthoringState` — the full authoring form state (defined in same file).
All fields are read-only. The function MUST NOT mutate the input.

---

## Output

`ValidationState` object — always returned, never throws.

```typescript
export interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
}

export interface ValidationState {
  rgdName?: ValidationIssue
  kind?: ValidationIssue
  resourceIssues: Record<string, ValidationIssue>
  specFieldIssues: Record<string, ValidationIssue>
  statusFieldIssues: Record<string, ValidationIssue>
  totalCount: number
}
```

**Guarantee**: `STARTER_RGD_STATE` always produces `{ totalCount: 0, resourceIssues: {}, specFieldIssues: {}, statusFieldIssues: {} }` (no issues on initial load).

---

## Validation rules (exhaustive)

| Input condition | Output field | Issue type | Message |
|----------------|--------------|------------|---------|
| `state.rgdName === ''` | `rgdName` | `error` | `'RGD name is required'` |
| `state.rgdName` non-empty, fails `/^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/` | `rgdName` | `warning` | `'RGD name should be a valid DNS subdomain (lowercase alphanumeric and hyphens)'` |
| `state.kind === ''` | `kind` | `error` | `'Kind is required'` |
| `state.kind` non-empty, fails `/^[A-Z][a-zA-Z0-9]*$/` | `kind` | `warning` | `'Kind should be PascalCase (e.g. WebApp, MyService)'` |
| Resource `id` appears > 1 time (non-empty) | `resourceIssues[resource._key]` | `warning` | `'Duplicate resource ID'` |
| Resource `resourceType === 'forEach'` with no valid iterator (variable + expression both non-empty) | `resourceIssues[resource._key]` | `warning` | `'forEach resources require at least one iterator'` |
| Note: duplicate-ID takes priority over forEach-no-iterator on same resource `_key` | — | — | — |
| Spec field `name` appears > 1 time (non-empty) | `specFieldIssues[field.id]` | `warning` | `'Duplicate spec field name'` |
| Spec field: `minimum` and `maximum` both non-empty AND `Number(minimum) > Number(maximum)`, no duplicate-name issue already set | `specFieldIssues[field.id]` | `warning` | `'minimum must be ≤ maximum'` |
| Status field `name` appears > 1 time (non-empty) | `statusFieldIssues[statusField.id]` | `warning` | `'Duplicate status field name'` |

---

## `totalCount` invariant

```
totalCount ===
  (rgdName !== undefined ? 1 : 0) +
  (kind !== undefined ? 1 : 0) +
  Object.keys(resourceIssues).length +
  Object.keys(specFieldIssues).length +
  Object.keys(statusFieldIssues).length
```

---

## Consumer contract — `RGDAuthoringForm`

The form component consumes `ValidationState` as follows:

| `ValidationState` field | Rendered adjacent to | CSS class | DOM attrs |
|------------------------|---------------------|-----------|-----------|
| `rgdName` | `rgdName` text input | `rgd-authoring-form__field-msg` or `--warn` | `role="alert" aria-live="polite"` |
| `kind` | `kind` text input | (same) | (same) |
| `resourceIssues[res._key]` | resource `id` input in that row | (same) | (same) |
| `specFieldIssues[field.id]` | spec field `name` input in that row | (same) | (same) |
| `statusFieldIssues[sf.id]` | status field `name` input in that row | (same) | (same) |
| `totalCount > 0` | top of form body | `rgd-authoring-form__validation-summary` | `data-testid="validation-summary"` |

**Invariant**: validation messages are NEVER shown for empty-string `name` / `id`
fields that the user hasn't touched — empty names in resource/field rows are
silently ignored by `generateRGDYAML` (filtered out), so no duplicate-detection
warning fires for them (the frequency map only counts non-empty values).
