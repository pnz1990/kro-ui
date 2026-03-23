# Tasks: readyWhen CEL Expressions on DAG Nodes

**Input**: Design documents from `/specs/021-readywhen-cel-dag/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ui-contracts.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the 4 new design tokens to `tokens.css` and fix the pre-existing `rgba()` violation that this feature touches. These changes unblock all three user stories and must land first.

- [x] T001 Add tokens `--shadow-tooltip`, `--shadow-panel`, `--color-ready-when`, `--z-tooltip` to `:root` block in `web/src/tokens.css` (dark-mode values: `0 4px 16px rgba(0,0,0,0.45)`, `-4px 0 16px rgba(0,0,0,0.3)`, `#f59e0b`, `200`)
- [x] T002 Add the same four tokens to the `[data-theme="light"]` block in `web/src/tokens.css` (light-mode values: `0 4px 12px rgba(0,0,0,0.15)`, `-4px 0 16px rgba(0,0,0,0.08)`, `#d97706`, `200`)
- [x] T003 Fix pre-existing anti-pattern in `web/src/components/NodeDetailPanel.css` line 21: replace `box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3)` with `box-shadow: var(--shadow-panel)`

**Checkpoint**: `bun typecheck` passes; `--shadow-panel`, `--shadow-tooltip`, `--color-ready-when`, `--z-tooltip` tokens are resolvable. All three user stories can now begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `DAGTooltip` shared component. This is the single shared implementation that all three graph components (`DAGGraph`, `LiveDAG`, `DeepDAG`) depend on. Must be complete before any graph component is wired up.

**⚠️ CRITICAL**: US1 (tooltip) and US3 (badge) both depend on this phase. US2 (panel sections) can proceed in parallel after Phase 1.

- [x] T004 Create `web/src/components/DAGTooltip.tsx`
- [x] T005 Add `useEffect` inside `DAGTooltip.tsx` that fires after render: measures the tooltip `<div>` via `getBoundingClientRect()`, clamps `left` if `right > window.innerWidth - 8` (flip leftward), clamps `top` if `bottom > window.innerHeight - 8` (flip upward), then adds class `dag-tooltip--visible` to make `opacity: 1`.
- [x] T006 Create `web/src/components/DAGTooltip.css`

**Checkpoint**: `DAGTooltip` renders correctly in isolation when passed a node with `readyWhen`. `bun typecheck` passes. US1 and US3 can now proceed.

---

## Phase 3: User Story 1 — Hover tooltip on DAG nodes (Priority: P1) 🎯 MVP

**Goal**: All three graph components show a viewport-clamped, portal-rendered, CEL-highlighted tooltip on hover over any node with `readyWhen` expressions.

**Independent Test**: Open the RGD detail page for the `test-app` RGD (which has `readyWhen` on `appNamespace`). Hover over the `appNamespace` node. A tooltip appears showing "Ready When" with the highlighted expression. Move the pointer away — tooltip disappears. Hover over the root `schema` node (no `readyWhen`) — no tooltip appears.

- [x] T007 [US1] Wire hover state into `web/src/components/DAGGraph.tsx`
- [x] T008 [US1] Add `onMouseEnter` and `onMouseLeave` handlers to the `<g>` element inside `NodeGroup` in `web/src/components/DAGGraph.tsx`
- [x] T009 [US1] Render `<DAGTooltip>` in `web/src/components/DAGGraph.tsx`
- [x] T010 [P] [US1] Repeat T007–T009 for `web/src/components/LiveDAG.tsx`
- [x] T011 [P] [US1] Repeat T007–T009 for `web/src/components/DeepDAG.tsx`
- [x] T012 [US1] Update `web/src/components/DAGGraph.test.tsx`: add tooltip and badge tests

**Checkpoint**: Hover over a `readyWhen` node in the static RGD graph, live instance graph, and deep graph — tooltip appears with highlighted CEL. Hover a node without `readyWhen` — no tooltip. `bun typecheck` passes, Vitest passes.

---

## Phase 4: User Story 2 — "Ready When" section in detail panels (Priority: P2)

**Goal**: The "CEL Expressions" merged block in both `NodeDetailPanel` and `LiveNodeDetailPanel` is replaced with up to four independent, labelled sections: "Ready When", "Include When", "forEach", "Status Projections".

**Independent Test**: Click a node with `readyWhen` in the static RGD detail view — the detail panel shows a "Ready When" section heading above the highlighted expression, separately from any "Include When" section. Click a node with only `includeWhen` — only "Include When" section appears, no "Ready When". Click a node with neither — neither section heading appears.

*Note: US2 can start after Phase 1 (tokens), independent of Phase 2 (DAGTooltip) and US1 (hover wiring).*

- [x] T013 [US2] Replace the merged `celCode` block in `web/src/components/NodeDetailPanel.tsx` with four independently conditional `<Section>` blocks
- [x] T014 [US2] Apply the identical section split to `web/src/components/LiveNodeDetailPanel.tsx`
- [x] T015 [US2] Update `web/src/components/NodeDetailPanel.test.tsx`: remove assertions on the old "CEL Expressions" section label; add assertions for "Ready When", "Include When", "forEach", "Status Projections" labels

**Checkpoint**: Click any node in static or live graphs — detail panel shows correctly labelled independent sections. "Ready When" is visually distinct from "Include When". Nodes with no CEL data show no section headings. `bun typecheck` passes, Vitest passes.

---

## Phase 5: User Story 3 — Visual indicator badge on readyWhen nodes (Priority: P3)

**Goal**: Nodes with `hasReadyWhen: true` carry a small `⧖` badge at the bottom-left of the node shape in all three graph views.

**Independent Test**: Open the RGD detail graph for `test-app`. The `appNamespace` node (which has `readyWhen`) shows a small `⧖` badge. The other nodes (no `readyWhen`) show no such badge. No tooltip or panel interaction is required to see the badge.

- [x] T016 [P] [US3] Add `readyWhen` badge to `NodeGroup` in `web/src/components/DAGGraph.tsx`
- [x] T017 [P] [US3] Add the same `readyWhen` badge block to `NodeGroup` in `web/src/components/LiveDAG.tsx`
- [x] T018 [P] [US3] Add the same `readyWhen` badge block to the standard-node render path in `web/src/components/DeepDAG.tsx`
- [x] T019 [P] [US3] Add `.dag-node-badge--ready-when { fill: var(--color-ready-when); }` to `web/src/components/DAGGraph.css`
- [x] T020 [P] [US3] Add the same `.dag-node-badge--ready-when` rule to `web/src/components/LiveDAG.css`
- [x] T021 [US3] Update `web/src/components/DAGGraph.test.tsx`: badge tests added (T021a, T021b)

**Checkpoint**: Visual badge visible on `readyWhen` nodes in all three graph views. No badge on nodes without `readyWhen`. Badge does not overlap the node type badge (different position: bottom-left vs top-right). `bun typecheck` passes, Vitest passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, cleanup, and final build validation.

- [x] T022 [P] Run `bun typecheck` — PASS (0 errors)
- [x] T023 [P] Run `cd web && bun run test` (Vitest) — PASS (363/363 tests)
- [x] T024 Verify no hardcoded `rgba()` or hex values exist in `DAGTooltip.css`, `DAGGraph.css`, `LiveDAG.css` — PASS
- [x] T025 Verify `DAGTooltip.tsx` is the single import used in all three graph components — PASS (one import each)
- [x] T026 Verify the `--shadow-panel` fix in `NodeDetailPanel.css` — PASS (no rgba() on line 21)
- [x] T027 Manual smoke test: run `make build` — PASS (binary builds, 363 tests pass)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (tokens)      — no dependencies; start immediately
Phase 2 (DAGTooltip)  — depends on Phase 1 (uses token vars in CSS)
Phase 3 (US1 hover)   — depends on Phase 2 (imports DAGTooltip)
Phase 4 (US2 panels)  — depends on Phase 1 only; CAN run in parallel with Phase 2 + Phase 3
Phase 5 (US3 badge)   — depends on Phase 1 only; CAN run in parallel with Phase 2 + Phase 3 + Phase 4
Phase 6 (polish)      — depends on all prior phases
```

### User Story Dependencies

- **US1 (Hover tooltip)**: Depends on Phase 2 (DAGTooltip component) → which depends on Phase 1
- **US2 (Panel sections)**: Depends on Phase 1 only — independent of US1 and DAGTooltip
- **US3 (Badge indicator)**: Depends on Phase 1 only — independent of US1 and US2

### Within Each Phase

- T001 before T002 (same file, `:root` before `light` block for readability — can be done in one edit pass)
- T004 before T005 before T006 (T005 modifies T004's component; T006 is CSS only, parallelizable with T004/T005)
- T007 before T008 before T009 (same file, sequential)
- T010 and T011 are [P] — different files from T007–T009 and from each other
- T013 and T014 are independent files — can be done in parallel
- T016, T017, T018, T019, T020 are all [P] — different files

### Parallel Opportunities

Within Phase 3 (US1): T010 (LiveDAG wiring) and T011 (DeepDAG wiring) can run in parallel after T009 (DAGGraph wiring) is complete — different files.

Within Phase 4 (US2): T013 (NodeDetailPanel) and T014 (LiveNodeDetailPanel) are independent files and can run in parallel.

Within Phase 5 (US3): T016, T017, T018 (badge in three graph components) and T019, T020 (CSS) are all independent files — all five tasks can run in parallel.

After Phase 1: Phase 4 (US2) can begin immediately — it does not need DAGTooltip or any Phase 2/3 work.

---

## Parallel Example: Phase 3 (US1)

```
# After T009 (DAGGraph hover wiring) is complete:
Parallel task A: T010 — Wire hover into LiveDAG.tsx
Parallel task B: T011 — Wire hover into DeepDAG.tsx
# Then merge results and run T012 (tests)
```

## Parallel Example: Phase 5 (US3)

```
# All five tasks can run simultaneously:
Parallel A: T016 — DAGGraph.tsx badge
Parallel B: T017 — LiveDAG.tsx badge
Parallel C: T018 — DeepDAG.tsx badge
Parallel D: T019 — DAGGraph.css badge style
Parallel E: T020 — LiveDAG.css badge style
# Then T021 (test update)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Token additions (T001–T003) — ~5 min
2. Complete Phase 2: DAGTooltip component (T004–T006) — ~30 min
3. Complete Phase 3: Wire hover in DAGGraph + LiveDAG + DeepDAG (T007–T012) — ~45 min
4. **STOP and VALIDATE**: Hover over `appNamespace` node in static and live graphs; tooltip appears with highlighted CEL
5. Submit MVP PR if desired

### Incremental Delivery

1. Phase 1 + 2 + 3 → Hover tooltip working (US1 MVP)
2. Phase 4 → Panel sections split (US2) — panel becomes clearer
3. Phase 5 → Badge visible on graph nodes (US3) — at-a-glance indicator
4. Phase 6 → Final polish and build validation

### Single-developer Sequential Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027

---

## Notes

- `[P]` tasks operate on different files with no shared incomplete dependencies
- Each User Story phase is independently completable and testable
- T003 fixes a pre-existing rgba() violation — it is included here since `NodeDetailPanel.css` is being touched in US2 anyway; landing it in Phase 1 keeps the fix atomic
- No Go/backend files are modified by any task in this list
- The E2E fixture already has `readyWhen` on `appNamespace` — no fixture changes needed
- After T027, the feature is complete and ready for PR creation
