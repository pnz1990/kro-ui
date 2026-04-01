# Component API Contracts: Overview SRE Dashboard (062)

**Phase**: 1 — Design
**Date**: 2026-04-01

---

## New Components

### `OverviewWidget`

Generic widget card wrapper. Handles title bar, loading skeleton, and inline error state.
Content is passed as `children`.

```tsx
interface OverviewWidgetProps {
  /** Widget title shown in the card header */
  title: string
  /** When true, renders shimmer skeleton instead of children */
  loading: boolean
  /** When non-null, renders inline error with Retry button instead of children */
  error: string | null
  /** Called when the user clicks "Retry" in the error state */
  onRetry?: () => void
  /** Optional CSS class added to the card root for layout (e.g. grid-area) */
  className?: string
  /** Widget content — rendered only when !loading && error === null */
  children: React.ReactNode
}
```

**File**: `web/src/components/OverviewWidget.tsx`

---

### `InstanceHealthWidget`

W-1 widget: health distribution as a segmented bar or SVG donut, with bar/donut toggle.

```tsx
interface InstanceHealthWidgetProps {
  /** Pre-computed distribution from buildHealthDistribution() */
  distribution: HealthDistribution
  /** Active chart mode — controlled by parent */
  chartMode: ChartMode
  /** Called when the user toggles the chart type */
  onChartModeChange: (mode: ChartMode) => void
}
```

`HealthDistribution` and `ChartMode` are defined in `data-model.md`.

**File**: `web/src/components/InstanceHealthWidget.tsx`

---

## New Pure Functions (additions to `web/src/lib/format.ts`)

### `healthFromSummary`

```ts
/**
 * Derive a 4-state InstanceHealthState from a compact InstanceSummary.
 * Does not require the full K8sObject conditions array.
 * 'degraded' and 'pending' are not derivable from InstanceSummary alone.
 */
export function healthFromSummary(item: InstanceSummary): InstanceHealthState
```

---

## Modified Components

### `Home.tsx` (rewrite)

Top-level page component. Owns all data fetching and passes data to widget sub-components.

**Props**: none (page component)

**Internal state**:
| State | Type | Description |
|-------|------|-------------|
| `layoutMode` | `LayoutMode` | `'grid'` or `'bento'`; initialized from localStorage |
| `chartMode` | `ChartMode` | `'bar'` or `'donut'`; initialized from localStorage |
| `isFetching` | `boolean` | True while any fetch is in-flight |
| `lastFetchedAt` | `Date \| null` | Timestamp of last successful settle |
| `lastAttemptFailed` | `boolean` | True if last Refresh had at least one failure |
| `instancesState` | `WidgetState<AllInstancesResponse>` | W-1/W-4/W-5/W-7 data |
| `rgdsState` | `WidgetState<K8sList>` | W-3 data |
| `metricsState` | `WidgetState<ControllerMetrics>` | W-2 data |
| `capabilitiesState` | `WidgetState<KroCapabilities>` | W-2 kro version |
| `eventsState` | `WidgetState<K8sList>` | W-6 data |

**Key `data-testid` attributes**:
| testid | Element |
|--------|---------|
| `overview-refresh` | Refresh button |
| `overview-layout-grid` | Grid layout toggle button |
| `overview-layout-bento` | Bento layout toggle button |
| `overview-staleness` | "Updated X ago" label |
| `widget-instances` | W-1 OverviewWidget wrapper |
| `widget-metrics` | W-2 OverviewWidget wrapper |
| `widget-rgd-errors` | W-3 OverviewWidget wrapper |
| `widget-reconciling` | W-4 OverviewWidget wrapper |
| `widget-top-erroring` | W-5 OverviewWidget wrapper |
| `widget-events` | W-6 OverviewWidget wrapper |
| `widget-activity` | W-7 OverviewWidget wrapper |

---

## Unchanged Contracts

The following existing components are imported but their contracts are unchanged:

| Component | Used for |
|-----------|---------|
| `buildErrorHint` from `RGDCard.tsx` | W-3 error message truncation |
| `formatAge` from `format.ts` | W-6 event timestamps, W-7 ages, staleness label |
| `displayNamespace` from `format.ts` | W-7 namespace display |
| `extractReadyStatus` from `format.ts` | W-3 RGD error detection |
| `extractRGDName` from `format.ts` | W-3 RGD name extraction |
| `listAllInstances` from `api.ts` | Instances data source |
| `listRGDs` from `api.ts` | RGDs data source |
| `listEvents` from `api.ts` | Events data source |
| `getControllerMetrics` from `api.ts` | Metrics data source |
| `getCapabilities` from `api.ts` | kro version source |
| `usePageTitle` from `@/hooks/usePageTitle` | Page title |
