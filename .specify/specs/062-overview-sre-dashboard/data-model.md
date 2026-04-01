# Data Model: Overview SRE Dashboard (062)

**Phase**: 1 — Design
**Date**: 2026-04-01

---

## Entities

### 1. `InstanceSummary` *(existing, from `api.ts`)*

Returned by `GET /api/v1/instances`. Already defined — no changes.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | CR instance name |
| `namespace` | `string` | Namespace (`_` = cluster-scoped) |
| `kind` | `string` | CR kind from the RGD schema |
| `rgdName` | `string` | Name of the parent RGD |
| `state` | `string` | kro `status.state` string (e.g. `"IN_PROGRESS"`, `"ACTIVE"`) |
| `ready` | `string` | Ready condition value (`"True"`, `"False"`, `"Unknown"`, or `""`) |
| `message?` | `string` | Ready condition message (non-empty when Ready≠True) |
| `creationTimestamp` | `string` | ISO 8601 creation timestamp |

---

### 2. `InstanceHealthState` *(existing, from `format.ts`)*

Six-state enum: `'ready' | 'degraded' | 'reconciling' | 'error' | 'pending' | 'unknown'`

For Overview purposes, only 4 states are derivable from `InstanceSummary` (no children data):
`ready`, `reconciling`, `error`, `unknown`.

---

### 3. `HealthDistribution` *(new, computed in `Home.tsx`)*

Aggregate counts derived by applying `healthFromSummary()` to all items in `AllInstancesResponse`.

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total instance count |
| `ready` | `number` | Instances in ready state |
| `reconciling` | `number` | Instances actively reconciling (IN_PROGRESS) |
| `error` | `number` | Instances in error state (Ready=False) |
| `unknown` | `number` | Instances with indeterminate state |

**Derivation**: `healthFromSummary(item: InstanceSummary): InstanceHealthState` — new pure function added to `web/src/lib/format.ts`.

---

### 4. `LayoutMode` *(new, localStorage key `"overview-layout"`)*

`'grid' | 'bento'`  
Default: `'grid'`  
Persisted via `lsGet/lsSet` helpers.

---

### 5. `ChartMode` *(new, localStorage key `"overview-health-chart"`)*

`'bar' | 'donut'`  
Default: `'bar'`  
Persisted via `lsGet/lsSet` helpers.

---

### 6. `WidgetState<T>` *(new, local pattern in `Home.tsx`)*

Each data source is modelled as a triple:

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T \| null` | Loaded data; null while loading or on error |
| `loading` | `boolean` | True while fetch in flight |
| `error` | `string \| null` | Error message from failed fetch; null on success |

Used for: `instancesState`, `rgdsState`, `metricsState`, `capabilitiesState`, `eventsState`.

---

### 7. `TopErroringRGD` *(new, computed in `Home.tsx`)*

Derived from `HealthDistribution` grouped by `rgdName`.

| Field | Type | Description |
|-------|------|-------------|
| `rgdName` | `string` | RGD name |
| `errorCount` | `number` | Count of error-state instances for this RGD |

Sorted descending by `errorCount`. Top 5 displayed in W-5.

---

## State Transitions

### Page Load / Refresh lifecycle

```
mount / Refresh click
  → abort previous AbortController
  → create new AbortController
  → isFetching = true
  → set all 5 WidgetState.loading = true
  → Promise.allSettled([instances, rgds, metrics, capabilities, events])
  → on settle: update each WidgetState independently
  → isFetching = false
  → lastFetchedAt = new Date()  (only on ≥1 success)
  → if any failed: lastAttemptFailed = true
```

### Layout toggle

```
user clicks Grid/Bento
  → setLayoutMode(mode)
  → lsSet('overview-layout', mode)
```

### Chart toggle (W-1)

```
user clicks Bar/Donut
  → setChartMode(mode)
  → lsSet('overview-health-chart', mode)
```

---

## Computed Derivations

### `healthFromSummary(item: InstanceSummary): InstanceHealthState`

```
if item.state === 'IN_PROGRESS'  → 'reconciling'
else if item.ready === 'True'    → 'ready'
else if item.ready === 'False'   → 'error'
else                             → 'unknown'
```

### `buildHealthDistribution(items: InstanceSummary[]): HealthDistribution`

Reduce `items` by `healthFromSummary`. Sum by state.

### `buildTopErroringRGDs(items: InstanceSummary[]): TopErroringRGD[]`

Filter to `error` state, group by `rgdName`, count, sort desc, take top 5.

### `getRecentlyCreated(items: InstanceSummary[]): InstanceSummary[]`

Sort by `creationTimestamp` DESC. Take top 5.

### `getMayBeStuck(items: InstanceSummary[]): InstanceSummary[]`

Filter to `state === 'IN_PROGRESS'` AND `creationTimestamp` present AND elapsed > 5 min.
Sort by `creationTimestamp` ASC (oldest first). Take top 5.

### `countMayBeStuck(items: InstanceSummary[]): number`

Count of all IN_PROGRESS instances where elapsed > 5 min (not capped at 5).

### SVG Donut Segment

For a circle with radius `r` and center `(cx, cy)`:
```
circumference C = 2 × π × r
dasharray for segment = (proportion × C) + ' ' + C
rotation = cumulative angle from 12 o'clock (−90°)
```
Each segment: `<circle stroke="var(--color-status-X)" strokeDasharray={...} strokeDashoffset={0} transform="rotate(deg, cx, cy)" />`
