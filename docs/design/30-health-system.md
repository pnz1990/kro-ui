# 30 — Health System

> Status: Active | Created: 2026-04-20
> Applies to: pnz1990/kro-ui

---

## What the Health System covers

The health system is the cross-cutting concern that surfaces resource health throughout
kro-ui: from individual instance badges to fleet-wide aggregates, error pattern analysis,
and the SRE dashboard. It provides the primary signal for operators monitoring at scale.

---

## Present (✅)

- ✅ Instance health rollup: 5-state → 6-state badges (unknown/pending/reconciling/degraded/ready/error), error count on cards (PR #136, #277, 2026-04)
- ✅ Error patterns tab: cross-instance error aggregation, Errors tab on RGD detail (PR #135, 2026-04)
- ✅ Overview health summary bar: aggregate fleet instance health chips (PR #324, 2026-04)
- ✅ Clickable health chips: filter Overview by health state (PR #329, 2026-04)
- ✅ Degraded health state (6th state) with multi-segment health bar (PR #277, 2026-04)
- ✅ WARNINGS counter includes failed/unknown conditions (PR #328, 2026-04)
- ✅ Fleet cluster card reconciling count (PR #347, 2026-04)
- ✅ Overview SRE dashboard: 7-widget view including health summary, error patterns, degraded trends (PR #405, 2026-04)
- ✅ Overview RGD error banner: compile-error count + error-only filter (PR #356, 2026-04)
- ✅ Error states UX audit: translateApiError, enriched empty states (PR #208, 2026-04)

## Present (✅) — continued

- ✅ Condition detail drill-down: per-condition expand/collapse — unhealthy conditions auto-expand; healthy conditions collapsed by default; keyboard accessible (PR #565, 2026-04)
- ✅ Error state for unreachable cluster on initial load: global "cluster unreachable" banner in Layout — fires when capabilities or context probe fails with a network error; includes retry button and dismiss; resets on context switch (PR #582, 2026-04)

## Present (✅) — continued

- ✅ Health trend sparkline: in-session health trend chart on RGD detail Instances tab — tracks % ready / % error+degraded over the current browser session; displays as SVG polyline with legend and sample count (spec issue-539, PR TBD, 2026-04)
- ✅ Health alert subscriptions: in-session browser Notification API alerts — bell button in TopBar lets operators subscribe; fires a browser notification on transition to error/degraded; per-instance transition tracking (no duplicate alerts); blocked/unavailable states handled gracefully (spec issue-540, PR TBD, 2026-04)
- ✅ Health snapshot clipboard export: "Copy snapshot" button in Overview header produces a stable JSON v1 blob with health counts, top-5 errors, cluster context name, and timestamp; clipboard API with execCommand fallback; 2s Copied! feedback; button disabled while fetching; 3 unit tests (spec issue-720, 2026-04)

## Future (🔲)

- 🔲 30.1 — Health state prediction: when an instance has been reconciling for >2× its historical average reconcile time (tracked in session via `useHealthTrend`), surface a yellow "taking longer than usual" banner on the instance detail page; this converts the existing health trend sparkline data (already collected) into an actionable operator signal — "something may be wrong" before it reaches error state; no new backend required; threshold configurable via a `RECONCILE_SLOW_FACTOR=2` constant
- 🔲 30.2 — Cross-instance error pattern correlation: the Errors tab on RGD detail groups errors by instance, but if 10 instances all fail with the same message (e.g. "waiting for node X"), the tab shows 10 separate rows; add a "top error messages" aggregation at the top of the Errors tab that shows `{count}×  {message}` sorted by frequency; a cluster-wide rollout failure (same error, many instances) is the most actionable operator signal and is currently invisible in the aggregated view
- 🔲 30.3 — Health SLO tracking: operators who manage kro at scale want to know if an RGD's instances are meeting a service level objective (e.g. "95% of instances should be ready within 5 minutes of creation"); add an SLO panel on the RGD detail page that computes: (1) `% ready` across all current instances, (2) `% reaching ready within 5m` for instances created in the last hour; data sources are instance `status.state` + `creationTimestamp` (already fetched); no new API required; this is the bridge from "health display" to "health accountability"
- 🔲 30.4 — Proactive degraded-to-error escalation warning: when `degraded` instances exist and their `ResourcesReady` condition has `reason=NotReady` for >10 minutes (matching the stuck-reconciling escalation threshold from doc 29 §stuck-escalation), surface a pre-error warning banner on the Overview: "N instances may be approaching error state — reconciling for >10m"; this gives operators a window to investigate before the state becomes error; the stuck-reconciling escalation in doc 29 covers terminating instances; this covers the degraded-before-error window which currently has no early warning
- 🔲 30.5 — Loop self-check: health system correctness is invisible to the development loop — when vibe-vision-auto runs its pressure scan and assesses "is the loop honest enough?", it has no signal from the health system docs about whether the 6-state model is correctly implemented across all surfaces; add a Zone 1 obligation: every new health state display surface (HealthPill, ReadinessBadge, OverviewHealthBar, LiveDAG node coloring) MUST be listed in doc 30 Present with a reference to the file that implements it, so the vibe scan can verify the implementation is reachable and the state model is consistent; this converts doc 30 from a historical record to an implementation registry that the scan can audit
- 🔲 30.6 — Visibility: no GitHub-visible health signal for humans scanning the repo — the `loop-health.md` file exists (27.32 partial ✅) but it is a markdown file in `docs/aide/` that a human must know to look for; a donation reviewer or new contributor checking the GitHub repo today cannot see in <10 seconds whether the product health system is operating correctly; add a GitHub Actions job summary (written by the E2E workflow via `>> $GITHUB_STEP_SUMMARY`) that outputs a 3-line health snapshot after each E2E run: overall health state (% ready instances), last kro version tested, and a pass/fail line; this makes health visible on the Actions tab without requiring a human to navigate to a specific file

---

## Zone 1 — Obligations

**O1**: Health state MUST be computed and displayed without requiring a page reload.
**O2**: Error states MUST show the error message or a human-readable translation — never raw k8s error codes alone.
**O3**: The 6-state health model (unknown/pending/reconciling/degraded/ready/error) is the canonical model; do not add states without updating the state machine.

---

## Zone 2 — Implementer's judgment

- Health chip color scheme: established in PR #136; follow existing Tailwind color conventions.
- Error message translation: translateApiError() is the canonical path — extend it, do not create new translation paths.

---

## Zone 3 — Scoped out

- Prometheus/metric scraping for health (k8s API only, no metrics server required)
- Health history persistence beyond the current session

