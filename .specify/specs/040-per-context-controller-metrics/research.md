# Research: 040-Per-Context Controller Metrics

All NEEDS CLARIFICATION items from the Technical Context have been resolved.
No additional research was required beyond reading the existing codebase.

---

## Decision 1: Pod proxy approach — `rest.HTTPClientFor` + manual URL

**Decision**: Use `rest.HTTPClientFor(*rest.Config)` from `k8s.io/client-go/rest`
to build an `*http.Client` that carries TLS, bearer token, and proxy settings,
then issue a manual `GET` to:
```
strings.TrimRight(cfg.Host, "/") + "/api/v1/namespaces/{ns}/pods/{podName}/proxy/metrics"
```

**Rationale**: The only alternative that avoids a typed client is this approach.
The `/proxy/` path segment is a literal kube-apiserver route — do NOT
percent-encode it. `cfg.Host` may have a trailing slash; trimming is required.

**Alternatives considered**:
- `CoreV1().Pods(ns).ProxyGet(...)`: requires a typed client which violates
  Constitution §II ("dynamic client everywhere"). Rejected.
- Typed `kubernetes.Clientset`: same violation. Rejected.
- Raw `http.Client` without `rest.HTTPClientFor`: would not carry TLS/auth
  credentials from kubeconfig, breaking out-of-cluster auth. Rejected.

---

## Decision 2: Pod discovery via dynamic client

**Decision**: List pods using `dynamic.Interface` with GVR
`{Group: "", Version: "v1", Resource: "pods"}` and a label selector.

Try these label selectors **in order**, first success wins:
1. `app.kubernetes.io/name=kro` (upstream standard label)
2. `control-plane=kro-controller-manager` (controller-runtime/manager convention)
3. `app=kro` (legacy / fallback)

For each selector: search `kro-system` namespace first, then `kro`, then
all namespaces (cluster-scoped list). This avoids a cluster-scoped list in
the common case where kro is in `kro-system`.

**Pod phase access**: `unstructured.NestedString(item.Object, "status", "phase")`.
Prefer Running-phase pods; fall back to first pod in any phase if none are Running.

**Rationale**: Dynamic client is already present in `ClientFactory`; no typed
client needed. Label priority matches kro upstream deployments observed in the
kro Helm chart and the kro `config/manager/` kustomize.

**Alternatives considered**:
- Namespace scanning via `discovery`: over-complex; namespace list first plus
  multi-list fan-out adds latency with no benefit over the ordered probe.
- Hard-coded namespace `kro-system` only: violates Constitution §XIII ("no
  hardcoded config"). Rejected.

---

## Decision 3: Pod reference cache — per-context, 60s TTL, `sync.RWMutex`

**Decision**: A single `PodRefCache` struct in `internal/k8s/metrics.go`
holding `map[string]cachedPodRef` (key = context name) protected by
`sync.RWMutex`. `cachedPodRef` carries `{namespace, podName string, expiry time.Time}`.

Cache eviction rules:
- TTL expires (60s) → re-discover on next request
- Context switch → full invalidate (all entries cleared) — safe because
  the active context's next request immediately re-populates its entry
- Proxy 404 → invalidate the specific entry and retry once in the same request;
  if retry also fails, return null fields with 200 OK

Double-check locking pattern:
1. `RLock` → check; if hit and not expired, return immediately
2. `RUnlock` then `Lock` for write
3. Re-check inside write lock (another goroutine may have populated it)
4. Discover → populate → `Unlock`

**Rationale**: 60s TTL matches the scrape interval budget (30s frontend poll
+ room for a pod restart event to propagate). Full invalidation on context
switch is conservative but correct and simpler than per-context invalidation
with active-context tracking.

**Alternatives considered**:
- `sync.Map`: no TTL semantics, more complex expiry logic. Rejected.
- Per-context `sync.Mutex` + lazy init: unnecessary complexity for N≤20 contexts.
- Redis/external cache: violates §V (simplicity, no unnecessary deps). Rejected.

---

## Decision 4: `?context=` query param on existing endpoint

**Decision**: Extend `GET /api/v1/kro/metrics` with an optional `?context=`
query parameter. Absent/empty → use active context (preserved backward compat).
Non-empty → build ephemeral `ContextClients` via `BuildContextClient` (same
pattern as fleet fan-out in `fleet.go`). Unknown context → 404.

A new `metricsDiscoverer` interface in `handlers/handler.go` (consumption-site
definition per §VI) will be satisfied by a concrete `k8s.MetricsDiscoverer`
struct that holds the `PodRefCache` and an `ephemeralClientBuilder`.

**Rationale**: Reusing the existing endpoint with a query param avoids a new
route, preserves the existing `MetricsStrip` call contract (bare GET still works),
and mirrors the `?saNamespace=&saName=` pattern already used by `/rgds/{name}/access`.

**Alternatives considered**:
- New endpoint `GET /api/v1/fleet/metrics?context=<name>`: requires frontend to
  change endpoint; adds a second route for the same data. Rejected.
- Batch endpoint returning a map: heavier payload; Fleet page already controls
  which contexts it queries. Rejected.

---

## Decision 5: Fleet page metrics column

**Decision**: After `getFleetSummary()` resolves, Fleet.tsx fans out to
`GET /api/v1/kro/metrics?context=<name>` for each `healthy|degraded` cluster
using `Promise.allSettled`. Results stored as `Map<string, ControllerMetrics | null>`
in a new `metricsMap` state variable. A new Metrics column in the cluster table
shows `watchCount` and `queueDepth` or `—`.

The column is visible only when at least one cluster returns non-null metrics
(hide otherwise to avoid a column of `—` for clusters without kro metrics).

**Rationale**: `Promise.allSettled` matches the Go backend's `sync.WaitGroup`
philosophy — partial data is better than no data. Filtering to reachable clusters
before fan-out avoids predictably-futile requests. Pre-filtering on `health ===
'healthy' | 'degraded'` matches existing pattern in fleet.go.

**Alternatives considered**:
- `Promise.all`: short-circuits on first error, loses all other results. Rejected.
- Batch backend endpoint: more backend work; front-end can already orchestrate
  with `Promise.allSettled`. Rejected.
- Auto-refresh metrics on Fleet page: fleet summary itself is manual-refresh;
  adding metrics polling would diverge from the existing UX model. Rejected.

---

## Decision 6: `--metrics-url` flag removal

**Decision**: Remove the Cobra flag registration from `internal/cmd/root.go`
and `MetricsURL` from `server.Config`. Cobra automatically returns exit code 1
with "unknown flag: --metrics-url" for any binary invoked with that flag.
No custom error handling needed.

**Rationale**: The flag is meaningless once pod-proxy discovery replaces it.
Keeping it as a no-op would be misleading. The issue notes this is a breaking
change and instructs "document in release notes".

**Alternatives considered**:
- Deprecate with a warning: adds code complexity for a flag that actively harms
  correctness. Rejected.
- Keep but ignore: silent behavior change; confusing for users. Rejected.

---

## Resolved Unknowns Summary

| Unknown | Resolved As |
|---------|-------------|
| How to proxy through kube-apiserver without typed client | `rest.HTTPClientFor(restCfg)` + manual URL construction |
| Pod GVR for dynamic client | `{Group: "", Version: "v1", Resource: "pods"}` |
| Phase field path in unstructured | `unstructured.NestedString(item.Object, "status", "phase")` |
| `cfg.Host` trailing slash | Must trim with `strings.TrimRight(cfg.Host, "/")` |
| Double-check locking pattern | RLock → check → RUnlock → Lock → re-check → write |
| Where to expose `restConfig` in `ClientFactory` | Add `RESTConfig() *rest.Config` accessor method |
| Fleet fan-out mechanism | `Promise.allSettled` after `getFleetSummary()` resolves |
| New api.ts function | `getControllerMetricsForContext(context: string)` calling `/kro/metrics?context=<encoded>` |
