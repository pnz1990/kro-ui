# Tasks: RGD Chaining — Deep Graph Visualization

**Spec**: `012-rgd-chaining-deep-graph`
**Plan**: `plan.md`
**Generated**: 2026-03-21

---

## Phase 1: Core Logic (dag.ts)

- [X] **T001**: Add `detectKroInstance(kind, rgds)` pure function to `web/src/lib/dag.ts`
  - Returns `true` when `kind` matches any RGD's `spec.schema.kind`
  - Pure — no side effects, never throws
  - Case-sensitive (kro kinds are PascalCase)

- [X] **T002**: Add `detectKroInstance` unit tests to `web/src/lib/dag.test.ts`
  - `T012`: returns true for matching RGD schema kind
  - `T013`: returns false for native k8s kinds
  - `T014`: returns false when rgds is empty
  - `T015`: is case-sensitive

---

## Phase 2: Components

- [X] **T003**: Create `web/src/components/ExpandableNode.tsx`
  - SVG node group with `▸`/`▾` toggle in top-right
  - When `isExpanded=false`: renders same as LiveDAG NodeGroup
  - When `isExpanded=true`: renders node + `foreignObject` containing nested `LiveDAG`
  - Loading/error states for nested fetch
  - Max depth indicator when `depth >= 4`

- [X] **T004**: Create `web/src/components/DeepDAG.tsx`
  - Wraps `LiveDAG` with recursive expansion capability
  - Fetches `listRGDs()` if not passed (or accepts `rgds` prop)
  - Holds `expandedNodes: Map<nodeId, ExpandedNodeData>` in state
  - On expand click: fetches `getRGD(rgdName)` → `buildDAGGraph` + `getInstance` + `getInstanceChildren` → `buildNodeStateMap`
  - Expansion state survives re-renders (FR-007)
  - Passes `onNodeClick` through to nested nodes
  - Detects kro nodes via `detectKroInstance` and replaces standard NodeGroup with `ExpandableNode`

- [X] **T005**: Create `web/src/components/DeepDAG.css`
  - Expand toggle styles (`.deep-dag-expand-toggle`)
  - Nested container styles (`.deep-dag-nested-container`)
  - Max depth indicator styles

---

## Phase 3: Tests

- [X] **T006**: Create `web/src/components/DeepDAG.test.tsx`
  - Mock `getInstance`, `getInstanceChildren`, `getRGD`, `listRGDs` from `@/lib/api`
  - `T001`: renders expand icon on kro-managed CRD nodes
  - `T002`: does NOT render expand icon on non-kro nodes
  - `T003`: renders nested subgraph on expand click
  - `T004`: caps recursion at 4 levels
  - `T005`: collapses subgraph on toggle

---

## Phase 4: Integration

- [X] **T007**: Update `web/src/pages/InstanceDetail.tsx`
  - Fetch `listRGDs()` once at mount (alongside RGD spec)
  - Replace `<LiveDAG>` with `<DeepDAG>` passing `rgds` and `namespace`
  - Pass existing `nodeStateMap`, `children`, `onNodeClick`, `selectedNodeId`

---

## Phase 5: Validation

- [X] **T008**: Run `bun run typecheck` — must pass with 0 errors
- [X] **T009**: Run `bun run test` — all tests must pass
- [X] **T010**: Manual review: all FR/NFR acceptance criteria met
