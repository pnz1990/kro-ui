# Data Model: Generate Form Polish + DAG Legend + Overlay Fixes (034)

**Branch**: `034-generate-form-polish`
**Updated**: 2026-03-23

---

## Overview

No new data entities. All changes are:
- Presentational/accessibility additions to existing components
- A new `DAGLegend` leaf component (no state, no props with complex types)
- One crash-fix null-coercion at a call site
- One behavior change (accordion expand) in `StaticChainDAG`

---

## Changed Components

### 1. `InstanceForm.tsx` + `InstanceForm.css`

**New element — legend header**

Added between the `metadata.name` row and the spec field rows:

```jsx
<div className="instance-form__legend">
  <span>
    <span className="instance-form__required-dot instance-form__required-dot--required"
          title="Required field" aria-hidden="true">●</span>
    {' '}required
  </span>
  <span>
    <span className="instance-form__required-dot instance-form__required-dot--optional"
          title="Optional field" aria-hidden="true">●</span>
    {' '}optional
  </span>
</div>
```

**Updated — `●` span `title` attributes in `FieldRow`**

| Before | After |
|--------|-------|
| `title="required"` | `title="Required field"` |
| `title="optional"` | `title="Optional field"` |

**Updated — `aria-required` on form controls**

All controls in `FieldRow` gain `aria-required={isRequired}` except checkbox.
`metadata.name` row input gains `aria-required="true"`.

**New CSS — `.instance-form__legend`**

```css
.instance-form__legend {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 6px 0 10px;
  font-size: 11px;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: 4px;
}
```

---

### 2. `RGDAuthoringForm.tsx`

**Changed — checkbox label text only**

```tsx
// Before
req

// After
Required
```

No CSS changes.

---

### 3. `DAGLegend.tsx` (new file)

A purely presentational component with no props (or optional `className` for
nesting context). Renders three badge entries in a horizontal row.

```tsx
interface DAGLegendProps {
  className?: string
}

export default function DAGLegend({ className }: DAGLegendProps) { ... }
```

Renders:
```
[?] conditional (includeWhen)   [∀] forEach collection   [⬡] external reference
```

Each badge char uses a `<span className="dag-legend__badge dag-legend__badge--{type}">`.

---

### 4. `DAGLegend.css` (new file)

```css
.dag-legend {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 6px 8px 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.dag-legend__entry {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.dag-legend__badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

.dag-legend__badge--conditional { color: var(--color-text-muted); }
.dag-legend__badge--collection   { color: var(--node-collection-border); }
.dag-legend__badge--external     { color: var(--node-external-border); }
```

Note: `color` (not `fill`) — HTML elements, not SVG.

---

### 5. `StaticChainDAG.tsx`

**Changed — accordion expand toggle**

```tsx
// Before (allows multiple open)
function handleToggle(nodeId: string) {
  setExpandedNodes((prev) => {
    const next = new Set(prev)
    if (next.has(nodeId)) { next.delete(nodeId) } else { next.add(nodeId) }
    return next
  })
}

// After (accordion — only one open at a time)
function handleToggle(nodeId: string) {
  setExpandedNodes((prev) =>
    prev.has(nodeId) ? new Set() : new Set([nodeId])
  )
}
```

**Added — `<DAGLegend>` below SVG at depth 0**

```tsx
return (
  <div className="dag-graph-container static-chain-dag-container">
    <svg ...>...</svg>
    {depth === 0 && <DAGLegend />}
    <DAGTooltip ... />
  </div>
)
```

---

### 6. `RGDDetail.tsx`

**Changed — null-coerce children items before `buildNodeStateMap`**

```tsx
// Before
setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items))

// After
setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? []))
```

One character change (`?? []`). Fixes "t is not iterable" crash.

---

## State Transitions

No new state. The `expandedNodes: Set<string>` in `StaticChainDAG` is changed
from a multi-item set to an accordion (maximum 1 item) via the `handleToggle`
change above.

---

## Validation Rules

| Rule | Scope |
|------|-------|
| `aria-required="true"` on required non-boolean inputs | `FieldRow`, `metadata.name` row |
| `title="Required field"` on required `●` spans | `FieldRow` |
| `DAGLegend` rendered at `depth === 0` only | `StaticChainDAG` |
| `childrenRes.items ?? []` before `buildNodeStateMap` | `RGDDetail.tsx` overlay fetch effect |
| Accordion: `expandedNodes.size <= 1` always | `StaticChainDAG.handleToggle` |
