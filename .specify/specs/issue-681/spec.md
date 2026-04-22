# Spec: issue-681 — DAG keyboard navigation (Arrow key navigation between nodes)

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: DAG keyboard navigation: DAG nodes are individual `role="button"` elements but there is no arrow-key navigation between them (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: Pressing ArrowRight or ArrowDown while a DAG node has keyboard focus moves focus to the next node in the Dagre layout order (by x+y position, left-to-right then top-to-bottom). Pressing ArrowLeft or ArrowUp moves focus to the previous node. If no adjacent node exists in that direction, focus stays on the current node.

**O2**: Arrow key presses on a DAG node do NOT scroll the page (preventDefault is called). Tab/Shift+Tab continue to work as before (cycle through all nodes sequentially).

**O3**: The implementation does not break Enter/Space (click activation) or mouse interaction. Existing tests for NodeGroup must continue to pass.

**O4**: Arrow key navigation must work in both `DAGGraph` and any other component that renders `NodeGroup` (specifically: LiveDAG, StaticChainDAG). The implementation is in the shared `NodeGroup` component.

**O5**: WCAG 2.1 SC 2.1.1 compliance: all interactive DAG node functionality (click, select) is accessible via keyboard without requiring specific timing.

---

## Zone 2 — Implementer's judgment

- Node ordering for Arrow navigation: sort by (y ASC, x ASC) — top-to-bottom, left-to-right, which matches natural reading order and Dagre's typical layout
- The implementation can use `document.querySelector` with `data-testid` or find sibling `<g>` elements to move focus — whichever is simpler to implement reliably
- ArrowLeft = ArrowUp = previous node; ArrowRight = ArrowDown = next node (simple linear order, not graph-topology-aware navigation)

---

## Zone 3 — Scoped out

- Graph-topology-aware navigation (following actual edges) — out of scope; linear order is sufficient for WCAG compliance
- Touch/virtual keyboard support beyond what exists today
- DAG screen reader text alternative (separate issue #682)
