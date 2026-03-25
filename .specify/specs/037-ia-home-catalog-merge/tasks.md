# Tasks: 037 — IA: Home & Catalog Differentiation

**Input**: Design documents from `.specify/specs/037-ia-home-catalog-merge/`
**Branch**: `037-ia-home-catalog-merge`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Web application layout:
- Frontend source: `web/src/`
- E2E tests: `test/e2e/journeys/`

---

## Phase 1: Setup

**Purpose**: Confirm the working tree is clean and all context is loaded before edits begin.

- [x] T001 Read `web/src/pages/Home.tsx` in full to confirm current heading, tagline, and `usePageTitle` arg before editing
- [x] T002 [P] Read `web/src/components/TopBar.tsx` in full to locate the "Home" nav link before editing
- [x] T003 [P] Read `web/src/pages/Catalog.tsx` in full to locate the `<h1>` insertion point for the subtitle
- [x] T004 [P] Read `web/src/pages/Catalog.css` in full to determine where to add `.catalog__subtitle`

**Checkpoint**: All four files are loaded and insertion points are confirmed — editing can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blockers exist for this spec. All changes are in separate files with no inter-dependency. Proceed directly to user story phases.

*(No tasks — Phase 1 unblocks all user stories immediately.)*

---

## Phase 3: User Story 1 — Home page renamed to "Overview" (Priority: P1) 🎯 MVP

**Goal**: The Home page (`/`) presents itself as an operational "Overview" dashboard with a clear heading, updated page title, and a meaningful subtitle. The TopBar nav link reads "Overview".

**Independent Test**:
1. Start the dev server (`bun run dev`)
2. Open `http://localhost:5173` — page `<h1>` reads "Overview"
3. Browser tab title reads "Overview — kro-ui"
4. Subtitle text "Controller and RGD health at a glance" is visible below the heading
5. TopBar nav link for `/` reads "Overview" (not "Home")
6. MetricsStrip, RGD cards, HealthChip, and terminating badges still render

### Implementation for User Story 1

- [x] T005 [US1] In `web/src/pages/Home.tsx`: change `usePageTitle('RGDs')` to `usePageTitle('Overview')`, change `<h1 className="home__heading">RGDs</h1>` to `<h1 className="home__heading">Overview</h1>`, and change `.home__tagline` text from `"ResourceGraphDefinitions — kro observability dashboard"` to `"Controller and RGD health at a glance"`
- [x] T006 [P] [US1] In `web/src/components/TopBar.tsx`: change the NavLink child text for `to="/"` from `Home` to `Overview`

**Checkpoint**: User Story 1 is complete when `<h1>` reads "Overview", page title is "Overview — kro-ui", subtitle reads "Controller and RGD health at a glance", and TopBar reads "Overview". MetricsStrip and all RGDCard features remain intact.

---

## Phase 4: User Story 2 — Catalog subtitle added (Priority: P2)

**Goal**: The Catalog page (`/catalog`) gains a descriptive subtitle below its `<h1>` heading, making its browsing/discovery purpose explicit and matching the subtitle treatment applied to the Overview page.

**Independent Test**:
1. Open `http://localhost:5173/catalog`
2. Below the "RGD Catalog" heading, the text "Browse, filter, and discover all ResourceGraphDefinitions" is visible
3. The subtitle is rendered as a `<p>` element (not a `<div>`)
4. The subtitle uses `var(--color-text-muted)` — no hardcoded color values
5. All existing Catalog features (sort, label filter, instance counts, "Used by") still work

### Implementation for User Story 2

- [x] T007 [US2] In `web/src/pages/Catalog.tsx`: add `<p className="catalog__subtitle">Browse, filter, and discover all ResourceGraphDefinitions</p>` immediately after `<h1 className="catalog__heading">RGD Catalog</h1>` inside the `.catalog__title-row` div
- [x] T008 [P] [US2] In `web/src/pages/Catalog.css`: add the `.catalog__subtitle` rule — `margin: 0; font-size: 0.875rem; color: var(--color-text-muted);` — using only CSS token references, no hardcoded values

**Checkpoint**: User Story 2 is complete when the Catalog subtitle is visible at `/catalog`, is a `<p>` element, and passes `bun run typecheck`.

---

## Phase 5: User Story 3 — E2E journey comments updated (Priority: P3)

**Goal**: The E2E journey file for the Home page has its descriptive comments updated to reflect the "Overview" rename. No assertion strings change (the existing `toHaveTitle(/kro-ui/)` already matches "Overview — kro-ui"). The Catalog E2E file requires no changes.

**Independent Test**:
1. Run `bun run typecheck` — passes
2. Inspect `test/e2e/journeys/002-home-page.spec.ts` — journey description reads "Overview" not "Home page RGD Card Grid"
3. All existing assertions are functionally unchanged

### Implementation for User Story 3

- [x] T009 [US3] In `test/e2e/journeys/002-home-page.spec.ts`: update the file header comment from `Journey 002: Home Page — RGD Card Grid and Navigation` to `Journey 002: Overview Page — RGD Card Grid and Navigation`; update `test.describe` description from `'Journey 002 — Home page RGD cards and navigation'` to `'Journey 002 — Overview page RGD cards and navigation'`; update `test('Step 5: Home page shows cards for all fixture RGDs'` to `test('Step 5: Overview page shows cards for all fixture RGDs'`

**Checkpoint**: User Story 3 is complete when journey description strings use "Overview" and no functional assertions are broken. `015-rgd-catalog.spec.ts` is confirmed unchanged (it navigates directly to `/catalog` and contains no "Home" nav assertions).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, type-checking, and final sanity checks across all changes.

- [x] T010 [P] Run `bun run typecheck` and confirm zero TypeScript errors
- [x] T011 [P] Run `GOPROXY=direct GONOSUMDB="*" go vet ./...` and confirm no new warnings (no Go changes, verify parity)
- [x] T012 [P] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./...` and confirm all Go tests pass
- [x] T013 Visually verify in dev server (`bun run dev`) that: (1) Overview page renders with correct heading/subtitle/MetricsStrip/RGDCards; (2) TopBar shows "Overview" nav link; (3) Catalog page renders with subtitle below "RGD Catalog"; (4) no CSS regressions (tokens only, no inline colors introduced)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — read files immediately
- **Phase 3 (US1)**: Depends on T001 (Home.tsx read) and T002 (TopBar.tsx read) from Phase 1
- **Phase 4 (US2)**: Depends on T003 (Catalog.tsx read) and T004 (Catalog.css read) from Phase 1
- **Phase 5 (US3)**: Depends on Phase 1 only (no code dependency on US1/US2)
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5 all complete

### User Story Dependencies

- **US1 (P1)**: Independent — starts after Phase 1 reads T001+T002
- **US2 (P2)**: Independent — starts after Phase 1 reads T003+T004; can run in parallel with US1
- **US3 (P3)**: Independent — comment-only; can run in parallel with US1+US2

### Within Each User Story

- US1: T005 and T006 touch different files — can run in parallel
- US2: T007 and T008 touch different files — can run in parallel
- US3: T009 is a single task

### Parallel Opportunities

Once Phase 1 reads are done (T001–T004), all of T005, T006, T007, T008, T009 can proceed in parallel (they all touch distinct files with no mutual dependencies).

---

## Parallel Example

```bash
# After Phase 1 reads complete, launch all implementation tasks together:
Task: T005 — Edit Home.tsx (heading, tagline, usePageTitle)
Task: T006 — Edit TopBar.tsx (nav link label)
Task: T007 — Edit Catalog.tsx (subtitle <p>)
Task: T008 — Edit Catalog.css (.catalog__subtitle rule)
Task: T009 — Edit 002-home-page.spec.ts (comment updates)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Read Home.tsx + TopBar.tsx (T001, T002)
2. Complete Phase 3: US1 — edit Home.tsx and TopBar.tsx (T005, T006)
3. **STOP and VALIDATE**: dev server visual check — "Overview" heading, subtitle, TopBar nav label
4. Optionally deploy/demo before adding Catalog subtitle

### Incremental Delivery

1. Phase 1 reads → all files understood
2. US1 (T005, T006) → Overview page differentiated → validate → MVP done
3. US2 (T007, T008) → Catalog subtitle added → validate
4. US3 (T009) → Journey comments updated → polish complete
5. Phase 6 → typecheck + go vet + go test-race → CI-ready

---

## Notes

- [P] tasks touch different files — safe to execute in parallel
- Total tasks: 13 (4 setup reads + 5 implementation + 1 E2E comment + 3 polish verifications)
- No new components, no new dependencies, no routing changes
- CSS changes: 1 new rule in `Catalog.css` using `var(--color-text-muted)` only
- E2E assertion changes: 0 — existing `toHaveTitle(/kro-ui/)` already matches "Overview — kro-ui"
- Rollback: trivially revert 5 source files
