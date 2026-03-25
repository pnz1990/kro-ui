# Tasks: RGD Authoring Global Entrypoint (039)

**Branch**: `039-rgd-authoring-entrypoint`
**Input**: `.specify/specs/039-rgd-authoring-entrypoint/`
**Stack**: TypeScript 5.x / React 19 / React Router v7 / Vite
**No new dependencies** — reuses `RGDAuthoringForm`, `YAMLPreview`, `generator.ts`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: User story this task belongs to
- No test tasks — spec does not request TDD; E2E journeys are implementation tasks (Step 7)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extract the shared constant that both the new page and existing component need.
This phase is a **blocking prerequisite** — both `AuthorPage` (US1) and the
`GenerateTab` import update (US4 regression guard) depend on this being done first.

- [x] T001 Export `STARTER_RGD_STATE` from `web/src/lib/generator.ts` (add `export` keyword; move constant from `GenerateTab.tsx` to end of generator.ts, after the existing type exports)
- [x] T002 Update `web/src/components/GenerateTab.tsx` to import `STARTER_RGD_STATE` from `@/lib/generator` instead of declaring it locally (remove local `const STARTER_RGD_STATE`)

**Checkpoint**: `bun run typecheck` passes — `GenerateTab` compiles with the imported constant.

---

## Phase 2: User Story 1 — Standalone `/author` route (Priority: P1) 🎯 MVP

**Goal**: A dedicated `/author` route that renders the RGD authoring form immediately,
accessible to any user without needing an existing RGD to navigate through.

**Independent Test**: Navigate to `http://localhost:5173/author` (dev server). Confirm:
- Page title tab reads "New RGD — kro-ui"
- `RGDAuthoringForm` renders with starter state (kind=MyApp, one Deployment)
- `YAMLPreview` panel shows live RGD YAML
- Editing the Kind field updates the YAML preview immediately
- Copy YAML button works

### Implementation for User Story 1

- [x] T003 [US1] Create `web/src/pages/AuthorPage.tsx` — page component that owns `RGDAuthoringState`, calls `usePageTitle('New RGD')`, renders `RGDAuthoringForm` + `YAMLPreview` side-by-side (mirrors GenerateTab "rgd" mode layout; imports `STARTER_RGD_STATE` from `@/lib/generator`)
- [x] T004 [US1] Create `web/src/pages/AuthorPage.css` — two-column layout (`author-page__body` flex row: `author-page__form-pane` + `author-page__preview-pane`); header section for title + subtitle; all values via `tokens.css` custom properties only (no hex, no rgba)
- [x] T005 [US1] Register `/author` route in `web/src/main.tsx` — add `import AuthorPage` and `<Route path="/author" element={<AuthorPage />} />` before the `path="*"` catch-all

**Checkpoint**: `http://localhost:5173/author` renders form and YAML preview. `bun run typecheck` passes.

---

## Phase 3: User Story 2 — Top bar global entrypoint (Priority: P1)

**Goal**: A "+ New RGD" button in the top bar, visible on every page, that links
directly to `/author` without requiring the user to visit any existing RGD first.

**Independent Test**: On any page (Home, Catalog, Fleet, Events, RGD detail),
the top bar shows `+ New RGD`. Clicking it navigates to `/author`.
The button is keyboard-focusable and has a visible focus ring.

### Implementation for User Story 2

- [x] T006 [US2] Edit `web/src/components/TopBar.tsx` — add `import { Link }` from react-router-dom (alongside existing `NavLink`); add `<Link to="/author" className="top-bar__new-rgd-btn" data-testid="topbar-new-rgd">+ New RGD</Link>` between the closing `</nav>` and the `<ContextSwitcher>` element
- [x] T007 [US2] Edit `web/src/components/TopBar.css` — add `.top-bar__new-rgd-btn` rule: primary blue background (`var(--color-primary)`), light text (`var(--color-bg)`), `var(--radius-sm)` border-radius, `var(--transition)` for hover opacity, `var(--color-border-focus)` focus-visible outline, `var(--font-sans)` font; no hardcoded hex/rgba

**Checkpoint**: Top bar shows `+ New RGD` on all pages. Clicking navigates to `/author`. `bun run typecheck` passes.

---

## Phase 4: User Story 3 — Empty-state entrypoints (Priority: P1)

**Goal**: When there are no RGDs in the cluster, both the Home and Catalog empty
states offer a direct path to `/author`, surfacing the authoring tool to first-time users.

**Independent Test**:
- Home: type a search string that matches nothing → the "no match" empty state shows but does NOT have a "New RGD" link (correct). Clear the search — if items.length is 0 the onboarding state should show "New RGD". (In CI, use the search-filter path to verify the link only appears in the right variant.)
- Catalog: open Catalog when items.length === 0 (or simulate via mock) → "New RGD" link appears.

### Implementation for User Story 3

- [x] T008 [P] [US3] Edit `web/src/pages/Home.tsx` — add `import { Link } from 'react-router-dom'`; in the `home__empty--onboarding` block (the `items.length === 0 && debouncedQuery === ''` path) add `<Link to="/author" className="home__empty-cta" data-testid="home-new-rgd-link">New RGD</Link>` as a third action inside `.home__empty-actions`; the "no match" variant (debouncedQuery non-empty) must NOT get this link
- [x] T009 [P] [US3] Edit `web/src/pages/Catalog.tsx` — add `import { Link } from 'react-router-dom'`; in the zero-items branch of the empty state (`items.length === 0`) update the hint paragraph to: `Create one with <code>kubectl apply -f your-rgd.yaml</code> or use the <Link to="/author" data-testid="catalog-new-rgd-link">in-app authoring tool</Link>.`

**Checkpoint**: `bun run typecheck` passes. Visually verify the Home onboarding empty state (trigger via search filter) shows "New RGD" link. The Catalog zero-items state also links to `/author`.

---

## Phase 5: User Story 4 — Regression guard (Priority: P1)

**Goal**: Verify the per-RGD Generate tab's "New RGD" mode button still works as
a within-tab mode switch (no navigation to `/author`). This is a zero-code-change
verification step — the GenerateTab was only modified in T002 (import update).

**Independent Test**: Navigate to `/rgds/test-app?tab=generate`. Click "New RGD"
mode button. Confirm `RGDAuthoringForm` renders inside the Generate tab (not a
page navigation). The URL does not change to `/author`.

### Implementation for User Story 4

- [x] T010 [US4] Verify `web/src/components/GenerateTab.tsx` — confirm the "New RGD" mode button (`mode-btn-rgd`) still calls `setMode('rgd')` and does not use `<Link>` or `navigate()`; the T002 import update must not change any mode-switching logic (read-only verification + `bun run typecheck`)

**Checkpoint**: `bun run typecheck` passes with no regressions in GenerateTab.

---

## Phase 6: E2E Journey

**Goal**: Add a Playwright journey that gates the four acceptance scenarios in CI.

**Independent Test**: `make test-e2e` with `SKIP_KIND_DELETE=true` — all four
steps pass against the kind cluster.

### Implementation

- [x] T011 Create `test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts` with Apache 2.0 header and four steps:
  - **Step 1**: `page.goto(BASE)` → `expect(page.getByTestId('topbar-new-rgd')).toBeVisible()`
  - **Step 2**: click `topbar-new-rgd` → expect URL to be `/author`; expect `[data-testid="rgd-authoring-form"]` to be visible
  - **Step 3**: `page.goto(BASE)` → fill search with `__no_match_xyzzy__` → wait 400ms → expect `home__empty` is visible but `home-new-rgd-link` is NOT visible (no-match variant); then clear search → if items.length === 0 the link appears (cluster-safe: test the link's absence in the filter-mismatch path to avoid cluster-dependency flakiness)
  - **Step 4**: `page.goto(`${BASE}/rgds/test-app?tab=generate`)` → click `mode-btn-rgd` → expect `rgd-authoring-form` visible AND URL still contains `tab=generate` (regression guard)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification pass across all changes.

- [x] T012 [P] Run `bun run typecheck` — confirm 0 TypeScript errors across all new and edited files
- [x] T013 [P] Audit all new/edited CSS files (`AuthorPage.css`, `TopBar.css` additions) — confirm no hardcoded hex, rgba, or numeric color values; every color must use a `var(--token)` reference
- [x] T014 Smoke test in dev server: visit `/`, `/catalog`, `/fleet`, `/events` — confirm top bar `+ New RGD` button visible on all; visit `/author` — confirm form and preview render, title is "New RGD — kro-ui", editing Kind field updates YAML live

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 — AuthorPage)**: Depends on Phase 1 (`STARTER_RGD_STATE` export)
- **Phase 3 (US2 — TopBar)**: Independent of Phase 2 (different files); can run in parallel with Phase 2 after Phase 1
- **Phase 4 (US3 — Empty states)**: Independent of Phase 2 and 3 (different files); can run in parallel after Phase 1
- **Phase 5 (US4 — Regression)**: Depends on Phase 1 (T002 import update is the only GenerateTab change)
- **Phase 6 (E2E)**: Depends on all implementation phases completing
- **Phase 7 (Polish)**: Depends on all implementation phases

### User Story Dependencies

- **US1 (AuthorPage)**: Depends on Phase 1 → provides the `/author` destination
- **US2 (TopBar)**: Depends on Phase 1 only — just needs the route to exist (Phase 2) before testing, but the TopBar code itself can be written in parallel
- **US3 (Empty states)**: Depends on Phase 1 only (for `Link` import pattern); the actual `/author` route from US1 must exist before smoke-testing
- **US4 (Regression)**: Depends on Phase 1 (T002 already modifies GenerateTab)

### Within Each Phase

- T001 before T002 (T002 removes the local constant that T001 makes available from generator.ts)
- T003, T004 can run in parallel (separate files)
- T005 depends on T003 (imports AuthorPage)
- T006, T007 can run in parallel (separate files)
- T008, T009 can run in parallel (separate files)

---

## Parallel Opportunities

### After Phase 1 completes (T001 + T002)

```
Phase 2 (US1):          Phase 3 (US2):          Phase 4 (US3):
T003 AuthorPage.tsx     T006 TopBar.tsx          T008 Home.tsx
T004 AuthorPage.css     T007 TopBar.css          T009 Catalog.tsx
T005 main.tsx
     ↓                       ↓                        ↓
     All phases converge → Phase 6 E2E (T011) → Phase 7 Polish
```

### Within Phase 2

```
T003 AuthorPage.tsx  ──┐
T004 AuthorPage.css  ──┴─→  T005 main.tsx (imports AuthorPage)
```

### Within Phase 3

```
T006 TopBar.tsx  ──┐
T007 TopBar.css  ──┘  (no ordering dependency between them)
```

### Within Phase 4

```
T008 Home.tsx    ──┐
T009 Catalog.tsx ──┘  (no ordering dependency between them)
```

---

## Implementation Strategy

### MVP (minimum shippable increment)

1. **Phase 1** — export `STARTER_RGD_STATE` (T001, T002)
2. **Phase 2** — `AuthorPage` + route registration (T003–T005)
3. **Phase 3** — top bar button (T006–T007)
4. **Stop and validate** — `bun run typecheck`; smoke test `/author` and top bar on all pages

This MVP satisfies US1 + US2 (the two highest-value changes). Empty-state links
(US3) and the E2E journey (Phase 6) can follow immediately after.

### Full delivery order

Phase 1 → Phase 2 + Phase 3 + Phase 4 (parallel) → Phase 5 → Phase 6 → Phase 7

### Total task count: 14 tasks

| Phase | Story | Tasks |
|-------|-------|-------|
| Phase 1 Setup | — | T001–T002 (2) |
| Phase 2 | US1 | T003–T005 (3) |
| Phase 3 | US2 | T006–T007 (2) |
| Phase 4 | US3 | T008–T009 (2) |
| Phase 5 | US4 | T010 (1) |
| Phase 6 | E2E | T011 (1) |
| Phase 7 Polish | — | T012–T014 (3) |
