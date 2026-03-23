# Tasks: 031-deletion-debugger

**Input**: Design documents from `.specify/specs/031-deletion-debugger/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story (FR-001 through FR-007) to enable independent implementation and testing of each feature surface.

**No tests requested**: Test tasks are not included per spec — no TDD requirement stated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: FR mapped to user story (US1=FR-001+FR-002, US2=FR-003+FR-006, US3=FR-004, US4=FR-005, US5=FR-007)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the working tree is clean and the foundation is understood before writing any code.

- [x] T001 Read `web/src/lib/instanceNodeState.ts` in full — understand the `ChildNodeState` / `NodeStateMap` types and how children array maps to node states (required before T006)
- [x] T002 Read `web/src/components/DeepDAG.tsx` lines 80–500 — understand node rendering, badge positions, `liveStateClass()` usage, and how `terminating` state should integrate (required before T008)
- [x] T003 [P] Read `web/src/components/LiveNodeDetailPanel.tsx` lines 1–150 — understand the resource data flow and panel section layout (required before T009)
- [x] T004 [P] Read `web/src/components/EventsPanel.tsx` in full — understand event row rendering and CSS class names (required before T010)
- [x] T005 [P] Run `cd web && bun run tsc --noEmit` to confirm baseline is clean before any changes

**Checkpoint**: Codebase context loaded, baseline is clean.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: `web/src/lib/k8s.ts` — the single shared utility module that ALL user stories depend on. Must be complete before any other task.

**⚠️ CRITICAL**: Every other phase depends on this module. No user story work can begin until T006 is done.

- [x] T006 Create `web/src/lib/k8s.ts` with:
  - `KubernetesMetadata` interface and `OwnerReference` interface (from data-model.md §1)
  - `extractMetadata(obj: K8sObject): KubernetesMetadata` — single safe cast layer, `typeof` narrowing only, no raw `as` casts on `unknown`
  - `isTerminating(obj: K8sObject): boolean` — returns `true` iff `metadata.deletionTimestamp` is a non-empty string
  - `getDeletionTimestamp(obj: K8sObject): string | undefined` — returns raw ISO string or `undefined`
  - `getFinalizers(obj: K8sObject): string[]` — always returns array (never `undefined`), uses `Array.isArray` + element-level `filter((f): f is string => typeof f === 'string')`
  - `getKroFinalizers(obj: K8sObject): string[]` — finalizers starting with `'kro.run/'`
  - `getNonKroFinalizers(obj: K8sObject): string[]` — all finalizers not starting with `'kro.run/'`
  - `DELETION_REASONS: ReadonlySet<string>` — set containing: `Killing`, `Deleted`, `FailedDelete`, `SuccessfulDelete`, `DeletionFailed`, `FailedKillPod`, `ResourceDeleted`, `FinalizerRemoved`, `DeletionBlocked`, `Terminating`, `PreStopHookFailed`
  - `isDeletionEvent(event: K8sObject): boolean` — `true` iff top-level `event.reason` (string) is in `DELETION_REASONS`; returns `false` if `reason` is absent or not a string
  - `formatRelativeTime(isoTimestamp: string): string` — converts RFC3339 to `"Ns ago"` / `"Nm ago"` / `"Nh ago"` / `"Nd ago"` format per research.md §5; falls back to raw string if `new Date()` parse fails
  - Note: `K8sObject` is already defined in `web/src/lib/api.ts` as `Record<string, unknown>`; import it from there rather than redefining
  - Run `cd web && bun run tsc --noEmit` after writing — must pass before proceeding

**Checkpoint**: `web/src/lib/k8s.ts` exists and `tsc --noEmit` is clean. All subsequent phases can now begin in parallel.

---

## Phase 3: US1 — Instance Terminating Banner + Finalizer List (FR-001, FR-002) 🎯 MVP

**Goal**: When an instance enters Terminating state, the instance detail page shows a rose banner with elapsed time, and a collapsible Finalizers section below ConditionsPanel.

**Independent Test**: Open any instance detail page → run `kubectl delete <cr>` with a finalizer-blocking scenario → within 5s polling cycle, rose banner appears showing time since deletion. Finalizer list is visible and expanded. Reconciling banner is suppressed while Terminating.

- [x] T007 Create `web/src/components/TerminatingBanner.tsx`:
  - Props: `{ deletionTimestamp: string; tick: number }`
  - Import `formatRelativeTime` from `@/lib/k8s`
  - Render `<div role="status" aria-live="polite" className="terminating-banner">` containing `⊗` char + `"Terminating since {formatRelativeTime(deletionTimestamp)}"` text
  - Apply `title={deletionTimestamp}` on the outer div for ISO timestamp on hover (AC-002)
  - `tick` prop is used as a `useMemo` dependency for `formatRelativeTime(deletionTimestamp)` so time label updates with each poll — no `setInterval`
  - No logic, no state beyond the memo; pure presentational component

- [x] T008 Create `web/src/components/TerminatingBanner.css`:
  - `.terminating-banner { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--node-error-bg); border: 1px solid var(--node-error-border); border-radius: var(--radius); font-size: 13px; color: var(--color-error); }`
  - No raw hex or `rgba()` — all values must use named tokens from `tokens.css` (AC-010)
  - Import this CSS at the top of `TerminatingBanner.tsx`

- [x] T009 Create `web/src/components/FinalizersPanel.tsx`:
  - Props: `{ finalizers: string[]; defaultExpanded?: boolean }`
  - Guard: return `null` immediately when `finalizers.length === 0` (AC-004)
  - Use `useState(defaultExpanded ?? false)` for collapse/expand state
  - When collapsed, show toggle button labelled `"Finalizers ({n})"` where `n = finalizers.length`
  - When expanded, show toggle button labelled `"Finalizers"` + badge list
  - Each finalizer as `<span className="finalizer-badge">` pill; if finalizer starts with `'kro.run/'` add `.finalizer-badge--kro` modifier class
  - Toggle button uses `className="finalizers-panel-toggle"` and is a `<button type="button">`

- [x] T010 Create `web/src/components/FinalizersPanel.css`:
  - `.finalizers-panel { border: 1px solid var(--color-border-subtle); border-radius: var(--radius); overflow: hidden; }`
  - `.finalizers-panel-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 10px 16px; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text); text-align: left; }`
  - `.finalizers-panel-toggle:hover { background: var(--color-surface-2); }`
  - `.finalizer-badges-list { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 12px; }`
  - `.finalizer-badge { padding: 2px 8px; border-radius: var(--radius-sm); font-size: 11px; font-family: var(--font-mono); background: var(--color-surface-2); border: 1px solid var(--color-border); color: var(--color-text-muted); }`
  - `.finalizer-badge--kro { border-color: var(--color-primary); color: var(--color-primary-text); }`
  - No raw hex/rgba (AC-010)
  - Import this CSS at the top of `FinalizersPanel.tsx`

- [x] T011 Modify `web/src/pages/InstanceDetail.tsx` to wire FR-001 and FR-002:
  - Import `isTerminating`, `getDeletionTimestamp`, `getFinalizers` from `@/lib/k8s`
  - Import `TerminatingBanner` from `@/components/TerminatingBanner`
  - Import `FinalizersPanel` from `@/components/FinalizersPanel`
  - Expose `tick` from the `usePolling` call that fetches `fastData` (the 5s instance poll); if `usePolling` doesn't already return a `tick` counter, add one (a simple `useState` counter incremented in the polling callback is sufficient)
  - In the banner section: render `<TerminatingBanner>` **instead of** (not in addition to) the reconciling banner when `isTerminating(fastData.instance)` is true — Terminating takes precedence (FR-001, AC-001)
  - After `<ConditionsPanel>`, before `<EventsPanel>`: render `<FinalizersPanel finalizers={getFinalizers(fastData.instance)} defaultExpanded={isTerminating(fastData.instance)} />` (FR-002, AC-003, AC-004)
  - Pass `tick` prop to `TerminatingBanner`
  - Run `cd web && bun run tsc --noEmit` after changes

**Checkpoint**: Open instance detail for a Terminating instance → rose banner with time shown, finalizers visible, reconciling banner suppressed.

---

## Phase 4: US2 — DAG Node Terminating Indicator + Slide-in Panel (FR-003, FR-006)

**Goal**: Any child resource with `deletionTimestamp` set shows a `⊗` badge on its DAG node (rose colour, top-left), the node ring is forced to the error colour, and the LiveNodeDetailPanel shows `Terminating since` + finalizers when that node is clicked.

**Independent Test**: Open instance detail for an instance with a stuck Terminating child → the affected DAG node shows a `⊗` badge at top-left in rose. Clicking it opens the slide-in panel showing "Terminating since Xm ago" and the child's finalizers.

- [x] T012 Modify `web/src/lib/instanceNodeState.ts` to extend `ChildNodeState`:
  - Add `terminating?: boolean` field to the `ChildNodeState` / equivalent interface
  - Add `finalizers?: string[]` field
  - Add `deletionTimestamp?: string` field
  - In the function that maps children array items to `ChildNodeState`: call `isTerminating(child)` from `@/lib/k8s` and set `terminating`, call `getFinalizers(child)` and set `finalizers`, call `getDeletionTimestamp(child)` and set `deletionTimestamp`
  - When `terminating === true`, override the derived `state` field to `'error'` so the existing `liveStateClass()` call in DeepDAG renders the error ring colour (data-model.md §2)
  - Import `isTerminating`, `getFinalizers`, `getDeletionTimestamp` from `@/lib/k8s`

- [x] T013 Modify `web/src/components/DeepDAG.tsx` to render the `⊗` badge:
  - In the node rendering section (where existing `nodeBadge()` badges are drawn at top-right), add a **separate** `<text>` element at top-left when the live state for that node has `terminating === true`
  - Badge position: `x = node.x + 10`, `y = node.y + 10` (top-left, mirroring the top-right position convention)
  - Apply `className="dag-node-badge dag-node-badge--terminating"` on the `<text>` element
  - Add `aria-label="resource is terminating"` attribute
  - The `⊗` badge is **in addition to** any existing top-right `nodeBadge()` — they do not conflict (different corners)

- [x] T014 Add CSS for the terminating DAG badge in `web/src/components/DeepDAG.css`:
  - `.dag-node-badge--terminating { fill: var(--color-error); font-size: 12px; font-weight: 700; }`
  - No raw hex/rgba (AC-010)

- [x] T015 Modify `web/src/components/LiveNodeDetailPanel.tsx` for FR-006:
  - The panel already fetches the resource's raw YAML via `GET /api/v1/resources/...`; the raw object is available in component state
  - Import `isTerminating`, `getDeletionTimestamp`, `getFinalizers` from `@/lib/k8s`
  - Import `FinalizersPanel` from `@/components/FinalizersPanel`
  - For non-instance nodes (i.e. child resource nodes, not the root CR): read `deletionTimestamp` and `finalizers` from the fetched raw resource object
  - If `isTerminating(rawResource)` is `true`: render an inline row at the top of the panel body `<div className="live-panel-terminating-row">⊗ Terminating since {formatRelativeTime(deletionTimestamp)}</div>` before the state badge section (AC-006)
  - If `getFinalizers(rawResource).length > 0`: render `<FinalizersPanel finalizers={getFinalizers(rawResource)} defaultExpanded={isTerminating(rawResource)} />` in the panel body after the existing info rows (AC-006)
  - Add `.live-panel-terminating-row` CSS inline in `LiveNodeDetailPanel.css` (or its companion CSS file): `font-size: 12px; color: var(--color-error); font-weight: 600; padding: 8px 16px 0; display: flex; align-items: center; gap: 6px;`
  - Run `cd web && bun run tsc --noEmit` after changes

**Checkpoint**: Terminating child node shows `⊗` at top-left with error ring. Clicking it opens panel with terminating row and finalizer list.

---

## Phase 5: US3 — Deletion Event Tagging (FR-004)

**Goal**: In the EventsPanel, events whose `reason` matches a deletion keyword are visually tagged with a `⊘` marker and a left-border accent.

**Independent Test**: Add or trigger a `FailedDelete` or `Killing` event for a kro instance → open instance detail → affected event rows show a rose left border and `⊘ deletion` tag in the event header.

- [x] T016 Modify `web/src/components/EventsPanel.tsx` for FR-004:
  - Import `isDeletionEvent` from `@/lib/k8s`
  - In the event row render: add `event-row--deletion` to the row's `className` when `isDeletionEvent(event)` is true
  - Inside `.event-header`, when `isDeletionEvent(event)` is true: render `<span className="event-deletion-tag" aria-label="deletion event">⊘</span>` before the `.event-type` pill
  - No logic change to event sorting, timestamps, or other fields

- [x] T017 Add CSS for deletion event styling in `web/src/components/EventsPanel.css`:
  - `.event-row--deletion { border-left: 2px solid var(--color-error); padding-left: 14px; }` (compensate for 2px border: subtract 2px from existing left padding so content stays aligned)
  - `.event-deletion-tag { font-size: 11px; color: var(--color-error); font-weight: 700; flex-shrink: 0; }`
  - No raw hex/rgba (AC-010)
  - Run `cd web && bun run tsc --noEmit` after changes

**Checkpoint**: Events with deletion reasons show rose left border and `⊘` symbol. Normal events are unaffected.

---

## Phase 6: US4 — Instances Table "Terminating Only" Filter (FR-005)

**Goal**: In the Instances tab of RGD detail (and standalone instance list), a "Terminating only" checkbox filters the table to show only terminating instances, and the page title updates.

**Independent Test**: Navigate to any RGD's Instances tab → toggle "Terminating only" → only instances with `deletionTimestamp` set appear. With 0 terminating instances, shows the empty-state message. Toggle off → full list resumes.

- [x] T018 Modify `web/src/components/InstanceTable.tsx` to add the Terminating filter toggle:
  - Import `isTerminating` from `@/lib/k8s`
  - Add `const [showTerminatingOnly, setShowTerminatingOnly] = useState(false)` alongside the existing filter state
  - Add a filter control above the table: `<label className="instance-filter-terminating"><input type="checkbox" checked={showTerminatingOnly} onChange={e => setShowTerminatingOnly(e.target.checked)} /> Terminating only</label>`
  - Apply filter before sorting/pagination: `const effectiveInstances = showTerminatingOnly ? instances.filter(isTerminating) : instances`
  - Pass `effectiveInstances` through the existing sort/pagination pipeline (replacing raw `instances` where the pipeline currently starts)
  - Empty state when `showTerminatingOnly && effectiveInstances.length === 0`: show `<p className="panel-empty">No instances are currently terminating.</p>` (AC-009, not an error state)

- [x] T019 Add CSS for the Terminating filter toggle in `web/src/components/InstanceTable.css` (or equivalent CSS file imported by `InstanceTable.tsx`):
  - `.instance-filter-terminating { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; user-select: none; }`
  - `.instance-filter-terminating input[type="checkbox"] { cursor: pointer; accent-color: var(--color-error); }`
  - No raw hex/rgba (AC-010)

- [x] T020 Modify `web/src/pages/RGDDetail.tsx` to update the page title when filter is active:
  - The `showTerminatingOnly` state lives in `InstanceTable`; to update the document title from `RGDDetail`, lift the filter state up to `RGDDetail` and pass `showTerminatingOnly` + `setShowTerminatingOnly` down as props to `InstanceTable`, **OR** handle the title update inside `InstanceTable` itself via `useEffect(() => { document.title = ... }, [showTerminatingOnly, rgdName])`
  - Title when filter active: `${rgdName} — Instances (Terminating) — kro-ui`
  - Title when filter inactive: restore the existing `RGDDetail` title format (FR-005)
  - Run `cd web && bun run tsc --noEmit` after changes

**Checkpoint**: "Terminating only" toggle is visible and functional. Title updates correctly. Empty state renders cleanly.

---

## Phase 7: US5 — Home Card Terminating Badge (FR-007)

**Goal**: RGD home cards show a small `⊗ N` rose badge when N ≥ 1 instances of that RGD are currently Terminating. Badge disappears when count returns to 0.

**Independent Test**: From the Home page, verify a card with terminating instances shows `⊗ N` in the meta row. Verify the badge `title` on hover reads "N instance(s) terminating". Verify a card with 0 terminating instances shows no badge.

- [x] T021 Modify `web/src/components/RGDCard.tsx` to accept and render the `terminatingCount` prop:
  - Add `terminatingCount?: number` to the `RGDCardProps` interface
  - In `.rgd-card__meta` row: after the existing kind pill, add `{terminatingCount && terminatingCount > 0 ? <span className="rgd-card__terminating-badge" title={`${terminatingCount} instance(s) terminating`}>⊗ {terminatingCount}</span> : null}`
  - Guard: never render when `terminatingCount` is `0`, `undefined`, or absent (AC-015, validation rule from data-model.md)

- [x] T022 Add CSS for the Home card terminating badge in `web/src/components/RGDCard.css`:
  - `.rgd-card__terminating-badge { padding: 2px 6px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; color: var(--color-error); background: var(--node-error-bg); border: 1px solid var(--node-error-border); cursor: default; white-space: nowrap; }`
  - No raw hex/rgba (AC-010)

- [x] T023 Modify `web/src/pages/Home.tsx` to compute and pass `terminatingCount` to each `RGDCard`:
  - The Home page already calls `listInstances(rgdName)` for each card to get the instance count
  - In the same response (or derived from the same list), count instances where `isTerminating(inst)` is `true`: `const terminatingCount = instances.filter(isTerminating).length`
  - Import `isTerminating` from `@/lib/k8s`
  - Pass `terminatingCount={terminatingCount}` to each `<RGDCard>` (pass `0` or omit when count is 0 — either works since the guard in T021 handles both)
  - Run `cd web && bun run tsc --noEmit` after changes

**Checkpoint**: Home card with terminating instances shows `⊗ N` badge with correct hover text. Card with 0 terminating instances shows no badge.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility, and constitution compliance checks across all changes.

- [x] T024 [P] Run full TypeScript typecheck across all modified files: `cd web && bun run tsc --noEmit` — must be clean with zero errors (AC-012)
- [x] T025 [P] Run Go vet: `go vet ./...` — must pass clean (AC-013, no Go changes expected but verify nothing was accidentally touched)
- [x] T026 [P] Audit all new CSS files and modifications against AC-010: grep for any `rgba(`, `#[0-9a-fA-F]`, or `rgb(` literals — must be zero. All colour values must reference named `var(--...)` tokens from `tokens.css`
- [x] T027 [P] Audit all new TypeScript files against AC-014: confirm `isTerminating`, `getFinalizers`, `getDeletionTimestamp`, `isDeletionEvent`, `formatRelativeTime` are imported from `@/lib/k8s` everywhere they are used — not duplicated or re-implemented in any component file
- [x] T028 Build frontend: `make web` — must succeed with no errors
- [x] T029 Build binary: `make go` — must succeed (embeds the compiled frontend)
- [ ] T030 Manual walkthrough of all 7 quickstart.md test scenarios to confirm AC-001 through AC-015

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — read files first
- **Phase 2** (Foundational): Depends on Phase 1 — BLOCKS all phases 3–7
- **Phase 3** (US1 — Banner + Finalizers): Depends on Phase 2 (T006)
- **Phase 4** (US2 — DAG + Panel): Depends on Phase 2 (T006); T012 should precede T013/T015
- **Phase 5** (US3 — Events): Depends on Phase 2 (T006) — completely independent of phases 3, 4, 6, 7
- **Phase 6** (US4 — Filter): Depends on Phase 2 (T006) — completely independent of phases 3, 4, 5, 7
- **Phase 7** (US5 — Home Badge): Depends on Phase 2 (T006) and Phase 3 (T009 `FinalizersPanel` not needed here, but T021's `RGDCard` change is independent); actually fully independent after Phase 2
- **Phase 8** (Polish): Depends on all phases 3–7 complete

### Within Phase 3 (US1)

T007 → T008 (T008 is the CSS companion to T007)  
T009 → T010 (T010 is the CSS companion to T009)  
T007 and T009 can run in parallel (different files)  
T011 depends on T007, T009 (imports both components)

### Within Phase 4 (US2)

T012 (extend `instanceNodeState.ts`) → T013 (read terminating flag in DeepDAG) → T014 (CSS for badge)  
T015 (`LiveNodeDetailPanel`) depends on T009 (`FinalizersPanel`) from Phase 3

### Parallel Opportunities After Phase 2

Once T006 is complete, the following stories can run in any order or in parallel:
- Phase 3 (US1) and Phase 5 (US3) touch completely different files
- Phase 6 (US4) touches `InstanceTable.tsx` and `RGDDetail.tsx` — independent of Phases 3, 4, 5
- Phase 7 (US5) touches `RGDCard.tsx` and `Home.tsx` — independent of Phases 3, 4, 5, 6

---

## Parallel Example: After Phase 2 (T006) completes

```bash
# These stories can be worked simultaneously (all different files):
Phase 3: TerminatingBanner.tsx + FinalizersPanel.tsx + InstanceDetail.tsx
Phase 5: EventsPanel.tsx (isDeletionEvent tagging)
Phase 6: InstanceTable.tsx (Terminating filter toggle)
Phase 7: RGDCard.tsx + Home.tsx (terminatingCount prop)
```

---

## Implementation Strategy

### MVP First (Phase 3 Only — US1)

1. Complete Phase 1: Setup reads
2. Complete Phase 2: `web/src/lib/k8s.ts` (T006)
3. Complete Phase 3: TerminatingBanner + FinalizersPanel + InstanceDetail wiring (T007–T011)
4. **STOP and VALIDATE**: Open instance detail for a Terminating instance → rose banner + finalizer list visible
5. This alone satisfies AC-001 through AC-004 and is independently valuable

### Incremental Delivery Order

1. Phase 2 (foundation) → Phase 3 (instance detail, highest user value)
2. Phase 4 (DAG + slide-in panel, second highest — operators see at a glance which child is stuck)
3. Phase 5 (event tagging, quick win — single file change)
4. Phase 6 (instances filter — helps at scale with many instances)
5. Phase 7 (home card badge — global visibility)
6. Phase 8 (polish)

---

## Notes

- `[P]` tasks within the same phase operate on **different files** and can run concurrently
- `[Story]` label maps each task to the FR it satisfies for traceability to spec.md
- All new colour values must use `var(--token-name)` — zero raw hex or `rgba()` in component CSS
- No new npm dependencies; no new Go dependencies
- `go vet ./...` should be a no-op (no Go files modified) but must still pass
- Verify `tsc --noEmit` after each phase's final task before moving to the next phase
- The `tick` prop pattern (poll-tick memoization) is documented in research.md §5 — do not introduce `setInterval`
