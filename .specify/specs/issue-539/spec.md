# Spec: issue-539 — Health Trend Sparkline

> Design doc: `docs/design/30-health-system.md`
> Section: `§ Future`
> Implements: Health trend chart — sparkline showing health state changes per RGD (🔲 → ✅)

---

## Summary

Add an in-session health trend sparkline to the RGD detail Instances tab. On each
poll cycle, the page records a health snapshot (counts of ready/error/degraded/
reconciling/unknown/pending instances). The sparkline renders these samples as a
small SVG line chart showing % ready (green) and % error+degraded (red) over time.

**Scope constraint** (design doc Zone 3): no server-side or localStorage persistence.
The sparkline only shows data accumulated since the Instances tab was first loaded in
the current browser session.

---

## Zone 1 — Obligations

**O1**: A `HealthTrendSparkline` component MUST render an SVG sparkline with:
  - A green line for `% ready` (ready / total)
  - A red line for `% error+degraded` ((error + degraded) / total)
  - Accessible `role="img"` and `aria-label` describing the trend

**O2**: The sparkline MUST appear on the RGD detail Instances tab above the
`InstanceTable`, visible whenever `instanceList` has items and there are ≥2 samples.

**O3**: Health samples MUST be collected on each successful `listInstances` response
(triggered by the Instances tab being open and the tab becoming active). Each sample
is: `{ timestamp: number, total, ready, error, degraded, reconciling, pending, unknown }`.

**O4**: The sparkline MUST show "Not enough data" text when there are <2 samples (i.e.
only the initial load — no trend visible yet).

**O5**: A `useHealthTrend` hook in `web/src/hooks/useHealthTrend.ts` MUST manage sample
accumulation. It accepts `items: K8sObject[]` and returns `{ samples, record }` where
`record(items)` appends a new snapshot and `samples` is the accumulated array.

**O6**: All colors MUST use CSS tokens from `tokens.css` (no hardcoded hex/rgba).

**O7**: The component MUST have ≥6 unit tests covering: empty state, single-sample state,
multi-sample rendering, % calculations, SVG path existence, and aria-label presence.

---

## Zone 2 — Implementer's judgment

- Max samples to keep: 288 (24h × 5m polling = 288; in practice 5s polling means more,
  cap at 288 to avoid memory growth). Use a FIFO circular buffer via array slice.
- Sparkline width/height: 240×40 viewBox. Use polyline (not path) for simplicity.
- Show sample count and time range as a caption below the sparkline.
- The sparkline is hidden if total = 0 (no instances). Show normal empty state instead.

---

## Zone 3 — Scoped out

- localStorage or any cross-session persistence
- Backend API changes
- Sparkline on non-RGD-detail pages
- Tooltip on individual data points (separate future item)
