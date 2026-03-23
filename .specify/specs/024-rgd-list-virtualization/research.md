# Research: RGD List Virtualization

**Branch**: `024-rgd-list-virtualization`
**Date**: 2026-03-22
**Status**: Complete — all unknowns resolved

---

## 1. Virtual Scroll Strategy for a CSS Grid

### Decision
Implement a custom **row-based virtual scroll** component (`VirtualGrid`) without
any external library. The component:

1. Measures the container width and a fixed card height to compute how many
   cards fit per row and how many rows are visible.
2. Maintains a `scrollTop` listener on the container element.
3. Derives `firstVisibleRow` / `lastVisibleRow` from `scrollTop` and renders
   only those rows plus an `overscanCount` (2 rows) above and below.
4. Uses two `<div>` spacers — one above the rendered slice (height = rows before ×
   rowHeight) and one below (height = rows after × rowHeight) — to maintain the
   correct total scrollable height without mounting hidden DOM nodes.

### Rationale
- The constitution (§V) prohibits adding external libraries unless the alternative
  is "significantly more complex to write correctly." A row-based virtual grid for
  a fixed-height card is straightforward (~120 lines) and does not justify adding
  a dependency.
- Cards on the home page (`RGDCard`) have **approximately fixed height (~130px)**
  because all text is `white-space: nowrap; text-overflow: ellipsis` and the
  structure always has exactly three sections (header + meta + actions).
- Catalog cards (`CatalogCard`) have **variable height** due to optional label
  pills and "Used by" rows. Two options exist (see §1a below).

### 1a: CatalogCard Height Handling

**Decision**: Normalize `CatalogCard` to a fixed minimum height using CSS
`min-height` and hide overflow content with `text-overflow: ellipsis` / line
clamping where needed. This keeps the virtual grid simple and avoids a measured-
item approach.

**Rationale**: The alternative — measuring every card's actual height before
layout — requires a two-pass render (mount all, measure, then window). This adds
complexity and a layout flash. The CatalogCard skeleton already uses `height: 160px`
as its placeholder, confirming a 160px design target. Clamping label pills to a
single line (with overflow ellipsis) and limiting "Used by" to 2 entries is an
acceptable trade-off for large-cluster performance.

**Alternatives considered**:
- *Dynamic measured rows*: each item is rendered into a hidden off-screen container,
  measured, then stored in a ref-based height map. Rejected: adds ~80 lines of
  complexity and a layout flash. Overkill for a card grid where the height
  variation is small (labels add at most 20–30px).
- *Server-side pagination*: rejected because it requires a new backend API
  parameter and round-trips per filter query, which breaks the ≤100ms filter
  budget on slow clusters.

### 1b: Row vs Item Virtualization

**Decision**: Virtualize at the **row level** — group cards into rows of N cards,
then show/hide rows.

**Rationale**: The grid uses `auto-fill, minmax(320px, 1fr)`. The number of cards
per row (`cols`) changes only when the window is resized. Computing
`cols = Math.floor(containerWidth / 320)` (approximate) is stable between
repaints. Row-level virtualization requires only a `ResizeObserver` on the
container plus a `scroll` listener — both are native browser APIs, no library needed.

**Edge case**: On very wide screens (4K monitors), `cols` could be 8–10, meaning
the DOM contains at most `(visible rows + overscan * 2) × cols ≈ 6 × 10 = 60`
cards at once — well within the ≤100 node requirement from the spec.

---

## 2. Debounce Hook

### Decision
Create `web/src/hooks/useDebounce.ts` — a generic value-debounce hook:

```typescript
function useDebounce<T>(value: T, delayMs: number): T
```

Uses `useEffect` with `setTimeout` / `clearTimeout`. Returns the debounced value.
The call-site (Catalog.tsx, and Home.tsx if a search bar is added) passes the
raw input state value and a `300` ms delay, and uses the returned debounced value
in its `useMemo` filter chain.

**Delay chosen**: 300 ms. This is the widely-accepted threshold that feels
"instant" to users while eliminating per-keystroke filtering on slow hardware.
The 100ms spec budget (SC-003) refers to the render after the debounce fires, not
the debounce delay itself.

### Rationale
- The codebase currently has no debounce utility. The `Catalog.tsx` search input
  re-runs the full `useMemo` filter pipeline on every keystroke, which at 5,000
  items will cause 50–100ms layout thrash on a mid-range laptop.
- A generic value-debounce hook (12 lines) is the simplest correct implementation.
- Alternatives: `useCallback`-with-timeout patterns are subtly broken when `value`
  changes rapidly (stale closure). The `useEffect`-cancellation pattern is the
  canonical React approach.

---

## 3. Home Page Search / Filter

### Decision
Add a search input to the Home page (`Home.tsx`), wiring it to `useDebounce`
and a `useMemo` filter over `items`. The Home page currently has **no search
state** — this is a new capability.

**Rationale**: The spec (FR-004, FR-005) requires debounced search on both the
home page and catalog. Currently the Home page has no search at all. Adding one
is the only path to compliance. The `SearchBar` component already exists and can
be reused.

**Visual placement**: A `SearchBar` above the `VirtualGrid`, consistent with the
Catalog layout. No new design tokens needed — the `SearchBar` component already
uses the correct tokens.

**Filter scope**: Plain case-insensitive substring match on RGD name and kind
(same as the Catalog's `matchesSearch` in `lib/catalog.ts`). Reuse that function.

---

## 4. ResizeObserver for Column Count Recalculation

### Decision
Use a `ResizeObserver` on the `VirtualGrid` container `<div>` to detect width
changes and recompute `cols`. Fall back to `window.innerWidth` during SSR (not
applicable here, but defensive).

**Rationale**: `ResizeObserver` is supported in all modern browsers and is the
correct way to track element dimensions. Using `window.resize` would give the
window width, not the container width (the grid has `padding: 0 32px` from
`Layout.css`).

---

## 5. `useVirtualGrid` Hook vs. Inline Logic in `VirtualGrid`

### Decision
Extract the windowing math into a dedicated hook `useVirtualGrid` that accepts
`{ itemCount, cols, itemHeight, overscan, containerHeight, scrollTop }` and
returns `{ firstIndex, lastIndex, offsetTop, offsetBottom }`.

**Rationale**: Separating the pure math from the DOM-interaction side (the
component) makes unit testing trivial without any DOM or rendering setup. The
component only handles DOM measurement and hands off to the hook for all index
arithmetic.

---

## 6. VirtualGrid API Surface

### Decision
The `VirtualGrid` component accepts a generic `items: T[]` prop and a
`renderItem: (item: T, index: number) => ReactNode` render prop. It also accepts
`itemHeight: number` (fixed height in px) and an optional `className`.

```typescript
interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;   // px, must be fixed
  className?: string;
  emptyState?: ReactNode;
}
```

**Rationale**: Generic render-prop pattern avoids coupling the grid to a specific
card type. Both `RGDCard` and `CatalogCard` can be used as `renderItem`. The
`emptyState` slot handles FR-007 (no-results message) in one place.

---

## 7. Constitution Amendment (FR-010)

### Decision
Amend `constitution.md` §XIII "Scale requirements" bullet:

> Home page and Catalog: must function correctly at ~~100+~~ **5,000+** RGDs
> (search/filter required)

The amendment is committed in the same PR as the implementation. The version bump
is `1.3.0 → 1.4.0` (MINOR: new capability requirement).

---

## Resolved Unknowns Summary

| Unknown | Resolved As |
|---------|-------------|
| Virtual scroll library vs. custom | Custom `VirtualGrid` (no external lib, ~120 LOC) |
| Fixed vs. variable card height | Fixed: RGDCard ~130px; CatalogCard normalized to ~160px via CSS `min-height` |
| Row-level vs. item-level virtualization | Row-level (matches CSS Grid layout) |
| Debounce delay value | 300ms (industry standard, meets spec's ≤100ms post-debounce render budget) |
| Home page search bar | Add new search input; reuse `SearchBar` + `matchesSearch` from `lib/catalog.ts` |
| Column count recalculation | `ResizeObserver` on container element |
| `useVirtualGrid` separation | Separate hook for testable pure arithmetic |
