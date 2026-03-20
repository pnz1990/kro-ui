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

An operator navigates to `/rgds/web-service-graph` and sees an SVG dependency graph
showing the complete resource topology: root CR, managed resources, specPatch
state nodes, includeWhen conditional nodes, and forEach fan-outs — each with a
distinct visual treatment.

**Why this priority**: The DAG is the primary visualization of kro-ui. It is the
main reason an operator would open this tool rather than using kubectl.

**Independent Test**: Open `/rgds/web-service-graph` against a live cluster. Confirm
the `WebService` root node appears, all child resource nodes appear with their
labels, dependency edges are drawn, and node types are visually distinct.

**Acceptance Scenarios**:

1. **Given** `web-service-graph` with 7 resource nodes and 9 specPatch nodes,
   **When** the page loads, **Then** all 16 nodes are rendered in the SVG with
   correct labels and type indicators; edges connect all dependent pairs
2. **Given** a resource with `includeWhen` expressions, **When** rendered,
   **Then** the node has a dashed border indicating conditionality
3. **Given** a resource with a `forEach` dimension, **When** rendered, **Then**
   the node carries an `∀` badge
4. **Given** a specPatch state node, **When** rendered, **Then** it is visually
   visually distinct from managed resource nodes (`--node-specpatch-bg` fill + dashed border vs default style)
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

**Independent Test**: Click the `databaseCR` node. Confirm the panel slides in
showing "Kind: Database", the "managed resource" concept explanation, and any
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

**Independent Test**: Navigate to the YAML tab on `web-service-graph`. Confirm:
- `${...}` tokens are blue (`var(--hl-cel-expression)`)
- `readyWhen:` label is dark slate (`var(--hl-kro-keyword)`)
- `string` type annotations are pink/amber (`var(--hl-schema-type)`)

**Acceptance Scenarios**:

1. **Given** a YAML with `${clusterVPC.status.vpcID}`, **When** rendered,
   **Then** the full `${...}` span is colored `var(--hl-cel-expression)`
2. **Given** a kro keyword `readyWhen:`, **When** rendered, **Then** it is
   colored `var(--hl-kro-keyword)` — visually different from regular YAML keys
3. **Given** a SimpleSchema type `string | default=primary`, **When** rendered,
   **Then** `string``database` → `var(--hl-schema-type)`, `|``database` → `var(--hl-schema-pipe)`,
   `default``database` → `var(--hl-schema-keyword)`, `primary``database` → `var(--hl-schema-value)`
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

**Independent Test**: Navigate to `/rgds/web-service-graph`. Default tab is "Graph".
Click "Instances"`database` → URL becomes `/rgds/web-service-graph?tab=instances`. Reload →
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

- RGD with 0 resources`database` → show root node alone with note "No managed resources
  defined"
- RGD name with URL-special characters`database` → URL-encoded in route params; decoded in
  the page component with `decodeURIComponent`
- `spec.resources` field absent or null`database` → treat as empty array; do not crash
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

  See design spec `000-design-system` for full token definitions. Summary:

  | Node type | Background | Border | Extra |
  |-----------|-----------|--------|-------|
  | Root CR | `--node-root-bg` | `--node-root-border` (2px solid) | "root" pill badge |
  | Managed resource | `--node-default-bg` | `--node-default-border` (1px solid) | kind label |
  | specPatch state | `--node-specpatch-bg` | `--node-specpatch-border` (1px dashed) | `{}` icon |
  | `includeWhen` conditional | `--node-default-bg` | `--node-default-border` (1px dashed) | `?` icon |
  | `forEach` fan-out | `--node-default-bg` | `--node-default-border` (1px solid) | `∀` badge |
  | `readyWhen` | `--node-default-bg` | `--node-default-border` (1px solid) | `✓` badge |

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
- **FR-009**: The DAG layout algorithm MUST be deterministic (same input`database` → same
  output every call)
- **FR-010**: The DAG MUST be horizontally scrollable when wider than the
  viewport; no content clipping

### Non-Functional Requirements

- **NFR-001**: DAG renders all nodes for `web-service-graph` (16 nodes) in under
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

- **SC-001**: All 16 nodes for `web-service-graph` render within 500ms of API response
- **SC-002**: Node click opens detail panel in under 50ms
- **SC-003**: CEL expressions in YAML tab are highlighted correctly per spec 006
- **SC-004**: DAG layout is stable — 3 consecutive renders of the same RGD
  produce identical SVG structure (verified by unit test)
- **SC-005**: TypeScript strict mode passes with 0 errors
- **SC-006**: `buildDAGGraph` unit tests cover all node type classifications

---

## E2E User Journey

**File**: `test/e2e/journeys/003-rgd-dag.spec.ts`
**Cluster pre-conditions**: kind cluster running, kro installed, `test-app` RGD
applied. The `test-app` fixture has: 1 root CR (TestApp), 2 managed resource
nodes (Namespace, ConfigMap), 1 specPatch node, 1 includeWhen conditional node.

### Journey: Operator reads an RGD's dependency graph and inspects a node

```
Step 1: Navigate to RGD detail (Graph tab)
  - Navigate to http://localhost:10174/rgds/test-app
  - Assert: [data-testid="dag-svg"] is visible
  - Assert: [data-testid="tab-graph"] has aria-selected="true"

Step 2: All expected nodes are rendered
  - Assert: [data-testid="dag-node-root"] is visible (root CR node)
  - Assert: [data-testid="dag-node-configmap"] is visible
  - Assert: [data-testid="dag-node-namespace"] is visible
  - Assert: [data-testid="dag-node-specpatch-1"] is visible
  - Assert: count of [data-testid^="dag-node-"] equals 5

Step 3: Node type visual distinction
  - Assert: [data-testid="dag-node-specpatch-1"] has CSS class "node-specpatch"
    (amber fill)
  - Assert: [data-testid="dag-node-conditional-1"] has CSS class
    "node-conditional" (dashed border)

Step 4: Click a resource node`database` → detail panel opens
  - Click [data-testid="dag-node-configmap"]
  - Assert: [data-testid="node-detail-panel"] is visible
  - Assert: [data-testid="node-detail-kind"] has text "ConfigMap"
  - Assert: [data-testid="node-detail-concept"] is visible (concept explanation
    rendered)
  - Assert: panel did NOT navigate away (URL is still /rgds/test-app)

Step 5: Close panel
  - Click [data-testid="node-detail-close"]
  - Assert: [data-testid="node-detail-panel"] is not visible

Step 6: Switch to YAML tab
  - Click [data-testid="tab-yaml"]
  - Assert: URL contains ?tab=yaml
  - Assert: [data-testid="kro-code-block"] is visible
  - Assert: at least one span with class "token-cel" is present in the code
    block (the test-app fixture YAML contains at least one ${...} expression)

Step 7: YAML tab persists on reload
  - Reload the page
  - Assert: [data-testid="tab-yaml"] has aria-selected="true"
  - Assert: [data-testid="kro-code-block"] is visible
```

**What this journey does NOT cover** (unit tests only):
- DAG layout determinism (3-render stability check)
- All node type classifications in detail
- CEL token color accuracy (covered by journey 006)
