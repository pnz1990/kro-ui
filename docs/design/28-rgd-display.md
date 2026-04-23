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

- 🔲 Visibility: Lighthouse CI score regression comment on PRs — PR #741 lowered the Lighthouse threshold from 50→45 silently; a reviewer cannot tell whether the score drop is intentional or a regression without checking the workflow diff; `lighthouse-ci.yml` should post the actual score as a PR comment so human reviewers can evaluate it; threshold should be raised back to ≥60 now that code-splitting landed (PR #612); issues: #717 open (date: 2026-04-23)
- 🔲 Reliability: kro upstream field parity SLO enforcement gap — `CONTRIBUTING.md` documents the SLO (issue-710, shipped PR #748) but the `kro-upstream-check.yml` weekly workflow only detects new kro CRD fields; it does not verify that user-visible fields are actually rendered in the UI; add a step to the workflow that reads the RGD schema spec from the kro release tag and asserts each field in `spec.resources[].template`, `spec.schema.kind`, `spec.resources[].forEach`, `spec.resources[].readyWhen`, `spec.resources[].includeWhen` has a corresponding render path in `rgd.go` or `dag.ts`; without verification the SLO is aspirational, not enforceable (date: 2026-04-23)
- 🔲 Onboarding: RGD display surface has no E2E persona journey for a first-time kro user — the zero-RGD empty state shipped (PR #733) but there is no E2E journey that simulates a new user creating their first RGD in the Designer and seeing it appear in the Overview; the persona journey for "first-time user" exists conceptually (doc 26 §26.5) but has no Playwright journey file; add journey `088-first-time-user.spec.ts` that covers: open Overview → see zero-state → click "Create your first RGD" → land on /author → create a minimal RGD → verify it appears in Overview (date: 2026-04-23)
- 🔲 Self-improvement: GraphRevision diff is the only major display feature without a unit test for `computeLineDiff` — the LCS algorithm in `@/lib/diff` has E2E coverage via `RevisionsTab` but no dedicated unit tests for edge cases (identical YAML, one-line change, entire-file replacement, trailing-newline differences); these cases produce incorrect diff counts in the summary banner; add 8 unit tests to `web/src/lib/diff.test.ts` covering the 4 edge cases × 2 (additions vs deletions) (date: 2026-04-23)
- 🔲 Visibility: DAG minimap has no E2E test — the minimap component (PR #TBD, spec issue-578) has unit tests but no E2E journey step asserting it activates for graphs >50 nodes and that the dismiss/show toggle persists in localStorage; without E2E coverage a minimap regression would pass CI; add a Step to journey `003-rgd-detail-dag.spec.ts` or a new chunk-9 journey that uses the stress-test `deep-dependency-chain` fixture (which has >50 nodes) to verify the minimap appears (date: 2026-04-23)

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

