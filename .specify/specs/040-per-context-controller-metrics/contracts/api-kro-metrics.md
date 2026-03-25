# API Contract: GET /api/v1/kro/metrics

**Endpoint**: `GET /api/v1/kro/metrics`  
**Handler**: `Handler.GetMetrics`  
**Auth**: None (same-origin browser request)

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | string | No | Kubeconfig context name to scrape. Absent or empty = active context. |

---

## Success Response

**Status**: `200 OK`  
**Content-Type**: `application/json`

```json
{
  "watchCount":     42,
  "gvrCount":       7,
  "queueDepth":     0,
  "workqueueDepth": 0,
  "scrapedAt":      "2026-03-24T12:00:00Z"
}
```

**Field semantics**:

| Field | Type | Null meaning |
|-------|------|--------------|
| `watchCount` | `number \| null` | kro pod not found or metric absent |
| `gvrCount` | `number \| null` | kro pod not found or metric absent |
| `queueDepth` | `number \| null` | kro pod not found or metric absent |
| `workqueueDepth` | `number \| null` | kro pod not found or metric absent |
| `scrapedAt` | `string` (RFC3339) | Always set (timestamp of request) |

A response with all-null metric fields and a current `scrapedAt` means "kro is not
installed or the controller pod was not found". This is **not an error** — 200 OK
with null fields is the correct graceful degradation response (Constitution §XII).

---

## Error Responses

| Status | When | Body |
|--------|------|------|
| `404 Not Found` | `?context=` param specifies a context not in kubeconfig | `{"error": "context \"<name>\" not found in kubeconfig"}` |
| `502 Bad Gateway` | Pod proxy returned a non-200 status from the upstream kro pod | `{"error": "metrics source returned HTTP <n>"}` |
| `504 Gateway Timeout` | Pod proxy or pod discovery exceeded 4s | `{"error": "metrics source timeout after 4s"}` |
| `503 Service Unavailable` | Network error reaching the pod proxy | `{"error": "metrics source unreachable: <cause>"}` |

---

## Behavior Notes

1. **Active context (no param)**: scrape the context currently active in `ClientFactory`.
2. **Explicit context (with param)**: build an ephemeral client for that context;
   does not change the active context.
3. **Pod not found**: return 200 with all metric fields null — not 503.
4. **Pod proxy 404**: invalidate cache, re-discover once, retry; if still failing,
   return 200 with null fields.
5. **Cache hit**: pod reference valid for 60s; discovery does not run on every request.

---

## TypeScript Interface (frontend)

```ts
// web/src/lib/api.ts

export interface ControllerMetrics {
  watchCount:     number | null
  gvrCount:       number | null
  queueDepth:     number | null
  workqueueDepth: number | null
  scrapedAt:      string          // ISO 8601 / RFC3339
}

// Existing — no change:
export const getControllerMetrics = () =>
  get<ControllerMetrics>('/kro/metrics')

// New:
export const getControllerMetricsForContext = (context: string) =>
  get<ControllerMetrics>(`/kro/metrics?context=${encodeURIComponent(context)}`)
```

---

## Go Handler Signature

```go
// internal/api/handlers/metrics.go

// GetMetrics scrapes the kro controller metrics for the requested context.
// If ?context= is absent or empty, the active context is used.
// If ?context= is set but not found in the kubeconfig, 404 is returned.
// When the kro pod is not found, 200 OK with null fields is returned.
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) { ... }
```

---

## Go Interface (consumption-site definition)

```go
// internal/api/handlers/handler.go

// metricsDiscoverer discovers the kro controller pod for a given context
// and proxies the /metrics scrape through the kube-apiserver pod proxy.
// An empty contextName means "use the currently active context".
type metricsDiscoverer interface {
    ScrapeMetrics(ctx context.Context, contextName string) (*k8s.ControllerMetrics, error)
}
```
