# Tasks: 029-dag-instance-overlay

**Input**: Design documents from `.specify/specs/029-dag-instance-overlay/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Run `bun typecheck` after each phase. Unit test for `buildNodeStateMap` required (T022).

**Organization**: Tasks grouped by user story. Foundation phase must complete before US2+.
Phases 1–8 implement the initial feature. Phase 9 is the **bug fix** phase for GH #165.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed. This phase records the pre-flight type check to establish a clean baseline.

- [x] T001 Run `cd web && bun run typecheck` from repo root to confirm zero type errors on the unmodified branch before making any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract `nodeStateForNode()` shared helper into `dag.ts` and refactor `LiveDAG` and `DeepDAG` to use it. This must complete before US2 (which adds the same call in `StaticChainDAG`). Also add the `PickerItem` type that US1 and US3 both consume.

**⚠️ CRITICAL**: US2 depends on T003. T002–T004 can run in parallel.

- [x] T002 [P] Add exported `nodeStateForNode(node: DAGNode, stateMap: NodeStateMap): NodeLiveState | undefined` function to `web/src/lib/dag.ts` — extract verbatim logic from `LiveDAG.tsx:42–61` (root CR aggregate over stateMap values, then kind-based lookup for all others); add JSDoc referencing constitution §IX
- [x] T003 [P] In `web/src/components/LiveDAG.tsx`: remove the inline `nodeState()` function (lines 42–61) and replace its call site (line 282-ish `state={nodeState(node, nodeStateMap)}`) with `state={nodeStateForNode(node, nodeStateMap)}` imported from `@/lib/dag`
- [x] T004 [P] In `web/src/components/DeepDAG.tsx`: remove the inline `nodeState()` function (lines 71–81) and replace its call sites with `nodeStateForNode(node, nodeStateMap)` imported from `@/lib/dag`

**Checkpoint**: Run `bun typecheck` — must pass with zero errors before proceeding.

---

## Phase 3: User Story 1 — Instance Picker on Graph Tab (Priority: P1) 🎯 MVP

**Goal**: When the Graph tab is active, an instance picker `<select>` appears above the DAG. It shows all live instances of the RGD. Selecting "No overlay" (default) does nothing. The picker handles loading, error, and empty states non-destructively.

**Independent Test**: Navigate to an RGD detail page → Graph tab. The picker appears. (AC-001, AC-002, AC-012, AC-014)

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `web/src/components/InstanceOverlayBar.tsx` — export `PickerItem` interface `{ namespace: string; name: string }` and `InstanceOverlayBarProps` (full interface per `data-model.md §4`); implement the component with four render branches: `pickerLoading` → loading text; `pickerError` → inline error + Retry button (calls `onPickerRetry`); `items.length === 0` → "No instances — create one with kubectl apply" muted message; otherwise → `<label>` + `<select className="instance-overlay-bar__select">` with leading "No overlay" `<option value="">` and one option per item formatted as `${ns}/${name}` (or just `${name}` when `ns` is empty); the select's `onChange` calls `onSelect(e.target.value || null)`; render nothing for summary bar yet (US3); import and apply `./InstanceOverlayBar.css`

- [x] T006 [P] [US1] Create `web/src/components/InstanceOverlayBar.css` — BEM styles for `.instance-overlay-bar` (flex row, `gap: 8px`, `align-items: center`, `padding: 8px 0`, `border-bottom: 1px solid var(--color-border-subtle)`), `.instance-overlay-bar__label` (font-size 13px, color `var(--color-text-muted)`), `.instance-overlay-bar__select` (match `NamespaceFilter.css` select styling: `background: var(--color-surface-2)`, `color: var(--color-text)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, `padding: 4px 8px`, `font-size: 13px`), `.instance-overlay-bar__loading` (color `var(--color-text-faint)`, font-size 13px), `.instance-overlay-bar__error` (color `var(--color-error)`, font-size 13px, flex row with gap), `.instance-overlay-bar__empty` (color `var(--color-text-muted)`, font-size 13px); all colors via `var()` only, no hex literals

- [x] T007 [US1] In `web/src/pages/RGDDetail.tsx`, add instance picker state and fetch effect

**Checkpoint**: `bun typecheck` passes. Graph tab shows picker with "No overlay" default. (AC-001, AC-002, AC-014)

---

## Phase 4: User Story 2 — Node State Coloring Overlay (Priority: P1)

**Goal**: Selecting an instance from the picker fetches its state and children, builds a `NodeStateMap`, and passes it to `StaticChainDAG`. Nodes colorize: alive (green), reconciling (amber+pulse), error (red), not-found (gray dashed). State nodes are never overlaid.

**Independent Test**: Select an instance → DAG nodes change color per their live state. Clear → nodes return to base styles. (AC-003–AC-008, AC-011, AC-015, AC-016, AC-017)

### Implementation for User Story 2

- [x] T008 [P] [US2] In `web/src/components/StaticChainDAG.tsx`: add `nodeStateMap?: NodeStateMap` prop, extend `nodeBaseClass()`, add overlay state computation

- [x] T009 [P] [US2] In `web/src/components/StaticChainDAG.css`: add four live-state rect override rules scoped to `.static-chain-dag-container`

- [x] T010 [US2] In `web/src/pages/RGDDetail.tsx`, wire up overlay activation state and effects

**Checkpoint**: `bun typecheck` passes. Select an instance → node colors apply. Select "No overlay" → colors clear. (AC-003–AC-008, AC-011, AC-015–AC-017)

---

## Phase 5: User Story 3 — Instance Summary Bar + Clear (Priority: P2)

**Goal**: When an instance is selected, a one-line summary bar appears below the picker showing the instance name/namespace, a readiness badge (Ready/Reconciling/Error/Unknown), and an "Open instance →" link. Clear returns to the static view.

**Independent Test**: Select an instance → summary bar appears with correct badge and working link. Click "Open instance →" → navigates to correct URL. (AC-009, AC-010, AC-011)

### Implementation for User Story 3

- [x] T011 [P] [US3] In `web/src/components/InstanceOverlayBar.tsx`, add the summary bar section (included in initial implementation)

- [x] T012 [P] [US3] In `web/src/components/InstanceOverlayBar.css`, add summary bar styles (included in initial CSS)

- [x] T013 [US3] In `web/src/pages/RGDDetail.tsx`, update `InstanceOverlayBar` render to pass `overlayInstance`; clear overlay on null select

**Checkpoint**: `bun typecheck` passes. Summary bar appears with correct badge/link. Clearing reverts to no-overlay. (AC-009, AC-010, AC-011)

---

## Phase 6: User Story 4 — Graceful Degradation (Priority: P2)

**Goal**: All edge cases are handled non-destructively: no instances, picker fetch failure, overlay fetch failure, absent conditions, absent children. The static graph always remains functional.

**Independent Test**: With no instances: "No instances" message shown, graph works. With a network error during overlay fetch: inline error shown, graph still shows. (AC-012, AC-013, AC-014, FR-006)

### Implementation for User Story 4

- [x] T014 [P] [US4] In `web/src/components/InstanceOverlayBar.tsx`, audit all state branches against the contracts

- [x] T015 [US4] In `web/src/pages/RGDDetail.tsx`, verify graceful degradation wiring

**Checkpoint**: `bun typecheck` passes. All AC-012, AC-013, AC-014 conditions verified manually against spec FR-006.

---

## Phase 7: User Story 5 — Tooltip Live State Display (Priority: P3)

**Goal**: When the overlay is active, hovering any DAG node shows a "State: Alive/Reconciling/Error/Not found" line in the tooltip popup, using the existing `.dag-tooltip__state--*` CSS classes.

**Independent Test**: Activate overlay → hover a node → tooltip shows State line. Deactivate overlay → same node tooltip shows no State line. (AC-018)

### Implementation for User Story 5

- [x] T016 [P] [US5] In `web/src/components/DAGTooltip.tsx`: add `nodeState?: NodeLiveState` prop; relax render guard; add State line to tooltip

- [x] T017 [US5] In `web/src/components/StaticChainDAG.tsx`: add tooltip hover wiring with nodeState; add DAGTooltip render

**Checkpoint**: `bun typecheck` passes. Tooltip shows State line when overlay is active. No State line when no overlay. (AC-018)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, constitution compliance check, and typecheck gate.

- [x] T018 [P] Audit all new CSS in `InstanceOverlayBar.css` and `StaticChainDAG.css` additions: confirm zero hardcoded hex literals or `rgba()` values — every color must be `var(--token-name)`; fix any found
- [x] T019 [P] Audit `InstanceOverlayBar.tsx` for constitution §XIII compliance: (a) no hardcoded namespace/resource names; (b) the "No instances" message includes `kubectl apply` guidance per spec FR-001; (c) the "Open instance →" link uses `<Link>` from react-router-dom (not `<a href>`); (d) the summary bar `${ns}/${name}` display omits the leading `/` when namespace is empty
- [x] T020 Run `cd web && bun run typecheck` — must pass with zero errors; fix any remaining type errors before marking complete
- [x] T021 Manual acceptance criteria walkthrough: verify AC-001 through AC-018 against the running app with `./kro-ui serve`; for each AC note pass/fail; fix any failing AC

---

## Phase 9: Bug Fix — GH #165 (Child nodes not colored)

**Purpose**: Fix the two root causes identified in GH #165. After Phases 1–8, the
summary bar (root CR node) works but child resource nodes do not receive live-state
CSS classes. Two bugs must be fixed:

1. **Bug 1** (`nodeBaseClass` truthy guard): `if (liveState) parts.push(liveStateClass(liveState))` silently skips absent nodes because `undefined` is falsy. Fix: use overlay-active guard instead.
2. **Bug 2** (`buildNodeStateMap` missing `rgdNodes`): the function only keys by observed children; nodes absent from children produce `undefined` from lookup.

**⚠️ T023 depends on T022. T022 and T024 can run in parallel.**

- [ ] T022 [P] Fix `buildNodeStateMap` in `web/src/lib/instanceNodeState.ts`:
  - Add `rgdNodes: DAGNode[]` as third parameter (import `DAGNode` from `@/lib/dag`)
  - Build a `presenceMap: Map<string, NodeLiveState>` from children (key: `child.kind?.toLowerCase()`, fallback: `child.metadata?.labels?.['kro.run/resource-id']?.toLowerCase()`; skip if kind absent; value: `'reconciling'` if `deletionTimestamp` set, else `'alive'`)
  - After processing children, loop over `rgdNodes`: for each node where `nodeType !== 'instance'` and `nodeType !== 'state'`, compute `kindKey = (node.kind || node.label).toLowerCase()` and emit `result[kindKey] = { state: presenceMap.get(kindKey) ?? 'not-found' }`
  - Write companion unit test `instanceNodeState.test.ts`: table-driven test with 6 rgdNodes (Deployment, Service, ConfigMap, Secret, Ingress, HPA) and 2 children (Deployment + Service) → assert map has entries for all 6 kinds, 4 with `state: 'not-found'`, 2 with `state: 'alive'` (AC-019)

- [ ] T023 Update call site in `web/src/pages/RGDDetail.tsx`:
  - Find the `buildNodeStateMap(instance, childrenRes.items ?? [])` call in the overlay fetch effect
  - Change to `buildNodeStateMap(instance, childrenRes.items ?? [], dagGraph?.nodes ?? [])`
  - Ensure `dagGraph` is accessible in scope (it should already be in component state)

- [ ] T024 [P] Fix `nodeBaseClass()` guard in `web/src/components/StaticChainDAG.tsx`:
  - Find the `if (liveState) parts.push(liveStateClass(liveState))` line in `nodeBaseClass`
  - Change to: pass `nodeStateMap` into `nodeBaseClass` as an optional fourth param, or compute `liveStateClass` at the call site
  - The critical invariant: when `nodeStateMap` is provided and `node.nodeType !== 'state'`, `liveStateClass(liveState)` is always called (including when `liveState === undefined` → produces `'dag-node-live--notfound'`)
  - Preferred implementation (minimal diff): compute the class at the node render site rather than threading `nodeStateMap` into `nodeBaseClass`:
    ```typescript
    const liveClass = (nodeStateMap && node.nodeType !== 'state')
      ? liveStateClass(liveState)
      : undefined
    // Then pass liveClass to nodeBaseClass or push directly into className
    ```

- [ ] T025 [P] Harden E2E Step 3 in `test/e2e/journeys/029-dag-instance-overlay.spec.ts`:
  - Find the soft assertion that checks `[class*="dag-node-live--"]` count
  - Replace with a hard assertion: `await expect(page.locator('[class*="dag-node-live--"]')).toHaveCount(greaterThan(1), { timeout: 15_000 })`
  - Or use a minimum count assertion matching the number of non-state nodes in `test-app` RGD
  - Remove any `try/catch` or graceful-skip wrapper around this assertion

- [ ] T026 Run `cd web && bun run typecheck` — must pass with zero errors

- [ ] T027 Manual AC verification for AC-003, AC-007, AC-017, AC-019:
  - Navigate to an RGD with multiple managed resources
  - Select an instance from the overlay picker
  - Verify: ALL non-state nodes receive a live-state class (use DevTools Elements inspector)
  - Verify: absent nodes have `dag-node-live--notfound` class (gray dashed style)
  - Verify: present nodes have `dag-node-live--alive` or `dag-node-live--reconciling` class
  - Verify: state nodes have NO live-state class

**Checkpoint**: AC-003, AC-007, AC-017, AC-019 all pass. No regression on AC-001–AC-002, AC-004–AC-018.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — run first
- **Phase 2** (Foundation): Depends on Phase 1 passing typecheck — **BLOCKS US2 (T008)** specifically; US1 can start after T002 is complete
- **Phase 3 (US1)**: Depends on Phase 2 completing; T007 depends on T005+T006 being done
- **Phase 4 (US2)**: Depends on Phase 2 complete (T002 needed for `nodeStateForNode` import in T008); T010 depends on T008
- **Phase 5 (US3)**: Depends on Phase 4 complete (needs `overlayInstance` state from T010)
- **Phase 6 (US4)**: Depends on Phase 3+4+5 complete (audits their output)
- **Phase 7 (US5)**: Depends on Phase 4 complete (needs nodeStateMap flowing to StaticChainDAG); independent from US3
- **Phase 8** (Polish): Depends on all user story phases complete
- **Phase 9** (Bug Fix): Depends on Phase 8 complete; T023 depends on T022; T022 and T024 can run in parallel

### User Story Dependencies

- **US1 (Phase 3)**: Needs T002 (PickerItem type / dag.ts compiles clean) — otherwise independent
- **US2 (Phase 4)**: Needs T002+T003+T004 (Foundation complete)
- **US3 (Phase 5)**: Needs T010 (overlay state in RGDDetail) from US2
- **US4 (Phase 6)**: Needs US1+US2+US3 complete (audits all three)
- **US5 (Phase 7)**: Needs T008 (StaticChainDAG has nodeStateMap prop) from US2; independent from US3

### Within Each User Story

- Models/types before consumers
- CSS before component (avoid import errors during dev server HMR)
- Component before page integration
- Page integration before manual AC verification

### Parallel Opportunities

Within Phase 2: T002, T003, T004 touch different files — run in parallel  
Within Phase 3: T005 (component) and T006 (CSS) touch different files — run in parallel; T007 depends on both  
Within Phase 4: T008 (StaticChainDAG) and T009 (CSS) touch different files — run in parallel; T010 depends on T008  
Within Phase 5: T011 (component update) and T012 (CSS) — run in parallel; T013 depends on T011  
Within Phase 6: T014 (component) and T015 (page) — run in parallel  
Within Phase 7: T016 (DAGTooltip) and T017 (StaticChainDAG) — run T016 first (T017 depends on DAGTooltipTarget having nodeState)  
Within Phase 8: T018 and T019 — run in parallel  
Within Phase 9: T022 (buildNodeStateMap fix + unit test) and T024 (nodeBaseClass fix) — run in parallel; T023 depends on T022

---

## Notes

- `[P]` tasks = different files, no shared state dependencies within the task
- `[Story]` label maps each task to its acceptance criteria for traceability
- No new npm packages, no new Go files, no backend changes
- `reconciling-pulse` keyframe is already in `tokens.css` — do NOT redefine it
- Nested `StaticChainDAG` renders (chain expand) must NOT receive `nodeStateMap`
- The `DAGTooltipTarget` type in `DAGTooltip.tsx` needs `nodeState?` added if not already exported
- Run `bun typecheck` after each phase checkpoint — do not accumulate type errors
- **GH #165**: Phase 9 is the fix phase. All Phase 1–8 tasks are already completed (marked `[x]`). Only Phase 9 tasks remain.

**Purpose**: No new project structure needed. This phase records the pre-flight type check to establish a clean baseline.

- [x] T001 Run `cd web && bun run typecheck` from repo root to confirm zero type errors on the unmodified branch before making any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract `nodeStateForNode()` shared helper into `dag.ts` and refactor `LiveDAG` and `DeepDAG` to use it. This must complete before US2 (which adds the same call in `StaticChainDAG`). Also add the `PickerItem` type that US1 and US3 both consume.

**⚠️ CRITICAL**: US2 depends on T003. T002–T004 can run in parallel.

- [x] T002 [P] Add exported `nodeStateForNode(node: DAGNode, stateMap: NodeStateMap): NodeLiveState | undefined` function to `web/src/lib/dag.ts` — extract verbatim logic from `LiveDAG.tsx:42–61` (root CR aggregate over stateMap values, then kind-based lookup for all others); add JSDoc referencing constitution §IX
- [x] T003 [P] In `web/src/components/LiveDAG.tsx`: remove the inline `nodeState()` function (lines 42–61) and replace its call site (line 282-ish `state={nodeState(node, nodeStateMap)}`) with `state={nodeStateForNode(node, nodeStateMap)}` imported from `@/lib/dag`
- [x] T004 [P] In `web/src/components/DeepDAG.tsx`: remove the inline `nodeState()` function (lines 71–81) and replace its call sites with `nodeStateForNode(node, nodeStateMap)` imported from `@/lib/dag`

**Checkpoint**: Run `bun typecheck` — must pass with zero errors before proceeding.

---

## Phase 3: User Story 1 — Instance Picker on Graph Tab (Priority: P1) 🎯 MVP

**Goal**: When the Graph tab is active, an instance picker `<select>` appears above the DAG. It shows all live instances of the RGD. Selecting "No overlay" (default) does nothing. The picker handles loading, error, and empty states non-destructively.

**Independent Test**: Navigate to an RGD detail page → Graph tab. The picker appears. (AC-001, AC-002, AC-012, AC-014)

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `web/src/components/InstanceOverlayBar.tsx` — export `PickerItem` interface `{ namespace: string; name: string }` and `InstanceOverlayBarProps` (full interface per `data-model.md §4`); implement the component with four render branches: `pickerLoading` → loading text; `pickerError` → inline error + Retry button (calls `onPickerRetry`); `items.length === 0` → "No instances — create one with kubectl apply" muted message; otherwise → `<label>` + `<select className="instance-overlay-bar__select">` with leading "No overlay" `<option value="">` and one option per item formatted as `${ns}/${name}` (or just `${name}` when `ns` is empty); the select's `onChange` calls `onSelect(e.target.value || null)`; render nothing for summary bar yet (US3); import and apply `./InstanceOverlayBar.css`

- [x] T006 [P] [US1] Create `web/src/components/InstanceOverlayBar.css` — BEM styles for `.instance-overlay-bar` (flex row, `gap: 8px`, `align-items: center`, `padding: 8px 0`, `border-bottom: 1px solid var(--color-border-subtle)`), `.instance-overlay-bar__label` (font-size 13px, color `var(--color-text-muted)`), `.instance-overlay-bar__select` (match `NamespaceFilter.css` select styling: `background: var(--color-surface-2)`, `color: var(--color-text)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-sm)`, `padding: 4px 8px`, `font-size: 13px`), `.instance-overlay-bar__loading` (color `var(--color-text-faint)`, font-size 13px), `.instance-overlay-bar__error` (color `var(--color-error)`, font-size 13px, flex row with gap), `.instance-overlay-bar__empty` (color `var(--color-text-muted)`, font-size 13px); all colors via `var()` only, no hex literals

- [x] T007 [US1] In `web/src/pages/RGDDetail.tsx`, add instance picker state and fetch effect

**Checkpoint**: `bun typecheck` passes. Graph tab shows picker with "No overlay" default. (AC-001, AC-002, AC-014)

---

## Phase 4: User Story 2 — Node State Coloring Overlay (Priority: P1)

**Goal**: Selecting an instance from the picker fetches its state and children, builds a `NodeStateMap`, and passes it to `StaticChainDAG`. Nodes colorize: alive (green), reconciling (amber+pulse), error (red), not-found (gray dashed). State nodes are never overlaid.

**Independent Test**: Select an instance → DAG nodes change color per their live state. Clear → nodes return to base styles. (AC-003–AC-008, AC-011, AC-015, AC-016, AC-017)

### Implementation for User Story 2

- [x] T008 [P] [US2] In `web/src/components/StaticChainDAG.tsx`: add `nodeStateMap?: NodeStateMap` prop, extend `nodeBaseClass()`, add overlay state computation

- [x] T009 [P] [US2] In `web/src/components/StaticChainDAG.css`: add four live-state rect override rules scoped to `.static-chain-dag-container`

- [x] T010 [US2] In `web/src/pages/RGDDetail.tsx`, wire up overlay activation state and effects

**Checkpoint**: `bun typecheck` passes. Select an instance → node colors apply. Select "No overlay" → colors clear. (AC-003–AC-008, AC-011, AC-015–AC-017)

---

## Phase 5: User Story 3 — Instance Summary Bar + Clear (Priority: P2)

**Goal**: When an instance is selected, a one-line summary bar appears below the picker showing the instance name/namespace, a readiness badge (Ready/Reconciling/Error/Unknown), and an "Open instance →" link. Clear returns to the static view.

**Independent Test**: Select an instance → summary bar appears with correct badge and working link. Click "Open instance →" → navigates to correct URL. (AC-009, AC-010, AC-011)

### Implementation for User Story 3

- [x] T011 [P] [US3] In `web/src/components/InstanceOverlayBar.tsx`, add the summary bar section (included in initial implementation)

- [x] T012 [P] [US3] In `web/src/components/InstanceOverlayBar.css`, add summary bar styles (included in initial CSS)

- [x] T013 [US3] In `web/src/pages/RGDDetail.tsx`, update `InstanceOverlayBar` render to pass `overlayInstance`; clear overlay on null select

**Checkpoint**: `bun typecheck` passes. Summary bar appears with correct badge/link. Clearing reverts to no-overlay. (AC-009, AC-010, AC-011)

---

## Phase 6: User Story 4 — Graceful Degradation (Priority: P2)

**Goal**: All edge cases are handled non-destructively: no instances, picker fetch failure, overlay fetch failure, absent conditions, absent children. The static graph always remains functional.

**Independent Test**: With no instances: "No instances" message shown, graph works. With a network error during overlay fetch: inline error shown, graph still shows. (AC-012, AC-013, AC-014, FR-006)

### Implementation for User Story 4

- [x] T014 [P] [US4] In `web/src/components/InstanceOverlayBar.tsx`, audit all state branches against the contracts

- [x] T015 [US4] In `web/src/pages/RGDDetail.tsx`, verify graceful degradation wiring

**Checkpoint**: `bun typecheck` passes. All AC-012, AC-013, AC-014 conditions verified manually against spec FR-006.

---

## Phase 7: User Story 5 — Tooltip Live State Display (Priority: P3)

**Goal**: When the overlay is active, hovering any DAG node shows a "State: Alive/Reconciling/Error/Not found" line in the tooltip popup, using the existing `.dag-tooltip__state--*` CSS classes.

**Independent Test**: Activate overlay → hover a node → tooltip shows State line. Deactivate overlay → same node tooltip shows no State line. (AC-018)

### Implementation for User Story 5

- [x] T016 [P] [US5] In `web/src/components/DAGTooltip.tsx`: add `nodeState?: NodeLiveState` prop; relax render guard; add State line to tooltip

- [x] T017 [US5] In `web/src/components/StaticChainDAG.tsx`: add tooltip hover wiring with nodeState; add DAGTooltip render

**Checkpoint**: `bun typecheck` passes. Tooltip shows State line when overlay is active. No State line when no overlay. (AC-018)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, constitution compliance check, and typecheck gate.

- [x] T018 [P] Audit all new CSS in `InstanceOverlayBar.css` and `StaticChainDAG.css` additions: confirm zero hardcoded hex literals or `rgba()` values — every color must be `var(--token-name)`; fix any found
- [x] T019 [P] Audit `InstanceOverlayBar.tsx` for constitution §XIII compliance: (a) no hardcoded namespace/resource names; (b) the "No instances" message includes `kubectl apply` guidance per spec FR-001; (c) the "Open instance →" link uses `<Link>` from react-router-dom (not `<a href>`); (d) the summary bar `${ns}/${name}` display omits the leading `/` when namespace is empty
- [x] T020 Run `cd web && bun run typecheck` — must pass with zero errors; fix any remaining type errors before marking complete
- [x] T021 Manual acceptance criteria walkthrough: verify AC-001 through AC-018 against the running app with `./kro-ui serve`; for each AC note pass/fail; fix any failing AC

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — run first
- **Phase 2** (Foundation): Depends on Phase 1 passing typecheck — **BLOCKS US2 (T008)** specifically; US1 can start after T002 is complete
- **Phase 3 (US1)**: Depends on Phase 2 completing; T007 depends on T005+T006 being done
- **Phase 4 (US2)**: Depends on Phase 2 complete (T002 needed for `nodeStateForNode` import in T008); T010 depends on T008
- **Phase 5 (US3)**: Depends on Phase 4 complete (needs `overlayInstance` state from T010)
- **Phase 6 (US4)**: Depends on Phase 3+4+5 complete (audits their output)
- **Phase 7 (US5)**: Depends on Phase 4 complete (needs nodeStateMap flowing to StaticChainDAG); independent from US3
- **Phase 8** (Polish): Depends on all user story phases complete

### User Story Dependencies

- **US1 (Phase 3)**: Needs T002 (PickerItem type / dag.ts compiles clean) — otherwise independent
- **US2 (Phase 4)**: Needs T002+T003+T004 (Foundation complete)
- **US3 (Phase 5)**: Needs T010 (overlay state in RGDDetail) from US2
- **US4 (Phase 6)**: Needs US1+US2+US3 complete (audits all three)
- **US5 (Phase 7)**: Needs T008 (StaticChainDAG has nodeStateMap prop) from US2; independent from US3

### Within Each User Story

- Models/types before consumers
- CSS before component (avoid import errors during dev server HMR)
- Component before page integration
- Page integration before manual AC verification

### Parallel Opportunities

Within Phase 2: T002, T003, T004 touch different files — run in parallel  
Within Phase 3: T005 (component) and T006 (CSS) touch different files — run in parallel; T007 depends on both  
Within Phase 4: T008 (StaticChainDAG) and T009 (CSS) touch different files — run in parallel; T010 depends on T008  
Within Phase 5: T011 (component update) and T012 (CSS) — run in parallel; T013 depends on T011  
Within Phase 6: T014 (component) and T015 (page) — run in parallel  
Within Phase 7: T016 (DAGTooltip) and T017 (StaticChainDAG) — run T016 first (T017 depends on DAGTooltipTarget having nodeState)  
Within Phase 8: T018 and T019 — run in parallel

---

## Parallel Example: Phase 2 (Foundation)

```
# All three run simultaneously (different files):
Task: T002 — add nodeStateForNode() to web/src/lib/dag.ts
Task: T003 — refactor LiveDAG.tsx to use nodeStateForNode()
Task: T004 — refactor DeepDAG.tsx to use nodeStateForNode()
```

## Parallel Example: Phase 4 (US2)

```
# Run simultaneously (different files):
Task: T008 — add nodeStateMap prop to StaticChainDAG.tsx
Task: T009 — add live-state CSS rules to StaticChainDAG.css
# Then after both complete:
Task: T010 — wire overlay state in RGDDetail.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1: Setup (T001 baseline)
2. Complete Phase 2: Foundation (T002–T004) — `nodeStateForNode()` extracted
3. Complete Phase 3: US1 — picker appears on Graph tab
4. Complete Phase 4: US2 — node colors apply on instance selection
5. **STOP and VALIDATE**: AC-001–AC-008, AC-011, AC-015–AC-017 all pass
6. This is a shippable MVP — the core overlay feature works

### Full Delivery

1. MVP above (Phases 1–4)
2. Phase 5 (US3): Summary bar + clear link
3. Phase 6 (US4): Graceful degradation audit
4. Phase 7 (US5): Tooltip state line
5. Phase 8: Polish + final AC walkthrough

---

## Notes

- `[P]` tasks = different files, no shared state dependencies within the task
- `[Story]` label maps each task to its acceptance criteria for traceability
- No new npm packages, no new Go files, no backend changes
- `reconciling-pulse` keyframe is already in `tokens.css` — do NOT redefine it
- Nested `StaticChainDAG` renders (chain expand) must NOT receive `nodeStateMap`
- The `DAGTooltipTarget` type in `DAGTooltip.tsx` needs `nodeState?` added if not already exported
- Run `bun typecheck` after each phase checkpoint — do not accumulate type errors
