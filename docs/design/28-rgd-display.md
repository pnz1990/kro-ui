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
- ✅ Lighthouse score regression comment on PRs: `perf.yml` posts/updates a PR comment showing current branch score vs main baseline with delta and visual indicator (✅/⚠️/❌); idempotent via `<!-- lighthouse-diff -->` marker (delete+create); baseline downloaded from most recent successful main-branch run artifact; fail-open on missing baseline (shows "baseline: unknown"); artifact retention extended from 7 to 30 days; `pull-requests: write` permission added to workflow job (spec issue-717, 🔲→✅ 2026-04)

## Future (🔲)


- 🔲 Rewrite vision pressure context in scheduled workflow: 3/5 pressure bullets addressed (≥2 matches each in merged PRs + design doc Present items) — the bar needs to be raised. Update the "Context for this vision scan:" block to push on the remaining open gaps. ⚠️ Inferred from pressure staleness scan: 60% addressed.
- ✅ 28.1 — RGD detail "what's new" section: when a GraphRevision is created (kro v0.9.1+), the Graph tab currently shows the latest revision's DAG; it does not highlight what changed since the prior revision in the live view; add a "Changes since last revision" banner at the top of the Graph tab when `spec.revisions.length >= 2`: "N nodes added, M nodes removed since r{prev}" with a "Diff revisions" shortcut link to the RevisionsTab diff; this surfaces the delta immediately without requiring the operator to navigate to a separate tab; zero new API calls (revision data already fetched for the RevisionsTab) (spec issue-767, 🔲→✅ 2026-04)
- 🔲 28.2 — Catalog RGD complexity score: the catalog shows 40+ RGDs on large clusters with no ordering by complexity; a donation reviewer or new operator cannot quickly identify which RGDs are trivial (2 resources) vs. complex (20 resources with chaining); add a `complexity_score = resources.length + (chaining_depth × 2) + (forEach_count × 3)` numeric badge on each catalog card; sort the catalog by complexity by default (descending, configurable); this reuses data already available in the RGD list response — no new backend required; addresses the visibility gap: "is the product advancing?" becomes verifiable when the catalog surface evolves beyond a flat list
- 🔲 28.3 — Self-improvement gate for DAG: the DAG is the most complex UI component in kro-ui and has the highest historical rework rate (anti-patterns §state-map-keyed-by-kind, §external-ref-live-state, §svgHeight, §overflow-x-without-overflow-y are all DAG-specific); before any new DAG feature is added to Present in this doc, the implementing agent MUST read `web/src/components/DAGGraph.tsx` and `web/src/lib/dag.ts`, enumerate the 5 most recent DAG-related anti-pattern fixes in AGENTS.md, and confirm none of the new feature's approach triggers them; add this as a Zone 1 obligation: "DAG features require pre-implementation anti-pattern check before PR is opened"; this is the frame-lock prevention mechanism for the highest-risk component
- 🔲 28.4 — Visibility: RGD display "advancement signal" — a human looking at the Overview today cannot quickly tell if kro-ui's RGD display capability is better than it was last week; add a `docs/aide/product-changelog.md` companion file (updated by the SM the same way `loop-health.md` is updated) with a 10-row rolling table of the most recently shipped user-visible features across all product docs (28, 29, 30, 31); the first two columns are "feature" and "date shipped"; this is the single-page answer to "is the product moving forward?" — distinct from the metrics table (which tracks batch velocity) and the loop-health.md (which tracks system health)
- 🔲 28.5 — Performance budget regression: Lighthouse CI threshold lowered from 50 to 45 (PR #741) when code splitting shipped (PR #612); `perf.yml` was supposed to raise the threshold to ≥70 after splitting but instead lowered it further due to GA runner variance; the PR #757 Lighthouse diff comment now surfaces per-PR scores, making root cause visible; once 3 consecutive main-branch scores exceed 60, raise the threshold in `perf.yml` to 60 and add a Zone 1 obligation to this doc: "performance budget must not regress — any PR that lowers the Lighthouse CI threshold requires a written justification comment in `perf.yml`"; a donation reviewer running the CI will see a 45/100 threshold and reasonably question the product's performance commitment
- 🔲 28.6 — Visibility pressure lens: product advancement is invisible to a person skimming the repo — `docs/aide/product-changelog.md` (doc 28.4) is still 🔲; a donation reviewer looking at the repo right now sees 600+ closed PRs and a flat AGENTS.md spec list but cannot quickly tell "what is the most impressive thing this product does that it did NOT do 30 days ago?"; add a `## What's New (last 30 days)` section to `docs/aide/vision.md` that the SM updates every batch with the 3 most user-visible shipped features (title, PR number, one-sentence description); this is faster to ship than a full product-changelog.md and gives the donation reviewer an immediate "wow factor" anchor; distinct from the donation readiness table (which tracks requirements, not features)
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

