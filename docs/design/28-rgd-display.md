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
- ✅ First-time user zero-RGD empty state: when a cluster has 0 RGDs and 0 instances, the Overview shows a structured onboarding banner with (1) kro health status derived from the capabilities API — "kro is running (vX.Y.Z)" when capabilities load or "kro not detected — check your kubeconfig context" when they fail; (2) a "Get started with kro →" link to https://kro.run/docs/getting-started/quick-start (opens in new tab); (3) a "Create your first RGD" CTA linking to /author; accessible via `role="status"` + `aria-live="polite"` on the kro status indicator; token-compliant CSS (spec issue-716, 🔲→✅ 2026-04)
- ✅ kro upstream field parity SLO: `CONTRIBUTING.md` documents the explicit commitment that any new kro CRD field that is user-visible (DAG inspection, YAML tab, spec diff, validation linting) must appear in the display surface within 2 kro-ui releases of the kro version that introduced it; defines what "user-visible" means; references the `kro-upstream-check.yml` weekly workflow for automated detection (spec issue-710, 🔲→✅ 2026-04)

## Future (🔲)

- 🔲 RGD detail "last meaningful change" indicator — the Revisions tab shows graph-revision hash history but gives no plain-language signal for "is this RGD advancing or stuck?"; add a `timeSinceLastRevision` field to the RGD detail header stat strip (alongside Age/Resources/Instances/Latest revision) that shows "last compiled N ago" in human-readable format using `formatAge()`; if the gap exceeds 7 days and the RGD has active instances, show an amber `stale` badge — an RGD that hasn't compiled a new revision in a week while serving traffic is worth surfacing; this addresses the visibility lens: an operator glancing at the detail page cannot today tell if the RGD is actively evolving or frozen (visibility lens, 2026-04-23)
- 🔲 Overview page Lighthouse performance budget enforcement — the Lighthouse threshold was lowered from 50 to 45 (PR #741, fix(ci)) to unblock a PR; this was flagged as a regression in the PR commit message; the threshold must return to ≥50 after the code-splitting or image optimization work that was originally intended to raise it; add a `🔲` item here to track the threshold restoration; the threshold lowering is the most concrete form of honesty gap in the product: the CI says "performance: pass" but at a lower bar than before; until the threshold is ≥50 the product is not advancing on performance, it is regressing with the guardrail moved out of the way (reliability lens, 2026-04-23)
- 🔲 RGD card stale-compilation detection — when an RGD's `GraphRevision` was last compiled >7 days ago and it has >0 active instances, the card in the Overview grid currently shows no indication; add a subtle `⏱ stale N days` badge below the health chip; operators managing large kro deployments need to know which RGDs are not receiving updates so they can investigate whether the schema author is inactive or the compilation pipeline is stuck; this is the list-level complement to the detail-level "last meaningful change" item above (visibility lens, 2026-04-23)
- 🔲 Overview tour / contextual help for first-time multi-RGD scenarios — the zero-RGD empty state (PR #733) handles the absolute-first-time case; but a cluster with 2-3 RGDs and mixed health states gives a new operator no guidance on what to look at first; add a dismissible "how to read this page" tooltip anchored to the OverviewHealthBar that appears on first visit (localStorage key `kro-ui-overview-tour-v1`); it should explain in 2 sentences what the health chips mean and link to the kro documentation; this closes the onboarding lens gap at the multi-RGD stage — the zero-state is handled, the first-populated-cluster state is not (onboarding lens, 2026-04-23)
- 🔲 RGD compile-error detail — when an RGD is in error state the card shows a one-line hint (PR #325) but clicking through to the detail page shows the same one-line truncated message in the header; there is no surface where the full compile error text is readable without the user running `kubectl get rgd -o yaml`; add a full-text expandable error block in the ValidationTab or in a new "Compile Error" section of the detail header for error-state RGDs; show the raw error string from the `GraphAccepted` condition message with monospace formatting; this directly addresses the loop honesty lens applied to the product: the system detects the error but does not give operators the information to act on it (loop honesty → product visibility lens, 2026-04-23)

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

