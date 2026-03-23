# Tasks: RGD List Virtualization

**Branch**: `024-rgd-list-virtualization`
**Input**: Design documents from `/specs/024-rgd-list-virtualization/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/virtual-grid-api.md ✓

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- No story label = Setup / Foundational / Polish phase

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files, CSS classes, and hook scaffolding needed before
any user story implementation begins.

- [x] T001 Create `web/src/hooks/useDebounce.ts` — export `useDebounce<T>(value: T, delayMs: number): T` stub (empty implementation, correct signature only)
- [x] T002 [P] Create `web/src/hooks/useVirtualGrid.ts` — export `useVirtualGrid(options: UseVirtualGridOptions): UseVirtualGridResult` stub with correct types from `data-model.md`
- [x] T003 [P] Create `web/src/components/VirtualGrid.tsx` — export `VirtualGrid<T>` component stub accepting `VirtualGridProps<T>` from contracts; renders `null` initially
- [x] T004 [P] Create `web/src/components/VirtualGrid.css` — add `.virtual-grid` (container), `.virtual-grid__spacer` (top/bottom spacers), `.virtual-grid__items` (grid layout: `display: grid; grid-template-columns: repeat(var(--vg-cols, 3), 1fr); gap: 16px`) using only `tokens.css` custom properties

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fully implement the two hooks and the VirtualGrid component —
these are the shared primitives that all three user stories depend on.

**⚠️ CRITICAL**: No user story integration can begin until this phase is complete.

- [x] T005 Implement `useDebounce` in `web/src/hooks/useDebounce.ts` — `useEffect` with `setTimeout`/`clearTimeout` pattern; returns initial value synchronously; cancels timer on unmount; matches Contract 3 behaviour guarantees exactly
- [x] T006 Write unit tests for `useDebounce` in `web/src/hooks/useDebounce.test.ts` — use Vitest fake timers; cover: no-change before delay, single emission after delay, rapid-change coalescing, no state-update-after-unmount warning
- [x] T007 Implement `useVirtualGrid` in `web/src/hooks/useVirtualGrid.ts` — pure arithmetic (no side effects): compute `firstIndex`, `lastIndex`, `offsetTop`, `offsetBottom`, `totalHeight` from inputs; apply overscan (default 2); clamp indices to `[0, itemCount]`; matches Contract 2 invariants exactly
- [x] T008 Write unit tests for `useVirtualGrid` in `web/src/hooks/useVirtualGrid.test.ts` — cover all 7 cases from Contract 2 test contract: `itemCount=0`, `itemCount=1`, `scrollTop=0`, mid-list, bottom, `cols=1`, `cols=10`
- [x] T009 Implement `VirtualGrid<T>` component in `web/src/components/VirtualGrid.tsx`: (a) `ResizeObserver` on container ref to track `containerWidth`; (b) `onScroll` handler to track `scrollTop`; (c) derive `cols = Math.max(1, Math.floor(containerWidth / 320))`; (d) call `useVirtualGrid` with measured values; (e) render top spacer div, `items.slice(firstIndex, lastIndex).map(renderItem)`, bottom spacer div; (f) set CSS `--vg-cols` on the grid div; (g) reset `scrollTop` to 0 when `items.length` decreases; (h) render `emptyState` (or default message) when `items.length === 0`
- [x] T010 Add `min-height: 160px` to `.catalog-card` in `web/src/components/CatalogCard.css` to normalize CatalogCard to a fixed row height, preventing variable heights from breaking the virtual grid row math

**Checkpoint**: `useDebounce`, `useVirtualGrid`, and `VirtualGrid` are all
implemented and their unit tests pass. `VirtualGrid` can be imported by pages.

---

## Phase 3: User Story 1 — Browse Large RGD Inventory Without Lag (Priority: P1) 🎯 MVP

**Goal**: Replace the flat `items.map()` on the Home page with `VirtualGrid`,
keeping the DOM node count bounded at any scroll position with 5,000+ RGDs.

**Independent Test**: Load the home page with a mock API returning 5,000 RGDs.
Confirm the page is interactive, the DOM has fewer than 100 `.rgd-card` nodes,
and scrolling to the bottom does not trigger a "Page Unresponsive" warning.

- [x] T011 [US1] Remove `.home__grid` CSS grid rule from `web/src/pages/Home.css` (the grid layout now lives in `VirtualGrid.css`); add `.home__virtual-grid` container class with `height: calc(100vh - 120px)` (or appropriate viewport-fill height) using only token variables
- [x] T012 [US1] Update `web/src/pages/Home.tsx`: replace `<div className="home__grid">{items.map(...)}</div>` with `<VirtualGrid items={filteredItems} itemHeight={130} renderItem={(rgd) => <RGDCard rgd={rgd} />} emptyState={...} className="home__virtual-grid" />`; keep skeleton loading unchanged (shown while `isLoading`)
- [x] T013 [US1] Add search state to `web/src/pages/Home.tsx`: add `searchQuery` + `setSearchQuery` state, `debouncedQuery = useDebounce(searchQuery, 300)`, and `filteredItems = useMemo(() => items.filter(rgd => matchesSearch(rgd, debouncedQuery)), [items, debouncedQuery])`; import `matchesSearch` from `@/lib/catalog` — do NOT reimplement
- [x] T014 [US1] Add `<SearchBar>` to `web/src/pages/Home.tsx` above the `VirtualGrid`; placeholder `"Search RGDs…"`; wire `value={searchQuery}` and `onChange={e => setSearchQuery(e.target.value)}`; style with `.home__search` class in `Home.css` using token variables only
- [x] T015 [US1] Add empty state messages to `web/src/pages/Home.tsx`: when `filteredItems.length === 0 && debouncedQuery !== ''` → `"No RGDs match your search."`; when `filteredItems.length === 0 && debouncedQuery === '' && !isLoading` → `"No RGDs found in this cluster."`; pass as `emptyState` prop to `VirtualGrid`

**Checkpoint**: Home page with 5,000 RGDs is interactive, DOM is bounded,
search bar is visible and functional, empty states render correctly.

---

## Phase 4: User Story 2 — Instant Filtered Results While Typing (Priority: P2)

**Goal**: Wire `useDebounce` into the Catalog page's existing search input so
the filter does not execute on every keystroke; results appear within 100ms
after the debounce fires.

**Independent Test**: Load the Catalog with 5,000 RGDs; type 5 characters rapidly
(< 300ms total); verify the filter fires exactly once (after the last keystroke + 300ms
pause) and the results update within 100ms of that fire.

- [x] T016 [US2] Update `web/src/pages/Catalog.tsx`: add `debouncedQuery = useDebounce(searchQuery, 300)` and change the `filtered` `useMemo` dependency from `searchQuery` to `debouncedQuery`; `activeLabels` changes remain un-debounced (Contract 5 exactly)
- [x] T017 [US2] Remove `.catalog__grid` CSS grid rule from `web/src/pages/Catalog.css` (moved to `VirtualGrid.css`); add `.catalog__virtual-grid` container class with the same viewport-fill height pattern used for `.home__virtual-grid` in `Home.css`
- [x] T018 [US2] Update `web/src/pages/Catalog.tsx`: replace `<div className="catalog__grid">{sorted.map(...)}</div>` with `<VirtualGrid items={sorted} itemHeight={160} renderItem={({rgd, instanceCount}) => <CatalogCard ... />} emptyState={<p className="catalog__empty">No RGDs match your filters.</p>} className="catalog__virtual-grid" />`; ensure the render prop unpacks the `{ rgd, instanceCount }` tuple correctly

**Checkpoint**: Catalog page debounces search correctly; filter fires once after
user pauses; `sorted.map()` is fully replaced with `VirtualGrid`.

---

## Phase 5: User Story 3 — Catalog Page Behaves Identically at Scale (Priority: P3)

**Goal**: Validate that the Catalog page meets the same DOM-bounded rendering
guarantee as the Home page and that the VirtualGrid recomputes correctly on
window resize.

**Independent Test**: Load Catalog with 5,000 RGDs; confirm DOM card count is
bounded; resize the browser window (narrower/wider); confirm the grid reflows
without blank rows or overflow and the visible window recalculates correctly.

- [x] T019 [US3] Verify `VirtualGrid` resize behaviour in `web/src/components/VirtualGrid.tsx`: confirm `ResizeObserver` fires on container width change, `cols` is recomputed, `scrollTop` is reset to 0, and no blank rows appear; add defensive `ResizeObserver` disconnect in the `useEffect` cleanup to prevent memory leaks
- [x] T020 [P] [US3] Add a `data-testid="virtual-grid-container"` attribute to the `VirtualGrid` outer div in `web/src/components/VirtualGrid.tsx` and a `data-testid="virtual-grid-items"` on the inner grid div — needed for E2E DOM count assertions
- [x] T021 [P] [US3] Add Playwright E2E test in `test/e2e/journeys/009-virtualization.spec.ts`: navigate to Home → assert `[data-testid="virtual-grid-items"] .rgd-card` count < 50 with a mock of 5,000 items; navigate to Catalog → assert same; type in search → assert filter fires once after pause

**Checkpoint**: All three user stories are independently functional. DOM count
is bounded on both pages. Resize reflows correctly. E2E journey covers both pages.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution amendment, accessibility, and final validation.

- [x] T022 Amend `constitution.md` §XIII Scale requirements: change `"100+ RGDs (search/filter required)"` to `"5,000+ RGDs (search/filter required, virtualized rendering)"` for the Home page and Catalog entries; bump version from `1.3.0` to `1.4.0`; update `Last Amended` date to 2026-03-22
- [x] T023 [P] Ensure `VirtualGrid` scrollable container has `role="list"` and each rendered card wrapper has `role="listitem"` in `web/src/components/VirtualGrid.tsx` for screen reader accessibility (constitution §IX / design system accessibility requirements)
- [x] T024 [P] Verify `Home.tsx` `document.title` is unchanged (`kro-ui`) and `Catalog.tsx` title is unchanged (`Catalog — kro-ui`) — no regressions from the refactor (constitution §XIII page title rule)
- [x] T025 [P] Run `cd web && bunx tsc --noEmit` from the worktree root and fix any TypeScript errors introduced by the refactor (generic `VirtualGrid<T>` inference, `renderItem` prop types, etc.)
- [x] T026 [P] Run `cd web && bun run test` and confirm all new and existing unit tests pass (`useDebounce`, `useVirtualGrid`, existing `catalog.test.ts`, `dag.test.ts`, etc.)
- [x] T027 Manually verify in browser with a 5,000-item mock: Home page loads in ≤ 2s, DOM card count stays bounded while scrolling, search debounces and results appear quickly, empty states render correctly; repeat for Catalog page

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001–T004 are all parallelizable
- **Foundational (Phase 2)**: Depends on Phase 1 completion — T005 depends on T001 (stub must exist); T007 depends on T002; T009 depends on T003+T004; **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Phase 2 (VirtualGrid + useDebounce ready)
- **US2 (Phase 4)**: Depends on Phase 2; independent of US1
- **US3 (Phase 5)**: Depends on Phase 3 + Phase 4 completion (validates both pages)
- **Polish (Phase 6)**: Depends on Phases 3–5 completion

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational phase. Fully independent.
- **US2 (P2)**: Depends only on Foundational phase. Fully independent of US1 (different page).
- **US3 (P3)**: Depends on US1 and US2 being complete (validates both pages together).

### Within Each User Story

- T011 before T012 (grid CSS must be removed before VirtualGrid replaces it)
- T012 before T013 (VirtualGrid render must exist before filter state is wired)
- T013 before T014 (search state must exist before SearchBar is connected)
- T016 before T017 before T018 (debounce, then CSS cleanup, then VirtualGrid render)

### Parallel Opportunities

- T001–T004 (all stubs): fully parallel
- T005 + T007 (hook implementations): parallel (different files)
- T006 + T008 (hook tests): parallel (different files)
- T011 + any Phase 4 CSS task: parallel (different CSS files)
- T020 + T021: parallel (different files, both US3)
- T022 + T023 + T024 + T025 + T026: fully parallel within Polish phase

---

## Parallel Example: Phase 2 (Foundational)

```
Parallel batch 1:
  Task: "Implement useDebounce in web/src/hooks/useDebounce.ts" (T005)
  Task: "Implement useVirtualGrid in web/src/hooks/useVirtualGrid.ts" (T007)

Parallel batch 2 (after batch 1):
  Task: "Write useDebounce tests in web/src/hooks/useDebounce.test.ts" (T006)
  Task: "Write useVirtualGrid tests in web/src/hooks/useVirtualGrid.test.ts" (T008)

Sequential:
  Task: "Implement VirtualGrid component in web/src/components/VirtualGrid.tsx" (T009)
  Task: "Add min-height to CatalogCard.css" (T010)
```

## Parallel Example: User Stories 1 & 2 (after Foundational)

```
# These two stories are on different pages — can run in parallel:
Developer A → Phase 3 (Home page, T011–T015)
Developer B → Phase 4 (Catalog debounce, T016–T018)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (stubs)
2. Complete Phase 2: Foundational (hooks + VirtualGrid — critical blocker)
3. Complete Phase 3: User Story 1 (Home page virtualization)
4. **STOP and VALIDATE**: Open browser with 5,000-item mock; confirm DOM bounded, search works, no jank
5. Merge as MVP if validated

### Incremental Delivery

1. Setup + Foundational → hooks and VirtualGrid ready for both pages
2. US1 (Phase 3) → Home page virtualized → validate independently
3. US2 (Phase 4) → Catalog debounced → validate independently
4. US3 (Phase 5) → E2E test + resize validation → confirms both pages
5. Polish (Phase 6) → constitution amendment, accessibility, TypeScript check

### Notes

- `[P]` tasks = different files, no in-flight dependencies
- `[Story]` label maps each task to its user story for traceability
- Each user story is independently completable and testable
- Commit after each logical group (e.g., after T005+T006 hooks, after T009 component)
- Do NOT hardcode hex values or `rgba()` in any new CSS — use `tokens.css` custom properties only (constitution §IX)
- Do NOT add any npm packages — `VirtualGrid` and both hooks are vanilla React + browser APIs (constitution §V)
