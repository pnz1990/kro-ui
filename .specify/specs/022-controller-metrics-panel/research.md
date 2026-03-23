# Research: Controller Metrics Panel (022)

**Branch**: `022-controller-metrics-panel`  
**Date**: 2026-03-22  
**Purpose**: Resolve all technical unknowns before design

---

## Decision 1: Prometheus text format parsing strategy

**Decision**: Use Go's standard library (`net/http`, `bufio`, `strings`) to parse the Prometheus text exposition format. A small dedicated parser in `internal/k8s/metrics.go` will scan line-by-line for the four target metric names and extract their float64 values. No third-party Prometheus parsing library is needed.

**Rationale**: The kro-ui constitution (§V) requires avoiding dependencies when the standard library is sufficient. Parsing Prometheus text format for four named gauges/counters is straightforward: lines starting with `#` are comments/type hints; metric lines follow `<name>{<labels>} <value> [<timestamp>]`. The four target metrics are all label-free gauges (or counters summed across label combinations), making the parser trivially small.

**Alternatives considered**:
- `github.com/prometheus/common/expfmt` — full Prometheus parser; heavyweight for four metric reads, adds a dependency, triggers govulncheck.
- `github.com/prometheus/client_model` — proto-based model; overly complex for a simple scrape.

---

## Decision 2: Target metric names (authoritative, from kro source + docs)

Confirmed by reading `pkg/dynamiccontroller/metrics.go` and `website/docs/docs/advanced/04-metrics.md`:

| Spec label | Prometheus metric name | Type | Source file | Stability |
|---|---|---|---|---|
| Active GroupResources watched | `dynamic_controller_watch_count` | Gauge | `pkg/dynamiccontroller/metrics.go:119` | ALPHA |
| GVRs served | `dynamic_controller_gvr_count` | Gauge | `pkg/dynamiccontroller/metrics.go:70` | ALPHA |
| Workqueue depth | `dynamic_controller_queue_length` | Gauge | `pkg/dynamiccontroller/metrics.go:76` | ALPHA |
| Workqueue backlog | `workqueue_depth{name="dynamic-controller-queue"}` | Gauge (client-go STABLE) | client-go workqueue internals | STABLE |

**Notes on "workqueue backlog"**:
- kro's own `dynamic_controller_queue_length` gauge directly tracks the queue length and is the primary depth signal.
- The client-go STABLE `workqueue_depth{name="dynamic-controller-queue"}` is a complementary label-filtered gauge. The backend will attempt both and prefer the kro-specific gauge; if absent it falls back to the workqueue gauge with the well-known name `dynamic-controller-queue`.
- `workqueue_adds_total` is a counter (monotonically increasing total), not an instantaneous backlog — it is **not** used.
- kro metrics default endpoint: `:8078/metrics` (documented in kro Helm chart, `metrics.service.port: 8080` is the service port; the controller listens on `:8078` by default per the Helm values).

**Resilience rule**: All four metrics are ALPHA-stability kro-specific metrics (except `workqueue_depth` which is STABLE). If a future kro version renames any of them, the individual counter shows "Not reported" — the endpoint never fails entirely over a missing metric name.

---

## Decision 3: Metrics source address — configurable CLI flag

**Decision**: Add `--metrics-url` flag to `kro-ui serve` with default `http://localhost:8080/metrics`. The flag value is passed through `server.Config` to the `Handler` struct, then used in the metrics scrape at request time.

**Rationale**: FR-011 forbids hardcoded service names, namespaces, or ports. The address must be configurable for:
- Local dev: `http://localhost:8080/metrics` (kubectl port-forward)
- In-cluster: `http://kro-controller-metrics.kro-system.svc.cluster.local:8080/metrics`
- Custom deployments: operator-provided override

The default `http://localhost:8080/metrics` matches the most common local development setup (kubectl port-forward to kro controller's metrics service port 8080).

**Alternatives considered**:
- Auto-discovery via Kubernetes Service labels: would require an additional Kubernetes API call per request or a discovery loop — violates the performance budget and adds complexity inconsistent with kro-ui's read-only observability role.
- Environment variable only: less ergonomic than a CLI flag with env var fallback support via cobra.

---

## Decision 4: Where the metrics fetch lives (backend package)

**Decision**: A new file `internal/api/handlers/metrics.go` replaces the stub in `instances.go`. The HTTP fetch and text parsing are extracted into a new `internal/k8s/metrics.go` file (mirroring the pattern of `rgd.go` for kro-specific knowledge). The handler calls the parser, then responds with JSON.

**Rationale**: Follows the constitution's package structure (§VI): handlers are thin, k8s-layer does the domain work. Prometheus text parsing is kro-specific knowledge and belongs in `internal/k8s/`. The stub in `instances.go:123-125` is removed — it was explicitly labeled "until phase 2".

---

## Decision 5: Frontend placement — metrics strip on Home page

**Decision**: The metrics strip is rendered as a horizontal band above the RGD card grid on the Home page. It is a new `MetricsStrip` component (`web/src/components/MetricsStrip.tsx`) using `usePolling` at 30-second interval.

**Rationale**: FR-005 requires the Home page to show the strip. A "dedicated Health tab" was the alternative in the spec but would require a new route and navigation entry — adding friction for what is a status glance. A compact strip above the RGD grid is visible without any navigation and matches the "compact metrics strip" phrasing in the original request. The strip is scoped and degraded independently (FR-007) — an error in the strip does not affect the RGD grid below it.

**Polling reuse**: `usePolling` already exists at `web/src/hooks/usePolling.ts` with exactly the interface needed. The MetricsStrip calls `usePolling(getControllerMetrics, [], { intervalMs: 30000 })`.

---

## Decision 6: Handling absent metrics ("Not reported" vs 0)

**Decision**: The Go response struct uses pointer fields (`*float64` or a typed `NullableInt`) so that JSON `null` means "metric was absent in the scrape" and a numeric value (including 0) means the metric was present with that value. The TypeScript client represents absent metrics as `null` and the component renders "Not reported" for `null` fields.

**Rationale**: FR-009 requires "Not reported" for absent counters, not `0`. A dedicated presence flag per field avoids the ambiguity of `0` meaning "absent" — which would be incorrect when the queue is genuinely empty.

---

## Decision 7: Response caching

**Decision**: No server-side caching of the metrics response. Each `GET /api/v1/kro/metrics` request triggers a fresh scrape of the upstream endpoint with a 4-second timeout (leaving 1 second margin from the 5-second budget). The 30-second frontend polling interval is the effective throttle.

**Rationale**: The metrics values change on a per-second basis; a server-side cache would add staleness without material performance benefit at the polling rate kro-ui uses. The upstream endpoint is a local process or in-cluster service — expected round-trip is <100ms on a healthy cluster.

---

## Decision 8: No new Kubernetes API calls / RBAC impact

**Decision**: The metrics feature makes an outbound HTTP call to kro's metrics endpoint — not a Kubernetes API call. No RBAC changes are needed. The kro-ui `ClusterRole` remains unchanged.

**Rationale**: Constitution §III (Read-Only) and §XI (Performance Budget) apply only to Kubernetes API calls. An HTTP GET to the controller's `/metrics` endpoint is a direct network call, outside the Kubernetes API surface.
