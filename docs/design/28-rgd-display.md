# 28 — RGD Display

> Status: Active | Created: 2026-04-20
> Applies to: pnz1990/kro-ui

---

## What RGD Display covers

The RGD display surface is the primary way users understand their ResourceGroupDefinitions:
the home/overview list, the detail page with DAG and YAML tabs, the catalog/registry, and
the graph diff view. This is the most heavily exercised surface in kro-ui.

---

## Present (✅)

- ✅ RGD list (Overview): card grid, health chips, compile-error banner, error-only filter (PR #35, #356, 2026-04)
- ✅ RGD card error hint: one-line compile error tooltip on error-state cards (PR #325, 2026-04)
- ✅ RGD detail: DAG visualization, node inspection, YAML tab, Kind badge, status dot (PR #38, #140, 2026-04)
- ✅ RGD catalog: searchable registry, filtering, chaining detection, compile-status filter (PR #47, #357, 2026-04)
- ✅ Overview health summary bar: aggregate fleet instance health chips with clickable filter (PR #324, #329, 2026-04)
- ✅ Home search + DAG node hover tooltip (PR #77, 2026-04)
- ✅ RGD list virtualization for 5,000+ RGDs (PR #80, 2026-04)
- ✅ RGD validation linting: surface validation conditions in the UI (PR #50, 2026-04)
- ✅ RGD schema doc generator: auto-generated API docs from RGD schema (PR #55, 2026-04)
- ✅ Home/Catalog IA rename: Home→Overview, subtitles (PR #179, 2026-04)
- ✅ Graph Revisions tab: revision history, compiled status, age, expand YAML (PR #314, 2026-04)
- ✅ Overview SRE dashboard: 7-widget single-cluster health view (PR #405, 2026-04)
- ✅ RGD Catalog bulk export: multi-select + export selected RGDs as clean multi-document YAML (🔲→✅ 2026-04)
- ✅ Catalog saved searches and filter presets: save/restore/delete filter combinations via localStorage (🔲→✅ 2026-04)
- ✅ DAG scale guard: RGDs with >100 nodes show a text-mode list fallback with opt-in "Show graph (N nodes — may be slow)" toggle; DAGScaleGuard wraps DAGGraph and StaticChainDAG (PR #613, 2026-04)
- ✅ YAML diff line-level highlighting: the YAML diff panel in `RevisionsTab` now uses `computeLineDiff` (LCS algorithm, no new dependency) from `@/lib/diff`; added/removed lines are highlighted green/red with line numbers in the gutter; "N lines differ" summary in the header; reuses `.yaml-diff-table` CSS from `InstanceYamlDiff.css` (spec issue-579, 🔲→✅ 2026-04)

## Future (🔲)

- 🔲 DAG minimap: for large graphs (>50 nodes) add a fixed-position mini-map (SVG overlay, no extra dependencies) so operators can orient themselves without scrolling; required for usability at real scale
- 🔲 GraphRevision diff: the two-panel line-level diff view with navigate-by-change arrows is not yet implemented; the `RGDDiffView` component exists but is only wired to the Revisions tab for static RGD comparison, not for the live instance DAG overlay; a kubernetes-sigs reviewer would flag this as a prominently advertised but incomplete feature
- 🔲 DAG keyboard navigation: DAG nodes are individual `role="button"` elements but there is no arrow-key navigation between them; a screen reader or keyboard-only user can Tab to each node sequentially but cannot use Arrow keys to move through the graph topology; add `onKeyDown` handlers for ArrowUp/ArrowDown/ArrowLeft/ArrowRight that move focus to the nearest adjacent node in the Dagre layout; WCAG 2.1 SC 2.1.1 requires all functionality to be accessible via keyboard without requiring specific timing
- 🔲 DAG screen reader text alternative: the DAG is an SVG with `role="button"` nodes; there is no `role="img"` or `aria-label` on the SVG container describing the graph topology as text (e.g. "Resource graph: 5 nodes — Deployment → Service → Ingress"); a screen reader user landing on the Graph tab receives no meaningful overview; add a visually-hidden `<p>` or `aria-describedby` that lists the node types and edge count; WCAG 2.1 SC 1.1.1 (Non-text Content) requires text alternatives for complex images

---

## Zone 1 — Obligations

**O1**: RGD list MUST display health state for each RGD without requiring a detail page visit.
**O2**: DAG MUST show node type, readyWhen CEL, and includeWhen conditions when present.
**O3**: Compile errors MUST be surfaced inline (not only in logs).

---

## Zone 2 — Implementer's judgment

- DAG layout algorithm: use existing D3 force layout; do not replace without benchmarking.
- Error tooltip format: one-line is intentional — do not expand to multi-line without UX review.

---

## Zone 3 — Scoped out

- Server-side RGD diff storage (frontend-only diff from fetched revisions)
- RGD YAML editing directly from the list view

