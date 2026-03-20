# Feature Specification: RGD Detail — DAG Visualization

**Feature Branch**: `003-rgd-detail-dag`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `002-rgd-list-home` (merged)
**Constitution ref**: §II (Cluster Adaptability), §V (Simplicity — no D3, no
force simulation), §VI (Go Standards), §IX (Theme)

---

## User Scenarios & Testing

### User Story 1 — Operator views the dependency graph of an RGD (Priority: P1)

An operator navigates to `/rgds/dungeon-graph` and sees an SVG dependency graph
showing the complete resource topology: root CR, managed resources, specPatch
state nodes, includeWhen conditional nodes, and forEach fan-outs — each with a
distinct visual treatment.

**Why this priority**: The DAG is the primary visualization of kro-ui. It is the
main reason an operator would open this tool rather than using kubectl.

**Independent Test**: Open `/rgds/dungeon-graph` against a live cluster. Confirm
the `Dungeon` root node appears, all child resource nodes appear with their
labels, dependency edges are drawn, and node types are visually distinct.

**Acceptance Scenarios**:

1. **Given** `dungeon-graph` with 7 resource nodes and 9 specPatch nodes,
   **When** the page loads, **Then** all 16 nodes are rendered in the SVG with
   correct labels and type indicators; edges connect all dependent pairs
2. **Given** a resource with `includeWhen` expressions, **When** rendered,
   **Then** the node has a dashed border indicating conditionality
3. **Given** a resource with a `forEach` dimension, **When** rendered, **Then**
   the node carries an `∀` badge
4. **Given** a specPatch state node, **When** rendered, **Then** it is visually
   distinct from managed resource nodes (amber/yellow fill vs default blue)
5. **Given** the graph is wider than the viewport, **When** rendered, **Then**
   horizontal scrolling is available and all nodes remain reachable
6. **Given** the same RGD data is rendered twice, **When** compared, **Then**
   the node positions are identical (layout is deterministic)

---

### User Story 2 — Operator clicks a node to inspect its CEL expressions (Priority: P1)

Clicking any DAG node opens a right-side detail panel with the node's kind, type
badges, kro concept explanation, and all CEL expressions on that node. The panel
appears without a page navigation or additional API call.

**Why this priority**: Node inspection is the primary way an operator understands
what an RGD does. The data is already in the RGD object fetched on page load.

**Independent Test**: Click the `bossCR` node. Confirm the panel slides in
showing "Kind: Boss", the "managed resource" concept explanation, and any
`readyWhen` expressions on that node. Close button dismisses the panel.

**Acceptance Scenarios**:

1. **Given** a managed resource node, **When** clicked, **Then** the detail
   panel shows: kind badge, "managed resource" concept explanation, any
   `readyWhen` expressions highlighted with the CEL highlighter
2. **Given** a specPatch state node, **When** clicked, **Then** the panel shows:
   "specPatch" concept explanation and all state fields with their CEL values
3. **Given** a node with `includeWhen: ["${foo.status.ready}"]`, **When** the
   panel opens, **Then** the `${...}` token appears in `var(--hl-cel-expression)`
   color (constitution §VI, see spec 006)
4. **Given** the panel is open for node A, **When** node B is clicked, **Then**
   the panel updates to node B without animation lag
5. **Given** the ✕ close button is clicked, **When** the panel closes, **Then**
   the DAG takes full width again

---

### User Story 3 — Operator reads the raw RGD YAML with CEL highlighting (Priority: P2)

A "YAML" tab on the RGD detail page shows the full manifest with kro's custom
syntax highlighting. An operator can read it to understand the exact CEL
expressions without using kubectl.

**Why this priority**: Raw YAML inspection is the fallback for debugging anything
not surfaced by the DAG view.

**Independent Test**: Navigate to the YAML tab on `dungeon-graph`. Confirm:
- `${...}` tokens are blue (`var(--hl-cel-expression)`)
- `readyWhen:` label is dark slate (`var(--hl-kro-keyword)`)
- `string` type annotations are pink/amber (`var(--hl-schema-type)`)

**Acceptance Scenarios**:

1. **Given** a YAML with `${clusterVPC.status.vpcID}`, **When** rendered,
   **Then** the full `${...}` span is colored `var(--hl-cel-expression)`
2. **Given** a kro keyword `readyWhen:`, **When** rendered, **Then** it is
   colored `var(--hl-kro-keyword)` — visually different from regular YAML keys
3. **Given** a SimpleSchema type `string | default=warrior`, **When** rendered,
   **Then** `string` → `var(--hl-schema-type)`, `|` → `var(--hl-schema-pipe)`,
   `default` → `var(--hl-schema-keyword)`, `warrior` → `var(--hl-schema-value)`
4. **Given** a 400-line RGD YAML, **When** the tab renders, **Then** the YAML
   is scrollable in its container with no layout overflow and no visible
   performance degradation

---

### User Story 4 — Page has tabs for Graph, Instances, and YAML (Priority: P2)

The RGD detail page has a tab bar: "Graph" (default), "Instances", and "YAML".
The active tab is reflected in the URL query parameter so it can be bookmarked
and shared.

**Why this priority**: Consistent navigation reduces cognitive load. The
Instances tab is also required by spec 004.

**Independent Test**: Navigate to `/rgds/dungeon-graph`. Default tab is "Graph".
Click "Instances" → URL becomes `/rgds/dungeon-graph?tab=instances`. Reload →
Instances tab is still active.

**Acceptance Scenarios**:

1. **Given** the page loads with no `?tab` parameter, **When** rendered, **Then**
   the "Graph" tab is active
2. **Given** `?tab=instances`, **When** the page renders, **Then** the
   "Instances" tab content is shown
3. **Given** `?tab=yaml`, **When** the page renders, **Then** the YAML tab
   content is shown
4. **Given** `?tab=<invalid>`, **When** the page renders, **Then** it falls back
   to the "Graph" tab

---

### Edge Cases

- RGD with 0 resources → show root node alone with note "No managed resources
  defined"
- RGD name with URL-special characters → URL-encoded in route params; decoded in
  the page component with `decodeURIComponent`
- `spec.resources` field absent or null → treat as empty array; do not crash
- DAG graph with a node referencing a non-existent dependency (malformed RGD) →
  render best-effort; show a warning badge on the orphaned node

---

## Requirements

### Functional Requirements

- **FR-001**: Page MUST fetch `GET /api/v1/rgds/:name` on mount and build the
  DAG client-side from `spec.resources` and their CEL cross-references
- **FR-002**: DAG MUST be rendered as inline SVG using a BFS-layered layout
  algorithm — no D3, no force simulation, no external graph library
- **FR-003**: Node type visual treatments:

  | Node type | Visual indicator |
  |-----------|-----------------|
  | Root CR | Blue accent border, "root" badge |
  | Managed resource | Default card style |
  | specPatch state node | Amber/yellow fill |
  | `includeWhen` conditional | Dashed border |
  | `forEach` fan-out | `∀` badge |
  | `readyWhen` | Check badge |

- **FR-004**: Clicking a node MUST open the `NodeDetailPanel` without any
  additional API call — all data is in the already-loaded RGD object
- **FR-005**: `NodeDetailPanel` MUST show: kind, type badge(s), concept
  explanation, CEL expressions (via `KroCodeBlock` component from spec 006)
- **FR-006**: A "YAML" tab MUST render the full RGD manifest via `KroCodeBlock`
  (spec 006) — no external highlighter
- **FR-007**: An "Instances" tab MUST render the instance list (spec 004 content)
  fetched from `GET /api/v1/rgds/:name/instances`
- **FR-008**: Active tab MUST be reflected in `?tab=graph|instances|yaml` URL
  query parameter and restored on reload
- **FR-009**: The DAG layout algorithm MUST be deterministic (same input → same
  output every call)
- **FR-010**: The DAG MUST be horizontally scrollable when wider than the
  viewport; no content clipping

### Non-Functional Requirements

- **NFR-001**: DAG renders all nodes for `dungeon-graph` (16 nodes) in under
  500ms after the API response arrives
- **NFR-002**: Node click opens detail panel in under 50ms (no I/O)
- **NFR-003**: TypeScript strict mode — `tsc --noEmit` reports 0 errors
- **NFR-004**: `DAGGraph` component MUST be purely data-driven: accepts
  `{nodes: DAGNode[], edges: DAGEdge[]}` — zero kro-specific logic inside
  the renderer itself (kro concepts live in the page/hook layer)

### Key Components

- **`RGDDetail`** (`web/src/pages/RGDDetail.tsx`): page component, tab routing,
  fetches RGD data, builds DAG graph from `spec`
- **`DAGGraph`** (`web/src/components/DAGGraph.tsx`): pure SVG renderer,
  data-driven, no kro knowledge
- **`NodeDetailPanel`** (`web/src/components/NodeDetailPanel.tsx`): slide-in
  panel with CEL details and concept explanation
- **`KroCodeBlock`** (`web/src/components/KroCodeBlock.tsx`): from spec 006
- **`buildDAGGraph`** (`web/src/lib/dag.ts`): pure function converting an RGD
  `spec` object into `{nodes: DAGNode[], edges: DAGEdge[]}`. Independently
  testable. This is where kro-specific parsing lives.

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/dag.test.ts
describe("buildDAGGraph", () => {
  it("returns root node for minimal RGD", () => { ... })
  it("creates edges for direct CEL references between resources", () => { ... })
  it("marks includeWhen nodes as conditional", () => { ... })
  it("marks forEach nodes correctly", () => { ... })
  it("is deterministic — same input produces same node positions", () => { ... })
})

// web/src/components/NodeDetailPanel.test.tsx
describe("NodeDetailPanel", () => {
  it("shows kind badge for managed resource nodes", () => { ... })
  it("shows specPatch concept explanation for state nodes", () => { ... })
  it("calls onClose when ✕ is clicked", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: All 16 nodes for `dungeon-graph` render within 500ms of API response
- **SC-002**: Node click opens detail panel in under 50ms
- **SC-003**: CEL expressions in YAML tab are highlighted correctly per spec 006
- **SC-004**: DAG layout is stable — 3 consecutive renders of the same RGD
  produce identical SVG structure (verified by unit test)
- **SC-005**: TypeScript strict mode passes with 0 errors
- **SC-006**: `buildDAGGraph` unit tests cover all node type classifications
