# Data Model: RGD Optimization Advisor (023)

## Entities

### `CollapseGroup`

Represents a detected set of sibling `NodeTypeResource` nodes that are
candidates for collapsing into a single `NodeTypeCollection`.

```typescript
interface CollapseGroup {
  /** Shared apiVersion across all nodes in the group (may be empty string if absent in template). */
  apiVersion: string
  /** Shared kind across all nodes in the group. */
  kind: string
  /** IDs of the NodeTypeResource nodes that form this group. Length ≥ 2. */
  nodeIds: string[]
}
```

**Constraints**:
- `nodeIds.length >= 2` always (groups of 1 are never returned)
- `kind` is never empty (resources with no resolvable kind are skipped during analysis)
- `apiVersion` may be empty string when the template has no `apiVersion` key

---

### `CollapseGroupSuggestion` (UI-only state, not persisted)

Per-group UI state managed inside `OptimizationAdvisor` via `useState`.

```typescript
interface CollapseGroupSuggestion {
  group: CollapseGroup
  dismissed: boolean
  expanded: boolean
}
```

**State transitions**:
- Initial: `{ dismissed: false, expanded: false }`
- User clicks "Learn more" / expand toggle: `expanded` flips to `true`
- User clicks "×" dismiss: `dismissed` flips to `true` (item hidden from view)
- Dismissed items are never shown again in the same session (no reset)

---

## Function Signature

### `detectCollapseGroups(spec: unknown): CollapseGroup[]`

Pure function, exported from `web/src/lib/dag.ts`.

**Input**: RGD `spec` object (same shape as passed to `buildDAGGraph`; may be
`null`, `undefined`, or malformed — must return `[]` without throwing).

**Output**: Array of `CollapseGroup` objects, one per qualifying candidate
group. Empty array if no groups qualify or if input is invalid.

**Algorithm**:
1. Extract `spec.resources` as an array; if absent/null, return `[]`
2. For each resource `r` in the array:
   a. Classify node type using the shared `classifyResource(r)` helper
   b. Skip if node type is not `'resource'` (i.e., skip `collection`, `external`,
      `externalCollection`, `instance`)
   c. Skip if `r.template` is absent or not an object
   d. Extract `kind` from `r.template.apiVersion`/`r.template.kind` as
      strings; skip if `kind` is absent or not a string
   e. Treat absent `apiVersion` as empty string `""`
3. Group by `"${apiVersion}/${kind}"` key
4. For each group with ≥ 2 members:
   a. If group size ≥ 3: qualify unconditionally
   b. If group size == 2: compute pairwise Jaccard similarity of top-level
      template key sets; qualify if ≥ 0.70
5. Return array of `CollapseGroup` for each qualifying group

**Jaccard similarity formula** (for two key sets A and B):
```
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

Where A and B are the `Set<string>` of top-level keys of each resource's
`template` object (excluding `apiVersion` and `kind` which are used for
grouping already).

---

## Structural Notes

### No Backend Changes

This feature is entirely frontend. No new API endpoints, no new backend types.
The analysis is performed client-side on the already-loaded RGD `spec` object.

### CSS Token Additions to `tokens.css`

The following new tokens are required (amber advisory color family):

```css
/* :root (dark theme) */
--color-advisor-bg: rgba(245, 158, 11, 0.06);
--color-advisor-border: rgba(245, 158, 11, 0.25);
--color-advisor-icon: #f59e0b;

/* [data-theme="light"] */
--color-advisor-bg: rgba(217, 119, 6, 0.06);
--color-advisor-border: rgba(217, 119, 6, 0.25);
--color-advisor-icon: #d97706;
```

`--color-advisor-icon` reuses the existing amber hue (`--color-reconciling`)
at full opacity; `--color-advisor-bg` and `--color-advisor-border` are
reduced-opacity tints. These tokens are defined in `tokens.css` and referenced
via `var()` in the component CSS — no inline rgba() literals.

### New Files

| File | Purpose |
|------|---------|
| `web/src/components/OptimizationAdvisor.tsx` | Main advisor component |
| `web/src/components/OptimizationAdvisor.css` | Scoped CSS (tokens only) |
| `web/src/components/OptimizationAdvisor.test.tsx` | Vitest unit tests |

### Modified Files

| File | Change |
|------|--------|
| `web/src/lib/dag.ts` | Add `detectCollapseGroups` export + private `classifyResource` helper refactor |
| `web/src/lib/dag.test.ts` | Extend with `detectCollapseGroups` test cases |
| `web/src/pages/RGDDetail.tsx` | Import + render `<OptimizationAdvisor>` in Graph tab |
| `web/src/tokens.css` | Add 3 new `--color-advisor-*` tokens |
