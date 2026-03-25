# Feature Specification: RGD Chaining — Deep Graph Visualization

**Feature Branch**: `012-rgd-chaining-deep-graph`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `005-instance-detail-live` (merged)
**Constitution ref**: §II (Cluster Adaptability — dynamic client), §III (Read-Only),
§V (Simplicity), §IX (Theme)

---

## Context

kro supports RGD chaining: an RGD's managed resources can include instances of
other RGDs. For example, a `FullStackApp` RGD might create a `Database` instance
(managed by the `database` RGD) and a `WebApplication` instance (managed by the
`web-application` RGD).

The current live DAG (spec 005) shows chained RGD instances as opaque leaf
nodes. The deep graph view recursively expands them, revealing the full composed
resource tree down to leaf Kubernetes resources.

---

## User Scenarios & Testing

### User Story 1 — Operator expands a chained RGD instance in the DAG (Priority: P1)

On the instance detail live DAG, the operator sees a node whose kind matches a
kro-generated CRD (e.g., `Database`). The node has an "expand" affordance. Clicking
it fetches the child RGD instance's resources and renders them as a nested
subgraph inside the parent DAG.

**Why this priority**: RGD chaining is a core kro pattern. Without deep
expansion, operators must manually `kubectl get` each nested instance to find
the root cause of a failure — defeating the purpose of a visual dashboard.

**Independent Test**: With a `FullStackApp` instance that chains a `Database`
RGD, click the expand icon on the `database` node. Confirm: the node expands
to reveal the Database RGD's internal resources (StatefulSet, Service, Secret)
with their live states.

**Acceptance Scenarios**:

1. **Given** a node whose GVK matches a kro-managed CRD (detected by checking
   if a `ResourceGraphDefinition` exists for that kind), **When** the DAG
   renders, **Then** the node shows an expand icon (`▸`) indicating it can be
   drilled into
2. **Given** the expand icon is clicked, **When** the child instance's resources
   are fetched, **Then** the node visually expands into a nested subgraph showing
   all child resources with live state colors
3. **Given** the nested subgraph is expanded, **When** a child resource node is
   clicked, **Then** the detail panel shows its YAML (same as spec 005 behavior)
4. **Given** a 3-level chain (App → Database → StorageVolume), **When** expanding
   recursively, **Then** up to 4 levels deep are expanded; deeper levels show a
   "Max depth reached" indicator
5. **Given** the nested subgraph is expanded, **When** the collapse icon (`▾`)
   is clicked, **Then** the subgraph collapses back to a single node
6. **Given** a child RGD instance is not yet ready, **When** expanded, **Then**
   its internal nodes show their individual states (pending, error, etc.) —
   providing root-cause visibility

---

### User Story 2 — Operator sees chained instance status propagation (Priority: P2)

The parent DAG node for a chained instance reflects the aggregated status of its
children. If the child instance's `Ready` condition is `False`, the parent node
shows error state — even before expansion.

**Acceptance Scenarios**:

1. **Given** a chained `Database` instance with `Ready=True`, **When** the parent
   DAG renders (collapsed), **Then** the `database` node shows green (alive)
2. **Given** a chained `Database` instance with `Ready=False`, **When** rendered,
   **Then** the `database` node shows red (error) with a tooltip "Child instance
   not ready — expand to see details"

---

### Edge Cases

- Circular RGD chaining (A → B → A) → detect cycle, show warning badge, do NOT
  recurse infinitely; max depth of 4 prevents this
- Child RGD deleted from cluster → nested expansion shows "RGD not found"
- Child instance in a different namespace → fetch across namespaces (read-only
  RBAC must allow this)
- Non-kro CRD instances (e.g., a Crossplane XR) → do NOT attempt expansion;
  show as regular resource nodes

---

## Requirements

### Functional Requirements

- **FR-001**: DAG MUST detect kro-managed CRD nodes by checking if a
  `ResourceGraphDefinition` exists whose `spec.schema.kind` matches the node's kind
- **FR-002**: Expandable nodes MUST show an expand/collapse toggle icon
- **FR-003**: Expansion MUST fetch the child instance detail and children
  endpoints (same as spec 005 FR-001)
- **FR-004**: Nested subgraphs MUST be rendered inline within the parent DAG,
  visually contained within the parent node's boundary (rounded container with
  a subtle background tint)
- **FR-005**: Nested nodes MUST show live state colors (reusing spec 005 state
  mapping)
- **FR-006**: Recursion depth MUST be capped at 4 levels
- **FR-007**: Expansion state MUST survive poll refreshes (do NOT collapse on
  5s poll cycle)

### Non-Functional Requirements

- **NFR-001**: Single-level expansion renders within 1s (one API round-trip)
- **NFR-002**: TypeScript strict mode MUST pass
- **NFR-003**: No layout shift in the parent DAG when a child expands — the
  parent graph re-layouts to accommodate the expanded subgraph
- **NFR-004**: Any `<foreignObject>` element inside the DeepDAG SVG MUST carry
  `overflow="visible"` so that expanded child content does not get clipped to the
  foreignObject bounds. After expansion, the SVG `viewBox` MUST be recalculated to
  encompass the new bounding box height.

### Key Components

- **`DeepDAG`** (`web/src/components/DeepDAG.tsx`): wraps `LiveDAG` with
  recursive expansion capability
- **`ExpandableNode`** (`web/src/components/ExpandableNode.tsx`): DAG node with
  expand/collapse toggle; renders nested `LiveDAG` when expanded
- **`detectKroInstance`** (`web/src/lib/dag.ts`): pure function that checks if a
  resource's kind matches a known RGD's `spec.schema.kind`

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/dag.test.ts (extended)
describe("detectKroInstance", () => {
  it("returns true when kind matches an existing RGD schema kind", () => { ... })
  it("returns false for native Kubernetes kinds", () => { ... })
  it("returns false for non-kro CRDs", () => { ... })
})

// web/src/components/DeepDAG.test.tsx
describe("DeepDAG", () => {
  it("renders expand icon on kro-managed CRD nodes", () => { ... })
  it("renders nested subgraph on expand", () => { ... })
  it("caps recursion at 4 levels", () => { ... })
  it("collapses subgraph on toggle", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Kro-managed CRD nodes show expand icon
- **SC-002**: Expansion reveals child resources with live state colors
- **SC-003**: 3-level chain expands correctly; 5th level shows "Max depth"
- **SC-004**: Expansion survives poll refreshes
- **SC-005**: TypeScript strict mode passes with 0 errors
