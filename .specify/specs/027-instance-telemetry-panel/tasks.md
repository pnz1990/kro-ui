# Tasks: Instance Telemetry Panel

**Input**: Design documents from `/specs/027-instance-telemetry-panel/`  
**Branch**: `027-instance-telemetry-panel`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1 —
US2 (graceful degradation) is delivered inside the same component and lib module
as US1 (health summary), so their tasks are interleaved. US3 (live ticker) adds
the `setInterval` pattern to the component built in US1/US2 and requires no
additional files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no dependencies)
- **[Story]**: User story label (US1 = health summary, US2 = graceful degradation, US3 = live ticking)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project initialization is needed — this is a pure frontend
addition to an existing project. Phase 1 confirms the integration point and imports.

- [x] T001 Verify `NodeStateMap` is exported from `web/src/lib/instanceNodeState.ts` (needed as prop type in `TelemetryPanel.tsx`) — read-only check, no code change unless export is missing
- [x] T002 Verify `formatAge` is exported from `web/src/lib/format.ts` (reused in `telemetry.ts`) — read-only check

**Checkpoint**: Confirmed import paths for `NodeStateMap` and `formatAge`. Implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure derivation module `telemetry.ts` is shared by both US1
(rendering) and US2 (graceful degradation). Its types and functions MUST be
complete and tested before the React component is written.

- [x] T003 Create `web/src/lib/telemetry.ts` — define and export `ChildHealthSummary` interface plus four pure functions
- [x] T004 Create `web/src/lib/telemetry.test.ts` — table-driven unit tests for all four functions (30 tests, all passing)

**Checkpoint**: `bun run test web/src/lib/telemetry.test.ts` passes. All four functions are green.

---

## Phase 3: User Stories 1 & 2 — Health Summary + Graceful Degradation (Priority: P1) 🎯 MVP

**Goal**: A `TelemetryPanel` component renders 4 metric cells (Age, Time in state,
Children, Warnings) on the instance detail page, displaying live data when present
and graceful fallbacks when absent.

**Independent Test**: Open any live instance detail page. Verify a compact strip
appears above the DAG with all 4 cells. Navigate to an instance with no conditions
— verify Age still renders and all condition-derived cells show "Not reported".
Verify `0/0` renders (not an error) when no children are mapped. Verify the
Warnings cell shows `0` (not blank) for an instance with no Warning events.

### Implementation

- [x] T005 [P] [US1] Create `web/src/components/TelemetryPanel.css` — horizontal flex strip layout; 4 cells; color modifier classes; NO hardcoded hex or `rgba()` literals

- [x] T006 [US1] Create `web/src/components/TelemetryPanel.tsx` — 4 MetricCell sub-components; 1s ticker via setInterval; imports telemetry lib functions

- [x] T007 [P] [US2] Create `web/src/components/TelemetryPanel.test.tsx` — 12 component render tests; all passing

- [x] T008 [US1] Integrate `TelemetryPanel` into `web/src/pages/InstanceDetail.tsx` — imported; rendered inside `!isLoading && fastData &&` fragment before `instance-detail-content`

**Checkpoint**: `bun run typecheck` passes. `bun run test web/src/components/TelemetryPanel.test.tsx` passes. Load any instance detail page — the strip appears above the DAG with all 4 cells rendering correctly. Absent-data paths show "Not reported" / `0/0` / `0`.

---

## Phase 4: User Story 3 — Live Updates (Priority: P2)

**Goal**: The Age cell ticks every second; Time in state and Warnings update on
every 5s poll cycle; no extra API requests are issued by `TelemetryPanel`.

**Independent Test**: Open an instance detail page. Open DevTools Network tab and
confirm no requests fire from `TelemetryPanel`. Watch the Age cell for 60 seconds
and confirm it increments. Navigate away — confirm no more requests fire.

*US3 is fully delivered by the `setInterval` wiring in T006 (the 1s ticker) and
the prop-passing in T008 (each poll cycle passes fresh props). No additional
implementation files are required — this phase adds only the timer validation test.*

- [x] T009 [US3] Extend `web/src/components/TelemetryPanel.test.tsx` — 3 timer tests: setInterval called with 1000ms, clearInterval on unmount, age updates after tick; all passing

**Checkpoint**: Timer tests pass. No runaway intervals observed in manual test after navigation.

---

## Phase 4b: Spec Clarification Follow-up (GH #161)

**Background**: GH issue #161 revealed that AC-003 was ambiguous about the Children
denominator. The spec has been updated (FR-005 / FR-010 / AC-003 / SC-004) to be
explicit: the denominator is the `NodeStateMap` size (label-search result count), not
the RGD `spec.resources` count. The existing implementation already uses `NodeStateMap`
correctly, so only the tooltip and one test need to be added.

- [ ] T016 [FR-010] Add optional `title` prop to `MetricCell` sub-component in
  `web/src/components/TelemetryPanel.tsx`; forward it to the root `<div>`

- [ ] T017 [FR-010] Pass `title` to the Children `MetricCell` in `TelemetryPanel`:
  `title={`${total} child Kubernetes object(s) found via kro.run/instance-name label`}`

- [ ] T018 [FR-010] Add component test: `it('children cell title attribute describes label-search count')` in `TelemetryPanel.test.tsx`; assert `data-testid="telemetry-cell-children"` element has the expected `title` value

- [ ] T019 Run `bun run typecheck` and `bun run test` after T016–T018; confirm all pass

**Checkpoint**: Children cell has a `title` attribute visible on hover. Test T018 passes. No TypeScript errors.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, build hygiene, and constitution compliance.

- [x] T010 [P] Run `bun run typecheck` (`tsc --noEmit`) and resolve any TypeScript errors in new/modified files
- [x] T011 [P] Verify `TelemetryPanel.css` has zero hardcoded hex values or `rgba()` literals (constitution §IX); add any missing color tokens to `web/src/tokens.css` if needed
- [x] T012 [P] Verify `web/src/pages/InstanceDetail.tsx` `document.title` is unchanged after adding `TelemetryPanel` (no page title regression)
- [x] T013 Run `go vet ./...` and `go test -race ./...` to confirm backend is untouched (no regressions)
- [x] T014 [P] Run full test suite `bun run test` and confirm all tests pass including new telemetry tests
- [x] T015 Run `go build ./...` to produce a working binary; smoke-test `kro-ui serve` shows instance detail page with telemetry strip

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 are read-only verifications that can run in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1; T003 must complete before T004 (tests import from `telemetry.ts`)
- **Phase 3 (US1 + US2 MVP)**: Depends on Phase 2; T005 and T007 are parallelizable; T006 depends on T003 (lib module); T008 depends on T006
- **Phase 4 (US3)**: T009 extends T007 — can run immediately after T007 completes; no new files
- **Phase 5 (Polish)**: All T010–T015 can run in parallel once Phase 3 + 4 are complete (T013 can run anytime — no backend changes)

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (telemetry.ts); delivers the visual strip + real data rendering
- **US2 (P1)**: Delivered inside US1 components (T003 + T006 + T007 handle all absent-data paths); no additional files
- **US3 (P2)**: Delivered by the 1s `setInterval` already inside T006; T009 is the only additional task — adds timer validation

### Within Phase 3 parallel opportunities

```
After T003 (telemetry.ts) completes:

T005 (CSS)   — parallel; no deps
T006 (TSX)   — depends on T003; start after lib
T007 (tests) — depends on T003; parallel to T006

After T006:
T008 (InstanceDetail integration) — depends on T006
```

---

## Parallel Example: Phase 3 (US1 + US2)

```
# After Phase 2 completes (telemetry.ts written):

Stream A:
  Task T005: "Create web/src/components/TelemetryPanel.css"
  Task T006: "Create web/src/components/TelemetryPanel.tsx"
  Task T008: "Integrate TelemetryPanel into web/src/pages/InstanceDetail.tsx"

Stream B (parallel to T005/T006):
  Task T007: "Create web/src/components/TelemetryPanel.test.tsx"
  Task T009: "Extend TelemetryPanel.test.tsx with timer tests"
```

---

## Implementation Strategy

### MVP First (US1 only — minimal viable strip)

1. Complete Phase 1: Verify exports (T001, T002)
2. Complete Phase 2: Write `telemetry.ts` + tests (T003, T004)
3. Complete Phase 3: CSS + Component + Integration (T005, T006, T007, T008)
4. **STOP and VALIDATE**: Instance detail page shows telemetry strip with real values and graceful fallbacks
5. US2 is already done (delivered within US1 tasks)
6. US3 ticking is already wired (1s interval inside T006); T009 adds test coverage only

### Incremental Delivery

1. Phase 1 + 2 → pure lib module ready; testable without React
2. Phase 3 → strip visible on instance detail page; feature is shippable
3. Phase 4 → timer test coverage added (no user-visible change)
4. Phase 5 → build hygiene sign-off; PR-ready

### Notes

- The 1s `setInterval` in `TelemetryPanel` runs independently of the 5s poll —
  the Age and Time-in-state cells tick every second even between poll cycles
- `nodeStateMap` is already computed in `InstanceDetail.tsx` at line 194 (via
  `buildNodeStateMap`); passing it as a prop to `TelemetryPanel` adds zero cost
- `countWarningEvents` must handle `events.items` being `undefined` gracefully
  (the `K8sList` type allows it); use `events.items ?? []` defensively
- All CSS value classes (alive/error/warning/muted) should be defined as modifier
  classes (e.g. `.telemetry-panel__value--alive`) that set `color: var(--color-alive)`
  rather than inline styles — keeps the component CSS-className-driven, not style-prop-driven
