# Data Model: RGD List Virtualization

**Branch**: `024-rgd-list-virtualization`
**Date**: 2026-03-22

This feature is entirely client-side. There are no new backend entities, no
database schema changes, and no new API endpoints. The data model describes the
frontend state and intermediate computed values introduced by this feature.

---

## Entities

### 1. `VirtualGridState`

The runtime state maintained by the `VirtualGrid` component (via `useVirtualGrid`
and DOM measurement hooks). Not persisted; derived on each scroll/resize event.

| Field | Type | Description |
|---|---|---|
| `containerHeight` | `number` (px) | Measured height of the scrollable container element |
| `containerWidth` | `number` (px) | Measured width of the container (drives `cols` calculation) |
| `scrollTop` | `number` (px) | Current scroll offset within the container |
| `cols` | `number` (integer ≥ 1) | Cards per row: `Math.max(1, Math.floor(containerWidth / MIN_CARD_WIDTH))` where `MIN_CARD_WIDTH = 320` |
| `firstIndex` | `number` | Index of the first card in the rendered window (inclusive) |
| `lastIndex` | `number` | Index of the last card in the rendered window (exclusive) |
| `offsetTop` | `number` (px) | Height of the top spacer div (cards above the window × rowHeight) |
| `offsetBottom` | `number` (px) | Height of the bottom spacer div (cards below the window × rowHeight) |

**Validation rules**:
- `cols ≥ 1` always (guards division-by-zero and 0-width containers)
- `firstIndex ≥ 0` always
- `lastIndex ≤ items.length` always
- `firstIndex ≤ lastIndex` always (empty window is valid, e.g., 0 items)
- `offsetTop + offsetBottom + renderedRows × itemHeight = totalScrollHeight`

---

### 2. `VirtualGridProps<T>` (Component Interface)

The props accepted by the `VirtualGrid` React component.

| Prop | Type | Required | Description |
|---|---|---|---|
| `items` | `T[]` | Yes | The full (already filtered) list of items to virtualize |
| `renderItem` | `(item: T, index: number) => ReactNode` | Yes | Render prop for a single card |
| `itemHeight` | `number` | Yes | Fixed height (px) of each rendered card row. Must be a positive integer. |
| `className` | `string` | No | Additional CSS class on the outer container |
| `emptyState` | `ReactNode` | No | Content to render when `items.length === 0`. Defaults to a generic "No items" message. |

---

### 3. `UseVirtualGridOptions` / `UseVirtualGridResult` (Hook Interface)

The pure arithmetic hook that `VirtualGrid` delegates to.

**Input** (`UseVirtualGridOptions`):

| Field | Type | Description |
|---|---|---|
| `itemCount` | `number` | Total number of items in the list |
| `cols` | `number` | Cards per row (computed from container width) |
| `itemHeight` | `number` | Row height in px |
| `overscan` | `number` | Number of extra rows to render above and below the visible window (default: 2) |
| `containerHeight` | `number` | Visible height of the scroll container in px |
| `scrollTop` | `number` | Current scroll offset in px |

**Output** (`UseVirtualGridResult`):

| Field | Type | Description |
|---|---|---|
| `firstIndex` | `number` | Index of the first item to render |
| `lastIndex` | `number` | Index of the last item to render (exclusive) |
| `offsetTop` | `number` | px height of the spacer above the rendered slice |
| `offsetBottom` | `number` | px height of the spacer below the rendered slice |
| `totalHeight` | `number` | Total scrollable height (for the outer container's `height` style) |

---

### 4. `DebounceState<T>` (Hook Interface)

The `useDebounce` hook's conceptual state. Not a struct — the hook returns a
single value.

| Concept | Description |
|---|---|
| `rawValue: T` | The value that changes on every event (e.g., every keystroke) |
| `debouncedValue: T` | The value committed after `delayMs` ms of inactivity |
| `timerId` | Internal `setTimeout` handle — cleared and reset on each `rawValue` change |

**State transitions**:
1. `rawValue` changes → cancel existing timer → start new timer for `delayMs`
2. Timer fires → `debouncedValue` ← `rawValue`
3. Component unmounts → timer cancelled (cleanup)

---

### 5. Home Page Filter State (new)

The Home page currently has no filter state. This feature adds:

| State field | Type | Initial | Description |
|---|---|---|---|
| `searchQuery` | `string` | `''` | Raw input value from the search bar |
| `debouncedQuery` | `string` | `''` | Debounced value used in filter `useMemo` |
| `filteredItems` | `K8sObject[]` | `[]` | Derived via `useMemo`: `matchesSearch(item, debouncedQuery)` filter over `items` |

---

### 6. Catalog Page Filter State (amended)

The Catalog already has `searchQuery`, `activeLabels`, and `sortOption`. This
feature amends only:

| State field | Change |
|---|---|
| `searchQuery` | Unchanged — still a controlled input string |
| `debouncedQuery` | **NEW**: derived from `useDebounce(searchQuery, 300)` |
| `filtered` useMemo | **AMENDED**: depends on `debouncedQuery` instead of raw `searchQuery` |

No other Catalog state changes.

---

## State Transitions

### Virtual Window on Scroll

```
Initial: scrollTop=0, containerHeight=600px, itemHeight=130px, cols=3, items=5000
→ rowsVisible = ceil(600/130) = 5 rows → 5 × 3 = 15 cards visible
→ overscan = 2 rows → render rows 0..6 (7 rows = 21 cards)
→ offsetTop = 0, offsetBottom = (ceil(5000/3) - 7) × 130 = huge

User scrolls to scrollTop=1300px:
→ firstRow = floor(1300/130) - 2 = 8 (with overscan)
→ lastRow = firstRow + 5 + 4 = 17 (visible + 2×overscan)
→ offsetTop = 8 × 130 = 1040px
→ render items[24..51]
```

### Debounce on Search

```
User types 'web' rapidly (3 keystrokes in 200ms):
t=0ms:   'w' → start timer(300ms) → debouncedQuery still ''
t=80ms:  'we' → cancel timer, start timer(300ms) → debouncedQuery still ''
t=160ms: 'web' → cancel timer, start timer(300ms) → debouncedQuery still ''
t=460ms: timer fires → debouncedQuery = 'web' → filter runs → results show
```
