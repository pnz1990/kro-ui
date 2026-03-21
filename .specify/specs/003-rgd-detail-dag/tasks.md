# Tasks: RGD Detail — DAG Visualization

**Input**: spec.md from `/specs/003-rgd-detail-dag/`
**Prerequisites**: 002-rgd-list-home (merged), 006-cel-highlighter (merged)

**Tests**: Unit tests are required before merge (spec Testing Requirements). TDD: write tests first, then implement.

**Organization**: Tasks are grouped by phase. Phase 1 is infrastructure. Phase 2 is the DAG graph builder (pure function, no React). Phase 3 is the SVG renderer. Phase 4 is the node detail panel. Phase 5 is the page rewrite with tabs. Phase 6 is E2E.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

All frontend source files are under `web/src/`. Tests are co-located (`*.test.ts`/`*.test.tsx`). E2E tests under `test/e2e/journeys/`.

---

## Phase 1: Setup & Data Model

**Purpose**: Define the DAG data types and classification constants. No rendering yet.

- [x] T001 Create `web/src/lib/dag.ts` with exported types: `NodeType` (string union: `'instance' | 'resource' | 'collection' | 'external' | 'externalCollection'`), `DAGNode` interface (`{ id: string; label: string; nodeType: NodeType; kind: string; isConditional: boolean; hasReadyWhen: boolean; celExpressions: string[]; includeWhen: string[]; forEach?: string; template?: Record<string, unknown>; externalRef?: Record<string, unknown>; x: number; y: number; width: number; height: number }`), `DAGEdge` interface (`{ from: string; to: string }`), `DAGGraph` interface (`{ nodes: DAGNode[]; edges: DAGEdge[]; width: number; height: number }`). Export a stub `buildDAGGraph(spec: Record<string, unknown>): DAGGraph` that returns `{ nodes: [], edges: [], width: 0, height: 0 }`. Ensure `bun run typecheck` passes.

---

## Phase 2: DAG Graph Builder (pure function — US1)

**Purpose**: `buildDAGGraph` parses an RGD `spec` object into typed nodes and edges. All kro-specific parsing lives here. This is the core logic spec FR-001 through FR-004.

### Tests (write FIRST)

- [x] T002 [P] Create `web/src/lib/dag.test.ts` — test `buildDAGGraph` with a minimal RGD spec containing one resource with `template` → expect one `DAGNode` with `nodeType: 'resource'` plus the root `'instance'` node; assert `nodes.length === 2`
- [x] T003 [P] Add test: RGD spec with `template` + `forEach` → node classified as `'collection'`; node has `forEach` field populated
- [x] T004 [P] Add test: RGD spec with `externalRef.metadata.name` → classified as `'external'`
- [x] T005 [P] Add test: RGD spec with `externalRef.metadata.selector` → classified as `'externalCollection'`
- [x] T006 [P] Add test: resource with `includeWhen` array → `isConditional: true` on the node; `nodeType` is still `'resource'` (not a separate type, per FR-004)
- [x] T007 [P] Add test: CEL cross-reference edges — resource B references `${resourceA.metadata.name}` in its template → edge from `resourceA` to `resourceB`
- [x] T008 [P] Add test: determinism — call `buildDAGGraph` twice with same input → `nodes` positions are identical (FR-011)
- [x] T009 [P] Add test: `specPatch` does NOT produce a node type — if a resource has no `template` and no `externalRef` but has some unknown structure, classify as `'resource'` with a warning flag, never as `'specPatch'` (FR-012)
- [x] T010 [P] Add test: empty `spec.resources` (null or `[]`) → returns only the root instance node, `edges` is empty
- [x] T011 [P] Add test: root instance node is always present with `nodeType: 'instance'`, `id: 'schema'`, and kind from `spec.schema.kind`

### Implementation

- [x] T012 Implement `buildDAGGraph` in `web/src/lib/dag.ts`: (1) extract `spec.schema` for root node, (2) iterate `spec.resources[]`, classify each into one of 5 `NodeType` values per FR-003 table, (3) scan all `template` values for `${resourceId.` CEL references to build edges, (4) run BFS-layered layout to assign `x, y` coordinates (root at top, dependents in layers below), (5) compute graph `width` and `height`. All kro field paths (`spec.resources[].id`, `spec.resources[].template`, etc.) live only in this file. No external graph library. Verify all T002–T011 tests pass.
- [x] T013 Run `bun run typecheck` — zero errors
- [x] T014 Run `bun run test` — all DAG builder tests pass

**Checkpoint**: Pure function converts RGD spec to DAGGraph. All node types classified correctly. Deterministic layout. No kro knowledge leaks outside dag.ts.

---

## Phase 3: SVG Renderer (US1)

**Purpose**: `DAGGraph` component renders `{nodes, edges}` as inline SVG. Data-driven, zero kro knowledge (NFR-004).

### Tests

- [x] T015 [P] Create `web/src/components/DAGGraph.test.tsx`
- [x] T016 [P] Add test: node with `nodeType: 'collection'` renders `∀` badge
- [x] T017 [P] Add test: node with `nodeType: 'external'` has dashed stroke style and `⬡` icon
- [x] T018 [P] Add test: root node (`nodeType: 'instance'`) has distinct styling
- [x] T019 [P] Add test: clicking a node calls `onNodeClick(nodeId)` callback

### Implementation

- [x] T020 Create `web/src/components/DAGGraph.css`
- [x] T021 Implement `DAGGraph` component in `web/src/components/DAGGraph.tsx`
- [x] T022 Run `bun run typecheck` + `bun run test` — all pass

**Checkpoint**: SVG renderer works with any DAGGraph input. Visual tokens from tokens.css. Accessible.

---

## Phase 4: Node Detail Panel (US2)

**Purpose**: Right-side panel showing node details with CEL highlighting when a DAG node is clicked.

### Tests

- [x] T023 [P] Create `web/src/components/NodeDetailPanel.test.tsx`
- [x] T024 [P] Add test: `NodeTypeCollection` → concept text shows "forEach Collection"
- [x] T025 [P] Add test: `NodeTypeExternal` → concept text shows "External Reference"
- [x] T026 [P] Add test: `NodeTypeInstance` → concept text shows "Root Custom Resource"
- [x] T027 [P] Add test: node with `includeWhen` expressions → `KroCodeBlock` renders the expressions
- [x] T028 [P] Add test: clicking close button calls `onClose` callback

### Implementation

- [x] T029 Create `web/src/components/NodeDetailPanel.css`
- [x] T030 Implement `NodeDetailPanel` in `web/src/components/NodeDetailPanel.tsx`
- [x] T031 Run `bun run typecheck` + `bun run test` — all pass

**Checkpoint**: Panel shows correct concept explanation per node type. CEL expressions highlighted. Close works.

---

## Phase 5: RGDDetail Page Rewrite (US3, US4)

**Purpose**: Rewrite `RGDDetail.tsx` with proper tab bar (Graph, Instances, YAML), DAG rendering on Graph tab, node selection wiring.

- [x] T032 Create `web/src/pages/RGDDetail.css`
- [x] T033 Rewrite `web/src/pages/RGDDetail.tsx`
- [x] T034 Create `web/src/pages/RGDDetail.test.tsx`
- [x] T035 Run `bun run typecheck` + `bun run test` — all pass

**Checkpoint**: Full page with 3 tabs. Graph tab shows DAG. Node click opens panel. YAML tab has CEL highlighting. URL reflects active tab.

---

## Phase 6: E2E & Final Verification

- [x] T036 Create `test/e2e/journeys/003-rgd-dag.spec.ts`
- [x] T037 Run `bun run typecheck` — zero errors
- [x] T038 Run `bun run test` — all unit tests pass
- [ ] T039 Visual verification: run `make build && make run` against a kro cluster, navigate to an RGD, confirm DAG renders with correct node types and colors

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1: Setup | T001 | Types and stubs |
| 2: DAG Builder | T002–T014 | Pure function, TDD |
| 3: SVG Renderer | T015–T022 | Component, tokens.css |
| 4: Node Detail Panel | T023–T031 | Side panel, CEL highlighting |
| 5: Page Rewrite | T032–T035 | Tab routing, wiring |
| 6: E2E | T036–T039 | Integration test |

**Total**: 39 tasks
