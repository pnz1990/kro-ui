# Tasks: Overview SRE Dashboard (062)

**Feature**: `062-overview-sre-dashboard`
**Input**: `.specify/specs/062-overview-sre-dashboard/`
**GH Issue**: #397

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files)
- **[Story]**: User story this task belongs to (US1–US6)
- All paths are relative to the worktree root

---

## Phase 1: Setup (New Files)

**Purpose**: Create the new files that this feature introduces — zero logic, just scaffolding with placeholder exports. This lets TypeScript resolve imports before any story begins.

- [x] T001 Create `web/src/components/OverviewWidget.tsx` — placeholder export (empty card div, props typed)
- [x] T002 [P] Create `web/src/components/OverviewWidget.css` — empty file (`.overview-widget {}` stub)
- [x] T003 [P] Create `web/src/components/InstanceHealthWidget.tsx` — placeholder export
- [x] T004 [P] Create `web/src/components/InstanceHealthWidget.css` — empty file stub
- [x] T005 Create `web/src/pages/Home.test.tsx` — delete all existing VirtualGrid/RGDCard tests; add a single `it('renders', () => {})` smoke test so the file compiles

**Checkpoint**: `bun tsc --noEmit` passes with zero errors after T001–T005.

---

## Phase 2: Foundational (Shared Logic — Blocks All Stories)

**Purpose**: Pure functions and data types that every widget depends on. Must be complete before any widget is built.

⚠️ **CRITICAL**: No widget implementation can begin until this phase is complete.

- [x] T006 Add `healthFromSummary(item: InstanceSummary): InstanceHealthState` to `web/src/lib/format.ts` — pure function per data-model.md R-02; export it; add unit tests in `web/src/lib/format.test.ts` (or create `format.healthFromSummary.test.ts` if preferred) covering all 4 branches (IN_PROGRESS, True, False, unknown)
- [x] T007 Add `buildHealthDistribution(items: InstanceSummary[]): HealthDistribution` to `web/src/lib/format.ts` — pure aggregation; add `HealthDistribution` interface export; unit test covering empty list and mixed states
- [x] T008 [P] Add `buildTopErroringRGDs(items: InstanceSummary[]): TopErroringRGD[]` to `web/src/lib/format.ts` — pure function returning top-5 RGDs by error count; export `TopErroringRGD` interface; unit test covering tie-breaking and fewer-than-5 case
- [x] T009 [P] Add `mayBeStuck(item: InstanceSummary): boolean` and `countMayBeStuck(items: InstanceSummary[]): number` to `web/src/lib/format.ts` — 5-minute threshold heuristic per R-11; unit test covers boundary (exactly 5 min, just over, missing timestamp)
- [x] T010 [P] Add `getRecentlyCreated(items: InstanceSummary[], n?: number): InstanceSummary[]` and `getMayBeStuck(items: InstanceSummary[], n?: number): InstanceSummary[]` to `web/src/lib/format.ts` — sort helpers for W-7 per data-model.md; unit test covering sort order
- [x] T011 Implement `OverviewWidget.tsx` fully — props: `{ title, loading, error, onRetry?, className?, children }` per contracts/component-api.md; renders shimmer skeleton when `loading=true`; renders inline `⚠ Could not load [title]. [Retry]` when `error` is non-null; `data-testid` on root div equals `className` prop when provided; use shimmer pattern from `MetricsStrip.css` in `OverviewWidget.css`

**Checkpoint**: `bun tsc --noEmit` passes; `bun vitest run web/src/lib/format` passes.

---

## Phase 3: User Story 1 — Instant Cluster Health Assessment (P1) 🎯 MVP

**Goal**: SRE opens Overview and sees correct instance health counts in W-1, controller metrics in W-2, and RGD compile errors in W-3. All widgets show skeletons while loading and inline errors on failure.

**Independent Test**: Load Overview against a cluster with mixed instance states. W-1 shows correct counts. W-2 shows 4 controller metric cells. W-3 shows either the clean state or an error list. All widgets show skeleton on first load.

### Implementation

- [x] T012 [US1] Rewrite `web/src/pages/Home.tsx` skeleton — import all needed API functions and hooks; replace entire JSX with a `<div className="home">` containing 7 `<OverviewWidget>` placeholders with `loading={true}`; add `usePageTitle('Overview')`; ensure `bun tsc --noEmit` still passes
- [x] T013 [US1] Add parallel fetch orchestration to `Home.tsx` — `fetchAll()` using `Promise.allSettled` over `[listAllInstances(), listRGDs(), getControllerMetrics(), getCapabilities(), listEvents()]`; `AbortController` ref for cancellation; `isFetching` state; `lastFetchedAt: Date | null` state; `lastAttemptFailed: boolean` state; five `WidgetState<T>` state values; call `fetchAll()` in `useEffect` on mount
- [x] T014 [US1] Implement `InstanceHealthWidget.tsx` — accepts `{ distribution: HealthDistribution, chartMode: ChartMode, onChartModeChange }` props; renders total count + per-state count labels; renders segmented horizontal bar (default Bar mode) with proportional segments using `var(--color-status-*)` tokens; Bar/Donut toggle buttons within the widget; empty state when `total === 0`; `data-testid="instance-health-widget"`
- [x] T015 [P] [US1] Wire `InstanceHealthWidget.css` — segmented bar: flex row, each segment `flex: count`, `background: var(--color-status-*)`, min-width guard; count labels below bar; toggle buttons styled as segmented control; all colors via tokens only
- [x] T016 [US1] Wire W-1 in `Home.tsx` — pass `instancesState` loading/error/data to `<OverviewWidget title="Instance Health" ...>`; compute `distribution` from `buildHealthDistribution(instancesState.data?.items ?? [])`; render `<InstanceHealthWidget>` as child; `data-testid="widget-instances"`
- [x] T017 [P] [US1] Implement W-2 (Controller Metrics) inline in `Home.tsx` — 4-cell grid mirroring MetricsStrip layout but inside an `<OverviewWidget title="Controller Metrics">`; use `metricsState` and `capabilitiesState`; footer line `kro v{capabilities.version}`; "Not reported" for null metrics per MetricsStrip pattern; `data-testid="widget-metrics"`
- [x] T018 [P] [US1] Implement W-3 (RGD Compile Errors) inline in `Home.tsx` — count RGDs where `extractReadyStatus(rgd).state === 'error'`; when 0: green "✓ All N RGDs compile cleanly"; when >0: scrollable list (max-height ~5 rows) of erroring RGD names + `buildErrorHint(reason, message)`, each row a `<Link to="/rgds/{name}">`; `data-testid="widget-rgd-errors"`
- [x] T019 [US1] Write unit tests in `Home.test.tsx` — test `healthFromSummary` mapping (covered in T006 but also validate integration: given mock `AllInstancesResponse`, distribution counts are correct); test W-3 clean state vs error list rendering using React Testing Library; test per-widget error state renders "⚠ Could not load"
- [x] T020 [US1] Rewrite `Home.css` Phase 1 — `.home` page layout, `.home__header` flex row (title/tagline left, layout-toggle + refresh right), `.home__grid` 3-column responsive grid (`grid-template-columns: repeat(auto-fill, minmax(360px, 1fr))`, `gap: 16px`), W-1 spanning 2 columns via `.home__w1 { grid-column: span 2 }` at ≥ 3-column breakpoint; all widget card base styles in `OverviewWidget.css`

**Checkpoint**: Overview page loads with real cluster data showing W-1 counts, W-2 metrics, W-3 error state. `bun tsc --noEmit` and `bun vitest run` pass.

---

## Phase 4: User Story 2 — Manual Refresh (P1)

**Goal**: Refresh button re-fetches all sources in parallel; "Updated X ago" label tracks staleness; button disabled while in-flight; partial failure shows inline widget error while others succeed.

**Independent Test**: Click Refresh — all 5 widgets re-enter loading state, resolve, and "Updated X ago" resets. Kill the events endpoint and click Refresh — W-6 shows inline error while W-1–W-5 update.

### Implementation

- [x] T021 [US2] Add page header controls to `Home.tsx` — `↻ Refresh` button with `data-testid="overview-refresh"`, `aria-label="Refresh now"` / `"Refreshing..."` while `isFetching`; spinner icon (reuse `⟳` unicode or existing spinner CSS); button `disabled={isFetching}`; "Updated X ago" staleness label with `data-testid="overview-staleness"` using `formatAge(lastFetchedAt.toISOString())`; "Last attempt failed — data may be stale" text when `lastAttemptFailed && !isFetching`
- [x] T022 [US2] Add 10-second tick for staleness label in `Home.tsx` — `useEffect` with `setInterval(10_000)` that calls `setTickAt(Date.now())` (or any state trigger); staleness label re-reads `lastFetchedAt` on each tick; clear interval on unmount
- [x] T023 [US2] Add layout-toggle segmented control to `Home.tsx` header — `[Grid] [Bento]` buttons with `data-testid="overview-layout-grid"` / `"overview-layout-bento"`; `lsGet/lsSet` helpers (`"overview-layout"` key, default `"grid"`); `layoutMode` state initialized from `lsGet`; clicking persists and applies immediately
- [x] T024 [US2] Add unit test to `Home.test.tsx` for Refresh button state — mock `listAllInstances` to hang (never resolve); assert button shows "Refreshing..." and is disabled; resolve mock; assert button re-enables

**Checkpoint**: Clicking Refresh visibly cycles all widgets through loading state. Staleness label updates. Layout toggle works.

---

## Phase 5: User Story 3 — Identify and Navigate to Problem RGDs (P2)

**Goal**: W-5 (Top Erroring RGDs) shows the correct top-5 ranking with proportional bars and links to the instances tab.

**Independent Test**: Given mock data with 3 RGDs having 5, 2, 1 error instances — W-5 renders them in descending order; clicking first row navigates to `/rgds/{name}?tab=instances`.

### Implementation

- [x] T025 [US3] Implement W-5 (Top Erroring RGDs) inline in `Home.tsx` — uses `instancesState.data?.items ?? []`; call `buildTopErroringRGDs(items)`; render ranked rows: rank number, `<Link to="/rgds/{name}?tab=instances">{name}</Link>`, error count, relative proportional bar (`width: {count/max * 100}%`, `background: var(--color-status-error)`); empty state "No instance errors"; `data-testid="widget-top-erroring"`
- [x] T026 [P] [US3] Add W-5 CSS to `Home.css` — `.home__top-erroring-row` flex row with rank, name link, count badge, bar; bar container fixed width; bar fill `var(--color-status-error)` with `border-radius`
- [x] T027 [US3] Add unit test in `Home.test.tsx` for W-5 — given 3 RGDs with 5/2/1 errors, assert correct render order and link hrefs

**Checkpoint**: W-5 ranks correctly. Empty state visible when no errors. Links navigate correctly.

---

## Phase 6: User Story 4 — Spot Stuck Reconciliations (P2)

**Goal**: W-4 shows total reconciling count + "N may be stuck > 5 min" in amber when >0. W-7 "May Be Stuck" panel lists oldest IN_PROGRESS instances first.

**Independent Test**: With 5 reconciling instances (2 created >5 min ago), W-4 shows "5" as large count and "2 may be stuck > 5 min" in amber. W-7 "May Be Stuck" panel shows the 2 stuck instances oldest-first.

### Implementation

- [x] T028 [US4] Implement W-4 (Reconciling Queue) inline in `Home.tsx` — uses `instancesState`; large count `distribution.reconciling`; secondary line `{countMayBeStuck(items)} may be stuck > 5 min` styled `color: var(--color-status-reconciling)` only when > 0; when reconciling = 0: "✓ No instances reconciling" in `var(--color-status-ready)`; `data-testid="widget-reconciling"`
- [x] T029 [P] [US4] Implement W-7 (Recent Activity) inline in `Home.tsx` — two side-by-side panels inside one `<OverviewWidget title="Recent Activity">`; left panel "Recently Created": `getRecentlyCreated(items, 5)` sorted newest-first, each row: name `<Link to="/rgds/{rgdName}/instances/{namespace}/{name}">`, `displayNamespace(namespace)`, kind badge, `formatAge(creationTimestamp)`; right panel "May Be Stuck": `getMayBeStuck(items, 5)` sorted oldest-first, same columns but elapsed duration instead of age; empty state "✓ No stuck instances" when none; `data-testid="widget-activity"`
- [x] T030 [P] [US4] Add W-4/W-7 CSS to `Home.css` — W-4 large count typography (`font-size: 3rem; font-weight: 700; font-family: var(--font-mono)`); W-7 two-column flex layout; row styles shared between both panels
- [x] T031 [US4] Add unit tests in `Home.test.tsx` — W-4: 0 reconciling → green text; >0 stuck → amber secondary line; W-7: stuck panel sorted oldest-first; recently created sorted newest-first

**Checkpoint**: W-4 amber heuristic works. W-7 panels render correct items in correct order. Links navigate to instance detail.

---

## Phase 7: User Story 5 — Grid / Bento Layout Toggle (P3)

**Goal**: Switching to Bento changes the page layout to the asymmetric CSS grid. Preference persists in localStorage.

**Independent Test**: Click Bento — layout changes. Navigate away and back — Bento still active. No JavaScript layout library used.

### Implementation

- [x] T032 [US5] Add Bento CSS grid to `Home.css` — `.home__bento` using `grid-template-areas` per research.md R-10; assign `grid-area` classes to each of the 7 widget wrappers; narrow viewport `@media (max-width: 768px)` override collapses to single column for both Grid and Bento modes
- [x] T033 [US5] Wire Bento class toggle in `Home.tsx` — apply `home__grid` or `home__bento` class to widget container div based on `layoutMode` state; layout toggle buttons already added in T023; verify persistence by reading `lsGet('overview-layout', 'grid')` on mount
- [x] T034 [US5] Add unit test in `Home.test.tsx` — given stored `localStorage.setItem('overview-layout','bento')`, assert `.home__bento` class is present on container after render

**Checkpoint**: Layout visually switches. Preference survives navigation (localStorage). `@media` collapse works on narrow viewport.

---

## Phase 8: User Story 6 — Bar / Donut Chart Toggle (P3)

**Goal**: W-1 chart type switches between segmented bar and SVG donut. Donut uses no external library. Preference persists.

**Independent Test**: Click Donut — SVG donut renders with correct segment proportions using token colors. Inspect DOM: no `<script>` from a chart library. Navigate away and back — donut still shown.

### Implementation

- [x] T035 [US6] Implement SVG donut in `InstanceHealthWidget.tsx` — pure SVG: `<circle>` per non-zero state using `stroke-dasharray`/`stroke-dashoffset` formula from research.md R-03; segment order: error→degraded→reconciling→pending→unknown→ready; each circle `style={{ stroke: 'var(--color-status-X)' }}`; center text showing total count; legend to the right with colored dots + count per state; renders only when `chartMode === 'donut'`
- [x] T036 [P] [US6] Add donut CSS to `InstanceHealthWidget.css` — SVG container size (e.g. `120×120`), center text absolute-positioned; legend flex column; dot `border-radius: 50%` colored with `var(--color-status-*)`; no hardcoded hex anywhere
- [x] T037 [P] [US6] Wire chart mode persistence in `Home.tsx` — `chartMode` state initialized from `lsGet('overview-health-chart', 'bar')`; `onChartModeChange` calls `setChartMode` and `lsSet('overview-health-chart', mode)`
- [x] T038 [US6] Add unit test in `Home.test.tsx` for donut — given `chartMode='donut'` and distribution with error=5, ready=10, assert SVG element is present and has correct number of `<circle>` children (one per non-zero state); assert no hardcoded color attribute values (all via `style.stroke`)

**Checkpoint**: Donut renders visually correct. No external chart library in bundle. Bar/Donut toggle persists.

---

## Phase 9: Polish & Recent Events (W-6) + Cross-Cutting

**Purpose**: W-6 (remaining widget), edge cases, full-page error, empty-cluster onboarding, accessibility, and final TypeScript + test validation.

- [x] T039 Implement W-6 (Recent Events) inline in `Home.tsx` — uses `eventsState`; take `(eventsState.data?.items ?? []).slice(0, 10)` newest-first; each row: `formatAge(event timestamp)`, reason, involved object name truncated to 40 chars with full text in `title`, message truncated to 80 chars with full text in `title`; badge per row: Warning → `var(--color-status-reconciling)` amber; `/condition/i` reason match → `var(--color-status-ready)` green; Normal → `var(--color-text-muted)`; footer `<Link to="/events">View all events →</Link>`; max-height with `overflow-y: auto; overflow-x: hidden`; empty state "No recent kro events"; `data-testid="widget-events"`
- [x] T040 [P] Add W-6 CSS to `Home.css` — event row flex layout; badge dot; truncation via `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- [x] T041 [P] Add full-page error state to `Home.tsx` — render `home__error` panel (same style as previous Home.tsx) ONLY when both `rgdsState.error !== null && instancesState.error !== null`; all other combinations show per-widget inline errors via `OverviewWidget`
- [x] T042 [P] Add empty-cluster onboarding state to `Home.tsx` — when `instancesState.data?.total === 0 && rgdsState.data?.items?.length === 0 && !isFetching`: render an onboarding card inside W-1 area with link to `/author` (RGD Designer)
- [x] T043 Remove `MetricsStrip` import from `Home.tsx` — ensure it is not rendered anywhere on the page (AC-02 / FR-003); verify `Catalog.tsx` is untouched
- [x] T044 [P] Verify no hardcoded colors — grep `Home.css`, `OverviewWidget.css`, `InstanceHealthWidget.css` for `#`, `rgb(`, `rgba(`, `hsl(`; fix any found
- [x] T045 [P] Add `overflow-x: hidden` to all `overflow-y: auto` containers in new CSS files (anti-pattern from AGENTS.md)
- [x] T046 Run `bun tsc --noEmit` and fix any remaining TypeScript errors
- [x] T047 Run `bun vitest run` and fix any failing tests
- [x] T048 [P] Add E2E journey `test/e2e/journeys/062-overview-sre-dashboard.spec.ts` — steps: (1) API-check `/api/v1/instances` before navigating; (2) navigate to `/`; (3) wait for `data-testid="widget-instances"` to contain digit text (not skeleton); (4) assert `data-testid="overview-refresh"` is visible; (5) assert `data-testid="overview-staleness"` contains "ago" or "just now"; (6) assert `data-testid="widget-metrics"` is visible; (7) click Refresh, assert button disabled briefly, then re-enables; follow `§XIV` API-first checks and `waitForFunction` patterns from constitution
- [x] T049 Add `062-*.spec.ts` pattern to the appropriate `testMatch` chunk in `test/e2e/playwright.config.ts` (constitution §XIV — new prefix MUST be registered or tests are silently skipped)

**Checkpoint**: `bun tsc --noEmit` clean. `bun vitest run` green. E2E journey file registered in playwright config. Page matches all 18 acceptance criteria (AC-01 through AC-18).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all story phases**
- **Phase 3 (US1 — Health Assessment)**: Depends on Phase 2 — this is the 🎯 MVP
- **Phase 4 (US2 — Refresh)**: Depends on Phase 3 scaffolding (fetch orchestration must exist)
- **Phase 5 (US3 — Top Erroring)**: Depends on Phase 2 only; can start in parallel with Phase 4
- **Phase 6 (US4 — Stuck Reconciliations)**: Depends on Phase 2 only; can start in parallel with Phase 4/5
- **Phase 7 (US5 — Layout Toggle)**: Depends on Phase 3 (widget container must exist)
- **Phase 8 (US6 — Donut Chart)**: Depends on Phase 3 (InstanceHealthWidget must exist)
- **Phase 9 (Polish)**: Depends on all story phases

### User Story Dependencies

| Story | Depends on | Parallel with |
|-------|-----------|---------------|
| US1 (P1) | Phase 2 | — (first) |
| US2 (P1) | US1 scaffolding | — |
| US3 (P2) | Phase 2 | US4, US5, US6 |
| US4 (P2) | Phase 2 | US3, US5, US6 |
| US5 (P3) | US1 widget container | US6 |
| US6 (P3) | US1 InstanceHealthWidget | US5 |

### Within Each Phase

- T006–T010 in Phase 2 can all run in parallel (different functions, same file is fine since they're additive)
- T001–T004 in Phase 1 can all run in parallel

---

## Parallel Opportunities

```
Phase 1 (all parallel):  T001 T002 T003 T004
Phase 2 (all parallel):  T006 T007 T008 T009 T010 (then T011 sequentially)
Phase 3 concurrent:      T014+T015 in parallel, T017+T018 in parallel; T012→T013→T016 sequential
Phase 5+6 concurrent:    T025+T026 || T028+T029+T030 (different widget, same data source)
Phase 7+8 concurrent:    T032+T033 || T035+T036+T037
```

---

## Implementation Strategy

### MVP (US1 + US2 only — Phases 1–4)

1. Phase 1: Scaffold new files
2. Phase 2: Pure functions + `OverviewWidget`
3. Phase 3: W-1, W-2, W-3 wired with real data + page skeleton
4. Phase 4: Refresh button + staleness label + layout toggle
5. **STOP AND VALIDATE**: Overview answers "is this cluster OK?" on a real cluster
6. Ship — all P1 stories done; page is production-useful

### Full Delivery (add P2/P3 incrementally)

- Phase 5: W-5 Top Erroring RGDs (P2 actionability)
- Phase 6: W-4 Reconciling Queue + W-7 Recent Activity (P2 stuck detection)
- Phase 7: Bento layout (P3 polish)
- Phase 8: SVG Donut (P3 polish)
- Phase 9: W-6 Events + polish + E2E

---

## Notes

- `[P]` tasks modify different files or are purely additive to the same file — safe to parallelize
- **No new npm or Go dependencies** — enforced by constitution §V
- **No hardcoded hex/rgba** anywhere in new CSS — all via `var(--color-*)` tokens
- `OverviewWidget` is the single shimmer/error pattern — do not duplicate it per-widget
- `healthFromSummary` lives in `format.ts` (not `Home.tsx`) so it can be unit-tested independently
- `Home.test.tsx` tests are for logic correctness only — no E2E assertions in unit tests
- E2E journey must use `waitForFunction` not `waitForTimeout` (constitution §XIV)
- After T049, verify with `grep testMatch test/e2e/playwright.config.ts | grep 062`
