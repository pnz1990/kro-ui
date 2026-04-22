# Spec: issue-712 — Health system: SRE dashboard in-session health sparkline

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Health system: SRE dashboard in-session health sparkline (🔲 → ✅)

## Summary

The SRE dashboard (PR #405) shows current health counts but no trend. An operator
cannot tell whether the cluster is getting healthier or more degraded over time.

The `useHealthTrend` hook (`web/src/hooks/useHealthTrend.ts`) already samples
health state per-poll and returns a `samples` array. The `HealthTrendSparkline`
component (`web/src/components/HealthTrendSparkline.tsx`) renders it as SVG polylines.

Neither is wired into the Overview SRE dashboard. This spec wires them in.

---

## Zone 1 — Obligations

**O1**: The Overview page (Home.tsx) MUST call `record(instances)` on each successful
`listAllInstances` response to accumulate trend samples.

**O2**: The W-1 "Instance health" widget MUST render `<HealthTrendSparkline samples={...} />`
below the existing donut chart, showing the in-session health trend.

**O3**: The sparkline MUST display the "not enough data" placeholder when `samples.length < 2`
(this is already handled by the `HealthTrendSparkline` component itself — no special case needed).

**O4**: No new npm dependencies may be added. The implementation reuses existing hooks and components.

**O5**: The `InstanceHealthWidget` MUST accept an optional `samples` prop of type `HealthSample[]`
so the sparkline can be rendered inline with the donut.

---

## Zone 2 — Implementer's judgment

- The `InstanceHealthWidget` component receives `samples` as an optional prop.
  If undefined or empty (< 2), the sparkline shows its own placeholder.
- The widget layout: donut + legend on the left, sparkline below the legend or full-width.
- In-memory only — no localStorage persistence for trend data (design §Zone 3).

---

## Zone 3 — Scoped out

- Persisting trend data across page refreshes (in-memory only, per design doc)
- Configurable time windows
- Per-RGD or per-namespace sparklines (overview aggregate only)
