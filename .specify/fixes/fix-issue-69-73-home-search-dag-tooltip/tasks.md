# Fix: home page search/filter + DAG node tooltip on hover

**Issue(s)**: #69, #73
**Branch**: fix/issue-69-73-home-search-dag-tooltip
**Labels**: enhancement

## Root Cause

### #69 — Home page needs search/filter
The Home page renders all RGDs in a flat card grid with no filtering.
Constitution §XIII "Scale requirements" explicitly requires search/filter at 100+ RGDs.

### #73 — DAG node tooltip on hover
DAGGraph and LiveDAG have no `mouseenter` tooltip. Constitution §XIII "Tooltips on
complex elements" explicitly requires DAG nodes to show node ID, kind, type, and
any `includeWhen` CEL expression on hover.

## Files to change

- `web/src/pages/Home.tsx` — add search state, filter logic, SearchBar
- `web/src/pages/Home.css` — add toolbar row layout
- `web/src/components/DAGGraph.tsx` — add portal tooltip on mouseenter/mouseleave
- `web/src/components/DAGGraph.css` — add tooltip styles
- `web/src/components/LiveDAG.tsx` — add portal tooltip (with live state row)
- `web/src/components/LiveDAG.css` — tooltip styles (shared via DAGGraph.css)
- `web/src/pages/Home.test.tsx` — add search filter tests
- `web/src/components/DAGGraph.test.tsx` — add tooltip appearance tests

## Tasks

### Phase 1 — #69: Home page search

- [x] Add `query` state + filter logic to `Home.tsx` (filter by name and kind)
- [x] Add SearchBar component above the grid with `home__toolbar` wrapper in `Home.tsx`
- [x] Update `Home.css` with `.home__toolbar` row + `.home__count` styles
- [x] Add "no results" state distinct from empty cluster state

### Phase 2 — #73: DAG node tooltip

- [x] Create `DagTooltip` portal component in `DAGGraph.tsx` (absolute positioned,
      attached to `document.body`, no SVG clipping issues)
- [x] Add `mouseenter`/`mouseleave` handlers to `NodeGroup` in `DAGGraph.tsx`;
      pass tooltip state up via callback
- [x] Render tooltip with: node ID, kind, node type badge, `includeWhen` CEL (highlighted)
- [x] Add same portal tooltip to `LiveDAG.tsx` with extra live state row
      (state label + last-transition-time when available)
- [x] Add tooltip CSS to `DAGGraph.css` (shared; `LiveDAG.css` picks it up)

### Phase 3 — Tests

- [x] Add Home.test.tsx cases: search filters by name, search filters by kind,
      "no results" empty state shown
- [x] Add DAGGraph.test.tsx case: hovering a node shows tooltip with node ID and kind
- [x] Run existing test suite to verify no regression

### Phase 4 — Verify

    - [x] Run `bun run --cwd web tsc --noEmit`
    - [x] Run `bun run --cwd web vitest run`

### Phase 5 — PR

- [ ] Commit: `feat(web): home search filter + DAG node hover tooltip — closes #69, closes #73`
- [ ] Push branch: `git push -u origin fix/issue-69-73-home-search-dag-tooltip`
- [ ] Open PR
