# Feature Specification: Collection Explorer

**Feature Branch**: `011-collection-explorer`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `005-instance-detail-live` (merged)
**Constitution ref**: §II (Cluster Adaptability — dynamic client), §III (Read-Only),
§V (Simplicity), §IX (Theme)

---

## Context

kro `forEach` collections expand a single resource definition into multiple
Kubernetes resources at runtime. Each generated resource is labeled with
`kro.run/node-id`, `kro.run/collection-index`, and `kro.run/collection-size`.

The collection explorer provides a dedicated view for inspecting these
expanded resources — something the DAG view cannot do because it shows
collections as a single node.

---

## User Scenarios & Testing

### User Story 1 — Operator drills into a collection from the live DAG (Priority: P1)

On the instance detail live DAG, the operator clicks a `NodeTypeCollection`
node. Instead of showing a single YAML panel, the detail panel shows a
"Collection" view: the source array expression, total item count, and a table
of expanded resources with their index, name, status, and age.

**Why this priority**: Collections can create dozens or hundreds of resources.
Without a dedicated explorer, operators must use `kubectl get -l kro.run/node-id=X`
to see individual items. This is the primary blind spot in the current live DAG.

**Independent Test**: With a `WorkerPool` instance that has `workers: ["alice", "bob", "charlie"]`,
click the `workerPods` collection node. Confirm: panel shows 3 items, each with
index (0, 1, 2), name (`myapp-alice`, `myapp-bob`, `myapp-charlie`), and live
status (Running/Pending/Failed).

**Acceptance Scenarios**:

1. **Given** a collection node `workerPods` with 3 items, **When** clicked,
   **Then** the detail panel shows: node ID, `forEach` expression, total count
   (3), and a table with columns: Index, Name, Kind, Status, Age
2. **Given** item at index 1 has `status.phase=Running`, **When** rendered in
   the table, **Then** the status cell shows a green dot and "Running"
3. **Given** item at index 2 has `status.phase=Pending`, **When** rendered,
   **Then** the status cell shows a violet dot and "Pending"
4. **Given** a collection with 50 items, **When** rendered, **Then** the table
   is scrollable within the panel; no pagination required for v1
5. **Given** a collection with 0 items (empty array), **When** clicked, **Then**
   the panel shows "Empty collection — 0 resources" with the `forEach` expression

---

### User Story 2 — Operator inspects a single collection item's YAML (Priority: P1)

From the collection table, clicking a row opens the resource's live YAML in a
nested panel (or replaces the table with a YAML view + back button).

**Why this priority**: Seeing the list is not enough — operators need to inspect
individual resources to debug issues.

**Independent Test**: In the collection table, click the row for `myapp-alice`.
Confirm: YAML is fetched and displayed with the `kubectl get` command shown.
Click "Back" to return to the collection table.

**Acceptance Scenarios**:

1. **Given** the collection table is visible, **When** a row is clicked, **Then**
   the panel transitions to show the resource's live YAML (fetched from
   `GET /api/v1/resources/:ns/:group/:version/:kind/:name`)
2. **Given** the YAML view is open, **When** "Back to collection" is clicked,
   **Then** the panel returns to the collection table without re-fetching
3. **Given** a resource that no longer exists (deleted during scale-down),
   **When** its row is clicked, **Then** "Resource not found in cluster" is shown

---

### User Story 3 — Collection health summary on the DAG node (Priority: P2)

The collection node on the live DAG shows a compact health summary badge:
`3/3 ready` (green), `2/3 ready` (amber), `0/3 ready` (red). This gives
at-a-glance collection health without opening the explorer.

**Acceptance Scenarios**:

1. **Given** all 3 items are ready, **When** the DAG renders, **Then** the
   collection node shows `3/3` in green text
2. **Given** 2 of 3 items are ready, **When** rendered, **Then** the node shows
   `2/3` in amber text
3. **Given** 0 items are ready, **When** rendered, **Then** the node shows
   `0/3` in red text

---

### Edge Cases

- Collection with cartesian product (2 iterators) → table shows all combinations;
  columns include both iterator dimensions
- Collection items created by kro but not yet observed (race condition) → show
  expected count from `collection-size` label, mark missing items as "Pending"
- Collection labels missing (pre-v0.8.0 kro) → fall back to listing child
  resources by owner reference; show "Legacy collection — labels unavailable"

---

## Requirements

### Functional Requirements

- **FR-001**: Clicking a `NodeTypeCollection` node MUST open the collection
  explorer panel instead of the standard YAML panel
- **FR-002**: Collection items MUST be fetched by label selector:
  `kro.run/node-id=<nodeId>,kro.run/instance-id=<instanceUID>`
- **FR-003**: Items MUST be sorted by `kro.run/collection-index` ascending
- **FR-004**: Each row MUST show: index, resource name, kind, status (derived
  from `status.conditions` or `status.phase`), age
- **FR-005**: Clicking a row MUST fetch and display the resource's live YAML
- **FR-006**: Collection health badge MUST be shown on the DAG node:
  `ready/total` with color based on ratio (all green, partial amber, none red)
- **FR-007**: Empty collections MUST show a clear empty state, not an error

### Non-Functional Requirements

- **NFR-001**: Collection table renders within 500ms for up to 100 items
- **NFR-002**: TypeScript strict mode MUST pass

### Key Components

- **`CollectionPanel`** (`web/src/components/CollectionPanel.tsx`): table view
  of collection items with drill-down to YAML
- **`CollectionBadge`** (`web/src/components/CollectionBadge.tsx`): `ready/total`
  badge rendered on the DAG collection node
- **`LiveDAG`** (extended): detect `NodeTypeCollection` click and route to
  `CollectionPanel` instead of `NodeDetailPanel`

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/components/CollectionPanel.test.tsx
describe("CollectionPanel", () => {
  it("renders one row per collection item", () => { ... })
  it("sorts items by collection-index", () => { ... })
  it("shows empty state for 0 items", () => { ... })
  it("transitions to YAML view on row click", () => { ... })
})

// web/src/components/CollectionBadge.test.tsx
describe("CollectionBadge", () => {
  it("shows green when all ready", () => { ... })
  it("shows amber when partially ready", () => { ... })
  it("shows red when none ready", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Collection node click opens explorer (not YAML panel)
- **SC-002**: Items sorted by index, status colors correct
- **SC-003**: DAG collection badge shows accurate ready/total count
- **SC-004**: TypeScript strict mode passes with 0 errors
