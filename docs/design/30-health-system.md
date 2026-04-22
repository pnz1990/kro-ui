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

## Future (🔲)
- ✅ Color-blind accessible health indicators: `HEALTH_STATE_ICON` map (single source of truth) exported from `format.ts`; icon prefixes (✓/✗/⚠/↻/…/?) added to HealthPill, ReadinessBadge, and OverviewHealthBar chips; icons use `aria-hidden="true"` to avoid screen reader double-reading; satisfies WCAG 2.1 SC 1.4.1 (Use of Color). (PR #TBD, spec issue-580, 2026-04)
- ✅ Accessibility audit expansion: journey 074 expanded from 4 to 8 pages — added Steps 5–8 covering Overview/SRE dashboard, Fleet view, RGD Designer (/author), and Errors tab; all use `waitForFunction()` (no `waitForTimeout`); SVG elements excluded with `.exclude('svg')` as custom widgets; test-app-dependent steps use `test.skip` guard. (spec issue-581, 2026-04)
- 🔲 Skip-to-main-content link: the Layout component renders a `<main>` landmark but there is no visible-on-focus "Skip to main content" link at the top of the page; keyboard and screen reader users must Tab through the entire navigation bar before reaching page content on every page load; WCAG 2.1 SC 2.4.1 (Bypass Blocks) requires a skip mechanism; add a visually-hidden-until-focused `<a href="#main-content">Skip to main content</a>` as the first focusable element in Layout, and add `id="main-content"` to the `<main>` element
- ✅ Live health state change announcements: `aria-live="polite"` region `health-state-announcer` in InstanceDetail; `prevHealthRef` (useRef) tracks prior state; `useEffect` fires `setAriaAnnouncement()` only on transition (prev ≠ current); initial render skipped (prevRef=null); `HEALTH_STATE_ICON` from format.ts used in message; `sr-only` CSS class added to tokens.css for reuse across visually-hidden elements. WCAG 2.1 SC 4.1.3 (Status Messages). (PR #TBD, issue-668, 2026-04)

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

