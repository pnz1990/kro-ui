# Tasks: RGD Graph Diff View

**Input**: Design documents from `.specify/specs/009-rgd-graph-diff/`
**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: Unit tests for `dag-diff.ts` are required before any component work (spec.md Testing Requirements).

**Organization**: Tasks are grouped by phase. Phase 0 and 1 must complete before Phase 2.
Phases 2 and 3 can largely overlap since `RGDDiffView` and `RevisionSelector` are independent.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- All paths are relative to the repository root

---

## Phase 0: Setup + Tokens + Pure Logic

**Purpose**: Baseline check, diff color tokens in `tokens.css`, pure `diffDAGGraphs`
function with full unit tests. Zero visible UI changes. All subsequent phases depend on this.

- [ ] T001 Verify Go build and TypeScript typecheck pass clean: `GOPROXY=direct GONOSUMDB="*" go vet ./... && cd web && bun run tsc --noEmit`
- [ ] T002 [P] Verify Go tests pass clean: `GOPROXY=direct GONOSUMDB="*" go test -race ./...`
- [ ] T003 [P] Verify frontend unit tests pass: `cd web && bun run vitest run`

**Checkpoint**: All existing tests green — safe to begin feature work.

- [ ] T004 Add diff color tokens to `web/src/tokens.css` (FR-007): add `--color-diff-added` (emerald, same hue as `--color-alive`), `--color-diff-removed` (rose, same hue as `--color-error`), `--color-diff-modified` (amber, same hue as `--color-reconciling`), `--color-diff-unchanged` (maps to `--color-text-muted`), `--color-diff-added-bg`, `--color-diff-removed-bg`, `--color-diff-modified-bg` — all must use `var()` references or distinct literal values defined only in `tokens.css`, never in component CSS

- [ ] T005 Create `web/src/lib/dag-diff.ts`: define `DiffStatus`, `DiffNode`, `DiffEdge`, `DiffGraph` types; implement `diffDAGGraphs(graphA: DAGGraph, graphB: DAGGraph): DiffGraph` — match nodes by `id`, classify added/removed/modified/unchanged; match edges by `from+to` pair, classify added/removed/unchanged; include `prevCEL`/`nextCEL` arrays on modified nodes capturing before/after `includeWhen`, `readyWhen`, `forEach`

- [ ] T006 Create `web/src/lib/dag-diff.test.ts` (spec.md Testing Requirements — all 6 cases):
  - `it("classifies node present in B but not A as added")`
  - `it("classifies node present in A but not B as removed")`
  - `it("classifies node with different CEL as modified")`
  - `it("classifies identical nodes as unchanged")`
  - `it("classifies new edge as added")`
  - `it("classifies removed edge as removed")`
  - Add: `it("node renamed between revisions is remove + add, not modified")` (edge case from spec)
  - Add: `it("returns correct prevCEL/nextCEL for modified node")`
  - Add: NFR-001 perf test: generate 20-node graphs, assert `diffDAGGraphs` completes in <100ms

**Checkpoint**: `bun run vitest run src/lib/dag-diff.test.ts` — all cases pass.

---

## Phase 1: RevisionSelector Component

**Purpose**: Two-dropdown UI for picking revision A and revision B from the
existing revision list. Emits the selected pair upward. Standalone, no DAG rendering.

- [ ] T007 Create `web/src/components/RevisionSelector.tsx`: props `{ revisions: K8sObject[]; onChange: (pair: [K8sObject, K8sObject] | null) => void }`. Render two `<select>` elements (Rev A, Rev B) populated from `revisions` sorted by `spec.revision` descending. Emit `onChange` with the selected pair when both are chosen and distinct. Emit `null` when fewer than 2 revisions exist. When only 1 revision: show message "Only one revision exists — nothing to compare" per spec acceptance scenario US1-5. Apply `aria-label` on each select for accessibility.

- [ ] T008 Create `web/src/components/RevisionSelector.css`: style the two dropdowns and compare button using `var(--token-name)` only — no hardcoded hex/rgba (§IX)

**Checkpoint**: `RevisionSelector` renders correctly with 0, 1, 2, and 3+ revisions passed as props.

---

## Phase 2: RGDDiffView Component

**Purpose**: Merged DAG renderer with diff-status overlays. Uses `diffDAGGraphs`
from Phase 0 and the existing `buildDAGGraph` function.

- [ ] T009 Create `web/src/components/RGDDiffView.tsx`: props `{ revA: K8sObject; revB: K8sObject }`. Call `buildDAGGraph(revA.spec.snapshot)` and `buildDAGGraph(revB.spec.snapshot)` to get two `DAGGraph` objects. Call `diffDAGGraphs(graphA, graphB)` to get `DiffGraph`. Render the merged DAG using dagre layout — pass the union of all nodes (added, removed, modified, unchanged) through the layout. Apply CSS class per `diffStatus` (e.g. `dag-node--diff-added`, `dag-node--diff-removed`, `dag-node--diff-modified`, `dag-node--diff-unchanged`). Removed nodes render with dashed border.

- [ ] T010 Add diff node badges: `+` badge on added nodes, `-` badge on removed nodes, `~` badge on modified nodes (spec US1 acceptance scenarios 1–4)

- [ ] T011 Add click handler for modified nodes: clicking a `diff-modified` node opens the node detail panel showing before/after `includeWhen`, `readyWhen`, `forEach` expressions (FR-006). Use existing `NodeDetailPanel` pattern or inline tooltip. Show "Before:" / "After:" labels with the expressions rendered via `KroCodeBlock`.

- [ ] T012 Create `web/src/components/RGDDiffView.css`: all node and edge overlay styles using `var(--color-diff-added)` etc. tokens defined in Phase 0. Dashed border for removed nodes. No hardcoded hex/rgba.

**Checkpoint**: Given two manually constructed `K8sObject` revision fixtures, `RGDDiffView` renders a merged DAG with correct color-coded nodes.

---

## Phase 3: Integration + E2E

**Purpose**: Wire `RevisionSelector` and `RGDDiffView` into `RevisionsTab.tsx`.
Add E2E journey (capability-gated). Update playwright config.

- [ ] T013 Update `web/src/components/RevisionsTab.tsx`: add `RevisionSelector` above the existing compare action bar. When `RevisionSelector` emits a pair, call `diffDAGGraphs` and render `RGDDiffView`. The existing side-by-side YAML diff section (PR #318 foundation, GH #13) MUST remain below the DAG diff — it is a complementary raw-data view, not a replacement.

- [ ] T014 Run `bun run tsc --noEmit` and fix any type errors introduced by the integration

- [ ] T015 Run full test suite: `GOPROXY=direct GONOSUMDB="*" go test -race ./... && cd web && bun run vitest run` — must be green before E2E work

- [ ] T016 Create `test/e2e/journeys/009-rgd-graph-diff.spec.ts`:
  - Step 1: `page.request.get(/api/v1/kro/capabilities)` → skip entire journey with `test.skip()` + `return` when `hasGraphRevisions: false` (§XIV, D4 audit finding)
  - Step 2 (gated): navigate to an RGD with 2+ revisions → verify Revisions tab visible
  - Step 3 (gated): select Rev A and Rev B → verify DAG diff renders with at least one node
  - Step 4 (gated): single-revision RGD → verify "Only one revision exists" message (US1-5)
  - All steps MUST use `page.request.get()` API checks before UI navigation

- [ ] T017 Update `test/e2e/playwright.config.ts`: ensure `009-*.spec.ts` matches an existing chunk (chunk-9 matches `(060|062|064|065|066|069|070)-*.spec.ts`). Either extend chunk-9 regex to include `009` or note that chunk-1 already matches `001-006` — confirm file is matched; if not, add `009` to chunk-9 pattern and update `serial` dependencies.

**Checkpoint**: `bun run tsc --noEmit` clean. All unit tests pass. E2E journey file registered in a chunk.

---

## Phase 4: Final Verification

- [ ] T018 [P] Run `GOPROXY=direct GONOSUMDB="*" go vet ./...` — must be clean
- [ ] T019 [P] Run `cd web && bun run tsc --noEmit` — must be clean
- [ ] T020 [P] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./...` — must pass
- [ ] T021 [P] Run `cd web && bun run vitest run` — must pass (includes dag-diff.test.ts 9 cases)
- [ ] T022 Verify brace depth of `009-rgd-graph-diff.spec.ts` is 0 (§XIV)
- [ ] T023 Verify `009-*.spec.ts` appears in a `testMatch` pattern in `playwright.config.ts` (§XIV)

**Checkpoint**: All checks green. Ready for PR.

---

## Success Criteria (from spec.md)

- SC-001: Diff tab hidden when `hasGraphRevisions: false` ✓ (T016 Step 1)
- SC-002: Added/removed/modified nodes visually distinguishable ✓ (T009–T010)
- SC-003: Expression diff shown for modified nodes ✓ (T011)
- SC-004: TypeScript strict mode passes with 0 errors ✓ (T019)
