# Research: Generate Form Polish + DAG Legend + Overlay Fixes (034)

**Branch**: `034-generate-form-polish`
**Updated**: 2026-03-23

---

## Area 1 — Generate form accessibility (issue #121)

### Decision 1: Required-field legend format

**Decision**: Add a `<div className="instance-form__legend">` above the field
rows. It shows two entries side by side:
- `●` (styled with `--color-error`) + text `required`
- `●` (styled with `--color-text-faint`) + text `optional`

**Rationale**: Reuses the exact CSS classes already on field dots
(`instance-form__required-dot--required`, `instance-form__required-dot--optional`)
so the legend is guaranteed to stay in sync with the actual indicator colors.
No new tokens needed.

**Alternatives considered**: Replace `●` with `*` — rejected; symbol change
would require updating tests and users are already familiar with `●`.

### Decision 2: `aria-required` scope

**Decision**: Add `aria-required={isRequired}` to each `<input>`, `<select>`,
and `<textarea>` in `FieldRow`. Exclude `<input type="checkbox">` (boolean
fields always have a value — "required" concept does not apply). Add
`aria-required="true"` to the `metadata.name` input (always required).

**Decision 3: `title` wording update**

Change `title="required"` → `title="Required field"` and
`title="optional"` → `title="Optional field"`.

**Decision 4: `req` label fix**

Change the text `req` to `Required` in `RGDAuthoringForm.tsx:196`. One-line
text change, no CSS changes.

---

## Area 2 — DAG legend (issue #118)

### Decision 5: Legend as a standalone component below the SVG

**Decision**: Create `DAGLegend.tsx` — a small presentational component
rendered below the `<svg>` element inside `StaticChainDAG`. Rendered only at
`depth === 0` to avoid repeating the legend in nested subgraph renders.

**Rationale**: A dedicated component is testable in isolation, avoids growing
the SVG complexity (SVG foreignObject for a legend would be brittle), and
allows the legend to be reused on the live DAG in a future spec.

**Alternatives considered**:
- Tooltip-only (hover explains each badge) — rejected; issue #118 explicitly
  calls out that hover yields no explanation, and tooltips don't help
  keyboard-only users or users who never hover.
- SVG `<text>` legend inside the same SVG — rejected; font rendering and
  clipping inside SVG is fragile; HTML `<div>` is simpler.
- Single `<details>` toggle — rejected; complexity not warranted for 3 items.

### Decision 6: Which badges to include

**Decision**: Three entries always shown:

| Badge | Label |
|-------|-------|
| `?` | conditional (includeWhen) |
| `∀` | forEach collection |
| `⬡` | external reference |

The `readyWhen` badge (present on some nodes) is NOT a node-type indicator —
it is a readiness expression badge. It is excluded from this legend to avoid
confusion. If readyWhen badge needs explanation it can be added in a future
polish pass.

### Decision 7: Badge colors in legend

**Decision**: Legend badge chars use the same CSS classes as DAG badges:
`dag-node-badge--conditional`, `dag-node-badge--collection`,
`dag-node-badge--external`. These classes are already defined in
`StaticChainDAG.css`. Since the legend is HTML (not SVG), `fill` won't apply —
use `color` via separate legend-specific CSS rules that mirror the same token
vars used for SVG `fill` properties.

---

## Area 3 — Overlay crash and expand layout bugs

### Decision 8: Overlay null-items fix location

**Decision**: Fix in `RGDDetail.tsx` at the call site:
```ts
setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? []))
```

**Rationale**: `buildNodeStateMap` already has the right signature
(`children: K8sObject[]`). The null comes from the backend returning
`{"items": null}`. Fixing at the call site (with `?? []`) is a one-character
change and makes the defensive logic visible at the consumption point.

**Alternative**: Fix inside `buildNodeStateMap` — rejected; the function
signature already documents `children: K8sObject[]` (not nullable). The caller
is responsible for normalization.

### Decision 9: Accordion vs multi-expand layout

**Decision**: Accordion behavior — clicking `▸` on node B while node A is
expanded collapses A and expands B. Only one subgraph open at a time.

**Rationale**:
- The multi-expand overlap issue is a hard layout problem. Subgraphs can be
  hundreds of pixels tall. Stacking them vertically requires tracking cumulative
  height offsets for each node-below-node pair — the current SVG coordinate
  system makes this complex and fragile.
- Accordion is the correct UX pattern when multiple expanded panels would
  compete for vertical space. Users can still see each subgraph in sequence.
- Implementation: change `handleToggle` to set `new Set([nodeId])` if the node
  was not already open, or `new Set()` if it was (toggle off). The
  `setExpandedNodes((prev) => ...)` function already handles the toggle logic.

**Implementation change** (one line in `StaticChainDAG.tsx`):
```ts
// Before (multi-expand)
const next = new Set(prev)
if (next.has(nodeId)) { next.delete(nodeId) } else { next.add(nodeId) }
return next

// After (accordion)
if (prev.has(nodeId)) return new Set()      // collapse
return new Set([nodeId])                     // expand, close all others
```

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Root cause of "t is not iterable" | `/children` API returns `items: null`; fix with `?? []` in RGDDetail |
| Why do expanded subgraphs overlap? | SVG height extraHeight uses `Math.max` (single expansion), positions not adjusted for multiple open nodes; fix with accordion |
| Does `buildNodeStateMap` need a guard? | No — fix at call site; function signature is already `K8sObject[]` |
| Should legend appear in nested subgraphs? | No — `depth === 0` only |
| New DAGLegend needs new tokens? | No — reuse existing `--node-collection-border`, `--color-text-muted`, `--node-external-border` via `color` property |
