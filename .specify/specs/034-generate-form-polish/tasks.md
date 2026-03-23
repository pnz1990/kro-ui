# Tasks: Generate Form Polish + DAG Legend + Overlay Fixes (034-generate-form-polish)

**Input**: Design documents from `.specify/specs/034-generate-form-polish/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Unit test updates are included where existing tests will break due to new `aria-required`
attributes. New component tests included for `DAGLegend` and the accordion behavior change.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.
Stories are ordered P0 (crash fix) → P1 → P2 so each phase is independently shippable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Verify the build is green before any changes; confirm test baseline.

- [ ] T001 Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors on the unmodified branch
- [ ] T002 Run `bun run --cwd web test` — confirm all existing tests pass (establish baseline)

**Checkpoint**: Build is green. All existing tests pass. Safe to begin changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared infrastructure to create — this spec modifies existing components.
The only foundational step is understanding the exact call site for the null-crash fix so
all other phases can reference the correct line.

- [ ] T003 Read `web/src/pages/RGDDetail.tsx` lines 226–242 and `web/src/components/StaticChainDAG.tsx` lines 222–236 to confirm exact edit locations before any changes are made

**Checkpoint**: Edit locations confirmed. All user story phases may now proceed.

---

## Phase 3: User Story 4 — Overlay null-crash fix (Priority: P0 — crash) 🚨

**Goal**: Selecting any overlay instance never shows "Overlay failed: t is not iterable".
Fix: coerce `childrenRes.items ?? []` before `buildNodeStateMap` in `RGDDetail.tsx`.

**Independent Test**: Open `dungeon-graph` → Graph tab → select any instance overlay →
confirm no error message. Node states may show `not-found` gray rings if no children
returned — that is correct.

### Implementation for User Story 4

- [x] T004 [US4] In `web/src/pages/RGDDetail.tsx` line ~232, change
  `buildNodeStateMap(instance, childrenRes.items)` to
  `buildNodeStateMap(instance, childrenRes.items ?? [])` — one-character fix that prevents
  "t is not iterable" when the `/children` endpoint returns `{"items": null}`
- [x] T005 [US4] Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors after the fix
- [ ] T006 [US4] Manual verify: open `dungeon-graph` → Graph tab → select overlay → confirm
  no "Overlay failed" message appears (quickstart.md Area 4, step 3)

**Checkpoint**: Overlay crash is fixed. Selecting any instance overlay works without error.

---

## Phase 4: User Story 5 — Expand accordion behavior (Priority: P1 — layout fix)

**Goal**: Expanding two chainable nodes simultaneously no longer produces visual overlap.
`StaticChainDAG` uses accordion behavior — only one subgraph open at a time.

**Independent Test**: Open `dungeon-graph` → expand `monsterCRs` → then expand `bossCR` →
confirm `monsterCRs` collapses automatically. No overlap visible. SVG height shrinks when
node is collapsed.

### Implementation for User Story 5

- [x] T007 [US5] In `web/src/components/StaticChainDAG.tsx`, replace `handleToggle` body
- [x] T008 [US5] In `web/src/components/StaticChainDAG.test.tsx`, add accordion tests
- [x] T009 [US5] Run `bun run --cwd web test src/components/StaticChainDAG.test.tsx` — 15/15 pass
- [x] T010 [US5] Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors

**Checkpoint**: Accordion expand works. No overlap possible. Existing expand tests still pass.

---

## Phase 5: User Story 3 — DAG legend for node badges (Priority: P1 — issue #118)

**Goal**: A compact `DAGLegend` component appears below the static chain DAG on the Graph tab,
explaining `?` (conditional), `∀` (forEach), `⬡` (external ref) badge symbols.

**Independent Test**: Open any RGD → Graph tab → confirm legend row visible below the SVG
with all three entries. Open a nested subgraph expand (if available) — confirm legend does
NOT appear inside nested content.

### Implementation for User Story 3

- [x] T011 [P] [US3] Create `web/src/components/DAGLegend.tsx`
- [x] T012 [P] [US3] Create `web/src/components/DAGLegend.css`
- [x] T013 [US3] Wire `DAGLegend` into `StaticChainDAG.tsx` at `depth === 0`
- [x] T014 [US3] Create `web/src/components/DAGLegend.test.tsx` — 5 tests
- [x] T015 [US3] Run `bun run --cwd web test src/components/DAGLegend.test.tsx` — 5/5 pass
- [x] T016 [US3] Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors

**Checkpoint**: DAG legend visible on Graph tab. Issue #118 resolved.

---

## Phase 6: User Story 1 — Required field legend + accessibility (Priority: P1 — issue #121)

**Goal**: The Instance Form shows a visible `● required / ● optional` legend, all required
form controls carry `aria-required="true"`, and `●` spans have descriptive `title` attributes.

**Independent Test**: Open any RGD → Generate tab → Instance Form → confirm legend row above
field list. Open DevTools, inspect a required input → `aria-required="true"` present.
Hover `●` next to required field → tooltip reads "Required field".

### Implementation for User Story 1

- [x] T017 [US1] Add legend `<div>` between metadata.name row and spec-fields block in `web/src/components/InstanceForm.tsx`
- [x] T018 [US1] Update `●` span `title` attrs to "Required field" / "Optional field" in `InstanceForm.tsx`
- [x] T019 [US1] Add `aria-required={isRequired}` to all non-boolean controls in `FieldRow`
- [x] T020 [US1] Add `aria-required="true"` to `metadata.name` input
- [x] T021 [US1] Add `.instance-form__legend` CSS to `web/src/components/InstanceForm.css`
- [x] T022 [US1] Review `web/src/components/GenerateTab.test.tsx` — no changes needed, all 19 pass
- [x] T023 [US1] Run `bun run --cwd web test src/components/GenerateTab.test.tsx` — 19/19 pass
- [x] T024 [US1] Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors

**Checkpoint**: Required-field legend visible. All required inputs are accessible. Issue #121 partially resolved.

---

## Phase 7: User Story 2 — RGDAuthoringForm "req" label (Priority: P2 — issue #121)

**Goal**: The required-checkbox label in the RGD Authoring form reads `Required` (not `req`).

**Independent Test**: Open Generate tab → New RGD mode → click `+ Add Field` → confirm
label next to the required checkbox reads `Required`.

### Implementation for User Story 2

- [x] T025 [US2] In `web/src/components/RGDAuthoringForm.tsx`, change label text `req` → `Required`
- [x] T026 [US2] Run `bun run --cwd web tsc --noEmit` — confirm 0 type errors

**Checkpoint**: All five user stories complete. Issues #118 and #121 fully resolved.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, full test run, and CI readiness check.

- [x] T027 [P] Run full test suite: `bun run --cwd web test` — 632 pass, 9 pre-existing Home.test failures (unchanged from baseline), 0 new failures
- [x] T028 [P] Run `bun run --cwd web tsc --noEmit` — 0 type errors
- [x] T029 Audit all new/changed `.css` files for any `rgba()` or hex color literals — none found
- [ ] T030 Manual quickstart validation per `.specify/specs/034-generate-form-polish/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (baseline established)
- **Phase 3 (US4 — crash fix)**: Depends on Phase 2. Single-line fix, independently shippable
- **Phase 4 (US5 — accordion)**: Depends on Phase 2. Can run in parallel with Phase 3
- **Phase 5 (US3 — DAG legend)**: Depends on Phase 2. Can run in parallel with Phases 3–4
- **Phase 6 (US1 — required legend)**: Depends on Phase 2. Can run in parallel with Phases 3–5
- **Phase 7 (US2 — req label)**: Depends on Phase 2. Trivial, can run at any time
- **Phase 8 (Polish)**: Depends on all Phases 3–7

### User Story Dependencies

- **US4 (P0 crash)**: Only requires Phase 2 done. No dependency on other stories
- **US5 (P1 accordion)**: Only requires Phase 2 done. No dependency on other stories
- **US3 (P1 DAG legend)**: Only requires Phase 2 done. No dependency on other stories
- **US1 (P1 required legend)**: Only requires Phase 2 done. No dependency on other stories
- **US2 (P2 req label)**: Only requires Phase 2 done. Single file, one-word change

### Within Each User Story

- Implementation before test updates (tests observe changed output)
- CSS before component (component imports CSS)
- Leaf component (`DAGLegend`) before parent (`StaticChainDAG`)

### Parallel Opportunities

```bash
# Phases 3–7 can all run in parallel after Phase 2:
Phase 3: Fix RGDDetail.tsx (childrenRes.items ?? [])
Phase 4: Fix StaticChainDAG.tsx accordion + test
Phase 5: Create DAGLegend.tsx + DAGLegend.css + wire into StaticChainDAG + test
Phase 6: Fix InstanceForm.tsx legend + aria-required + css + update test
Phase 7: Fix RGDAuthoringForm.tsx label text

# Within Phase 5:
T011: Create DAGLegend.tsx
T012: Create DAGLegend.css   ← parallel with T011 (different files)
```

---

## Implementation Strategy

### MVP First (crash fix — US4, one line)

1. Complete Phase 1: Setup (confirm baseline)
2. Complete Phase 2: Foundational (confirm edit location)
3. Complete Phase 3: US4 crash fix (T004–T006)
4. **STOP and VALIDATE**: Overlay no longer crashes — shippable immediately

### Recommended Sequential Order (single developer)

```
T001 → T002 → T003
→ T004 → T005 → T006            (crash fix, shippable)
→ T007 → T008 → T009 → T010     (accordion)
→ T011 + T012 (parallel) → T013 → T014 → T015 → T016   (DAG legend)
→ T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024  (required legend)
→ T025 → T026                    (req label)
→ T027 + T028 (parallel) → T029 → T030   (polish)
```

### Parallel Team Strategy (two developers)

```
After T003:
Developer A: T004–T006 (crash fix) then T007–T010 (accordion)
Developer B: T011–T016 (DAG legend) then T017–T026 (form polish)
Merge: T027–T030
```

---

## Notes

- `[P]` tasks operate on different files and have no incomplete task dependencies
- `[Story]` label maps to user stories from `spec.md` for traceability
- All CSS changes must use `tokens.css` custom properties — no inline hex/rgba
- The `aria-required` attribute on checkboxes is intentionally omitted (booleans always have a value)
- `DAGLegend` must only appear at `depth === 0` in `StaticChainDAG` — do not pass it to `NestedSubgraph`
- The accordion change is backward-compatible: if only one node was ever expanded, behavior is unchanged
- Commit after each phase checkpoint at minimum
