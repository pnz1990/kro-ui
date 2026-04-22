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
- ✅ DAG minimap: fixed-position SVG overlay minimap activates for graphs >50 nodes; node rects color-coded by type; dismiss/show toggle with localStorage persistence; no new dependencies (spec issue-578, 🔲→✅ 2026-04)
- ✅ DAG keyboard navigation: Arrow key (ArrowRight/ArrowDown = next, ArrowLeft/ArrowUp = prev) navigation between DAG nodes sorted by reading order (y ASC, x ASC); `onKeyDown` handler in `NodeGroup` calls `handleArrowKey` which focuses the adjacent node via `data-testid`; `preventDefault` prevents page scroll; existing Enter/Space activation unchanged; WCAG 2.1 SC 2.1.1 satisfied (spec issue-681, 🔲→✅ 2026-04)
- ✅ DAG screen reader text alternative: `buildDagDescription()` utility in `DAGGraph.tsx` generates a human-readable summary ("Resource graph: N nodes — label1 (type1), ... [, M connections]"); exported and used in `DAGGraph`, `LiveDAG`, and `StaticChainDAG`; each SVG has `aria-describedby` pointing to a visually-hidden `<span className="sr-only">`; `useId()` generates unique IDs to avoid conflicts when multiple DAGs are on screen; WCAG 2.1 SC 1.1.1 satisfied (spec issue-682, 🔲→✅ 2026-04)
- ✅ GraphRevision diff navigate-by-change arrows: "← prev change" / "next change →" bar in `RevisionYamlDiff`; auto-scroll to first change on mount; "N / M" counter with aria-live; `data-change-idx` on each change block's first row; prev/next disabled at boundaries; hidden when YAML is identical (spec issue-680, PR #694, 2026-04)

## Future (🔲)

- 🔲 RGD display: kro upstream field parity SLO — when `kubernetes-sigs/kro` ships new RGD CRD fields (new `spec.resources[].includeWhen` modes, new CEL built-ins, new scope values), the display surface must reflect them; DAG node inspection panels must render new fields rather than ignoring them; the kro-upstream-check workflow opens issues automatically (doc 27 §27.1) but there is no design SLO; add an explicit commitment: any new kro CRD field that is user-visible must appear in the RGD display surface within 2 kro-ui releases of the kro version that introduced it; this SLO must be documented in `CONTRIBUTING.md` so community contributors know the bar
- 🔲 RGD display: first-time user zero-RGD empty state — when a cluster has 0 RGDs, the Overview shows an empty grid with no guidance; a new user cannot tell whether kro is installed, whether they have the right kubeconfig context, or how to create their first RGD; add a structured empty state that: (1) checks kro health via the capabilities API and shows "kro is running" vs "kro not detected"; (2) links to the kro quickstart doc (kro.run); (3) shows a "Create your first RGD" CTA pointing to the Designer (/author); the first-time-onboarding feature (PR #139) addressed the footer/tagline but not the empty-grid moment — this is the highest-impact UX gap for new adopters
- 🔲 RGD display: Lighthouse score regression comment on PRs — PR #612 shipped code splitting (score ≥70); future PRs can silently regress the score; the current perf.yml threshold (70) flags catastrophic regressions but a drop from 85→71 passes CI; add a per-PR Lighthouse diff comment (current score vs baseline from main) so developers see "Lighthouse: 78 → 73 (−5)" without reading the full CI log; integrates with the existing perf.yml Lighthouse CI step

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

