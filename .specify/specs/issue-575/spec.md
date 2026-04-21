# Spec: 27.13 — DAG Scale Guard

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future 27.13`
- **Implements**: DAG scale guard: node-count guard (>100 nodes) with collapsed-by-depth view and text-mode list fallback (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. **Node-count threshold**: When `graph.nodes.length > 100` (configurable constant `DAG_SCALE_THRESHOLD = 100`), the DAGGraph and StaticChainDAG components MUST NOT render the full SVG by default. Violation: a graph with 101 nodes renders the full SVG without any guard.

2. **Text-mode list fallback**: When the scale threshold is exceeded, a text-mode list view MUST be shown as the default. This view lists all nodes in a flat scrollable list, grouped by nodeType, showing: nodeId, kind, nodeType label, and includeWhen status. Violation: the text-mode view is missing or shows no node data.

3. **Toggle to graph mode**: When the scale threshold is exceeded, a "Show graph (N nodes — may be slow)" button MUST allow the user to override and render the full SVG. Clicking it renders the SVG. Violation: there is no way to see the full graph for an oversized DAG.

4. **Warning banner**: A visible banner MUST appear when the scale guard activates, explaining: "This RGD has N nodes. Graph view may be slow — showing text list. Click to render graph." Violation: the user receives no explanation for why the graph is not showing.

5. **TypeScript clean**: `tsc --noEmit` MUST pass after the change. Violation: any TypeScript error.

6. **Tests pass**: All existing DAGGraph unit tests MUST continue to pass. New tests for the scale guard MUST be added. Violation: any pre-existing test broken, or no new tests for the guard.

7. **Graceful at threshold boundary**: A graph with exactly 100 nodes MUST render normally (not trigger the guard). A graph with 101 nodes MUST trigger the guard. Violation: off-by-one error at the boundary.

---

## Zone 2 — Implementer's judgment

- The text-mode list layout (table, flat list, grouped by type) is left to the implementer.
- Where to add the guard — in `DAGGraph.tsx` or as a wrapper (`DAGScaleGuard.tsx`) — is left to the implementer. A wrapper is preferred for testability.
- The `LiveDAG` component may optionally also use the scale guard; it is not required for this spec (LiveDAG with >100 nodes is less common since it requires 100+ live children).
- Visual styling of the text-mode list uses existing design tokens only (no new tokens required).

---

## Zone 3 — Scoped out

- Minimap navigation for large graphs is out of scope (27.13 part c — separate future item).
- Collapsed-by-depth rendering of the SVG itself is out of scope for this PR (complexity high; text fallback + toggle covers the immediate usability gap).
- LiveDAG scale guard is out of scope.
- DeepDAG scale guard is out of scope.
