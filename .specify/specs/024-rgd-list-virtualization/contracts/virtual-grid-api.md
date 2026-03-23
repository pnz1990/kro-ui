# Component & Hook Contracts: VirtualGrid System

**Branch**: `024-rgd-list-virtualization`
**Date**: 2026-03-22
**Scope**: Internal UI contracts — `VirtualGrid`, `useVirtualGrid`, `useDebounce`

These contracts define the stable interface boundaries between the new shared
components/hooks and the pages that consume them. Any change to these interfaces
requires updating both the contract document and all call-sites.

---

## Contract 1: `VirtualGrid<T>` Component

**File**: `web/src/components/VirtualGrid.tsx`

### Type Signature

```typescript
interface VirtualGridProps<T> {
  /** Fully filtered, sorted list of items to render. Length may be 0–N. */
  items: T[];

  /** Render prop. Called only for items in the visible window. */
  renderItem: (item: T, index: number) => React.ReactNode;

  /**
   * Fixed height of each card in pixels.
   * ALL items are assumed to have this height (enables O(1) layout math).
   * Must be a positive finite integer.
   */
  itemHeight: number;

  /**
   * Optional CSS class added to the outermost container div.
   * The container is `position: relative; overflow-y: auto; height: 100%`.
   */
  className?: string;

  /**
   * Content to display when items.length === 0 and no load is in progress.
   * Defaults to a generic "No items to display" paragraph.
   */
  emptyState?: React.ReactNode;
}

function VirtualGrid<T>(props: VirtualGridProps<T>): React.ReactElement
```

### Behaviour Guarantees

| Guarantee | Description |
|-----------|-------------|
| Bounded DOM | At any scroll position, at most `(visibleRows + 2 × overscan) × cols` card elements are mounted in the DOM |
| Correct total height | The scroll container's total scrollable height equals `ceil(items.length / cols) × itemHeight` regardless of window position |
| Empty state | When `items.length === 0`, renders `emptyState` (or default message) — never a blank container |
| No flicker on resize | A `ResizeObserver` recalculates `cols` and visible window synchronously; no intermediate blank frame |
| Scroll position stability | After filter changes reduce `items.length`, `scrollTop` is reset to 0 to avoid showing a blank offset |

### NOT in scope

- Sorting — callers pass pre-sorted `items`
- Filtering — callers pass pre-filtered `items`
- Loading state — callers render skeletons before passing non-empty `items`
- Variable-height items — not supported; `itemHeight` is a fixed contract

### Usage Example

```tsx
// Home page
<VirtualGrid
  items={filteredRGDs}
  itemHeight={130}
  renderItem={(rgd) => (
    <RGDCard key={extractRGDName(rgd)} rgd={rgd} />
  )}
  emptyState={<p className="home__empty">No RGDs match your search.</p>}
  className="home__virtual-grid"
/>
```

---

## Contract 2: `useVirtualGrid` Hook

**File**: `web/src/hooks/useVirtualGrid.ts`

### Type Signature

```typescript
interface UseVirtualGridOptions {
  itemCount: number;      // total items (after filtering)
  cols: number;           // cards per row (≥ 1)
  itemHeight: number;     // px per row (fixed)
  overscan?: number;      // extra rows above+below window (default: 2)
  containerHeight: number; // visible scroll area height in px
  scrollTop: number;      // current scroll offset in px
}

interface UseVirtualGridResult {
  firstIndex: number;   // first item index to render (inclusive)
  lastIndex: number;    // last item index to render (exclusive)
  offsetTop: number;    // px height of top spacer
  offsetBottom: number; // px height of bottom spacer
  totalHeight: number;  // total scroll height for the container
}

function useVirtualGrid(options: UseVirtualGridOptions): UseVirtualGridResult
```

### Pure Function Invariants

The hook contains no side effects. Given the same inputs it always returns the
same output. The following invariants hold:

```
firstIndex >= 0
lastIndex <= itemCount
firstIndex <= lastIndex
offsetTop >= 0
offsetBottom >= 0
totalHeight = ceil(itemCount / cols) × itemHeight
offsetTop + (lastIndex - firstIndex items) height + offsetBottom = totalHeight  (approx, due to partial rows)
```

### Test contract

The unit tests (`useVirtualGrid.test.ts`) MUST cover:

- `itemCount=0`: returns `{ firstIndex: 0, lastIndex: 0, offsetTop: 0, offsetBottom: 0, totalHeight: 0 }`
- `itemCount=1`: single item, single row
- `scrollTop=0, overscan=2`: renders rows 0..`min(visibleRows+overscan, totalRows)`
- `scrollTop` mid-list: correct first/last indices with overscan
- `scrollTop` at bottom: `lastIndex === itemCount`
- `cols=1` (narrow container): degenerates to a simple list
- `cols=10` (wide container): groups items correctly

---

## Contract 3: `useDebounce<T>` Hook

**File**: `web/src/hooks/useDebounce.ts`

### Type Signature

```typescript
function useDebounce<T>(value: T, delayMs: number): T
```

### Behaviour Guarantees

| Guarantee | Description |
|-----------|-------------|
| Delayed emission | The returned value updates only after `delayMs` ms have elapsed since the last `value` change |
| Timer reset | Each new `value` cancels the pending timer and starts a fresh one |
| Cleanup | The pending timer is cancelled on component unmount |
| Initial value | On first render, returns the initial `value` synchronously (no delay on mount) |
| Type-safe | Works with any `T`: `string`, `number`, array, object, etc. |

### Test contract

The unit tests (`useDebounce.test.ts`) MUST cover (using Vitest fake timers):

- Value does not change before `delayMs` elapses
- Value changes exactly once after `delayMs` elapses
- Rapid changes (n keystrokes < `delayMs` apart) result in exactly 1 emission
- Timer is cleared on unmount (no state-update-after-unmount warning)

---

## Contract 4: Home Page Search Integration

**File**: `web/src/pages/Home.tsx` (amended)

### State contract

```typescript
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

const filteredItems = useMemo(
  () => items.filter(rgd => matchesSearch(rgd, debouncedQuery)),
  [items, debouncedQuery]
);
```

`matchesSearch` is imported from `@/lib/catalog`. It performs a case-insensitive
plain-text substring match on RGD name and kind. It MUST NOT be reimplemented
in `Home.tsx` — reuse only.

### UI contract

- A `<SearchBar>` component is rendered above the `<VirtualGrid>`
- The `SearchBar` shows a placeholder: `"Search RGDs…"`
- When `filteredItems.length === 0` and `debouncedQuery !== ''`, the `VirtualGrid`
  renders the empty state: `"No RGDs match your search."`
- When `filteredItems.length === 0` and `debouncedQuery === ''` and `!isLoading`,
  the empty state reads: `"No RGDs found in this cluster."`

---

## Contract 5: Catalog Page Debounce Integration

**File**: `web/src/pages/Catalog.tsx` (amended)

### Change contract

The existing `searchQuery` state and `SearchBar` controlled input are unchanged.
The only change to the filter pipeline is:

```typescript
// Before
const filtered = useMemo(
  () => entries.filter(e => matchesSearch(e.rgd, searchQuery) && matchesLabelFilter(e.rgd, activeLabels)),
  [entries, searchQuery, activeLabels]
);

// After
const debouncedQuery = useDebounce(searchQuery, 300);
const filtered = useMemo(
  () => entries.filter(e => matchesSearch(e.rgd, debouncedQuery) && matchesLabelFilter(e.rgd, activeLabels)),
  [entries, debouncedQuery, activeLabels]
);
```

`activeLabels` changes (label pill toggle) are NOT debounced — they are discrete
click events, not continuous keystroke streams, so immediate response is correct.

The `sorted.map(...)` render is replaced with `<VirtualGrid>` consuming `sorted`.
