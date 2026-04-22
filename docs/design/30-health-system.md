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
- ✅ Color-blind accessible health indicators: `HEALTH_STATE_ICON` map exported from `format.ts`; icon prefixes (✓/✗/⚠/↻/…/?) added to HealthPill, ReadinessBadge, and OverviewHealthBar chips; WCAG 2.1 SC 1.4.1 (spec issue-580, 2026-04)
- ✅ Accessibility audit expansion: journey 074 expanded to 8 pages (Overview SRE dashboard, Fleet, Designer, Errors tab); all use `waitForFunction()`; SVG excluded as complex widget; test-app steps use `test.skip` guard (spec issue-581, 2026-04)
- ✅ Skip-to-main-content link: `<a href="#main-content">` as first focusable element in Layout; WCAG 2.1 SC 2.4.1 (PR #669, issue-667, 2026-04)
- ✅ Live health state change announcements: `aria-live="polite"` region in InstanceDetail with `prevRef` transition tracking; WCAG 2.1 SC 4.1.3 (PR #670, issue-668, 2026-04)

## Future (🔲)
- 🔲 Health system: SRE dashboard in-session health sparkline — the SRE dashboard (PR #405) shows current health counts but no trend; an operator cannot tell whether the cluster is getting healthier or more degraded over the past hour; add per-health-state sparkline charts (ready/degraded/error counts) using data sampled at each 5s poll cycle, retained in-memory for the current browser session (max 720 points = 1 hour); the `useHealthTrend` hook already exists (`web/src/hooks/useHealthTrend.ts`) — wire it into the SRE dashboard widget; no server-side storage required; this directly addresses the "metrics collected but not acted on" pressure: poll data is available but not visualized over time
- 🔲 Health system: health snapshot clipboard export — an operator debugging a cluster incident needs to share the current health state with their team; add a "Copy health snapshot" button to the SRE dashboard that produces a structured JSON blob with: health state counts per RGD, top-5 error messages, cluster context name, and a timestamp; pastes into Slack or incident tickets without requiring the recipient to have kubectl access; the JSON format must be stable across kro-ui versions so future tooling can parse historical snapshots

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

