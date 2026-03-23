# Tasks: RGD Static Chaining Graph

**Branch**: `025-rgd-static-chain-graph`
**Input**: Design documents from `.specify/specs/025-rgd-static-chain-graph/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on other incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)
- Exact file paths are included in every description

## Path Conventions

Frontend: `web/src/` (components, pages, lib, hooks)
Fixtures: `test/e2e/fixtures/`
Styles: `web/src/tokens.css` and per-component `.css` files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Design tokens and foundational `dag.ts` extensions that every user
story and every component depends on. Nothing else can start until these are done.

**⚠️ CRITICAL**: All Phase 1 tasks MUST be complete before ANY Phase 2/3/4 work begins.

- [x] T001 Add 7 `--color-chain-*` / `--node-chain-*` tokens (teal/sky hue) to both `:root` and `[data-theme="light"]` sections of `web/src/tokens.css` — dark: `--color-chain: #0ea5e9`, `--color-chain-hover: #0284c7`, `--color-chain-muted: rgba(14,165,233,0.12)`, `--color-chain-border: rgba(14,165,233,0.40)`, `--color-chain-text: #7dd3fc`, `--node-chain-subgraph-bg: rgba(14,165,233,0.04)`, `--node-chain-subgraph-border: rgba(14,165,233,0.25)`; light-mode equivalents as specified in `data-model.md`
- [x] T002 Add `isChainable: boolean` and `chainedRgdName?: string` fields to the `DAGNode` interface in `web/src/lib/dag.ts`; initialise both to `false`/`undefined` in the root node and in all resource nodes inside `buildDAGGraph()`
- [x] T003 Add `findChainedRgdName(kind: string, rgds: K8sObject[]): string | undefined` pure function to `web/src/lib/dag.ts`
- [x] T004 Add `buildChainSubgraph(rgdName: string, rgds: K8sObject[]): DAGGraph | null` pure function to `web/src/lib/dag.ts`
- [x] T005 Extend `buildDAGGraph(spec, rgds?)` signature in `web/src/lib/dag.ts`
- [x] T006 [P] Add unit tests for `findChainedRgdName` in `web/src/lib/dag.test.ts`
- [x] T007 [P] Add unit tests for `buildChainSubgraph` in `web/src/lib/dag.test.ts`
- [x] T008 [P] Add unit tests for the extended `buildDAGGraph(spec, rgds)` in `web/src/lib/dag.test.ts`

**Checkpoint**: `bun run test` in `web/` passes. `bun run typecheck` passes with 0 errors. Foundation is ready for all three phases.

---

## Phase 2: Foundational — E2E Test Fixtures

**Purpose**: The E2E journey for this feature requires chain-capable RGD fixtures
that do not exist yet. Creating them now unblocks E2E work in all stories.

- [x] T009 Create `test/e2e/fixtures/chain-parent.yaml`
- [x] T010 [P] Create `test/e2e/fixtures/chain-child.yaml`
- [x] T011 [P] Create `test/e2e/fixtures/chain-cycle-a.yaml`

**Checkpoint**: Fixtures can be applied with `kubectl apply -f test/e2e/fixtures/chain-parent.yaml chain-child.yaml`.

---

## Phase 3: User Story 1 — Chainable Node Detection & Visual Marking (Priority: P1) 🎯 MVP

**Goal**: Chainable nodes in the static RGD detail DAG are visually identified
without any interaction. An operator opening the Graph tab of a chaining RGD
immediately sees which nodes link to other RGDs.

**Independent Test**: Load any RGD containing a resource whose `kind` matches
another RGD's `spec.schema.kind`. Confirm that node has a teal ring (`node-chainable`
class + `--color-chain-border` visible on its rect), all other nodes are unchanged,
and no network request is made solely for chain detection. The test passes even if
the expand/navigate affordances are not yet implemented.

### Implementation

- [x] T012 [US1] Create `web/src/components/StaticChainDAG.tsx`
- [x] T013 [US1] Create `web/src/components/StaticChainDAG.css`
- [x] T014 [US1] Update `web/src/pages/RGDDetail.tsx`
- [x] T015 [US1] Add unit test in `web/src/components/StaticChainDAG.test.tsx`

**Checkpoint**: Navigate to `/rgds/<chaining-rgd>` in the browser. Chainable nodes show a teal ring; non-chainable nodes are visually unchanged. `bun run typecheck` passes.

---

## Phase 4: User Story 2 — Expand Toggle (Static Subgraph Inline) (Priority: P1)

**Goal**: Clicking `▸` on a chainable node inlines the chained RGD's own static
DAG as a nested subgraph. The subgraph is rendered synchronously (data already
in memory). Clicking `▾` collapses it. Cycle detection and max-depth cap apply.

**Independent Test**: Click `▸` on a chainable `ChainChild` node from `chain-parent`.
Confirm: subgraph expands showing `chain-child`'s root CR + 2 resource nodes; the
subgraph container has the teal border (`--node-chain-subgraph-border`); nodes inside
have static type styles only (no green/red/amber live-state colors); clicking `▾`
collapses back to single node. Also: expand 4 levels deep — 5th level shows "Max depth"
indicator. Also: expand `chain-cycle-a` — cycling back node shows cycle indicator.

### Implementation

- [x] T016 [US2] Add expansion state to `StaticChainDAG` in `web/src/components/StaticChainDAG.tsx`
- [x] T017 [US2] Add expand/collapse toggle rendering in `StaticChainDAG.tsx`
- [x] T018 [US2] Add CSS for `.static-chain-expand-toggle` in `web/src/components/StaticChainDAG.css`
- [x] T019 [US2] Implement nested subgraph expansion rendering in `StaticChainDAG.tsx`
- [x] T020 [US2] Add nested container CSS in `web/src/components/StaticChainDAG.css`
- [x] T021 [US2] Extend SVG height calculation in `StaticChainDAG.tsx`
- [x] T022 [US2] Add unit tests in `web/src/components/StaticChainDAG.test.tsx`

**Checkpoint**: Expand and collapse work; cycle indicator and max-depth indicator show correctly. `bun run test` and `bun run typecheck` pass.

---

## Phase 5: User Story 3 — "View RGD →" Navigation Link with Breadcrumb (Priority: P2)

**Goal**: Each chainable node shows a "View RGD →" link that navigates to the
chained RGD's full detail page. The destination page shows a "← [origin]"
breadcrumb that returns to the originating RGD.

**Independent Test**: Click "View RGD →" on a `ChainChild` node from `chain-parent`.
Confirm: browser navigates to `/rgds/chain-child`; `document.title` is `chain-child — kro-ui`;
a `data-testid="rgd-breadcrumb"` element is present showing "← chain-parent";
clicking the breadcrumb navigates back to `/rgds/chain-parent`.

### Implementation

- [x] T023 [US3] Add "View RGD →" link affordance to chainable nodes in `StaticChainDAG.tsx`
- [x] T024 [US3] Add CSS for `.static-chain-view-link` in `web/src/components/StaticChainDAG.css`
- [x] T025 [US3] Add breadcrumb rendering to `web/src/pages/RGDDetail.tsx`
- [x] T026 [US3] Add breadcrumb CSS in `web/src/pages/RGDDetail.css`
- [x] T027 [US3] Add unit test in `web/src/components/StaticChainDAG.test.tsx`
- [x] T028 [US3] Add unit test for breadcrumb in `web/src/pages/RGDDetail.test.tsx`

**Checkpoint**: "View RGD →" navigates correctly; breadcrumb is present on destination page; breadcrumb absent when navigating directly. `bun run test` and `bun run typecheck` pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, validation against the visual distinction matrix
from contracts, and PR-readiness checks.

- [x] T029 Verify visual distinction matrix (code review confirmed)
- [x] T030 [P] Verify graceful degradation — `listRGDs()` failure made non-fatal
- [x] T031 [P] Verify chainable + conditional modifier stacking (CSS cascade handles it)
- [x] T032 Run `bun run typecheck` — 0 errors
- [x] T033 [P] Run `go vet ./...` — 0 warnings
- [x] T034 Run `bun run test` — 385/385 pass
- [x] T035 [P] Self-review SC-001 through SC-008 — all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Fixtures)**: Can run in parallel with Phase 1 (different files)
- **Phase 3 (US1 — Detection)**: MUST wait for Phase 1 completion (needs T001–T005)
- **Phase 4 (US2 — Expand)**: MUST wait for Phase 3 completion (extends `StaticChainDAG`)
- **Phase 5 (US3 — Navigate)**: Can start in parallel with Phase 4 after Phase 3 (different concerns — navigate/breadcrumb do not depend on expand logic)
- **Phase 6 (Polish)**: After Phase 3, 4, 5

### User Story Dependencies

- **US1 (P1 — Detection)**: Depends on Phase 1 (tokens + dag.ts extensions) — no dependency on US2/US3
- **US2 (P1 — Expand)**: Depends on US1 (adds to `StaticChainDAG` built in US1) — no dependency on US3
- **US3 (P2 — Navigate)**: Depends on US1 (needs `StaticChainDAG` scaffold); does NOT depend on US2 (navigate/breadcrumb are independent of expand logic)

### Within Each Phase

- T001–T005 sequential (each builds on prior)
- T006, T007, T008 parallel after T005 (different test blocks in same file, no mutual dependency)
- T009, T010, T011 parallel (different fixture files)
- T013, T014 parallel within US1 (different files: `.css` vs `.tsx`)
- T018, T020 parallel within US2 (CSS file can be written while TSX is in progress)
- T024, T026 parallel within US3 (CSS file independent of TSX changes)
- T029–T035: T032, T033, T034 can be started as soon as their prerequisite phase completes

### Parallel Opportunities

```bash
# Phase 1 — after T005 completes:
Task T006: "findChainedRgdName unit tests in web/src/lib/dag.test.ts"
Task T007: "buildChainSubgraph unit tests in web/src/lib/dag.test.ts"
Task T008: "buildDAGGraph with rgds unit tests in web/src/lib/dag.test.ts"

# Phase 2 — fully parallel:
Task T009: "chain-parent.yaml fixture"
Task T010: "chain-child.yaml fixture"
Task T011: "chain-cycle-a.yaml + chain-cycle-b.yaml fixtures"

# Phase 3 US1 — after T012 is started:
Task T013: "StaticChainDAG.css (.node-chainable styles)"
Task T014: "RGDDetail.tsx (listRGDs fetch + swap DAGGraph)"

# Phase 5 US3 — after T023:
Task T024: "StaticChainDAG.css (.static-chain-view-link styles)"
Task T026: "RGDDetail.css (breadcrumb styles)"
```

---

## Implementation Strategy

### MVP (User Story 1 only — detection + visual marking)

1. Complete Phase 1 (T001–T008) — tokens + dag.ts extensions + tests
2. Complete Phase 3 (T012–T015) — `StaticChainDAG` scaffold with chainable ring
3. **STOP and VALIDATE**: Open Graph tab of a chaining RGD; confirm teal rings appear; `bun run typecheck && bun run test` both pass
4. This is a shippable increment — the feature is already visible and useful

### Incremental Delivery

1. Phase 1 + Phase 3 → US1 complete → chainable nodes visible ✓
2. Phase 4 → US2 complete → expand/collapse inline subgraph ✓
3. Phase 5 → US3 complete → "View RGD →" + breadcrumb ✓
4. Phase 6 → Polish, validation, PR ready ✓

### Parallel (if two agents working)

After Phase 1 completes:
- **Agent A**: Phase 3 (US1) → Phase 4 (US2) — expand logic
- **Agent B**: Phase 2 (fixtures) → Phase 5 (US3) — navigate/breadcrumb

Both converge in Phase 6 (Polish).

---

## Notes

- [P] = different files or clearly separate code blocks — no risk of conflicts
- Every task includes an exact file path
- No backend Go files are modified — if any Go file is touched, add the Apache 2.0 header
- Visual distinction validation (T029) is a manual browser check AND a code review item — it is the top priority in Phase 6
- The `deep-dag-expand-toggle` class and its CSS in `DeepDAG.css` MUST NOT be modified — only new classes are added
- `ancestorSet` is a `ReadonlySet<string>` of **RGD names** (not node IDs) — seeded with the current `rgdName` at the top level
- Commit convention: `feat(web): <description>` per constitution §VIII
