# Contract: UI Components for kro v0.9.0 Features

**Spec**: `046-kro-v090-upgrade` | **Date**: 2026-03-26

---

## Scope Badge

### Contract

A small inline badge rendered on:
1. `RGDCard` (Overview + Catalog pages)
2. RGD detail page header

**Trigger**: `spec.schema.scope === 'Cluster'` on the RGD object.
**Default (Namespaced / absent)**: No badge rendered.

### Visual

```
┌─────────────────────────────┐
│  WebApp    [Active] [Cluster]│
│  ...                        │
└─────────────────────────────┘
```

- Badge text: `"Cluster"`
- CSS class: `rgd-scope-badge` (new)
- Token references: `var(--badge-cluster-bg)`, `var(--badge-cluster-fg)`
- No hardcoded hex values in component CSS

### Token definitions (tokens.css)

```css
/* Cluster-scope badge — violet family to distinguish from status colors */
--badge-cluster-bg: color-mix(in srgb, var(--color-pending) 15%, transparent);
--badge-cluster-fg: var(--color-pending);
```

### DOM output

```html
<span class="rgd-scope-badge" aria-label="Cluster-scoped resource">Cluster</span>
```

`aria-label` is required for screen reader accessibility (§IX WCAG AA).

---

## lastIssuedRevision Chip

### Contract

Rendered in the RGD detail page header when `status.lastIssuedRevision` is present
and `> 0`.

**Graceful degradation**: If the field is absent, `null`, `0`, or non-numeric, the
chip is omitted. Never renders "0" or "unknown".

### Visual

```
  WebApp  [Active ●]  [Rev #3]
```

- Chip text: `"Rev #${n}"` where n is the integer value
- CSS class: `rgd-revision-chip` (new, or extend existing chip pattern)
- Token references: existing `--color-secondary` or neutral token family

---

## DocsTab Types Section

### Contract

Rendered below the Spec section when `spec.schema.types` is a non-empty
JSON object and `capabilities.schema.hasTypes === true`.

**Graceful degradation**: If `types` is `null`, `{}`, or absent → section hidden.

### Visual

```
## Spec
[field table]

## Types
### Server
[field table: host (string), port (integer)]

### DatabaseConfig
[field table: url (string), maxConn (integer | default=10)]
```

- Section heading: `"Types"` (same h2/h3 hierarchy as existing Spec/Status sections)
- Each named type renders as a sub-section with its name as heading
- Field rows use the existing `FieldTable` component

### Props contract

```typescript
// DocsTab receives the RGD K8sObject. Internally:
const rawTypes = nestedGet(rgd, 'spec', 'schema', 'types')  // null | object
const parsedTypes: Record<string, ParsedField[]> = parseTypesBlock(rawTypes)
// Show section only when parsedTypes has ≥1 key
```

`parseTypesBlock` is a new pure helper — it iterates the keys of `rawTypes` and
calls the existing `parseSchema(value)` on each value.

---

## RGDAuthoringForm — Cartesian forEach

### Contract

The "Add iterator" button adds a second `ForEachIterator` row to the forEach
section of a forEach-type resource. The "Remove" button appears on each row
when there are ≥2 iterators.

**Invariant**: forEach resources MUST have ≥1 iterator (validation rule from
spec 045 persists). The "Remove" button is hidden when `forEachIterators.length === 1`.

### DOM output for cartesian product

When 2 iterators are configured:
```html
<div class="iterator-row">
  <input name="iter-var-0" value="region" />
  <input name="iter-expr-0" value="${schema.spec.regions}" />
  <!-- Remove button hidden: only 1 iterator remains if removed = 1 total -->
</div>
<div class="iterator-row">
  <input name="iter-var-1" value="tier" />
  <input name="iter-expr-1" value="${schema.spec.tiers}" />
  <button aria-label="Remove iterator">×</button>
</div>
<button data-testid="add-iterator">+ Add iterator</button>
```

### Generated YAML (cartesian product)

```yaml
forEach:
- region: ${schema.spec.regions}
- tier: ${schema.spec.tiers}
```

Each iterator becomes one entry in the YAML array. Already implemented in
`generateRGDYAML`; this contract is about the UI state wiring only.
