# Tasks: RGD List — Home Page

**Input**: Design documents from `/specs/002-rgd-list-home/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests are required before merge (spec.md "Testing Requirements").

**Organization**: Tasks are grouped by user story. US3 (context display) is a
foundational prerequisite because Layout + `<Outlet />` must work before any
child route renders.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Testing Infrastructure)

**Purpose**: Add Vitest + React Testing Library. No existing test infra exists.

- [x] T001 Install test devDependencies: vitest, @testing-library/react, @testing-library/dom, @testing-library/jest-dom, @testing-library/user-event, jsdom in web/package.json
- [x] T002 Add vitest test configuration (globals, jsdom, setupFiles, css:false) to web/vite.config.ts
- [x] T003 Create test setup file with jest-dom matchers in web/src/test/setup.ts
- [x] T004 Add "types": ["vitest/globals"] to web/tsconfig.json compilerOptions
- [x] T005 Add "test" and "test:watch" scripts to web/package.json
- [x] T006 Verify test infrastructure works by running `bun run test` (should find 0 tests, exit clean)

---

## Phase 2: Foundational (Utility Library + Layout)

**Purpose**: Core utilities and Layout shell that ALL user stories depend on.
Layout must render `<Outlet />` for any child route to work. Utility functions
are needed by RGDCard (US1) and are pure/testable independently.

**CRITICAL**: No user story work can begin until this phase is complete.

### Utility functions

- [x] T007 [P] Implement formatAge function in web/src/lib/format.ts (ISO 8601 → kubectl-style age string)
- [x] T008 [P] Implement extractReadyStatus, readyStateColor, readyStateLabel functions in web/src/lib/format.ts
- [x] T009 [P] Implement extractRGDName, extractRGDKind, extractResourceCount, extractCreationTimestamp helpers in web/src/lib/format.ts
- [x] T010 [P] Write unit tests for formatAge (7 test cases with vi.useFakeTimers) in web/src/lib/format.test.ts
- [x] T011 [P] Write unit tests for extractReadyStatus (9 test cases) in web/src/lib/format.test.ts
- [x] T012 [P] Write unit tests for extractRGDName, extractRGDKind, extractResourceCount, readyStateColor, readyStateLabel in web/src/lib/format.test.ts

### Layout and TopBar (serves US3 but is a prerequisite for all routes)

- [x] T013 [P] Create TopBar.css with top-bar styles (brand, context display, truncation) in web/src/components/TopBar.css
- [x] T014 [P] Implement TopBar component (logo, title, context name with 40-char truncation and title tooltip) in web/src/components/TopBar.tsx
- [x] T015 Create Layout.css with layout styles (full-height flex column, content area) in web/src/components/Layout.css
- [x] T016 Rewrite Layout component (fetch context via listContexts, render TopBar + Outlet) in web/src/components/Layout.tsx
- [x] T017 [P] Write unit tests for TopBar (4 test cases: context name, truncation, no-truncation, branding) in web/src/components/TopBar.test.tsx
- [x] T018 Write unit tests for Layout (3 test cases: outlet rendering, context name, fetch failure) in web/src/components/Layout.test.tsx
- [x] T019 Verify Layout renders child routes by running the dev server and confirming Home stub is visible

**Checkpoint**: Layout + TopBar working, `<Outlet />` renders child routes, format.ts tested

---

## Phase 3: User Story 1 — Operator sees all RGDs as cards (Priority: P1) MVP

**Goal**: Home page fetches `GET /api/v1/rgds` and renders one card per RGD
with name, kind, resource count, age, and status dot. Includes skeleton
loading, error, and empty states.

**Independent Test**: With a running server and >=1 RGD, open the browser
and confirm cards are visible with correct name, kind, and status.

### Leaf components (no dependencies on each other)

- [x] T020 [P] [US1] Create StatusDot.css with status-dot styles (base circle, ready/error/unknown modifiers) in web/src/components/StatusDot.css
- [x] T021 [P] [US1] Implement StatusDot component (colored circle, aria-label, title tooltip) in web/src/components/StatusDot.tsx
- [x] T022 [P] [US1] Create SkeletonCard.css with skeleton-card styles and shimmer animation in web/src/components/SkeletonCard.css
- [x] T023 [P] [US1] Implement SkeletonCard component (placeholder bars matching RGDCard dimensions, aria-hidden) in web/src/components/SkeletonCard.tsx

### RGDCard (depends on StatusDot + format.ts)

- [x] T024 [US1] Create RGDCard.css with card styles (surface bg, border, header, meta, kind badge, actions) in web/src/components/RGDCard.css
- [x] T025 [US1] Implement RGDCard component (extract fields via format.ts, render card with StatusDot, Graph/Instances Links) in web/src/components/RGDCard.tsx

### Home page (depends on RGDCard + SkeletonCard)

- [x] T026 [US1] Create Home.css with home page styles (grid layout, error/empty states, retry button) in web/src/pages/Home.css
- [x] T027 [US1] Implement Home page (fetch listRGDs on mount, loading/error/empty/success states, retry) in web/src/pages/Home.tsx

### Unit tests for US1

- [x] T028 [P] [US1] Write unit tests for StatusDot (6 test cases: 3 state classes, tooltip with reason, tooltip without reason, aria-label) in web/src/components/StatusDot.test.tsx
- [x] T029 [P] [US1] Write unit tests for SkeletonCard (2 test cases: aria-hidden, placeholder elements) in web/src/components/SkeletonCard.test.tsx
- [x] T030 [US1] Write unit tests for RGDCard (9 test cases: name, kind, missing kind, count, age, graph link, instances link, URL encoding, status dot) in web/src/components/RGDCard.test.tsx
- [x] T031 [US1] Write unit tests for Home (6 test cases: skeleton loading, card rendering, empty state, error state, retry, card names) in web/src/pages/Home.test.tsx

**Checkpoint**: Home page renders cards with all data, skeleton/error/empty states work, all US1 tests pass

---

## Phase 4: User Story 2 — Card navigation to Graph/Instances (Priority: P1)

**Goal**: "Graph" and "Instances" links on each card navigate via React Router
without full page reload. Browser Back preserves scroll position.

**Independent Test**: Click "Graph" on a card -> URL is `/rgds/:name`. Click
"Instances" -> URL is `/rgds/:name?tab=instances`. Press Back -> home at same
scroll position.

**Note**: The `<Link>` elements are already rendered by RGDCard (T025). This
phase validates the routing integration and adds the E2E journey test.

- [x] T032 [US2] Verify client-side navigation works: Graph link navigates to /rgds/:name without reload, Instances link navigates to /rgds/:name?tab=instances
- [x] T033 [US2] Verify browser Back button returns to home page with cards still visible (React Router scroll restoration)
- [x] T034 [US2] Write E2E journey test (4 steps: open dashboard, verify card, navigate Graph, back + navigate Instances) in test/e2e/journeys/002-home-page.spec.ts

**Checkpoint**: Navigation works end-to-end, E2E journey defined

---

## Phase 5: User Story 3 — Active cluster context visible (Priority: P2)

**Goal**: Top bar shows the active kubeconfig context name on every page. Long
names are truncated with a tooltip showing the full name.

**Independent Test**: Top bar shows the string matching `kubectl config
current-context` for the connected server context.

**Note**: Layout and TopBar were implemented in Phase 2 (foundational). This
phase validates the context display end-to-end and ensures truncation behavior.

- [x] T035 [US3] Verify context name displays correctly in top bar with a running server connected to a real cluster
- [x] T036 [US3] Verify long context names (>40 chars) are truncated with ellipsis and full name in title tooltip

**Checkpoint**: Context name visible on all pages, truncation works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript strictness, keyboard accessibility, final validation

- [x] T037 Run TypeScript strict mode check (tsc --noEmit) and fix any errors in web/src/
- [x] T038 Verify keyboard navigation: Tab reaches card buttons, Enter activates links in web/src/components/RGDCard.tsx
- [x] T039 Run full unit test suite (bun run test) and verify all tests pass
- [x] T040 Verify Vite build succeeds (bun run build) with no warnings in web/
- [x] T041 Add test-web and test-web-watch targets to Makefile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (test infra needed for T010-T012, T017-T018)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (Layout for routing, format.ts for data extraction)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (cards must exist to test navigation)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (Layout/TopBar already implemented)
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 completion (format.ts + Layout). Core MVP.
- **US2 (P1)**: Depends on US1 (cards must render for navigation to work). Validation + E2E.
- **US3 (P2)**: Foundational implementation done in Phase 2. Phase 5 is validation only.

### Within User Story 1

- StatusDot + SkeletonCard: parallel (no dependencies on each other)
- RGDCard: depends on StatusDot + format.ts
- Home: depends on RGDCard + SkeletonCard
- Tests: can run after implementation of each component

### Parallel Opportunities

```
Phase 2 (after T006):
  T007 ─┐
  T008 ─┤ (all format.ts functions)
  T009 ─┤
  T010 ─┤ (all format.ts tests)
  T011 ─┤
  T012 ─┘
  T013 ─┐ (TopBar CSS + component)
  T014 ─┘

Phase 3 (after Phase 2):
  T020 + T021 ─┐ (StatusDot)
  T022 + T023 ─┘ (SkeletonCard)   ← these two groups are parallel
  Then: T024 + T025 (RGDCard, depends on StatusDot)
  Then: T026 + T027 (Home, depends on RGDCard + SkeletonCard)
  T028 + T029 (StatusDot/Skeleton tests) ← parallel after their components
```

---

## Parallel Example: Phase 2 Utilities

```bash
# Launch all format.ts implementation tasks together:
Task: "Implement formatAge in web/src/lib/format.ts"
Task: "Implement extractReadyStatus in web/src/lib/format.ts"
Task: "Implement extraction helpers in web/src/lib/format.ts"

# Launch all format.ts test tasks together:
Task: "Write formatAge tests in web/src/lib/format.test.ts"
Task: "Write extractReadyStatus tests in web/src/lib/format.test.ts"
Task: "Write extraction helper tests in web/src/lib/format.test.ts"

# Launch TopBar tasks in parallel with format.ts:
Task: "Create TopBar.css in web/src/components/TopBar.css"
Task: "Implement TopBar component in web/src/components/TopBar.tsx"
```

## Parallel Example: Phase 3 Leaf Components

```bash
# Launch StatusDot and SkeletonCard in parallel:
Task: "Create StatusDot.css + implement StatusDot.tsx"
Task: "Create SkeletonCard.css + implement SkeletonCard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (test infra)
2. Complete Phase 2: Foundational (format.ts + Layout + TopBar)
3. Complete Phase 3: User Story 1 (cards + states + tests)
4. **STOP and VALIDATE**: Run `bun run test` and `tsc --noEmit`
5. Cards render, all states work, tests pass → MVP complete

### Incremental Delivery

1. Setup + Foundational → Test infra + Layout working
2. Add US1 → Cards render with all states → Test independently (MVP)
3. Add US2 → Navigation works → E2E journey defined
4. Add US3 validation → Context name verified end-to-end
5. Polish → TypeScript strict, keyboard nav, build verification

### Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- format.ts tasks (T007-T009) are marked [P] because they go in the same file
  but can be written as independent functions in a single pass
- Tests are interleaved with implementation per the spec requirement
- Phase 5 (US3) is validation-only because Layout/TopBar are foundational
