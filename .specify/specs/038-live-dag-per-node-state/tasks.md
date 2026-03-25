# Tasks: 038-live-dag-per-node-state

**Input**: Design documents from `.specify/specs/038-live-dag-per-node-state/`
**Branch**: `038-live-dag-per-node-state`
**Stack**: TypeScript 5.x + React 19 + Vite (frontend-only; no backend changes)
**Affected files**: 7 existing files, 0 new files

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on other incomplete tasks)
- **[Story]**: Which user story this task belongs to
- No tests requested — test tasks omitted

---

## Phase 1: Setup

**Purpose**: Verify the working environment is ready; no new project structure needed.

- [x] T001 Verify `bun run typecheck` passes with 0 errors before any changes (baseline): run `cd web && bun run typecheck`
- [x] T002 Verify `bun run test` passes before any changes (baseline): run `cd web && bun run test`

---

## Phase 2: Foundational — Extend `NodeLiveState` type

**Purpose**: The `'pending'` union member must be added to `NodeLiveState` first.
Every downstream task (US1, US2, US3) depends on the type being correct so
TypeScript exhaustiveness checks work during implementation.

**⚠️ CRITICAL**: All user story tasks depend on T003 being complete.

- [x] T003 Add `'pending'` to the `NodeLiveState` union type in `web/src/lib/instanceNodeState.ts` (line 22) — after `'error'`, before `'not-found'`; update the JSDoc table in the same block to document the new state

**Checkpoint**: After T003, `bun run typecheck` will report exhaustiveness errors in
`liveStateClass()` and `stateClass()` — those are the guide for US2/US3 work.

---

## Phase 3: User Story 1 — Per-node condition inspection (P1) 🎯 MVP

**Goal**: Each child resource gets its own state based on its own `status.conditions`
when the instance-level global state is `'alive'`. Absent nodes with `includeWhen`
expressions are classified as `'pending'` instead of `'not-found'`.

**Independent Test**:
1. `bun run typecheck` passes with 0 errors after these changes
2. `bun run test` passes (existing unit tests for `buildNodeStateMap` still green)
3. In the browser: navigate to a live instance where one managed Deployment has
   `Available=False` — only that node shows a rose ring while others stay green

### Implementation for User Story 1

- [x] T004 [US1] Add a `getChildConditions()` helper function in `web/src/lib/instanceNodeState.ts` that reads `status.conditions` from a child `K8sObject`, reusing the existing `K8sCondition` interface and `getConditions()` pattern already present in the file
- [x] T005 [US1] Add a `deriveChildState()` helper function in `web/src/lib/instanceNodeState.ts` that takes a child's conditions array and returns a `NodeLiveState`; precedence: `Ready=False` or `Available=False` → `'error'`; `Progressing=True` → `'reconciling'`; otherwise `'alive'`
- [x] T006 [US1] Update Step 2 of `buildNodeStateMap()` in `web/src/lib/instanceNodeState.ts` (lines 116–157): when `globalState === 'alive'` and child is not terminating, call `deriveChildState()` on the child's conditions instead of using `presentState` directly
- [x] T007 [US1] Update Step 3 of `buildNodeStateMap()` in `web/src/lib/instanceNodeState.ts` (lines 159–177): replace the unconditional `state: 'not-found'` with conditional logic — if `node.includeWhen.some(e => e.trim() !== '')` then `state: 'pending'`, else `state: 'not-found'`
- [x] T008 [US1] Update the block comment header of `buildNodeStateMap()` in `web/src/lib/instanceNodeState.ts` to document the updated algorithm: per-node condition inspection when globalState is `'alive'`, and the `pending` vs `not-found` distinction for absent nodes

**Checkpoint**: User Story 1 complete when `bun run typecheck` and `bun run test` both pass and `buildNodeStateMap()` produces distinct states per child.

---

## Phase 4: User Story 2 — `pending` state visual & CSS class (P1)

**Goal**: The `'pending'` state maps to the violet dashed CSS ring using the
existing `--node-pending-bg` and `--node-pending-border` tokens. The tooltip
shows a violet "Pending" label. TypeScript exhaustiveness errors from T003 are
resolved.

**Independent Test**:
1. `bun run typecheck` passes with 0 errors (exhaustiveness errors from T003 resolved)
2. In the browser on a DAG with `includeWhen`-excluded nodes: excluded nodes show
   a violet dashed ring (distinct from the gray dashed `not-found` ring)
3. Hovering an excluded node shows "Pending" in violet in the tooltip

### Implementation for User Story 2

- [x] T009 [P] [US2] Extend `liveStateClass()` in `web/src/lib/dag.ts` (line ~624): add `case 'pending': return 'dag-node-live--pending'` to the switch statement; verify TypeScript exhaustiveness check is now satisfied
- [x] T010 [P] [US2] Add `.dag-node-live--pending` CSS rule to `web/src/components/LiveDAG.css` after the existing `.dag-node-live--notfound` block: use `fill: var(--node-pending-bg); stroke: var(--node-pending-border); stroke-dasharray: 6 3;` — same dashed pattern as `--notfound` but violet
- [x] T011 [P] [US2] Extend `stateClass()` in `web/src/components/DAGTooltip.tsx` (line ~64): add `case 'pending': return 'pending'` to the switch
- [x] T012 [P] [US2] Extend `STATE_LABEL` in `web/src/components/DAGTooltip.tsx` (line ~73): add `pending: 'Pending'` to the record
- [x] T013 [P] [US2] Add `.dag-tooltip__state--pending` rule to `web/src/components/LiveDAG.css` (where existing tooltip state rules live) after the existing `--notfound` rule: `color: var(--color-pending);`

**Checkpoint**: User Story 2 complete when `bun run typecheck` reports 0 errors (exhaustiveness satisfied) and the violet dashed ring renders for excluded nodes.

---

## Phase 5: User Story 3 — Live state label in tooltip (P2)

**Goal**: Hovering any node in `LiveDAG` and `DeepDAG` shows the "State: …"
line in the tooltip for all 5 states (alive/reconciling/error/pending/not-found).
Previously the `nodeState` prop was not passed at either call site.

**Independent Test**:
1. `bun run typecheck` passes
2. In the browser: hover any node in the live DAG — the tooltip shows a state
   label with the correct colour for all states including the root CR node
3. Same behaviour in the Deep DAG (chained instance expansion)

### Implementation for User Story 3

- [x] T014 [P] [US3] In `web/src/components/LiveDAG.tsx` (lines 278–284): pass `nodeState={hoveredTooltip?.node ? nodeStateForNode(hoveredTooltip.node, nodeStateMap) : undefined}` to the `<DAGTooltip>` call — `nodeStateForNode` is already imported at line 13
- [x] T015 [P] [US3] In `web/src/components/DeepDAG.tsx`: locate the `<DAGTooltip>` call site and pass `nodeState` using the same pattern — call `nodeStateForNode(hoveredTooltip.node, nodeStateMap)` where `nodeStateMap` is the prop received by the component

**Checkpoint**: User Story 3 complete when the state label appears on hover in both LiveDAG and DeepDAG for all 5 node states.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 Run `cd web && bun run typecheck` — must report 0 errors across all 7 modified files
- [x] T017 Run `cd web && bun run test` — all existing tests must pass; no new test failures
- [x] T018 Run `make build` — full Go + frontend build must succeed
- [x] T019 [P] Verify `tokens.css` is unchanged (no new tokens needed — `--node-pending-bg`, `--node-pending-border`, `--color-pending` already defined): run `git diff web/src/tokens.css` and confirm empty output
- [x] T020 [P] Verify no inline hex or `rgba()` colors were introduced in any modified CSS file: run `git diff -- '*.css'` and confirm no raw hex or rgba values appear outside of tokens.css

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories (T003 must land first)
- **Phase 3 (US1)**: Depends on T003 — `instanceNodeState.ts` algorithm changes
- **Phase 4 (US2)**: Depends on T003 — CSS class + tooltip label for `'pending'`
- **Phase 5 (US3)**: Depends on Phase 4 (tooltip labels must be wired before testing them); also benefits from US1 data being correct
- **Phase 6 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Phase 3)**: Independent after T003 — touches only `instanceNodeState.ts`
- **US2 (Phase 4)**: Independent after T003 — touches `dag.ts`, `LiveDAG.css`, `DAGTooltip.tsx/.css`
- **US3 (Phase 5)**: Independent after T003 — touches `LiveDAG.tsx`, `DeepDAG.tsx`
- US1, US2, US3 touch **different files** and can be executed in parallel once T003 is done

### Within Each User Story

- US1: T004 → T005 → T006 → T007 → T008 (sequential — each step builds on the previous helper)
- US2: T009, T010, T011, T012, T013 are all [P] — different files, fully parallel
- US3: T014, T015 are both [P] — different component files

### Parallel Opportunities

Once T003 is complete, all three stories can start simultaneously:

```bash
# Parallel after T003:
Task: "US1 — per-node condition inspection (T004–T008)"   # instanceNodeState.ts
Task: "US2 — pending CSS + tooltip (T009–T013)"           # dag.ts, LiveDAG.css, DAGTooltip.tsx/.css
Task: "US3 — tooltip wiring (T014–T015)"                  # LiveDAG.tsx, DeepDAG.tsx
```

Within US2, all 5 tasks are fully parallel (different files):

```bash
Task: "T009 — liveStateClass() pending case in dag.ts"
Task: "T010 — dag-node-live--pending CSS in LiveDAG.css"
Task: "T011 — stateClass() pending case in DAGTooltip.tsx"
Task: "T012 — STATE_LABEL pending entry in DAGTooltip.tsx"
Task: "T013 — dag-tooltip__state--pending CSS in DAGTooltip.css"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all three are small)

This spec is deliberately scoped to a small set of focused changes. All three
user stories touch fewer than 10 lines each and can be completed in a single
session:

1. Complete Phase 1: baseline verification (T001, T002)
2. Complete Phase 2: add `'pending'` to `NodeLiveState` (T003) — 1 line change
3. Complete Phase 3 (US1): update `buildNodeStateMap()` algorithm (T004–T008)
4. Complete Phase 4 (US2): add CSS class + tooltip label (T009–T013)
5. Complete Phase 5 (US3): wire `nodeState` into both tooltips (T014–T015)
6. Complete Phase 6: typecheck + test + build validation (T016–T020)

### Incremental Delivery

After T003 + US1 (T004–T008): per-node condition state is computed correctly.
After US2 (T009–T013): `pending` nodes render with violet dashed ring.
After US3 (T014–T015): every tooltip shows the state label.

Each increment leaves the build in a working state with no broken types.

---

## Notes

- [P] tasks touch different files — safe to implement simultaneously
- T003 is the single gating task; its 1-line type change unlocks all parallel work
- No new files, no new npm deps, no backend changes
- `tokens.css` is explicitly excluded from changes — all visual tokens pre-exist
- TypeScript exhaustiveness on the `switch` in `liveStateClass()` will guide US2 implementation — the compiler error after T003 points to exactly the right location
- Commit after each phase; conventional commit prefix: `feat(web):`
