# Data Model: 044-rgd-designer-full-features

**Branch**: `044-rgd-designer-full-features`
**Date**: 2026-03-26

---

## Overview

This spec extends the TypeScript types in `web/src/lib/generator.ts` and the
form state driving `RGDAuthoringForm`. No new files — all type extensions land
in `generator.ts`. The shape changes flow through to `generateRGDYAML` and
`rgdAuthoringStateToSpec`.

---

## Entity 1: `AuthoringField` (extended)

**File**: `web/src/lib/generator.ts`

```typescript
export interface AuthoringField {
  id: string          // stable React key
  name: string        // spec field name
  type: string        // SimpleSchema base type
  defaultValue: string
  required: boolean
  // NEW: optional constraint fields
  enum?: string       // comma-separated allowed values, e.g. "dev,staging,prod"
  minimum?: string    // numeric minimum (stored as string, empty = absent)
  maximum?: string    // numeric maximum (stored as string, empty = absent)
  pattern?: string    // regex pattern string, empty = absent
}
```

**Validation rules**:
- `enum` only applies to `string` type; ignored for others during serialization
- `minimum`/`maximum` only apply to `integer`/`number`; ignored otherwise
- `pattern` only applies to `string`
- All constraint fields are optional — omitting or empty = not serialized

**State transitions**: constraint fields may be added/removed by the "expand
row" toggle. Collapsing a row does not clear constraints.

---

## Entity 2: `AuthoringStatusField` (new)

**File**: `web/src/lib/generator.ts`

```typescript
/** A user-defined status field in the RGD authoring form. */
export interface AuthoringStatusField {
  /** Stable React key. */
  id: string
  /** Status field name (key in spec.schema.status). */
  name: string
  /** CEL expression string, including ${...} wrapper. */
  expression: string
}
```

**Validation rules**:
- Empty `name` → field is omitted from serialized YAML
- Empty `expression` → field is omitted from serialized YAML
- No server-side validation; expression is written verbatim

---

## Entity 3: `ForEachIterator` (new)

**File**: `web/src/lib/generator.ts`

```typescript
/** A single iterator entry in a forEach collection resource. */
export interface ForEachIterator {
  /** Stable React key. */
  _key: string
  /** Iterator variable name (YAML key in the forEach entry). */
  variable: string
  /** CEL expression that evaluates to an array. */
  expression: string
}
```

---

## Entity 4: `AuthoringExternalRef` (new)

**File**: `web/src/lib/generator.ts`

```typescript
/** External reference configuration for a resource in externalRef mode. */
export interface AuthoringExternalRef {
  apiVersion: string
  kind: string
  namespace: string    // optional; empty = omit from YAML
  /** For scalar refs: name of the resource. Mutually exclusive with selectorLabels. */
  name: string
  /** For collection refs: matchLabels entries. Mutually exclusive with name. */
  selectorLabels: { _key: string; labelKey: string; labelValue: string }[]
}
```

**Classification logic** (mirrors `dag.ts` `classifyResource`):
- `name` non-empty → `NodeTypeExternal` (scalar)
- `selectorLabels` non-empty and `name` empty → `NodeTypeExternalCollection`

---

## Entity 5: `AuthoringResource` (extended)

**File**: `web/src/lib/generator.ts`

```typescript
export interface AuthoringResource {
  /** Stable React key. */
  _key: string
  /** Resource id in spec.resources[]. */
  id: string
  /** Template apiVersion. */
  apiVersion: string
  /** Template kind. */
  kind: string

  // NEW fields:
  /** Resource type toggle. Default: 'managed'. */
  resourceType: 'managed' | 'forEach' | 'externalRef'
  /**
   * Raw YAML string for the template body (everything below `template:`).
   * CEL expressions are preserved verbatim.
   * Empty string → fall back to 'spec: {}' in generated YAML.
   */
  templateYaml: string
  /**
   * includeWhen CEL expression (single entry — kro supports a list but the
   * designer exposes one for simplicity; advanced users can add more in the
   * YAML preview).
   * Empty string → omit includeWhen from generated YAML.
   */
  includeWhen: string
  /** readyWhen CEL expressions. Empty entries are filtered before serialization. */
  readyWhen: string[]
  /** forEach iterators. Only used when resourceType === 'forEach'. */
  forEachIterators: ForEachIterator[]
  /** External ref config. Only used when resourceType === 'externalRef'. */
  externalRef: AuthoringExternalRef
}
```

**Default values** (for `newResource()` factory in the form):
```typescript
{
  _key: newResourceId(),
  id: 'resource',
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  resourceType: 'managed',
  templateYaml: '',
  includeWhen: '',
  readyWhen: [],
  forEachIterators: [{ _key: newForEachKey(), variable: '', expression: '' }],
  externalRef: {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    namespace: '',
    name: '',
    selectorLabels: [],
  },
}
```

---

## Entity 6: `RGDAuthoringState` (extended)

**File**: `web/src/lib/generator.ts`

```typescript
export interface RGDAuthoringState {
  rgdName: string
  kind: string
  group: string
  apiVersion: string
  /** NEW: CRD scope. Default 'Namespaced' emits no scope key in YAML. */
  scope: 'Namespaced' | 'Cluster'
  specFields: AuthoringField[]
  /** NEW: Status field definitions. */
  statusFields: AuthoringStatusField[]
  resources: AuthoringResource[]
}
```

---

## Pure function changes

### `generateRGDYAML(state: RGDAuthoringState): string`

Extended to emit:
1. `scope: Cluster` after `kind:` line (when scope === 'Cluster')
2. `status:` block after `spec:` block (when statusFields non-empty)
3. Per-resource: `includeWhen`, `readyWhen`, `forEach` (before `template:`)
4. Per-resource template body from `templateYaml` (indented 8 spaces, fallback to `spec: {}`)
5. `externalRef` block instead of `template:` for externalRef-mode resources
6. Spec field constraint strings appended in `buildSimpleSchemaStr`

### `rgdAuthoringStateToSpec(state: RGDAuthoringState): Record<string, unknown>`

Extended to map new resource fields to the shape `buildDAGGraph` expects:
- forEach-mode → `{ id, forEach: [{variable: expression}], template: { apiVersion, kind, metadata: {name:''}, spec: {}, _raw: templateYaml } }`
- externalRef-mode → `{ id, externalRef: { apiVersion, kind, metadata: { name?, namespace?, selector? } } }` (no template)
- includeWhen → `{ ..., includeWhen: [expr] }` when non-empty
- readyWhen → `{ ..., readyWhen: [...] }` when non-empty
- templateYaml → added as `template._raw = templateYaml` for raw string CEL extraction by `walkTemplate`

### `buildSimpleSchemaStr(field: AuthoringField): string`

Extended to append constraint modifiers:
```
'string | enum=dev,staging,prod'
'integer | default=3 minimum=1 maximum=100'
'string | required pattern=^[a-z]+'
```
Order: `required` or `default=`, then `minimum=`, `maximum=`, `enum=`, `pattern=`.

---

## `STARTER_RGD_STATE` update

Updated to include the new fields with sensible defaults:
```typescript
export const STARTER_RGD_STATE: RGDAuthoringState = {
  rgdName: 'my-app',
  kind: 'MyApp',
  group: 'kro.run',
  apiVersion: 'v1alpha1',
  scope: 'Namespaced',
  specFields: [],
  statusFields: [],
  resources: [{
    _key: 'starter-web',
    id: 'web',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    resourceType: 'managed',
    templateYaml: '',
    includeWhen: '',
    readyWhen: [],
    forEachIterators: [{ _key: 'fe-0', variable: '', expression: '' }],
    externalRef: { apiVersion: 'v1', kind: 'ConfigMap', namespace: '', name: '', selectorLabels: [] },
  }],
}
```

---

## Component state summary

`RGDAuthoringForm` receives `state: RGDAuthoringState` and `onChange`. All new
form state is local to the prop callback chain — no new React context, no
localStorage.

New per-resource UI state (not in `RGDAuthoringState`):
- `expandedTemplates: Set<string>` — which resource `_key`s have template editor open
- `expandedAdvanced: Set<string>` — which resource `_key`s have advanced options open
- `expandedFields: Set<string>` — which spec field `id`s have constraints expanded

These are `useState` in `RGDAuthoringForm` itself (ephemeral UI state, not persisted).
