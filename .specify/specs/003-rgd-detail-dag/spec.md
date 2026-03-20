# Feature Specification: RGD Detail — DAG Visualization

**Feature Branch**: `003-rgd-detail-dag`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User views the dependency graph of an RGD (Priority: P1)

A user navigates to `/rgds/dungeon-graph` and sees an SVG graph showing all resource nodes, dependency edges, and kro-specific node types (root CR, managed resources, specPatch state nodes, includeWhen conditional nodes, forEach fan-outs).

**Why this priority**: The DAG is the core visualization of kro-ui. It is the main reason someone would open this tool.

**Independent Test**: Open `/rgds/dungeon-graph` with a cluster. Confirm the root `Dungeon` node and all child resource nodes appear with correct labels. Confirm edges exist between dependent nodes.

**Acceptance Scenarios**:

1. **Given** an RGD with 8 resources and 2 specPatch nodes, **When** the DAG renders, **Then** all 10 nodes appear with correct labels, kinds, and visual type indicators
2. **Given** a resource with `includeWhen` expressions, **When** the node renders, **Then** it has a visual indicator (dashed border or badge) distinguishing it as conditional
3. **Given** a resource with `forEach`, **When** the node renders, **Then** it has a forEach indicator (∀ badge)
4. **Given** a specPatch state node, **When** the node renders, **Then** it is visually distinct from managed resource nodes (different shape/color)
5. **Given** the DAG has more nodes than fit in the viewport, **When** the user scrolls horizontally, **Then** all nodes are reachable via scroll (no clipping)

---

### User Story 2 — User clicks a node to inspect its CEL expressions and concept (Priority: P1)

Clicking any DAG node opens a right-side detail panel showing the node's kind, type badge, concept explanation (what is this kro concept), CEL expressions (includeWhen, readyWhen, forEach, stateFields), and raw YAML template.

**Why this priority**: Node inspection is the primary way users understand what an RGD does.

**Independent Test**: Click the `bossCR` node → right panel appears with "Kind: Boss", concept explanation for "managed resource", and any CEL expressions on that node.

**Acceptance Scenarios**:

1. **Given** a managed resource node, **When** clicked, **Then** the panel shows kind, the "managed resource" concept explanation, and any CEL expressions
2. **Given** a specPatch state node, **When** clicked, **Then** the panel shows state fields and the "specPatch" concept explanation
3. **Given** a node with `includeWhen: ["${foo.status.ready}"]`, **When** clicked, **Then** the panel shows the CEL expression with the kro highlighter
4. **Given** the panel is open for node A, **When** node B is clicked, **Then** the panel updates to show node B's details
5. **Given** the panel close button is clicked, **Then** the panel closes and the DAG takes full width

---

### User Story 3 — User views the raw RGD YAML with CEL highlighting (Priority: P2)

On the RGD detail page there is a "YAML" tab that shows the full raw RGD YAML with kro's custom syntax highlighting: gray for YAML keys, blue for CEL expressions (`${...}`), pink for schema types, dark slate for kro keywords.

**Why this priority**: Raw YAML inspection is important for debugging and understanding the full RGD definition.

**Independent Test**: Navigate to YAML tab on `dungeon-graph`. Confirm CEL expressions (`${...}`) are highlighted in blue and schema types (`string`, `integer`) are highlighted in pink/rose.

**Acceptance Scenarios**:

1. **Given** an RGD YAML with CEL expressions, **When** the YAML tab renders, **Then** `${...}` tokens are highlighted in the kro primary blue
2. **Given** a schema type like `string | default=warrior`, **When** rendered, **Then** `string` is pink, `|` is muted gray, `default` is muted blue, `warrior` is lavender
3. **Given** a kro keyword like `readyWhen:` or `forEach:`, **When** rendered, **Then** it is highlighted in dark slate (different from regular YAML keys)
4. **Given** a very long YAML (500+ lines), **When** the tab renders, **Then** the YAML is scrollable in its container with no layout overflow

---

### Edge Cases

- What if the RGD has no resources? → Show the root node alone with a message "No managed resources defined."
- What if the graph has a circular dependency (shouldn't happen in valid kro, but)? → Render best-effort without crashing; show a warning badge.
- What if an RGD name contains special characters? → URL-encode on navigation; decode on the page.

## Requirements

### Functional Requirements

- **FR-001**: DAG MUST be rendered as inline SVG using a BFS-layered layout (port from open-krode)
- **FR-002**: Node types MUST be visually distinct: root CR (blue accent), managed resource (default), specPatch (yellow/amber), includeWhen (dashed), forEach (∀ badge), readyWhen (check badge)
- **FR-003**: Clicking a node MUST open a right-side detail panel without page navigation
- **FR-004**: The detail panel MUST show: kind, type badge(s), concept explanation, CEL expressions (highlighted), close button
- **FR-005**: A "YAML" tab MUST show the full raw RGD manifest with the kro CEL/schema highlighter
- **FR-006**: The DAG MUST be horizontally scrollable when wider than the viewport
- **FR-007**: The DAG layout algorithm MUST be deterministic (same input → same layout every render)
- **FR-008**: The page MUST fetch the RGD from `GET /api/v1/rgds/:name` and also list instances via `GET /api/v1/rgds/:name/instances` for the instances tab
- **FR-009**: No YAML highlighting libraries (no Prism, no highlight.js) — custom tokenizer only

### Key Entities

- **DAGGraph component**: `{nodes: DAGNode[], edges: DAGEdge[]}` — data-driven, no hardcoded kro concepts in the renderer itself
- **NodeDetailPanel**: right-side slide-in showing CEL and concept info
- **KroCodeBlock component**: custom tokenizer for kro YAML
- **RGDDetail page**: tabs — Graph | Instances | YAML

## Success Criteria

- **SC-001**: DAG renders all nodes for `dungeon-graph` (16 resources) within 500ms of API response
- **SC-002**: Clicking a node opens the detail panel within 50ms (no API call needed — data already in memory)
- **SC-003**: CEL expressions in YAML tab are highlighted in the correct color for 100% of `${...}` tokens
- **SC-004**: DAG layout is stable across re-renders (same graph = same node positions)
