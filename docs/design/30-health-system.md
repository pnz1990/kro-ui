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

## Future (🔲)

- 🔲 Health trend chart: sparkline showing health state changes over last 24h per RGD
- 🔲 Health alert subscriptions: notify when RGD/instance enters error state
- 🔲 Color-blind accessible health indicators: the current health system uses color as the sole differentiator for several states (e.g. the `--color-status-ready` green vs `--color-status-error` red in HealthChip bar segments); add pattern fills or icons as secondary signals so users with red-green color blindness can distinguish ready/error/degraded without relying solely on hue; WCAG 2.1 SC 1.4.1 (Use of Color) and CNCF accessibility expectations require this; the axe-core journey (074) does not catch this class of violation
- 🔲 Accessibility audit expansion: journey 074 covers only 4 Tier-1 pages (Catalog, RGD DAG, Instance list, Context switcher); add axe-core coverage for the RGD Designer (/author), Fleet view, SRE dashboard, and the Errors tab — these pages have interactive elements (buttons, dropdowns, modals) that could have WCAG violations not caught by current scope

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

