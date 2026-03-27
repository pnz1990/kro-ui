# Feature Specification: RGD List Virtualization

**Feature Branch**: `024-rgd-list-virtualization`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "RGD list virtualization for large clusters — replace the flat card grid on the home page and catalog with a virtualized rendering strategy (windowed list or paginated grid) that handles 5,000+ RGDs without DOM bloat; the search/filter input must debounce and the visible window must render within 100ms of input; update the constitution scale requirement from 100+ to 5k+"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse Large RGD Inventory Without Lag (Priority: P1)

A platform engineer connects kro-ui to a production cluster that has 5,000+
ResourceGraphDefinitions deployed. They open the home page expecting to see the
RGD grid. The page loads quickly; only the RGDs currently visible on screen are
rendered — the rest are not in the DOM. Scrolling through the grid feels smooth
and responsive with no browser freezes or jank.

**Why this priority**: This is the core safety requirement. A user on a large
cluster today gets an unresponsive or crashed browser tab. Without fixing the
rendering strategy everything else is moot.

**Independent Test**: Can be validated end-to-end by pointing kro-ui at a
cluster (or mock endpoint) returning 5,000 RGDs and confirming the home page
loads and is interactive within the render budget, with fewer than 100 DOM
nodes representing RGD cards at any time.

**Acceptance Scenarios**:

1. **Given** a cluster with 5,000 RGDs, **When** the home page loads, **Then**
   the page becomes interactive in ≤ 2 seconds and fewer than 100 RGD card
   elements exist in the DOM simultaneously.
2. **Given** the home page is showing a large RGD list, **When** the user scrolls
   to the bottom of the visible area, **Then** newly visible cards appear within
   100ms and previously off-screen cards are removed from the DOM (or remain
   virtualized), keeping the DOM node count bounded.
3. **Given** the home page is displaying 5,000 RGDs, **When** the user scrolls
   rapidly through the list, **Then** no browser freeze or unresponsive tab
   warning occurs.

---

### User Story 2 — Instant Filtered Results While Typing (Priority: P2)

A platform engineer wants to find a specific RGD by name or kind among thousands.
They focus the search/filter input and start typing. The visible list updates to
reflect only matching RGDs. The update feels instant — there is no perceptible
delay while the user is actively typing, and the final filtered results appear
quickly after the user pauses.

**Why this priority**: Without debouncing, rapid keystrokes on 5,000+ items
would block the main thread on every keystroke. This directly impacts usability
on the primary use case for the filter input.

**Independent Test**: Can be tested independently by loading 5,000 RGD items
and typing into the search box while measuring time-to-result after each
keystroke pause.

**Acceptance Scenarios**:

1. **Given** the home page search input with 5,000 RGDs loaded, **When** the
   user types a search term character by character, **Then** the filter operation
   does not execute on every individual keystroke — it fires after the user pauses
   typing.
2. **Given** the user has paused typing for the debounce interval, **When** the
   debounce fires, **Then** the visible RGD list updates to show only matching
   results within 100ms.
3. **Given** the user clears the search input, **When** the input is emptied,
   **Then** the full RGD list is restored within 100ms.
4. **Given** a search term that matches zero RGDs, **When** the debounce fires,
   **Then** an explicit "No RGDs match your search" empty state is shown — not a
   blank area.

---

### User Story 3 — Catalog Page Behaves Identically at Scale (Priority: P3)

A platform engineer uses the Catalog page to browse and discover RGDs across the
cluster. The same virtualization and debounced search behavior that applies to the
home page also applies to the catalog grid, so browsing thousands of RGDs in the
catalog is equally smooth.

**Why this priority**: The catalog is a secondary surface sharing the same card
rendering pattern. Correctness of the home page (P1, P2) is a prerequisite before
the catalog benefit is meaningful.

**Independent Test**: Can be validated independently by navigating to the Catalog
route with a large dataset and repeating the same scroll and search tests as P1
and P2.

**Acceptance Scenarios**:

1. **Given** 5,000 RGDs in the cluster, **When** the user opens the Catalog page,
   **Then** the page is interactive in ≤ 2 seconds and the DOM card count is
   bounded identically to the home page.
2. **Given** the Catalog search/filter input, **When** the user types a query,
   **Then** debounce behavior is identical to the home page — filter fires after
   the user pauses, not on every keystroke, and results appear within 100ms of
   the debounce firing.

---

### Edge Cases

- What happens when the cluster returns 0 RGDs? The empty state message must
  render correctly with no virtualization artifacts.
- What happens when the cluster returns exactly 1 RGD? Single-item list must
  render without layout errors.
- What happens when the RGD list is loading (API call in flight)? The virtualized
  container must show a loading skeleton or spinner — not a blank area that
  confuses the user about whether virtualization swallowed the data.
- What happens when the user resizes the browser window while the list is
  displayed? The visible window and card sizes must recompute correctly with no
  blank rows or overflow.
- What happens when a search term contains special characters (e.g., `/`, `<`,
  `&`)? The filter must treat the input as plain text, not as a pattern, and must
  not cause errors or XSS.
- What happens when the user navigates away mid-scroll and returns via the browser
  back button? Scroll position restores to the top (standard navigation behavior).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page RGD grid MUST render using a virtualized (windowed)
  strategy — only the cards currently visible in the viewport, plus a small
  overscan buffer, are present in the DOM at any time.
- **FR-002**: The catalog page RGD grid MUST use the same virtualized rendering
  strategy as the home page (FR-001).
- **FR-003**: The total number of RGD card DOM elements present at any time MUST
  NOT exceed approximately twice the number of simultaneously visible cards
  (overscan buffer included), regardless of total RGD count.
- **FR-004**: The search/filter input on both the home page and catalog MUST
  debounce user keystrokes — the filter operation MUST NOT execute on every
  individual keystroke.
- **FR-005**: After the debounce interval elapses, the visible list MUST update
  to reflect the filtered results within 100ms.
- **FR-006**: Clearing the search input MUST restore the full list within 100ms.
- **FR-007**: When the filtered list is empty, the system MUST display a distinct,
  readable "no results" message — not a blank container.
- **FR-008**: When the RGD list is loading, the virtualized container MUST show
  a loading indicator (skeleton cards or spinner) rather than an empty viewport.
- **FR-009**: The virtualized grid MUST recompute the visible window correctly
  when the browser window is resized.
- **FR-010**: The constitution document §XIII scale requirement for the home page
  and catalog MUST be updated from "100+ RGDs" to "5,000+ RGDs".
- **FR-011**: Existing search/filter UI controls (text input fields, namespace
  selectors) MUST remain as visible, interactive input elements and MUST NOT
  regress to URL-params-only behavior during this refactor.

### Key Entities

- **RGD Card**: A self-contained visual unit representing one
  ResourceGraphDefinition displayed in a grid. Its dimensions are uniform to
  enable efficient virtual layout calculation.
- **Visible Window**: The subset of RGD cards actively rendered in the DOM at any
  point in time, corresponding to the scrolled viewport plus an overscan buffer
  above and below.
- **Filter State**: The current search query and any active namespace/kind filters,
  applied client-side against the full in-memory RGD list after the debounce
  interval fires.
- **Debounce Interval**: The delay between the last keystroke and the filter
  operation executing. A value of 150–300ms is assumed as default; exact value is
  an implementation detail subject to perceived-responsiveness testing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With 5,000 RGDs loaded, the home page becomes interactive within
  2 seconds of the API response completing.
- **SC-002**: At any scroll position with 5,000 RGDs loaded, the number of RGD
  card elements in the DOM does not exceed approximately twice the number of
  simultaneously visible cards (overscan buffer included).
- **SC-003**: After the search debounce fires, the filtered results are fully
  visible in the viewport within 100ms.
- **SC-004**: Rapid scrolling through a 5,000-item list does not cause a browser
  "Page Unresponsive" warning or frame drops that make the page visibly janky
  on a modern laptop.
- **SC-005**: The catalog page meets SC-001 through SC-004 identically to the
  home page.
- **SC-006**: The merged spec and constitution both reference 5,000+ RGDs as the
  scale requirement for the home page and catalog.
- **SC-007**: An empty search result state is always a distinct, readable message —
  never a blank container or a zero-height element.

## Assumptions

- Card dimensions (width and height) are uniform across all RGD cards in the grid.
  This is required for efficient virtual layout without measuring every item.
- The RGD list is fetched once and held in memory client-side for the page session.
  Filtering is purely client-side — no new API calls are made per search query.
- The existing polling interval for the RGD list is preserved unchanged.
- The debounce implementation is a pure custom hook with no external library,
  consistent with the project's simplicity-over-cleverness principle.
- Virtual scroll is the preferred strategy over server-side pagination, as it
  better matches the instant-filter requirement (no round-trips per query).
  Paginated grid is a fallback if virtual scroll proves impractical with the
  card grid layout.
- This spec does not change the card visual design — only the rendering strategy.
  All existing card content, click behavior, and navigation remain unchanged.
