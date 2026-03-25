# Tasks: 042-rgd-designer-nav

**Input**: Design documents from `.specify/specs/042-rgd-designer-nav/`  
**Spec**: GitHub issue #196 — "feat(web): RGD Designer — remove 'New RGD' mode from Generate tab, promote /author to nav as 'RGD Designer', add live DAG preview"  
**Branch**: `042-rgd-designer-nav`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared state)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths are required in all task descriptions

## User Stories

| ID | Priority | Goal |
|----|----------|------|
| US1 | P1 (MVP) | Remove redundant `New RGD` mode from GenerateTab; rename top nav entry to `RGD Designer` as a proper `<NavLink>` |
| US2 | P2 | Add live DAG preview panel to `/author` (AuthorPage) — debounced, client-side, no API calls |
| US3 | P3 | Update empty-state CTA copy in Home and Catalog to match `RGD Designer` branding |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the foundational `rgdAuthoringStateToSpec` adapter — required by US2 DAG preview. Everything else is self-contained edits.

- [x] T001 Add `rgdAuthoringStateToSpec(state: RGDAuthoringState): Record<string, unknown>` export to `web/src/lib/generator.ts` — converts authoring form state to the `spec` shape accepted by `buildDAGGraph`; filter resources with empty `id`; filter fields with empty `name`; pure function, no throws

**Checkpoint**: `bun --cwd web run typecheck` passes. `rgdAuthoringStateToSpec` is importable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No additional foundational infrastructure needed beyond Phase 1. All user stories can proceed once T001 is complete.

**⚠️ CRITICAL**: T001 must be merged before US2 work begins. US1 and US3 are independent of T001.

---

## Phase 3: User Story 1 — TopBar + GenerateTab Refactor (Priority: P1) 🎯 MVP

**Goal**: The `+ New RGD` pill button is replaced by a `RGD Designer` nav link inside `<nav>`; the `New RGD` mode in GenerateTab no longer exists. All testids updated.

**Independent Test**:
1. Load any page — the top bar shows `RGD Designer` inside the nav alongside Overview, Catalog, Fleet, Events.
2. Click `RGD Designer` — navigates to `/author`, link is highlighted as active.
3. Navigate to any RGD's Generate tab — only two mode buttons appear: `Instance Form` and `Batch`. No `New RGD` button.
4. Run `bun --cwd web run typecheck` — zero errors.

### Implementation for User Story 1

- [x] T002 [P] [US1] In `web/src/components/TopBar.tsx`: replace `<Link to="/author" className="top-bar__new-rgd-btn" data-testid="topbar-new-rgd">+ New RGD</Link>` (outside `<nav>`) with `<NavLink to="/author" className={({ isActive }) => \`top-bar__nav-link\${isActive ? ' top-bar__nav-link--active' : ''}\`} data-testid="topbar-rgd-designer">RGD Designer</NavLink>` placed as the last item inside `<nav className="top-bar__nav">`; remove the standalone `<Link>` import if `NavLink` is already imported
- [x] T003 [P] [US1] In `web/src/components/TopBar.css`: delete the entire `.top-bar__new-rgd-btn` block (lines 76–99, the `/* ── New RGD CTA button ──` section) — no replacement needed; `RGD Designer` uses existing `.top-bar__nav-link` styles
- [x] T004 [P] [US1] In `web/src/components/GenerateTab.tsx`: (a) change `type GenerateMode = 'form' | 'batch'` (remove `'rgd'`); (b) remove the `useState<GenerateMode>('form')` default is already `'form'` — no change needed; (c) delete `const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)`; (d) delete `const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])`; (e) delete the "New RGD" `<button data-testid="mode-btn-rgd">` block; (f) delete both `{mode === 'rgd' && ...}` JSX branches; (g) remove unused imports: `generateRGDYAML`, `STARTER_RGD_STATE`, `RGDAuthoringState`, `RGDAuthoringForm`; (h) add optional subtle hint at the bottom of `.generate-tab__input-pane`: `<p className="generate-tab__designer-hint">Authoring a new RGD? <Link to="/author">Open RGD Designer →</Link></p>` with import of `Link` from `react-router-dom`
- [x] T005 [P] [US1] In `web/src/components/GenerateTab.css`: check for any `.generate-tab__mode-btn--rgd` rules and remove them if present; add `.generate-tab__designer-hint` style: `font-family: var(--font-sans); font-size: 0.8125rem; color: var(--color-text-muted); margin-top: auto; padding-top: 16px; text-align: center;` with `a` child inheriting `color: var(--color-primary); text-decoration: none;`

**Checkpoint**: `bun --cwd web run typecheck` — zero errors. Open the app: top bar has `RGD Designer` in the nav, highlighted when on `/author`. GenerateTab shows only Instance Form and Batch buttons.

---

## Phase 4: User Story 2 — Live DAG Preview on AuthorPage (Priority: P2)

**Goal**: The `/author` page renders "RGD Designer" as its title, and shows a live dependency graph that updates (debounced at 300ms) as the user fills in resources. The graph uses `StaticChainDAG` with `rgds=[]` fed by `rgdAuthoringStateToSpec`.

**Independent Test**:
1. Navigate to `/author` — page title is `RGD Designer — kro-ui`, `<h1>` says `RGD Designer`.
2. A DAG panel is visible in the right column, above the YAML preview.
3. With the starter state (`MyApp` kind, one `web/Deployment` resource), the DAG shows the schema root node connected to the `web` resource node.
4. Add a second resource — the DAG updates within ~300ms to show the new node.
5. Remove all resources — the DAG shows only the `schema` root node.
6. `bun --cwd web run typecheck` — zero errors.

**Prerequisite**: T001 complete.

### Implementation for User Story 2

- [x] T006 [US2] In `web/src/pages/AuthorPage.tsx`: (a) change `usePageTitle('RGD Designer')` (was `'New RGD'`); (b) change `<h1 className="author-page__title">RGD Designer</h1>`; (c) add imports: `useDebounce` from `@/hooks/useDebounce`, `rgdAuthoringStateToSpec` and `buildDAGGraph` from `@/lib/generator` and `@/lib/dag` respectively, `StaticChainDAG` from `@/components/StaticChainDAG`, `useMemo` (already imported); (d) add `const debouncedState = useDebounce(rgdState, 300)`; (e) add `const dagGraph = useMemo(() => buildDAGGraph(rgdAuthoringStateToSpec(debouncedState), []), [debouncedState])`; (f) restructure JSX: wrap right column in `<div className="author-page__right-pane">`, insert `<div className="author-page__dag-pane"><StaticChainDAG graph={dagGraph} rgds={[]} rgdName={debouncedState.rgdName || 'my-rgd'} /></div>` above the existing `<div className="author-page__preview-pane">` — keep `<YAMLPreview>` unchanged; (g) add `{debouncedState.resources.length === 0 && <p className="author-page__dag-hint">Add resources to see the dependency graph</p>}` below the dag-pane div
- [x] T007 [US2] In `web/src/pages/AuthorPage.css`: (a) rename `.author-page__preview-pane` from `flex: 1 1 420px` to remain for the YAML only; (b) add `.author-page__right-pane { flex: 1 1 420px; display: flex; flex-direction: column; gap: 16px; min-height: 0; }`; (c) add `.author-page__dag-pane { flex: 0 0 auto; min-height: 200px; max-height: 340px; overflow: hidden; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-surface-2); }`; (d) add `.author-page__dag-hint { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--color-text-muted); text-align: center; padding: 8px 0 0; }`; (e) update `.author-page__preview-pane` to `flex: 1 1 0` inside `.author-page__right-pane`; (f) change `.author-page__body` right child from direct preview-pane to right-pane; ensure all color values use `var()` tokens — no hardcoded hex or rgba

**Checkpoint**: `bun --cwd web run typecheck` — zero errors. AuthorPage at `/author` shows live DAG that updates as resources are added/removed.

---

## Phase 5: User Story 3 — Empty-State CTA Copy (Priority: P3)

**Goal**: Consistent branding across Home and Catalog empty states using `RGD Designer` terminology.

**Independent Test**:
1. In the Home page onboarding empty state (no RGDs), the third CTA link reads `Open RGD Designer`.
2. In the Catalog page zero-items empty state, the authoring link text reads `RGD Designer`.
3. Both links still navigate to `/author`.

### Implementation for User Story 3

- [x] T008 [P] [US3] In `web/src/pages/Home.tsx` (around line 137): change `<Link to="/author" className="home__empty-cta" data-testid="home-new-rgd-link">New RGD</Link>` text to `Open RGD Designer` — keep `to`, `className`, and `data-testid` unchanged
- [x] T009 [P] [US3] In `web/src/pages/Catalog.tsx` (around line 224): change the link text inside the zero-items empty state from `in-app authoring tool` to `RGD Designer` — keep `to="/author"` and `data-testid="catalog-new-rgd-link"` unchanged

**Checkpoint**: Home and Catalog empty states show updated copy. Links still navigate to `/author`.

---

## Phase 6: E2E Test Update + Final Validation

**Purpose**: Update the E2E journey that references the old `topbar-new-rgd` testid and old text assertions; replace the now-invalid Step 4 regression guard.

- [x] T010 In `test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts`: (a) replace all `getByTestId('topbar-new-rgd')` with `getByTestId('topbar-rgd-designer')`; (b) update Step 1 text assertion: `expect(text?.trim()).toContain('RGD Designer')`; (c) update Step 2 title assertion: `await expect(page).toHaveTitle(/RGD Designer — kro-ui/)`; (d) replace Step 4 body — new test navigates to `/author`, asserts the page has a DAG preview pane visible (`page.locator('.author-page__dag-pane')`); keep the test description updated to reflect the new behavior; (e) update the journey-level description comment to remove reference to `mode-btn-rgd`
- [x] T011 Run `bun --cwd web run typecheck` from repo root and confirm zero TypeScript errors across all changed files
- [x] T012 Run `go vet ./...` from repo root and confirm zero Go vet errors (no Go changes, but required pre-commit gate)

**Checkpoint**: All TypeScript types valid. `go vet` clean. E2E journey 039 updated and passes locally against dev server (`bun --cwd web run dev`).

---

## Dependencies

```
T001 (rgdAuthoringStateToSpec)
  └─► T006, T007 (AuthorPage DAG preview — US2)

T002, T003 (TopBar changes)       ← independent, parallel
T004, T005 (GenerateTab changes)  ← independent, parallel
T008, T009 (copy updates)         ← independent, parallel

T010 (E2E update) ← depends on T002 (testid change), T006 (dag-pane class)
T011 (typecheck)  ← depends on all implementation tasks
T012 (go vet)     ← independent
```

**Story completion order**: US1 → US3 can run in parallel; US2 after T001.  
**Merge order**: All tasks in one PR — no cross-story API dependencies.

---

## Parallel Execution Examples

**Phase 3 (US1) — fully parallelizable**:
```
Agent A: T002 (TopBar.tsx)       → T003 (TopBar.css)
Agent B: T004 (GenerateTab.tsx)  → T005 (GenerateTab.css)
```

**Phase 5 (US3) — fully parallelizable**:
```
Agent A: T008 (Home.tsx)
Agent B: T009 (Catalog.tsx)
```

**Phases 3 + 5 — can run simultaneously** (all different files, no shared state).

**Phase 4 (US2) — sequential** (T006 → T007, since CSS must match JSX class names added in T006).

---

## Implementation Strategy

**MVP** (deliver US1 alone — T001–T005, T010–T012):
- Removes the confusing `New RGD` mode from GenerateTab
- Promotes `/author` to a first-class nav item as `RGD Designer`
- E2E journey 039 updated to match
- Zero new features — pure refactor, immediately shippable

**Full delivery** (all tasks):
- Adds live DAG preview to AuthorPage (US2)
- Updates all empty-state CTAs (US3)

**Suggested commit sequence**:
1. `feat(web): add rgdAuthoringStateToSpec adapter in generator.ts` (T001)
2. `feat(web): promote /author to RGD Designer nav link, remove New RGD mode from GenerateTab` (T002–T005)
3. `feat(web): live DAG preview on RGD Designer page` (T006–T007)
4. `feat(web): update empty-state CTA copy to RGD Designer` (T008–T009)
5. `test(e2e): update journey 039 for RGD Designer nav and DAG preview` (T010)
6. Final `go vet` + typecheck pass (T011–T012)

---

## Total task count

| Phase | Tasks | Parallelizable |
|-------|-------|---------------|
| Phase 1 — Setup | 1 (T001) | — |
| Phase 3 — US1 (MVP) | 4 (T002–T005) | All 4 |
| Phase 4 — US2 | 2 (T006–T007) | No |
| Phase 5 — US3 | 2 (T008–T009) | Both |
| Phase 6 — E2E + Validation | 3 (T010–T012) | T011 + T012 |
| **Total** | **12** | **8 parallelizable** |
