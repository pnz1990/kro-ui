# Data Model: 040-Per-Context Controller Metrics

## Entities

### 1. `PodRef` (new — `internal/k8s/metrics.go`)

Identifies the resolved kro controller pod for a specific kubeconfig context.

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Namespace the pod lives in |
| `podName` | `string` | Pod name |

No validation beyond non-empty strings. Populated by `discoverKroPod`.

---

### 2. `cachedPodRef` (new — `internal/k8s/metrics.go`, unexported)

Wraps a `PodRef` with a TTL for in-process caching.

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Namespace of the cached pod |
| `podName` | `string` | Name of the cached pod |
| `expiry` | `time.Time` | Time after which this entry is stale |

Stored inside `PodRefCache` as `map[string]cachedPodRef` keyed by context name.

---

### 3. `PodRefCache` (new — `internal/k8s/metrics.go`)

Thread-safe per-context pod reference cache.

| Field | Type | Description |
|-------|------|-------------|
| `mu` | `sync.RWMutex` | Guards `refs` map |
| `refs` | `map[string]cachedPodRef` | Context name → cached pod ref |
| `ttl` | `time.Duration` | Cache entry lifetime (default 60s) |

Methods:
- `get(ctx string) (PodRef, bool)` — returns cached entry if present and not expired
- `set(ctx string, ref PodRef)` — stores entry with `expiry = now + ttl`
- `invalidate(ctx string)` — removes a specific entry
- `invalidateAll()` — clears all entries (called on context switch)

---

### 4. `ControllerMetrics` (existing — `internal/k8s/metrics.go`, extended)

No structural changes to this type. The existing pointer fields remain:

| Field | Type | Description |
|-------|------|-------------|
| `WatchCount` | `*int64` | `dynamic_controller_watch_count`; nil if absent |
| `GVRCount` | `*int64` | `dynamic_controller_gvr_count`; nil if absent |
| `QueueDepth` | `*int64` | `dynamic_controller_queue_length`; nil if absent |
| `WorkqueueDepth` | `*int64` | `workqueue_depth{name="dynamic-controller-queue"}`; nil if absent |
| `ScrapedAt` | `time.Time` | UTC timestamp of successful upstream scrape |

The `nil` sentinel semantics are unchanged: `nil` = "not reported", never zero.

---

### 5. `ControllerMetricsResponse` (existing — `internal/api/types/response.go`)

No changes to JSON field names or types. The response shape is stable.

| JSON field | Go type | Description |
|-----------|---------|-------------|
| `watchCount` | `*int64` (→ `number\|null`) | Active watches |
| `gvrCount` | `*int64` (→ `number\|null`) | GVRs served |
| `queueDepth` | `*int64` (→ `number\|null`) | kro workqueue depth |
| `workqueueDepth` | `*int64` (→ `number\|null`) | client-go workqueue depth |
| `scrapedAt` | `string` (RFC3339) | When upstream responded |

---

### 6. `MetricsDiscoverer` (new interface — `internal/api/handlers/handler.go`)

Defined at the consumption site (§VI). Satisfied by `k8s.MetricsDiscoverer`.

```go
type metricsDiscoverer interface {
    ScrapeMetrics(ctx context.Context, contextName string) (*k8s.ControllerMetrics, error)
}
```

`contextName` is the kubeconfig context name to scrape. Empty string = active context.

---

### 7. `MetricsDiscoverer` (concrete — `internal/k8s/metrics.go`)

The concrete implementation of `metricsDiscoverer`.

| Field | Type | Description |
|-------|------|-------------|
| `factory` | `*ClientFactory` | Active context clients + REST config |
| `cache` | `*PodRefCache` | Per-context pod ref cache |
| `kubeconfigPath` | `string` | For building ephemeral clients for `?context=` |

Methods:
- `ScrapeMetrics(ctx context.Context, contextName string) (*ControllerMetrics, error)`
  - Empty `contextName` → use factory's active context
  - Non-empty → build ephemeral `ContextClients` via `BuildContextClient`
  - Internally calls `discoverKroPod` then `scrapeViaProxy`

---

## State Transitions

### Pod reference lifecycle

```
[absent / expired]
        │
        ▼ (request arrives, cache miss)
   discoverKroPod
        │
        ├─ pod found ──→ [cached, TTL=60s] ──→ scrapeViaProxy
        │                      │
        │                   TTL expires ──→ [absent / expired]
        │                      │
        │                  proxy returns 404 ──→ invalidate ──→ re-discover (once)
        │                      │
        │                  re-discover fails ──→ [absent] ──→ return null fields
        │
        └─ pod not found ─→ return null fields (200 OK, no cache entry)
```

### Context switch impact

```
ClientFactory.SwitchContext(ctx)
    │
    └─ PodRefCache.InvalidateAll()
              │
              └─ all cached entries cleared
                    │
                    └─ next request for any context → re-discover
```

---

## Validation Rules

| Rule | Where Enforced |
|------|----------------|
| `?context=` query param, if present, must match a known kubeconfig context | `GetMetrics` handler; returns 404 if not found |
| Pod discovery falls back gracefully; never errors on "not found" | `discoverKroPod`; returns `PodRef{}`, `false` when no pods match |
| Pod proxy 404 triggers exactly one re-discover retry per request | `ScrapeMetrics` implementation; no infinite retry |
| Cache TTL is 60s; configurable via `PodRefCache.ttl` but default is 60s | `NewPodRefCache(ttl time.Duration)` constructor |
| `contextName = ""` always resolves to active context | `MetricsDiscoverer.ScrapeMetrics` |

---

## Frontend State Shape (new)

In `web/src/pages/Fleet.tsx`:

```ts
// New state variable
const [metricsMap, setMetricsMap] =
  useState<Map<string, ControllerMetrics | null>>(new Map())
```

- Key: `context` string (matches `ClusterSummary.context`)
- Value: `ControllerMetrics` when scrape succeeded; `null` when unavailable
- `undefined` (key absent) = not yet fetched (loading state)
- Map is populated by `Promise.allSettled` fan-out after `getFleetSummary()` resolves
