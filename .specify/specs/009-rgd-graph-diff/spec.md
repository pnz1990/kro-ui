# Feature Specification: RGD Graph Diff View

**Feature Branch**: `009-rgd-graph-diff`
**Created**: 2026-03-20
**Status**: Draft — BLOCKED (requires kro KREP-013 Graph Revisions, expected v0.9.0)
**Depends on**: `003-rgd-detail-dag` (merged)
**Constitution ref**: §II (Cluster Adaptability), §V (Simplicity), §IX (Theme)

---

## Blocked Status

This spec CANNOT be implemented until kro merges KREP-013 (Graph Revisions),
which introduces a `GraphRevision` CRD that tracks versioned snapshots of RGD
resource graphs. Without revisions, there is no second graph to diff against.

**KREP-013 PR**: https://github.com/kubernetes-sigs/kro/pull/1174
**Expected release**: kro v0.9.0

Once Graph Revisions land, this spec should be updated with the actual CRD
schema and API surface. The user stories and acceptance scenarios below are
written against the expected KREP-013 design.

---

## User Scenarios & Testing

### User Story 1 — Platform engineer compares two graph revisions (Priority: P1)

A platform engineer navigates to an RGD's detail page and selects "Diff" mode.
Two revision selectors appear. The engineer picks revision A (current) and
revision B (previous). A side-by-side DAG renders showing added nodes in green,
removed nodes in red, and modified nodes (changed CEL expressions, readyWhen,
includeWhen) in amber.

**Why this priority**: Understanding what changed between RGD versions is
critical for safe rollouts. `kubectl diff` on raw YAML is unreadable for
complex graphs with many CEL cross-references.

**Independent Test**: With an RGD that has at least 2 graph revisions, open the
diff view. Confirm: added nodes appear green, removed nodes appear red, unchanged
nodes appear gray, and modified nodes appear amber with a detail tooltip showing
the expression diff.

**Acceptance Scenarios**:

1. **Given** an RGD with revisions v1 (3 nodes) and v2 (4 nodes — 1 added),
   **When** diffing v1 → v2, **Then** the added node appears with a green
   background and `+` badge; existing nodes appear gray
2. **Given** a node whose `readyWhen` expression changed between revisions,
   **When** diffing, **Then** the node appears amber with a `~` badge; clicking
   it shows the before/after expression in the detail panel
3. **Given** a node removed in v2, **When** diffing v1 → v2, **Then** the
   removed node appears with a red background, dashed border, and `-` badge
4. **Given** revisions are selected in reverse order (v2 → v1), **When**
   rendered, **Then** the diff is inverted (what was added now shows as removed)
5. **Given** an RGD with only 1 revision, **When** the diff tab loads, **Then**
   a message "Only one revision exists — nothing to compare" is shown

---

### User Story 2 — Platform engineer reviews edge changes (Priority: P2)

Beyond node additions/removals, the diff view highlights new and removed
dependency edges. A new CEL reference between two resources creates a green edge;
a removed reference creates a red dashed edge.

**Acceptance Scenarios**:

1. **Given** revision v2 adds a CEL reference `${newResource.status.ready}` to
   an existing node, **When** diffing v1 → v2, **Then** a green edge appears
   from `newResource` to the referencing node
2. **Given** a CEL reference was removed in v2, **When** diffing, **Then** a
   red dashed edge appears where the reference used to be

---

### Edge Cases

- RGD with 0 revisions (pre-KREP-013 cluster) → show "Graph Revisions not
  supported on this cluster" and hide the Diff tab entirely (use capabilities
  API from spec 008)
- Revision objects deleted by garbage collection → show "Revision not found"
  for the missing side
- Node renamed between revisions (same kind, different ID) → treat as
  remove + add; do NOT attempt fuzzy matching

---

## Requirements

### Functional Requirements

- **FR-001**: Page MUST detect Graph Revision support via the capabilities API
  (`GET /api/v1/kro/capabilities`); if unsupported, the Diff tab MUST be hidden
- **FR-002**: Diff view MUST fetch two `GraphRevision` resources and build two
  DAG graphs client-side
- **FR-003**: Node diff classification: added (in B not A), removed (in A not B),
  modified (in both, different CEL/readyWhen/includeWhen), unchanged (identical)
- **FR-004**: Edge diff classification: added (in B not A), removed (in A not B)
- **FR-005**: Diff MUST be rendered as a single merged DAG (not side-by-side
  panels) with color-coded overlays for added/removed/modified
- **FR-006**: Clicking a modified node MUST show before/after expressions in
  the detail panel
- **FR-007**: All diff colors MUST use dedicated CSS tokens (to be added to
  `tokens.css` when this spec is unblocked)

### Non-Functional Requirements

- **NFR-001**: Diff renders within 1s for a 20-node graph
- **NFR-002**: TypeScript strict mode MUST pass

### Key Components

- **`RGDDiffView`** (`web/src/components/RGDDiffView.tsx`): merged DAG renderer
  with diff overlays
- **`RevisionSelector`** (`web/src/components/RevisionSelector.tsx`): dropdown
  for picking revisions
- **`diffDAGGraphs`** (`web/src/lib/dag-diff.ts`): pure function that takes two
  DAG graphs and returns a merged diff graph with node/edge classifications

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/dag-diff.test.ts
describe("diffDAGGraphs", () => {
  it("classifies node present in B but not A as added", () => { ... })
  it("classifies node present in A but not B as removed", () => { ... })
  it("classifies node with different CEL as modified", () => { ... })
  it("classifies identical nodes as unchanged", () => { ... })
  it("classifies new edge as added", () => { ... })
  it("classifies removed edge as removed", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Diff tab is hidden when Graph Revisions are not available
- **SC-002**: Added/removed/modified nodes are visually distinguishable
- **SC-003**: Expression diff is shown for modified nodes
- **SC-004**: TypeScript strict mode passes with 0 errors
