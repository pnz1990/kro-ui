# Spec: issue-682 — DAG screen reader text alternative (WCAG 2.1 SC 1.1.1)

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: DAG screen reader text alternative: add visually-hidden text describing the graph topology (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: The DAG SVG container MUST have an accessible text alternative that describes the graph topology. A screen reader user landing on the Graph tab must receive a meaningful overview (node count + edge summary) without reading each node individually.

**O2**: The text alternative MUST be visually hidden (not visible to sighted users) and programmatically associated with the SVG via `aria-describedby` pointing to a hidden element.

**O3**: The text alternative is dynamically generated from the graph data: format is "Resource graph: N node(s) — [comma-separated node labels and types]". If edges are present, also append the edge count (e.g. "3 connections").

**O4**: The implementation must apply to `DAGGraph`, `LiveDAG`, and `StaticChainDAG` (all three SVG DAGs in the app).

**O5**: WCAG 2.1 SC 1.1.1 (Non-text Content) compliance: the DAG SVG as a complex image requires a text alternative.

---

## Zone 2 — Implementer's judgment

- The hidden description element can be a `<span>` with `className="sr-only"` (already defined in the CSS)
- Generate a unique ID per DAG instance to avoid id conflicts when multiple DAGs are on screen
- Use React `useId()` (React 18+) for the unique ID; do NOT rely on node IDs (not unique across page)
- The description need not include all nodes for large graphs — summarize with "N nodes, M connections"

---

## Zone 3 — Scoped out

- Graph navigation hints (e.g. "use Tab to navigate nodes") — separate UX consideration
- Full machine-readable graph data (topology export) — out of scope
- Live region updates when graph changes — separate polling/aria-live concern
