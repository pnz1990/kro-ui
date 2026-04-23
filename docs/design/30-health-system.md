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

- 🔲 Health state accuracy audit — the 6-state health model (PR #277) has known edge cases where the state machine maps the wrong state: `Ready=False` with `ResourcesReady.reason=NotReady` is classified as `error` even while waiting for a slow dependency (AGENTS.md anti-pattern); `IN_PROGRESS` with `Ready=True` is technically possible during a rolling update and the behavior is undefined; add a dedicated test suite `internal/k8s/health_accuracy_test.go` that asserts the correct state for each of 12 known edge-case condition combinations; add any failed assertions as `🔲` items here; this is self-improvement applied to the health system: the system should detect its own classification errors before operators do (self-improvement lens, 2026-04-23)
- 🔲 Health signal persistence across page reload — all in-session health tracking (sparklines, alert subscriptions, trend charts) is lost on page refresh; an operator who reloads the page loses the health trend for the current session; add `sessionStorage` persistence for `useHealthTrend` records and the alert subscription list using the existing pattern from Designer tab persistence (PR #684); the records should be pruned at session end (not `localStorage`) to avoid stale data across clusters; this is a reliability gap: health monitoring that resets on every page load is unreliable for on-call operators who may need to reload during an incident (reliability lens, 2026-04-23)
- 🔲 Aggregate health export for external paging — the health snapshot clipboard export (PR #740) produces a JSON blob but it is clipboard-only with no URL or webhook destination; an SRE team using PagerDuty or Slack cannot receive kro-ui health alerts without screen-watching; add a `POST` endpoint `/api/v1/health/snapshot` that returns the same JSON as the clipboard button; document it in the README with a `curl` example; a user can then set up a cron job or Slack webhook integration using standard Unix tools; no LLM, no new dependencies — just a documented endpoint that exposes what the UI already computes; this addresses the visibility lens: a human looking at GitHub right now cannot quickly tell if the system is healthy without opening the browser tab (visibility lens, 2026-04-23)
- 🔲 Per-cluster health trend in Fleet view — the Fleet view (PR #52) shows current health counts per cluster but no historical trend within the current session; the SRE dashboard sparkline (PR #739) exists for single-cluster but is not exposed in Fleet; when a fleet has 5+ clusters, an operator cannot see which cluster is improving vs. degrading without drilling into each; add a mini sparkline (2px height, 60px wide) per cluster card showing the last 10 health samples (same `useHealthTrend` hook); this closes the visibility lens for multi-cluster operators: the dashboard shows current state but not direction (visibility lens, 2026-04-23)
- 🔲 Health state mismatch alerting — when the kro-ui health state for an instance differs from `kubectl get` for >30 seconds (which would be detectable if the instance's `status.conditions` array changes between polls but the computed health state does not update), show a "health may be stale — last refreshed N ago" badge on the instance detail; this is self-improvement applied to the health system: the system should detect its own staleness and tell the operator rather than presenting potentially-wrong data silently; the implementation checks `lastPollTimestamp` vs `Date.now()` — if >10s since last successful poll, the health chip shifts to an `unknown` border style with a tooltip (self-improvement lens, 2026-04-23)

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

