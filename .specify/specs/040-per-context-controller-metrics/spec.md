# Spec 040 — Per-Context Controller Metrics

**GitHub Issue**: #174  
**Branch**: `040-per-context-controller-metrics`  
**Status**: In progress

---

## Problem

`GET /api/v1/kro/metrics` scrapes a hardcoded `--metrics-url` flag set at kro-ui
startup. Switching kubeconfig contexts leaves `MetricsStrip` on the Home page
displaying data from the original cluster — silently wrong. The Fleet page has no
metrics at all, so per-cluster metrics are unavailable in the multi-cluster view.

Root cause: metrics is the only feature that bypasses `ClientFactory`. All other
features (RGDs, instances, events, fleet) flow through the context-aware dynamic
client; metrics makes an outbound HTTP call to an arbitrary URL that was fixed at
process startup.

---

## Proposed Solution

Replace the hardcoded `--metrics-url` mechanism with per-context **pod-proxy
discovery**: find the kro controller pod via the Kubernetes API, then proxy the
`/metrics` scrape through the kube-apiserver's built-in pod proxy endpoint:

```
GET /api/v1/namespaces/{ns}/pods/{podName}/proxy/metrics
```

This approach:
- Requires **zero operator configuration** — no URL to know, set, or maintain
- Works out-of-cluster (kubeconfig) and in-cluster identically
- Is **per-context correct** — context switch → new pod discovery → new data
- Fails gracefully when kro is not installed (fields → `nil` → `—` in UI)
- Adds no new dependencies
- Keeps the existing `GET /api/v1/kro/metrics` response shape
- Enables a `?context=` query param so Fleet can request per-cluster metrics
  independently of the active context

---

## Functional Requirements

### FR-001: Pod discovery algorithm

On every metrics request, the backend resolves the kro controller pod via:

1. **Label selectors** (tried in order, first success wins):
   - `app.kubernetes.io/name=kro` (upstream standard label)
   - `control-plane=kro-controller-manager` (controller-manager convention)
   - `app=kro` (legacy / fallback)
2. **Namespace search**: first look in `kro-system`, then `kro`, then all
   namespaces (via cluster-scoped List with label selector).
3. **Pod selection**: from the matching pod list, pick the first pod in
   `Running` phase; if none are Running, pick the first pod in any phase
   (degraded state is still scrapeable via proxy).
4. **On no match**: return all metric fields as `nil` with `scrapedAt` set to
   now. Do **not** return an error; return `200 OK` with null fields.

Discovery uses the `dynamic.Interface` already held by `ClientFactory` — no new
typed client needed. List pods via:
```
GVR: core/v1/pods
Label selector: one of the selectors above
```

### FR-002: Pod-proxy scrape

After discovering the pod (`namespace`, `podName`), proxy the metrics request
through the kube-apiserver using `ClientFactory.RESTConfig()`:

```
GET /api/v1/namespaces/{ns}/pods/{podName}/proxy/metrics
```

 Use `rest.HTTPClientFor(restCfg)` to build an `http.Client` with the correct
TLS credentials and auth token; then construct the URL from `restCfg.Host`.

> **§II Exception (justified)**: `rest.HTTPClientFor` is used here instead of the
> dynamic client because the kube-apiserver pod-proxy path requires a raw HTTP
> client with the kubeconfig's TLS/auth credentials. The dynamic client exposes
> no API for arbitrary non-k8s-resource HTTP proxying. This is the only place in
> the codebase that uses `rest.HTTPClientFor`; all kro resource access elsewhere
> continues to use `k8s.io/client-go/dynamic`.

Do **not** use `CoreV1().Pods(ns).ProxyGet()` — that requires a typed client
which violates Constitution §II ("dynamic client everywhere").

### FR-003: Pod reference cache

The discovered `(namespace, podName)` pair is cached **per context** with a
**60-second TTL**.

Cache eviction rules:
- TTL expires → re-discover on next request
- Context switch → invalidate cache for ALL contexts (since active context changed)
  — only the active context's cache needs to be rebuilt, but full invalidation
  is safe and simpler
- Proxy request fails with HTTP 404 → immediately invalidate the cache entry and
  retry with fresh discovery (pod may have restarted)

Cache implementation:
- Single `sync.RWMutex`-protected map `contextName → {namespace, podName, expiry}`
- Lives in `internal/k8s/metrics.go` alongside `ScrapeMetrics`
- Initial implementation: in-process, non-persistent (no Redis, no file cache)

### FR-004: `?context=` query parameter on GET /api/v1/kro/metrics

The metrics handler accepts an optional `?context=` query parameter:

- **Absent or empty**: scrape the active context (current behavior, preserved)
- **Non-empty**: build ephemeral clients for that context using
  `BuildContextClient` (same pattern as fleet fan-out) and scrape from there

This enables the Fleet page to request per-context metrics in parallel without
triggering a context switch on the shared `ClientFactory`.

When `?context=` is an unknown context (not in kubeconfig), return:
```json
HTTP 404
{"error": "context \"<name>\" not found in kubeconfig"}
```

### FR-005: Fleet page per-cluster metrics column

The Fleet page gains an optional **Metrics** column in the cluster matrix showing
`watchCount` and `queueDepth` for each cluster.

- Frontend calls `GET /api/v1/kro/metrics?context=<contextName>` for **each
  cluster in parallel** after the fleet summary loads
- Display: `👁 <n>  ⬛ <n>` (watch count + queue depth) or `—` when unavailable
- Column is shown only when at least one cluster returns non-null metrics
- Metrics are fetched once on page load; no auto-refresh on the Fleet page
  (fleet summary itself is already a manual refresh)

### FR-006: MetricsStrip context-correctness

After a context switch:
- The frontend `MetricsStrip` already polls every 30 seconds; no change needed
  to its polling interval
- The backend, on receiving the next poll, will use the new active context's
  pod reference (or re-discover if cache was invalidated by the switch)
- No frontend changes required for MetricsStrip context-correctness —
  the fix is entirely in the backend

### FR-007: Remove `--metrics-url` flag

The `--metrics-url` CLI flag is **removed** entirely.

- `internal/cmd/root.go`: delete the flag registration and `metricsURL` var
- `internal/server/server.go`: remove `MetricsURL` from `Config` and from
  `NewRouter` / `handlers.New` call signatures
- `internal/api/handlers/handler.go`: remove `metricsURL` field
- `internal/api/handlers/metrics.go`: no longer passes a URL to `ScrapeMetrics`;
  instead calls a new `DiscoverAndScrape` function on the `metricsDiscoverer`
  interface

Startup with `--metrics-url` must log a **clear error** and exit non-zero:
```
Error: unknown flag: --metrics-url
Run 'kro-ui serve --help' for usage.
```
Cobra provides this automatically when the flag is removed — no custom handling needed.

---

## Non-Functional Requirements

### NFR-001: Performance budget

- Pod discovery + proxy adds ≤200ms overhead to the existing 4s scrape budget
- Pod reference cache hit (60s TTL) adds <1ms
- Discovery on cache miss: `dynamic.List` with label selector takes ~10–50ms
  on a local cluster
- Total `GET /api/v1/kro/metrics` p99: ≤4.5s (within the 5s API budget)

### NFR-002: Cache efficiency

- Pod reference cached per context, 60s TTL
- On pod restart / 404: immediate cache invalidation + single re-discovery attempt
  within the same request — do not retry indefinitely within one request; if
  re-discovery also finds no running pod, return null fields with 200 OK

### NFR-003: Graceful degradation

All existing graceful degradation behaviour is preserved:
- `null` fields in `ControllerMetricsResponse` when metrics are unavailable
- `MetricsStrip` continues to render `—` when scrape fails
- No new error states introduced to the frontend

### NFR-004: Test coverage

New Go functions must have unit tests:
- `discoverKroPod`: table-driven tests covering selector priority, namespace
  search order, Running-phase preference, and no-match case
- `ScrapeViaProxy`: stub tests verifying correct URL construction from restCfg
- `GetMetrics` handler: existing table-driven tests remain and pass; new cases
  for `?context=` param (known context, unknown context, active context)
- Fleet metrics fan-out: tested via `Handler.FleetSummary` or a dedicated test

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | `kro-ui serve --metrics-url ...` exits non-zero with "unknown flag" |
| AC-002 | `MetricsStrip` shows data from context A after starting with context A |
| AC-003 | After switching to context B via the UI, within 30s MetricsStrip shows context B's data (or `—` if kro not installed) |
| AC-004 | Fleet page shows a Metrics column with per-cluster `watchCount` / `queueDepth` (or `—`) |
| AC-005 | `GET /api/v1/kro/metrics` returns 200 with null fields when kro pod is not found |
| AC-006 | `GET /api/v1/kro/metrics?context=nonexistent` returns 404 with JSON error |
| AC-007 | Pod reference cache is invalidated when context switches |
| AC-008 | If the cached pod reference returns 404 from proxy, re-discovery runs and the request succeeds or returns null fields |
| AC-009 | Helm `ClusterRole` includes `get` on `pods/proxy` |
| AC-010 | `go vet ./...` and `tsc --noEmit` pass |
| AC-011 | `go test -race ./...` passes |

---

## Helm RBAC Change

Add to `helm/kro-ui/templates/clusterrole.yaml`:

```yaml
# Pod proxy — required for per-context kro controller metrics scraping (spec 040)
- apiGroups: [""]
  resources: ["pods/proxy"]
  verbs: ["get"]
```

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `internal/k8s/metrics.go` | New: `PodRef`, `PodRefCache`, `discoverKroPod`, `ScrapeViaProxy`. Remove: `ScrapeMetrics` (replaced). |
| `internal/api/handlers/metrics.go` | Replace `ScrapeMetrics(metricsURL)` call with `metricsDiscoverer` interface. Add `?context=` param handling. |
| `internal/api/handlers/handler.go` | Remove `metricsURL` field. Add `metricsDiscoverer` field (interface). |
| `internal/api/handlers/handler_test.go` | Extend stubs with `metricsDiscoverer` stub. |
| `internal/api/handlers/metrics_test.go` | Update tests for new interface; add `?context=` cases. |
| `internal/api/handlers/fleet.go` | Add per-cluster metrics fan-out. |
| `internal/k8s/metrics_test.go` | New: table-driven tests for `discoverKroPod` and `ScrapeViaProxy`. |
| `internal/cmd/root.go` | Remove `--metrics-url` flag. |
| `internal/server/server.go` | Remove `MetricsURL` from `Config`; update `NewRouter` / `handlers.New` call. |

### Frontend

| File | Change |
|------|--------|
| `web/src/lib/api.ts` | Add `getControllerMetricsForContext(context: string)`. |
| `web/src/pages/Fleet.tsx` | Add per-cluster metrics fan-out; render Metrics column. |

### Helm

| File | Change |
|------|--------|
| `helm/kro-ui/templates/clusterrole.yaml` | Add `pods/proxy` get rule. |

---

## Out of Scope

- Persisting the pod reference cache across process restarts
- WebSocket/SSE streaming of metrics (polling is sufficient per constitution §V)
- Exposing raw Prometheus text format through the API
- Scraping metrics endpoints other than the kro controller
