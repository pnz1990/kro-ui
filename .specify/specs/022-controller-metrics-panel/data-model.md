# Data Model: Controller Metrics Panel (022)

**Branch**: `022-controller-metrics-panel`  
**Date**: 2026-03-22  
**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

---

## Backend entities (Go)

### `ControllerMetrics` — `internal/k8s/metrics.go`

Represents a single point-in-time snapshot of kro controller operational state, fetched by scraping the Prometheus text endpoint.

```
ControllerMetrics
├── WatchCount        *int64    // dynamic_controller_watch_count (active informers / GroupResources watched)
│                               // null = metric absent in scrape
├── GVRCount          *int64    // dynamic_controller_gvr_count (instance GVRs managed)
│                               // null = metric absent in scrape
├── QueueDepth        *int64    // dynamic_controller_queue_length (kro's internal gauge)
│                               // null = metric absent in scrape; 0 = queue truly empty
├── WorkqueueDepth    *int64    // workqueue_depth{name="dynamic-controller-queue"} (client-go STABLE)
│                               // used as fallback if QueueDepth absent; otherwise a complementary signal
│                               // null = metric absent in scrape
└── ScrapedAt         time.Time // wall-clock time when the upstream endpoint responded
```

**Validation rules**:
- All counter fields are non-negative when present.
- `ScrapedAt` is always set on a successful scrape; it is the zero value on parse errors that still return partial results (not used — any parse error returns a full error response).
- Pointer semantics distinguish `0` (metric present, value zero) from `nil` (metric absent in scrape).

**State transitions**: None — this is a read-only snapshot. Each call to the scraper produces a new independent `ControllerMetrics` value.

---

### `MetricsSource` — `internal/k8s/metrics.go`

Encapsulates the upstream scrape target. Not persisted; constructed from config on startup.

```
MetricsSource
├── URL          string          // full URL, e.g. "http://localhost:8080/metrics"
└── HTTPTimeout  time.Duration   // fixed 4s — leaves 1s margin from the 5s API budget
```

**Invariants**:
- `URL` must be a valid absolute HTTP/HTTPS URL. Validated at startup; `serve` fails fast on malformed input.
- `HTTPTimeout` is a constant; not user-configurable (reducing config surface).

---

## API response entities (Go) — `internal/api/types/response.go`

### `ControllerMetricsResponse`

The JSON shape returned by `GET /api/v1/kro/metrics`.

```
ControllerMetricsResponse
├── watchCount      *int64   json:"watchCount"       // null if absent
├── gvrCount        *int64   json:"gvrCount"         // null if absent
├── queueDepth      *int64   json:"queueDepth"       // null if absent
├── workqueueDepth  *int64   json:"workqueueDepth"   // null if absent (client-go STABLE fallback)
└── scrapedAt       string   json:"scrapedAt"        // RFC3339 timestamp
```

**Null semantics**: A `null` JSON value for a counter field means the metric name was not found in the upstream scrape during this cycle. The frontend renders "Not reported" for `null` — never `0`.

---

## Frontend entities (TypeScript) — `web/src/lib/api.ts`

### `ControllerMetrics` interface

```typescript
interface ControllerMetrics {
  watchCount:     number | null   // null = not reported
  gvrCount:       number | null
  queueDepth:     number | null
  workqueueDepth: number | null
  scrapedAt:      string          // ISO 8601
}
```

---

## Component model — `web/src/components/MetricsStrip.tsx`

### Props

```typescript
interface MetricsStripProps {
  // no props — the component owns its own data fetching via usePolling
}
```

### Internal state (via `usePolling`)

```
MetricsStrip internal state
├── data:     ControllerMetrics | null   // null on first load or sustained error
├── error:    string | null              // non-null when last fetch failed
├── loading:  boolean                    // true only on the very first fetch
└── (polling interval: 30 000 ms, stops on unmount)
```

### Render states

| State | Condition | Rendered output |
|---|---|---|
| Loading | `loading === true && data === null` | Skeleton/spinner strip |
| Healthy | `data !== null && error === null` | 4 counter cells with values |
| Degraded | `error !== null && data === null` | "Metrics unavailable" message scoped to strip |
| Stale-ok | `error !== null && data !== null` | Counter values from last successful fetch; no error banner |

**"Stale-ok"**: if a mid-session fetch fails but prior data exists, the strip continues to show the last-known values without surfacing an error to the user (polling recovers silently per FR-006 scenario 3 in the spec).

---

## Configuration model — `internal/server/server.go` + `internal/cmd/root.go`

```
server.Config (extended)
└── MetricsURL  string   // --metrics-url flag; default "http://localhost:8080/metrics"
```

The `MetricsURL` flows: CLI flag → `server.Config` → `handlers.New(factory, metricsURL)` → stored on `Handler` struct → used in `GetMetrics` handler → passed to `internal/k8s/ScrapeMetrics(ctx, metricsURL)`.

---

## File map for new/modified files

### Backend (Go)

| File | Action | What |
|---|---|---|
| `internal/k8s/metrics.go` | **New** | `ControllerMetrics` struct, `ScrapeMetrics(ctx, url)` — HTTP fetch + Prometheus text parser |
| `internal/k8s/metrics_test.go` | **New** | Table-driven unit tests with golden Prometheus text fixtures |
| `internal/api/handlers/metrics.go` | **New** | `GetMetrics` handler (replaces stub in `instances.go`) |
| `internal/api/handlers/metrics_test.go` | **New** | Handler unit tests with stub scraper |
| `internal/api/handlers/instances.go` | **Modify** | Remove `GetMetrics` stub + stub test |
| `internal/api/handlers/handler.go` | **Modify** | Add `metricsURL string` field; update `New()` to accept it |
| `internal/api/types/response.go` | **Modify** | Add `ControllerMetricsResponse` |
| `internal/cmd/root.go` | **Modify** | Add `--metrics-url` flag; pass to `server.Config` |
| `internal/server/server.go` | **Modify** | Add `MetricsURL` to `Config`; pass to `handlers.New` |

### Frontend (TypeScript)

| File | Action | What |
|---|---|---|
| `web/src/lib/api.ts` | **Modify** | Add `ControllerMetrics` interface and `getControllerMetrics()` |
| `web/src/components/MetricsStrip.tsx` | **New** | Strip component — 4 counter cells, loading/degraded states |
| `web/src/components/MetricsStrip.css` | **New** | Strip layout; token-only colors |
| `web/src/components/MetricsStrip.test.tsx` | **New** | Unit tests for all 4 render states |
| `web/src/pages/Home.tsx` | **Modify** | Import and render `<MetricsStrip />` above RGD grid |
