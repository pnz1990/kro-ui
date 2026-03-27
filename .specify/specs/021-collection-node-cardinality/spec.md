# Feature Specification: Collection Node forEach Expression and Runtime Cardinality

**Feature Branch**: `021-collection-node-cardinality`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "Display forEach iterator expression and runtime cardinality on collection nodes — show the forEach CEL expression on collection DAG nodes (static, from the RGD spec), and display the actual instance count badge on collection nodes in the live DAG so contributors can see cardinality at a glance without drilling into the collection explorer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - forEach Expression on Static DAG Nodes (Priority: P1)

A contributor opens the RGD detail page and views the DAG. For every collection node (a node that fans out over a list using a forEach iterator), they can read the forEach CEL expression directly on the node — without needing to click into the node detail panel or navigate to the collection explorer. This makes the iteration source immediately obvious when reviewing or explaining an RGD's structure.

**Why this priority**: The static DAG is the primary entry point for understanding an RGD's topology. Showing the CEL expression on the node itself eliminates a click and surfaces the single most important distinguishing fact about a collection node — what it iterates over.

**Independent Test**: Can be fully tested by opening the RGD detail page for any RGD that contains a collection resource and verifying the forEach CEL expression text appears on the collection node in the DAG without any interaction — delivers immediate topology clarity without opening panels.

**Acceptance Scenarios**:

1. **Given** an RGD with at least one collection resource (has a `forEach` field in its spec), **When** a user views the RGD detail DAG, **Then** each collection node displays its forEach CEL expression as a visible text annotation on or directly below the node, truncated gracefully if the expression is long.

2. **Given** an RGD collection node whose CEL expression fits within the node width, **When** the DAG renders, **Then** the full expression is shown without truncation.

3. **Given** an RGD collection node whose CEL expression is longer than the node width, **When** the DAG renders, **Then** the expression is truncated with an ellipsis and the full expression remains accessible via the node detail panel (already existing behavior).

4. **Given** a non-collection node (resource, external, root), **When** the DAG renders, **Then** no forEach expression annotation appears on that node.

5. **Given** an RGD with no collection nodes, **When** the DAG renders, **Then** the DAG appearance is unchanged from current behavior.

---

### User Story 2 - Runtime Cardinality Badge on Live DAG Collection Nodes (Priority: P2)

A contributor opens the instance detail live DAG. For every collection node they can immediately see how many instances were actually created at runtime — a "N/M" count badge — directly on the node, without clicking into the collection explorer drill-down. The badge updates as the live DAG polls for state changes.

**Why this priority**: The live DAG already shows a health badge (ready/total) on collection nodes. This story ensures the instance count is prominently visible during reconciliation so contributors can spot fanout issues (wrong count, stuck at 0) at a glance. It extends existing live DAG behavior rather than introducing entirely new concepts.

**Independent Test**: Can be fully tested by viewing the instance detail page for any live instance that includes a collection resource, and verifying that the collection node in the live DAG shows the current ready/total instance count without navigating to the collection explorer — delivers reconciliation visibility without drilling down.

**Acceptance Scenarios**:

1. **Given** a live CR instance with at least one collection node that has reconciled children, **When** a user views the instance detail live DAG, **Then** each collection node shows a count badge displaying the number of ready children out of the total expected (e.g., "3/5").

2. **Given** a collection node whose children have not yet appeared (cardinality is zero or unknown), **When** the live DAG renders, **Then** the badge shows "0/?" or is omitted entirely rather than displaying an error state or a stale count.

3. **Given** the live DAG polling cycle updates, **When** the child resource counts change, **Then** the cardinality badge on the collection node updates to reflect the new counts without a full page reload.

4. **Given** a collection node where all children are ready, **When** the live DAG renders, **Then** the badge uses the "all-ready" visual treatment (green) to signal healthy cardinality.

5. **Given** a collection node where some but not all children are ready, **When** the live DAG renders, **Then** the badge uses the "partial" visual treatment (amber).

6. **Given** a collection node where no children are ready, **When** the live DAG renders, **Then** the badge uses the "none-ready" visual treatment (red/error).

---

### User Story 3 - forEach Expression on Live DAG Collection Nodes (Priority: P3)

A contributor viewing the live DAG on the instance detail page sees the same forEach CEL expression annotation on collection nodes as on the static DAG. The live DAG view already exposes node state and cardinality; adding the expression annotation provides complete context without requiring panel interaction.

**Why this priority**: Consistency between the static and live DAG views eliminates confusion. Lower priority than P1 and P2 because the live DAG already has the collection explorer panel as a drill-down, and P1/P2 deliver the highest marginal value first.

**Independent Test**: Can be fully tested by opening any live instance detail page with a collection node and confirming the forEach CEL expression appears on the node in the same position and style as on the static RGD detail DAG.

**Acceptance Scenarios**:

1. **Given** a live instance with a collection node, **When** the user views the instance detail live DAG, **Then** the forEach CEL expression is shown on the collection node using identical visual treatment to the static DAG.

2. **Given** a live DAG collection node with both a cardinality badge and a forEach expression, **When** rendered, **Then** the two annotations do not visually overlap — layout accommodates both.

---

### Edge Cases

- What happens when the `forEach` field is an empty string? The expression annotation must not be rendered (treat empty string identically to absent).
- What happens when `kro.run/collection-size` label is missing from all children? The cardinality badge must display the observed child count as the total rather than crashing or showing "?/?".
- What happens when a collection node has zero children in the live response? The badge must either be hidden or show "0/0" — it must not show a stale value from a previous poll.
- What happens when the same live DAG is viewed on a narrow viewport and the CEL expression is long? The expression must truncate gracefully and not cause horizontal overflow on the DAG canvas.
- What happens when a collection node is also conditional (`includeWhen` is set)? Both the conditional `?` badge and the forEach expression must be shown without one obscuring the other.
- What happens when the forEach expression contains template interpolation syntax (e.g., `${schema.spec.regions}`)? The expression must be displayed as-is without further interpretation or rendering side-effects.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The static RGD detail DAG MUST display the `forEach` CEL expression as a text annotation on every collection node, sourced directly from the RGD spec without any backend changes.
- **FR-002**: The forEach expression annotation MUST be truncated with an ellipsis when it exceeds the available node width, and the full expression MUST remain accessible in the existing node detail panel.
- **FR-003**: The forEach expression annotation MUST NOT appear on non-collection nodes (resource, external, root CR nodes).
- **FR-004**: The live instance detail DAG MUST display a cardinality badge showing ready-child count and total-expected count on every collection node, updating with each poll cycle.
- **FR-005**: The cardinality badge MUST use distinct visual states — all-ready, partial, and none-ready — consistent with the color tokens already defined in the design system.
- **FR-006**: When total expected child count is unavailable from cluster labels, the badge MUST fall back to the observed child count rather than displaying an error or indeterminate state.
- **FR-007**: The live instance detail DAG MUST display the forEach CEL expression annotation on collection nodes, using the same visual treatment as the static DAG.
- **FR-008**: When both a cardinality badge and a forEach expression annotation are present on the same live DAG collection node, the layout MUST ensure neither annotation overlaps the other or the existing `∀` type badge.
- **FR-009**: An empty or absent `forEach` field MUST result in no expression annotation being rendered on the node.
- **FR-010**: The `DeepDAG` recursive view MUST receive the same forEach expression and cardinality badge treatment as the standard live DAG, since it reuses the same node rendering.

### Key Entities

- **Collection node**: A DAG node representing a kro resource with a `forEach` field. It fans out to produce multiple child resources at runtime. Identified by `nodeType === 'collection'` in the frontend graph model.
- **forEach CEL expression**: The iteration source expression stored in `spec.resources[N].forEach` of the RGD. It is a CEL string (often containing `${...}` template syntax) that references the schema to determine what list to iterate over.
- **Cardinality**: The pair of (ready child count, total expected child count) for a collection node in a live instance. Derived from child resource labels set by the kro controller (`kro.run/collection-size`, `kro.run/node-id`).
- **Live DAG poll cycle**: The recurring data refresh on the instance detail page (every 5 seconds) that re-fetches instance children and updates node states and badges.

## Assumptions

- No backend API changes are required. The `forEach` field is already present in the RGD spec passthrough response, and child resource labels already carry cardinality data. All work is frontend-only.
- The existing `CollectionBadge` component already computes ready/total counts and applies the three color states. The cardinality badge story extends or reuses this component rather than introducing a parallel implementation.
- Node dimensions in the DAG are fixed at 180×48px for non-root nodes. Showing the forEach expression may require either a small height increase for collection nodes or strictly ellipsis-based truncation — the spec does not prescribe which; both satisfy FR-002.
- The `DeepDAG` component (used for deep recursive views) shares node rendering helpers with `LiveDAG`. Changes to collection node rendering apply to both without separate implementation effort.
- The feature is purely additive and read-only. No user interaction (edit, copy, filter) on the new annotations is required by this spec.
- Design tokens for collection node colors (`--node-collection-bg`, `--node-collection-border`, `--color-alive`, `--color-reconciling`, `--color-error`) are already defined in `tokens.css` and MUST be used for any new annotation styling — no new hardcoded colors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can identify the iteration source of any collection node on the static RGD detail DAG without opening a panel or tooltip — the forEach expression is visible on the node itself on first render.
- **SC-002**: A contributor can determine the current ready/total child count for any collection node in the live DAG without navigating to the collection explorer — the count is visible on the node at all times while children exist.
- **SC-003**: The cardinality badge on live DAG collection nodes reflects the actual cluster state within one polling cycle (≤5 seconds) of a child resource becoming ready or being deleted.
- **SC-004**: Collection nodes with both a forEach expression and a cardinality badge render without visual overlap or text collision at the default DAG zoom level on a 1280px-wide viewport.
- **SC-005**: No regression on existing DAG behavior: non-collection nodes, conditional badges, external node badges, and the node detail panel all continue to function identically to before this feature.
- **SC-006**: The forEach expression annotation and cardinality badge are both present and accurate in the `DeepDAG` recursive view, not only in the standard live DAG.
