# Implementation Plan: Overview Page Revamp — Single-Cluster SRE Executive Dashboard

**Branch**: `062-overview-sre-dashboard` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**GH Issue**: #397

## Summary

Replace `Home.tsx` (currently a searchable RGD card grid) with a purpose-built 7-widget SRE
dashboard that answers "Is this cluster healthy right now?" at a glance. All data comes from
existing API endpoints — no new backend code required. The rewrite is frontend-only: new
`OverviewWidget` and `InstanceHealthWidget` components, a CSS grid layout with Grid/Bento mode
toggle, a pure-SVG donut chart, and per-widget independent loading/error states.

---

## Technical Context

**Language/Version**: TypeScript 5.x / React 19 / Vite  
**Primary Dependencies**: React Router v7 (navigation), existing `@/lib/api` and `@/lib/format` (no new deps)  
**Storage**: `localStorage` (layout mode key `"overview-layout"`, chart mode key `"overview-health-chart"`)  
**Testing**: Vitest + React Testing Library (existing setup); `bun vitest run`  
**Target Platform**: Web (SPA, same-origin Go binary)  
**Project Type**: Frontend feature within existing web/ module  
**Performance Goals**: All 7 widgets populated within the same time budget as the current page (no new backend endpoints); data sources fetched in parallel via `Promise.allSettled`  
**Constraints**: No external chart library (SVG donut must be pure CSS/SVG with design tokens); no CSS frameworks; no state management libraries; all colors via `var(--token-name)` only  
**Scale/Scope**: Works at 5,000+ instances in W-1 (aggregated counts, not per-item rendering); W-6 capped at 10 events

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | ✅ PASS | No dependency on unmerged code; all API endpoints exist |
| §II Cluster Adaptability | ✅ PASS | Uses existing `listAllInstances`, `listRGDs`, `listEvents`, `getControllerMetrics`, `getCapabilities` — all dynamic client backed |
| §III Read-Only | ✅ PASS | No mutating calls; frontend-only change |
| §IV Single Binary | ✅ PASS | No new assets; embedded via existing `go:embed` |
| §V Simplicity — no new deps | ✅ PASS | SVG donut implemented with `stroke-dasharray`/`stroke-dashoffset`; no chart library |
| §V Simplicity — no CSS frameworks | ✅ PASS | All CSS via `tokens.css` custom properties |
| §V Simplicity — no state mgmt libs | ✅ PASS | Plain `useState`/`useEffect`; `localStorage` via try/catch helpers |
| §IX No hardcoded hex/rgba | ✅ PASS | All SVG stroke colors reference `var(--color-status-*)` tokens |
| §IX Shared helpers | ✅ PASS | `buildErrorHint` imported from `RGDCard.tsx` (already exported); `formatAge`, `extractReadyStatus`, `displayNamespace` from `@/lib/format` |
| §XI API Performance Budget | ✅ PASS | All fetches in parallel; no sequential loops; re-uses already-loaded instance list across W-1/W-4/W-5/W-7 |
| §XII Graceful Degradation | ✅ PASS | Per-widget inline error; missing `creationTimestamp` → excluded from stuck heuristic only; `localStorage` failure → silent default |
| §XIII Page title | ✅ PASS | `usePageTitle('Overview')` preserved |
| §XIII Interactive cards | ✅ PASS | W-3/W-5/W-6/W-7 row links use full-row `<Link>` or `<a>` |
| §XIII Tooltips / overflow | ✅ PASS | Long text truncated with `title` attribute per FR-037 |
| §XIV E2E | ✅ PASS | No new journey file prefix conflicts; API-first checks required in journeys |

**No violations. No justification table required.**

---

## Project Structure

### Documentation (this feature)

```text
.specify/specs/062-overview-sre-dashboard/
├── plan.md              ← this file
├── spec.md              ← requirements (from GH #397)
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── component-api.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
web/src/pages/
├── Home.tsx                   ← REWRITTEN (7-widget dashboard)
├── Home.css                   ← REWRITTEN
└── Home.test.tsx              ← UPDATED (old VirtualGrid/RGDCard tests removed; widget tests added)

web/src/components/
├── OverviewWidget.tsx         ← NEW — generic widget card wrapper
├── OverviewWidget.css         ← NEW
├── InstanceHealthWidget.tsx   ← NEW — W-1: bar/donut toggle + health distribution
└── InstanceHealthWidget.css   ← NEW
```

**Unchanged**: `Catalog.tsx`, `MetricsStrip.tsx`, `OverviewHealthBar.tsx`, `RGDCard.tsx`,
`VirtualGrid.tsx`, all backend handlers, all other pages.

**Structure Decision**: Single frontend module. No new routes. All widgets are inline
sub-components of `Home.tsx` (or dedicated component files for W-1 which is complex).
Widget state is local to each widget; shared fetch results are lifted to `Home.tsx` and
passed as props.

---

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
