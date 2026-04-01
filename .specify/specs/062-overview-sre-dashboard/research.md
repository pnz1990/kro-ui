# Research: Overview SRE Dashboard (062)

**Phase**: 0 — Research
**Date**: 2026-04-01
**Branch**: `062-overview-sre-dashboard`

---

## R-01 — Instance data source for W-1/W-4/W-5/W-7

**Question**: Does `listAllInstances()` return enough fields (`state`, `ready`, `creationTimestamp`, `rgdName`, `kind`, `name`, `namespace`) to compute all widget data without extra fetches?

**Finding**: Yes. `InstanceSummary` in `api.ts:73-83` includes all required fields:
```ts
export interface InstanceSummary {
  name: string; namespace: string; kind: string; rgdName: string
  state: string; ready: string; message?: string; creationTimestamp: string
}
```
`AllInstancesResponse` wraps `InstanceSummary[]` with a `total` count. Endpoint: `GET /api/v1/instances`.

**Decision**: Fetch `listAllInstances()` once on mount and share its result across W-1, W-4, W-5, and W-7. No per-RGD `listInstances()` fan-out needed on the Overview page.

---

## R-02 — Health state mapping for InstanceSummary

**Question**: How does the spec's simplified 4-state mapping (IN_PROGRESS→reconciling, True→ready, False→error, else→unknown) relate to the existing 6-state `extractInstanceHealth()`?

**Finding**: `extractInstanceHealth()` in `format.ts:108` operates on full `K8sObject` (needs `status.conditions[]`). `InstanceSummary` only carries `state` (kro status string) and `ready` (condition value string) — not the full conditions array. Therefore `extractInstanceHealth()` cannot be called directly on an `InstanceSummary`.

**Decision**: Implement a new pure function `healthFromSummary(item: InstanceSummary): InstanceHealthState` in `Home.tsx` (or extract to `format.ts` for testability):
```ts
function healthFromSummary(item: InstanceSummary): InstanceHealthState {
  if (item.state === 'IN_PROGRESS') return 'reconciling'
  if (item.ready === 'True') return 'ready'
  if (item.ready === 'False') return 'error'
  return 'unknown'
}
```
This matches FR-013 exactly. The 'degraded' and 'pending' states are not derivable from `InstanceSummary` alone (noted in spec Assumptions).

---

## R-03 — SVG donut implementation approach

**Question**: How to implement a pure-SVG donut with no external library using design tokens?

**Decision**: Use a single `<circle>` per segment with `stroke-dasharray` / `stroke-dashoffset`. The circumference formula: `C = 2π × r`. Each segment's `stroke-dasharray` is `(proportion × C) (C - proportion × C)`. Segments are stacked by rotating with `transform="rotate(deg, cx, cy)"` based on cumulative angle.

**Token mapping** (from `tokens.css` scan):
| State | CSS token |
|-------|-----------|
| error | `--color-status-error` |
| degraded | `--color-status-degraded` |
| reconciling | `--color-status-reconciling` |
| pending | `--color-status-pending` |
| unknown | `--color-status-unknown` |
| ready | `--color-status-ready` |

SVG `stroke` values must use `var(--color-status-*)` — read via `getComputedStyle` if needed, but prefer setting `stroke` from an inline `style={{ stroke: 'var(--color-status-error)' }}` on each `<circle>`. This is valid SVG and respects design tokens without any hardcoded hex.

**Segment order** (worst-first at 12 o'clock, per FR-019): error → degraded → reconciling → pending → unknown → ready.

---

## R-04 — buildErrorHint availability

**Question**: Is `buildErrorHint` exported from `RGDCard.tsx` and importable?

**Finding**: `RGDCard.tsx:26` — `export function buildErrorHint(reason: string, message: string): string`. Yes, it is a named export. W-3 can import it directly:
```ts
import { buildErrorHint } from '@/components/RGDCard'
```

**Decision**: Import directly. No duplication needed. Resolves spec assumption on line 232.

---

## R-05 — MetricsStrip data: polling vs. one-shot fetch

**Question**: `MetricsStrip` uses `usePolling`. W-2 must NOT use `MetricsStrip` and should fetch once (snapshot + Refresh model). What does `getControllerMetrics()` return?

**Finding**: `api.ts:224-232` — `ControllerMetrics` has `watchCount`, `gvrCount`, `queueDepth`, `workqueueDepth` (all `number | null`), `scrapedAt` (ISO string). `getCapabilities()` returns `KroCapabilities.version` string for the kro version footer line.

**Decision**: In `Home.tsx`, call `getControllerMetrics()` and `getCapabilities()` as two of the parallel fetch sources. Pass results as props to W-2 sub-component. No polling inside W-2. Labels match MetricsStrip exactly:
- `watchCount` → "Active watches"
- `gvrCount` → "GVRs served"
- `queueDepth` → "Queue depth (kro)"
- `workqueueDepth` → "Queue depth (client-go)"

---

## R-06 — Events fetch signature

**Question**: `listEvents()` accepts optional `namespace` and `rgd` params. W-6 needs cluster-wide, no filter. Is an empty call safe?

**Finding**: `api.ts:146` — `listEvents(namespace?: string, rgd?: string)`. Calling with no args produces `GET /api/v1/events` with no query string. Backend returns all kro events up to the configured limit.

**Decision**: Call `listEvents()` with no arguments. Take `(items ?? []).slice(0, 10)` client-side. No backend change.

---

## R-07 — Skeleton shimmer pattern

**Question**: What CSS pattern is used for shimmer skeletons? Need to replicate for widget loading states.

**Finding**: `MetricsStrip.css:71-99` — uses `linear-gradient` sweep with `animation: skeleton-shimmer`. The keyframe moves `background-position` from `-200% 0` to `200% 0`. This pattern is also in `SkeletonCard.css`.

**Decision**: `OverviewWidget.css` defines a `.overview-widget__skeleton` class using the same pattern. Each widget renders `<div className="overview-widget__skeleton" />` while loading. For W-1's chart area, a taller skeleton block is used.

---

## R-08 — localStorage access pattern

**Question**: Is there an existing `localStorage` helper in the codebase?

**Finding**: No centralised helper. Individual components use `localStorage.getItem/setItem` directly (e.g. `Catalog.tsx` for status filter). `localStorage` access in SSR-safe environments requires try/catch.

**Decision**: Implement two module-level pure helpers in `Home.tsx`:
```ts
function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* silent */ }
}
```
No shared utility file — single use, scope-local.

---

## R-09 — "Updated X ago" staleness counter

**Question**: How to implement a live-updating "Updated X ago" label?

**Finding**: `formatAge()` in `format.ts:215` is a pure function. The counter needs to re-run every render cycle (or on a timer) to tick. Using `Date.now()` inside a `useState` + `useEffect` tick every 10s is sufficient (the display only has minute-resolution for > 1m).

**Decision**: Store `lastFetchedAt: Date | null` in state. Render `{lastFetchedAt ? formatAge(lastFetchedAt.toISOString()) : '—'}` inside a component that ticks via `useEffect` with a 10s `setInterval`. This is a simple timer, not polling — it just re-reads `lastFetchedAt` to recompute the label.

---

## R-10 — Bento grid CSS approach

**Question**: Can the Bento layout be achieved with pure CSS grid, no JS?

**Finding**: The spec describes a named-area CSS grid:
```
W1(tall,60%) | W2
             | W3
             | W4
W5           | W6 (wide)
W7           (full width)
```

**Decision**: Use CSS `grid-template-areas` with named areas. Example:
```css
.home__bento {
  display: grid;
  grid-template-columns: 60% 1fr;
  grid-template-rows: auto auto auto;
  grid-template-areas:
    "w1 w2"
    "w1 w3"
    "w1 w4"
    "w5 w6"
    "w7 w7";
  gap: 16px;
}
```
Each widget gets `grid-area: w1` etc. On narrow viewports (< 768px), a `@media` query collapses to single column by overriding `grid-template-columns: 1fr` and `grid-template-areas` to a vertical stack.

---

## R-11 — "May be stuck" heuristic timing

**Question**: How to compare `creationTimestamp` against 5 minutes ago reliably?

**Finding**: `InstanceSummary.creationTimestamp` is an ISO 8601 string (same format as all other timestamps). `Date.parse()` is safe.

**Decision**:
```ts
const STUCK_THRESHOLD_MS = 5 * 60 * 1000
function mayBeStuck(item: InstanceSummary): boolean {
  if (item.state !== 'IN_PROGRESS') return false
  if (!item.creationTimestamp) return false
  return Date.now() - Date.parse(item.creationTimestamp) > STUCK_THRESHOLD_MS
}
```

---

## R-12 — Refresh button abort / deduplication

**Question**: How to prevent concurrent fetches when Refresh is clicked multiple times?

**Finding**: Existing `Home.tsx` uses `AbortController` ref pattern (`abortRef.current`). This is the established codebase pattern.

**Decision**: Store an `AbortController` in a `useRef`. On Refresh, call `abortRef.current?.abort()`, create a new `AbortController`, store it, then launch all `Promise.allSettled` fetches passing `{ signal }`. The `isFetching` state boolean gates the button disabled/aria state.

---

## R-13 — File surface conflict risk

**Question**: Does this feature touch any files that other open branches also modify?

**Finding** (from `wt list`):
- `fix/derive-child-state-available-wins` — touches `LiveDAG.tsx` / `dag.ts` (not `Home.tsx`)
- `fix/extref-live-state-reconciling` — same DAG files
- `fix/issue-387-395-audit-findings` — wide audit; may touch `format.ts`

**Decision**: Check `format.ts` diff on `fix/issue-387-395-audit-findings` before merging. The new `healthFromSummary` function will be added to `format.ts` — it's a pure additive export so merge conflicts are unlikely. `Home.tsx` and the two new component files have no overlap with any open branch.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R-01 | Use `listAllInstances()` for W-1/W-4/W-5/W-7; single fetch, shared data |
| R-02 | New `healthFromSummary(item: InstanceSummary)` pure function in `format.ts` |
| R-03 | Pure SVG donut via `stroke-dasharray`; inline `style={{ stroke: 'var(--token)' }}` |
| R-04 | Import `buildErrorHint` directly from `@/components/RGDCard` |
| R-05 | `getControllerMetrics()` + `getCapabilities()` one-shot; no polling in W-2 |
| R-06 | `listEvents()` no-args + `.slice(0, 10)` client-side |
| R-07 | `OverviewWidget.css` shimmer using same gradient pattern as `MetricsStrip.css` |
| R-08 | Module-level `lsGet/lsSet` helpers in `Home.tsx` |
| R-09 | `lastFetchedAt: Date | null` + 10s tick interval for staleness label |
| R-10 | CSS `grid-template-areas` for Bento; `@media` collapse for narrow viewports |
| R-11 | `mayBeStuck()` pure function using `Date.parse(creationTimestamp)` |
| R-12 | `AbortController` ref pattern for Refresh deduplication |
| R-13 | `healthFromSummary` is additive to `format.ts`; no conflict risk |
