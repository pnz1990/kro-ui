# Feature Specification: readyWhen CEL Expressions on DAG Nodes

**Feature Branch**: `021-readywhen-cel-dag`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "Surface readyWhen CEL expressions on DAG nodes — show each node's readyWhen condition (highlighted via the existing CEL tokenizer) in the node tooltip and detail panel, so contributors can see exactly what a resource waits on before kro considers it ready"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Hover tooltip reveals readyWhen condition (Priority: P1)

A contributor reviewing an RGD graph hovers over a DAG node that has a `readyWhen` condition. A tooltip appears inline, showing the CEL expression(s) with syntax highlighting, without requiring a click to open the full detail panel. This gives an at-a-glance answer to "what does this resource wait on?" without navigating away from the graph overview.

**Why this priority**: The tooltip is the primary discoverability surface. Contributors scanning a large RGD with many nodes need a non-disruptive way to check individual readiness conditions. Clicking to open the panel is already available (P2); hover is the incremental improvement that makes the information effortless to access.

**Independent Test**: Can be fully tested by viewing an RGD whose resources include at least one `readyWhen` expression, hovering over that node, and verifying the tooltip appears with highlighted CEL content. Delivers standalone value: contributors discover readiness conditions without any panel interaction.

**Acceptance Scenarios**:

1. **Given** a DAG node whose resource defines one or more `readyWhen` CEL expressions, **When** a user hovers over that node, **Then** a tooltip appears near the node showing each expression with syntax highlighting consistent with the CEL Expressions detail panel section.
2. **Given** a DAG node with no `readyWhen` defined, **When** a user hovers over that node, **Then** no `readyWhen` tooltip content is shown (the tooltip must not show an empty "Ready When" heading).
3. **Given** a node tooltip is visible, **When** the user moves the pointer away from the node, **Then** the tooltip disappears without leaving stale content on the screen.
4. **Given** a DAG node near the right or bottom viewport edge, **When** the tooltip renders, **Then** it is clamped within the viewport so that it does not overflow off-screen.
5. **Given** the graph is in the static RGD view and the live instance view, **When** a node with `readyWhen` is hovered, **Then** the tooltip behaviour is consistent across both views.

---

### User Story 2 — Detail panel surfaces readyWhen as a dedicated, labelled section (Priority: P2)

A contributor clicks a DAG node in the RGD graph or the live instance graph. The detail panel that slides in already shows CEL expressions, but `readyWhen` is currently merged together with `includeWhen`, `forEach`, and status projections into a single block. This story requires that `readyWhen` expressions appear in their own clearly labelled "Ready When" section within the detail panel — separate from other CEL expressions — so the contributor can immediately identify what the resource waits on for kro to consider it ready.

**Why this priority**: The detail panel (click) already surfaces `readyWhen` in a merged block. Separating it into a dedicated section is a clarity improvement, not a new capability. The hover tooltip (P1) is the net-new behaviour that most directly addresses the feature request.

**Independent Test**: Can be fully tested by clicking a node with a `readyWhen` condition in either the static or live panel and confirming a "Ready When" section heading appears above the highlighted expressions, distinct from any `includeWhen` or `forEach` block.

**Acceptance Scenarios**:

1. **Given** a DAG node with one or more `readyWhen` expressions, **When** the user clicks it and the detail panel opens, **Then** the panel shows a "Ready When" section with each expression syntax-highlighted, separate from other CEL sections.
2. **Given** a DAG node with no `readyWhen` defined, **When** the panel opens, **Then** no "Ready When" section heading appears.
3. **Given** a node has both `readyWhen` and `includeWhen` defined, **When** the panel opens, **Then** both sections are visible and clearly labelled independently.
4. **Given** the static RGD detail view and the live instance detail view, **When** a node with `readyWhen` is selected, **Then** the "Ready When" section appears in both panels with identical rendering.

---

### User Story 3 — Visual indicator on nodes that carry a readyWhen condition (Priority: P3)

A contributor scanning the DAG overview can see at a glance which nodes have a `readyWhen` condition without hovering or clicking each one. Nodes with at least one `readyWhen` expression display a small, unobtrusive indicator (e.g., a labelled badge or subtle tag) directly on the node shape.

**Why this priority**: The hover tooltip (P1) and improved panel section (P2) already cover discoverability once the contributor focuses on a node. The at-a-glance indicator is a convenience enhancement that improves scanning efficiency for large graphs but is not required for the core use case.

**Independent Test**: Can be fully tested by rendering an RGD graph with at least one `readyWhen` node and one non-`readyWhen` node and confirming a distinguishing visual marker appears only on the `readyWhen` node, without opening any tooltip or panel.

**Acceptance Scenarios**:

1. **Given** a DAG node with at least one `readyWhen` expression, **When** the graph is rendered, **Then** the node carries a visible indicator that distinguishes it from nodes without `readyWhen`.
2. **Given** a DAG node with no `readyWhen` expression, **When** the graph is rendered, **Then** the node carries no `readyWhen` indicator.
3. **Given** the indicator is visible on a node, **When** the user hovers over it, **Then** the tooltip triggered is the same `readyWhen` tooltip described in User Story 1 — no additional second tooltip appears.

---

### Edge Cases

- What happens when a node's `readyWhen` array is present but contains only empty strings? The tooltip and panel section must not render empty highlighted blocks — treat as equivalent to "no readyWhen defined".
- What happens when a `readyWhen` expression is very long (more than ~200 characters)? The tooltip must scroll or wrap within its bounds without overflowing the viewport.
- What happens if the user quickly moves the pointer between multiple nodes? Only one tooltip may be visible at a time; previous tooltips must be dismissed before the new one appears — no stacking or flickering.
- What happens when the graph has no nodes with `readyWhen`? No tooltip or indicator surface appears; the graph renders exactly as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The DAG graph MUST display a hover tooltip for any node that has at least one non-empty `readyWhen` expression; the tooltip MUST show each expression with CEL syntax highlighting.
- **FR-002**: The hover tooltip MUST NOT appear (and must not show an empty heading) for nodes whose `readyWhen` array is absent, empty, or contains only empty strings.
- **FR-003**: Only one node tooltip MAY be visible at a time; moving the pointer to a different node MUST dismiss the previous tooltip before showing the new one.
- **FR-004**: The tooltip MUST be clamped within the visible viewport on all four edges; it MUST reposition automatically when proximity to a viewport edge would cause overflow.
- **FR-005**: The tooltip MUST be rendered outside the SVG/DAG container element to avoid clipping by the SVG bounding box.
- **FR-006**: The static RGD graph detail panel MUST display `readyWhen` expressions in a dedicated "Ready When" section, visually separate from `includeWhen`, `forEach`, and status projection sections.
- **FR-007**: The live instance graph detail panel MUST display `readyWhen` expressions in an identically structured "Ready When" section.
- **FR-008**: Neither the "Ready When" panel section nor any associated heading MUST appear when the node has no `readyWhen` expressions.
- **FR-009**: DAG nodes that carry at least one non-empty `readyWhen` expression MUST display a persistent visual indicator directly on the node shape in both the static and live graph views.
- **FR-010**: All colours and visual treatments for the tooltip and node indicator MUST be expressed via design tokens defined in the shared token stylesheet — no inline hex or rgba values are permitted.
- **FR-011**: Tooltip positioning and viewport-clamping logic MUST be implemented in a single shared location and imported by each graph component — it MUST NOT be duplicated.
- **FR-012**: CEL syntax highlighting for `readyWhen` content in the tooltip MUST reuse the same tokenizer already used in the detail panels — no separate or parallel highlighting implementation is permitted.

### Key Entities

- **DAG Node**: A resource, collection, external reference, or root instance vertex in the resource dependency graph. Attributes relevant to this feature: `id`, `kind`, `readyWhen: string[]`, `hasReadyWhen: boolean`.
- **readyWhen expression**: A CEL string stored in `spec.resources[N].readyWhen[]` on the RGD Kubernetes object. Evaluated by kro at runtime to determine whether a managed resource is considered ready. May contain `${...}` CEL expression syntax.
- **Node tooltip**: A transient overlay that appears on node hover and disappears on pointer leave. Shows `readyWhen` expressions with syntax highlighting. Rendered outside the SVG container.
- **"Ready When" panel section**: A labelled content block within the node detail panel that groups `readyWhen` expressions separately from other CEL expressions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can identify what condition a resource waits on before kro considers it ready in under 5 seconds from first looking at a DAG, without clicking into any detail panel — achievable via the hover tooltip.
- **SC-002**: 100% of nodes with non-empty `readyWhen` expressions display the visual node indicator; 0% of nodes without `readyWhen` display that indicator.
- **SC-003**: The tooltip appears promptly on pointer entry over any `readyWhen` node and disappears immediately on pointer leave — no lingering or stale tooltip is ever visible.
- **SC-004**: The tooltip never overflows the visible viewport, regardless of the node's position within the graph or the browser window size.
- **SC-005**: In the detail panel, `readyWhen` expressions are identifiable by heading label alone — a contributor does not need to read the expression content to know which section refers to readiness conditions.
- **SC-006**: There is zero duplication of tooltip positioning or CEL rendering logic across the static graph, live instance graph, and deep graph components — verifiable by code review showing a single shared implementation.

## Assumptions

- The `readyWhen` field is already parsed from the raw RGD object and available on `DAGNode` as `readyWhen: string[]` and `hasReadyWhen: boolean`. No backend or data-layer changes are required.
- The existing CEL tokenizer and highlighted code block rendering are used as-is for the tooltip and updated panel section — no modifications to the highlighting library are needed.
- The tooltip shows only `readyWhen` content (no other node metadata such as kind or id). A full node-metadata tooltip is out of scope for this feature.
- The visual node indicator (FR-009) is a supplemental decoration — a small badge or marker — that does not replace or interfere with the existing node type colour coding.
- Separating `readyWhen` into its own detail panel section (FR-006, FR-007) supersedes the current behaviour of merging it into a single `celCode` string alongside `includeWhen` and `forEach`. Existing tests for the affected panels will need to be updated.
- The tooltip feature applies to all three graph components: the static RGD graph, the live instance graph, and the deep instance graph. No other surfaces require tooltip changes in this spec.
