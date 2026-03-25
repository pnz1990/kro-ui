# Tasks: Per-Context Controller Metrics

**Branch**: `040-per-context-controller-metrics`  
**Input**: Design documents from `.specify/specs/040-per-context-controller-metrics/`  
**Spec**: FR-001–FR-007, NFR-001–NFR-004, AC-001–AC-011

**Tests**: Included per NFR-004 — spec explicitly requires unit tests for all new Go functions.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify the working tree is clean and all files exist before touching anything.

- [x] T001 Read `internal/k8s/metrics.go`, `internal/k8s/client.go`, `internal/api/handlers/handler.go`, `internal/api/handlers/metrics.go`, `internal/api/handlers/metrics_test.go`, `internal/cmd/root.go`, `internal/server/server.go` — confirm current state matches spec understanding
- [x] T002 [P] Read `internal/k8s/fleet.go` to confirm `BuildContextClient` signature and `ContextClients` struct for ephemeral client pattern
- [x] T003 [P] Run `make go CMD="vet ./..."` and `make web CMD="run typecheck"` — confirm clean baseline before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add all new data structures and low-level functions to `internal/k8s/metrics.go`
and expose `RESTConfig()` on `ClientFactory`. These are pure additions; existing `ScrapeMetrics`
stays untouched until US1. No handler or CLI changes here.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on this phase. Complete before proceeding.

- [x] T004 Add `PodRef` exported struct (`Namespace string`, `PodName string`) to `internal/k8s/metrics.go` — placed above the existing `ControllerMetrics` type
- [x] T005 Add unexported `cachedPodRef` struct (`namespace`, `podName string`, `expiry time.Time`) and exported `PodRefCache` struct (`mu sync.RWMutex`, `refs map[string]cachedPodRef`, `ttl time.Duration`) to `internal/k8s/metrics.go`
- [x] T006 Add `NewPodRefCache(ttl time.Duration) *PodRefCache` constructor and four methods — `get(ctx string) (PodRef, bool)`, `set(ctx string, ref PodRef)`, `invalidate(ctx string)`, `invalidateAll()` — to `internal/k8s/metrics.go` using the double-check locking pattern from research.md (RLock → check → RUnlock → Lock → re-check)
- [x] T007 Add `discoverKroPod(ctx context.Context, dyn dynamic.Interface) (PodRef, bool)` to `internal/k8s/metrics.go`: tries label selectors `app.kubernetes.io/name=kro`, `control-plane=kro-controller-manager`, `app=kro` in order; for each selector probes namespaces `kro-system` → `kro` → cluster-scoped; picks Running-phase pod first, any phase as fallback; returns zero PodRef + false when nothing found
- [x] T008 Add `scrapeViaProxy(ctx context.Context, restCfg *rest.Config, ref PodRef) (*ControllerMetrics, error)` to `internal/k8s/metrics.go`: builds `*http.Client` via `rest.HTTPClientFor(restCfg)`, constructs URL `strings.TrimRight(restCfg.Host, "/") + "/api/v1/namespaces/{ns}/pods/{podName}/proxy/metrics"`, issues GET with 4s timeout, parses response body with existing `parseMetricLine` helper; returns sentinel error types `ErrMetricsUnreachable`, `ErrMetricsBadGateway`, `ErrMetricsTimeout` as before
- [x] T009 Add `MetricsDiscoverer` concrete struct to `internal/k8s/metrics.go` with fields `factory *ClientFactory`, `cache *PodRefCache`, `kubeconfigPath string`; add `NewMetricsDiscoverer(factory *ClientFactory) *MetricsDiscoverer` constructor; add `ScrapeMetrics(ctx context.Context, contextName string) (*ControllerMetrics, error)` method implementing: empty contextName → use factory's dynamic client + restConfig; non-empty → `BuildContextClient`; cache lookup → `discoverKroPod` → `scrapeViaProxy` with single 404-retry+re-discover logic
- [x] T010 Add `RESTConfig() *rest.Config` accessor method to `ClientFactory` in `internal/k8s/client.go` (read-locked, returns copy of `f.restConfig`)
- [x] T011 Add `metricsDiscoverer` interface to `internal/api/handlers/handler.go` (consumption-site, per §VI): `ScrapeMetrics(ctx context.Context, contextName string) (*k8s.ControllerMetrics, error)`; replace `metricsURL string` field on `Handler` with `metrics metricsDiscoverer`; update `New(factory *k8sclient.ClientFactory, metricsURL string)` — **keep** `metricsURL` param for now (empty string accepted) to avoid breaking other callers in this phase; construct and inject `k8s.NewMetricsDiscoverer(factory)` inside `New`

**Checkpoint**: `make go CMD="vet ./..."` passes. `go build ./...` compiles. Existing `ScrapeMetrics` function still present and tests still pass.

---

## Phase 3: User Story 1 — Context-Correct MetricsStrip (P1) 🎯 MVP

**Goal**: `GET /api/v1/kro/metrics` uses pod-proxy discovery instead of a hardcoded URL.
`MetricsStrip` on Home page now shows data from the currently active kubeconfig context.
`--metrics-url` flag removed. AC-001 through AC-003, AC-005, AC-007, AC-008, AC-010, AC-011.

**Independent Test**:
```bash
# 1. Build succeeds without --metrics-url flag:
make build
./kro-ui serve --help   # must NOT show --metrics-url

# 2. Startup with --metrics-url exits non-zero:
./kro-ui serve --metrics-url http://localhost:8080/metrics
# exit code 1, "Error: unknown flag: --metrics-url"

# 3. Metrics endpoint returns 200 with null fields when kro not installed:
curl http://localhost:40107/api/v1/kro/metrics | jq .
# {"watchCount":null,"gvrCount":null,"queueDepth":null,"workqueueDepth":null,"scrapedAt":"..."}

# 4. All tests pass:
make go CMD="test -race ./..."
```

### Unit tests for User Story 1

- [x] T012 [US1] Add table-driven unit tests for `discoverKroPod` in `internal/k8s/metrics_test.go` (new file, Apache 2.0 header required): cases — selector priority (first selector with pods wins), namespace probe order (`kro-system` before cluster-scoped), Running-phase preference over non-Running, no-match returns `(PodRef{}, false)`; use `stubDynamic` pattern from `internal/api/handlers/handler_test.go` adapted to the k8s package
- [x] T013 [US1] Add table-driven unit tests for `scrapeViaProxy` in `internal/k8s/metrics_test.go`: cases — correct URL construction from restCfg.Host (with and without trailing slash), 200 response parses metrics, non-200 returns `ErrMetricsBadGateway`, timeout returns `ErrMetricsTimeout`, unreachable returns `ErrMetricsUnreachable`; use `httptest.NewServer` as the stub
- [x] T014 [US1] Add table-driven unit tests for `PodRefCache` in `internal/k8s/metrics_test.go`: cases — cache miss returns false, cache hit returns true within TTL, expired entry returns false, `invalidate` removes specific entry, `invalidateAll` clears all; no cluster needed (pure unit test)
- [x] T015 [US1] Update `internal/api/handlers/metrics_test.go`: replace `&Handler{metricsURL: ...}` construction with `&Handler{metrics: stubMetricsDiscoverer{...}}`; add `stubMetricsDiscoverer` hand-written stub implementing the `metricsDiscoverer` interface; existing test cases (200 with metrics, 504, 502, 503) must all pass with the new stub

### Implementation for User Story 1

- [x] T016 [US1] Rewrite `internal/api/handlers/metrics.go` `GetMetrics` handler: remove `k8s.ScrapeMetrics(r.Context(), h.metricsURL)` call; call `h.metrics.ScrapeMetrics(r.Context(), "")` (empty string = active context); error mapping (ErrMetricsBadGateway → 502, ErrMetricsTimeout → 504, ErrMetricsUnreachable → 503) stays the same; remove the `h.metricsURL` log field
- [x] T017 [US1] Remove `--metrics-url` flag from `internal/cmd/root.go`: delete `metricsURL` var, delete `serveCmd.Flags().StringVar` line for `metrics-url`, remove `MetricsURL: metricsURL` from `server.Config` struct literal
- [x] T018 [US1] Remove `MetricsURL` field from `server.Config` in `internal/server/server.go`; update `NewRouter(factory, metricsURL string)` → `NewRouter(factory)` (drop `metricsURL` param); update the `handlers.New(factory, metricsURL)` call inside `NewRouter` → `handlers.New(factory)` (no metrics URL arg); update `Run(cfg)` accordingly
- [x] T019 [US1] Update `handlers.New` signature in `internal/api/handlers/handler.go` to `New(factory *k8sclient.ClientFactory) *Handler` — remove `metricsURL string` param; `metricsURL` field already replaced by `metrics metricsDiscoverer` in T011; wire `metrics: k8s.NewMetricsDiscoverer(factory)`
- [x] T020 [US1] Wire `PodRefCache` invalidation on context switch: in `internal/k8s/metrics.go`, `MetricsDiscoverer.ScrapeMetrics` must call `cache.invalidateAll()` whenever the active context changes — the simplest approach is to call `cache.invalidateAll()` inside `ClientFactory.SwitchContext` by passing the cache as an optional observer, OR have `MetricsDiscoverer.ScrapeMetrics` compare `contextName` against `factory.ActiveContext()` and invalidate when they differ; choose the approach that requires fewer structural changes and document it clearly in a code comment

**Checkpoint**: `make go CMD="test -race ./..."` passes. `make build` succeeds. Binary rejects `--metrics-url`. `GET /api/v1/kro/metrics` returns 200 with null fields against a cluster without kro.

---

## Phase 4: User Story 2 — `?context=` Param + Fleet Metrics Column (P2)

**Goal**: `GET /api/v1/kro/metrics?context=<name>` works for any kubeconfig context.
Fleet page shows per-cluster `watchCount` / `queueDepth` column. AC-004, AC-006.

**Independent Test**:
```bash
# 1. Known context returns metrics (or null fields if kro not installed there):
curl "http://localhost:40107/api/v1/kro/metrics?context=kind-kro-ui-demo" | jq .

# 2. Unknown context returns 404:
curl -i "http://localhost:40107/api/v1/kro/metrics?context=nonexistent"
# HTTP/1.1 404 Not Found
# {"error":"context \"nonexistent\" not found in kubeconfig"}

# 3. Fleet page in browser shows Metrics column (or no column if no kro anywhere)
```

### Unit tests for User Story 2

- [x] T021 [US2] Add `?context=` test cases to `internal/api/handlers/metrics_test.go`: (a) `?context=` absent → stub called with `""` → 200 OK; (b) `?context=known` → stub called with `"known"` → 200 OK; (c) `?context=unknown` → handler returns 404 with JSON error body (requires the handler to validate context exists — test validates 404 shape); update `stubMetricsDiscoverer` if needed to capture the `contextName` it was called with

### Implementation for User Story 2

- [x] T022 [US2] Update `GetMetrics` handler in `internal/api/handlers/metrics.go`: read `r.URL.Query().Get("context")`; if non-empty, validate that the context exists via `h.ctxMgr.ListContexts()` (reuse existing `contextManager` interface) — if not found return 404; pass the context name (or `""`) to `h.metrics.ScrapeMetrics`
- [x] T023 [US2] Add `getControllerMetricsForContext(context: string)` to `web/src/lib/api.ts`: `export const getControllerMetricsForContext = (context: string): Promise<ControllerMetrics> => get<ControllerMetrics>(\`/kro/metrics?context=\${encodeURIComponent(context)}\`)`; place immediately after the existing `getControllerMetrics` export
- [x] T024 [P] [US2] Update `web/src/pages/Fleet.tsx` state: add `const [metricsMap, setMetricsMap] = useState<Map<string, ControllerMetrics | null>>(new Map())` after the existing state declarations; import `getControllerMetricsForContext` and `ControllerMetrics` from `@/lib/api`
- [x] T025 [US2] Add metrics fan-out to `fetchFleet` in `web/src/pages/Fleet.tsx`: after `setClusters(res.clusters)` resolves, call `Promise.allSettled` over `getControllerMetricsForContext(c.context)` for all clusters with `health === 'healthy' || health === 'degraded'`; collect fulfilled results into a `Map<string, ControllerMetrics | null>`; call `setMetricsMap(map)`; handle errors per cluster gracefully (rejected → entry stays absent from map, renders as `—`)
- [x] T026 [US2] Add Metrics column to the Fleet cluster table in `web/src/pages/Fleet.tsx`: column header "Metrics"; show column only when `metricsMap.size > 0 && [...metricsMap.values()].some(m => m !== null && (m.watchCount !== null || m.queueDepth !== null))`; per-cluster cell: render `watchCount` and `queueDepth` from `metricsMap.get(c.context) ?? null`; display format: two small `<span>` elements `Watches: N` and `Queue: N` or a single `—` em-dash when null; use existing token CSS classes and no hardcoded colors
- [x] T027 [P] [US2] Run `make web CMD="run typecheck"` and fix any TypeScript errors introduced by T023–T026

**Checkpoint**: `make go CMD="test -race ./..."` passes. `make web CMD="run typecheck"` passes. Fleet page shows Metrics column in browser (or no column when no kro contexts present).

---

## Phase 5: User Story 3 — Helm RBAC + Integration Verification (P3)

**Goal**: Helm `ClusterRole` grants `get` on `pods/proxy`. All acceptance criteria verified.
AC-009 satisfied. Build, vet, test all green.

**Independent Test**:
```bash
helm template ./helm/kro-ui | grep -A3 "pods/proxy"
# - apiGroups: [""]
#   resources: ["pods/proxy"]
#   verbs: ["get"]
```

### Implementation for User Story 3

- [x] T028 [US3] Add `pods/proxy` RBAC rule to `helm/kro-ui/templates/clusterrole.yaml`: insert a new rule block with `apiGroups: [""]`, `resources: ["pods/proxy"]`, `verbs: ["get"]`; add comment `# Pod proxy — required for per-context kro controller metrics scraping (spec 040)`
- [x] T029 [P] [US3] Run `make go CMD="vet ./..."` — fix any vet warnings
- [x] T030 [P] [US3] Run `make web CMD="run typecheck"` — fix any remaining TypeScript errors

**Checkpoint**: AC-009 satisfied. All vet + typecheck pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification sweep, copyright headers, test race run.

- [x] T031 Verify Apache 2.0 copyright header is present in `internal/k8s/metrics_test.go` (new file); add if missing
- [x] T032 [P] Run `make go CMD="test -race -count=1 ./internal/k8s/... ./internal/api/handlers/..."` — confirm all new tests pass under the race detector
- [x] T033 [P] Run `make go CMD="test -race -count=1 ./..."` — full suite green
- [x] T034 Verify `go vet ./...` is clean (no new issues introduced)
- [x] T035 [P] Manually verify AC-001: `./kro-ui serve --metrics-url http://x` exits 1 with "unknown flag"
- [x] T036 Review all modified files for Constitution §VI compliance: error wrapping with `%w`, `zerolog.Ctx(ctx)` logging with structured fields (no bare `.Msg` without context), no `_ = err` silencing

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─ Phase 2 (Foundational) ← blocks all user stories
        ├─ Phase 3 (US1 — P1, MVP)
        ├─ Phase 4 (US2 — P2)  ← depends on US1 handler changes
        └─ Phase 5 (US3 — P3)  ← independent of US1/US2 content
              └─ Phase 6 (Polish)
```

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only. Core backend rewrite. Must complete before US2.
- **US2 (P2)**: Depends on US1 (handler structure). Fleet frontend is independent of backend US2 work.
- **US3 (P3)**: Helm change is independent; can be done any time after Phase 2.

### Within Phase 2 (Foundational)

Tasks T004–T006 can run together (data structures only).
T007 depends on T004–T006.
T008 depends on T004.
T009 depends on T004–T008.
T010 is independent of T004–T009.
T011 depends on T009.

### Within Phase 3 (US1)

T012, T013, T014 are independent of each other [P].
T015 depends on T011 (stub interface).
T016 depends on T011, T015.
T017, T018, T019 depend on each other (flag removal chain) — do in order T017 → T018 → T019.
T020 depends on T009, T019.

### Within Phase 4 (US2)

T021 depends on T016 (handler structure).
T022 depends on T016.
T023 is independent of Go changes.
T024 depends on T023.
T025 depends on T024.
T026 depends on T025.
T027 depends on T023–T026.

---

## Parallel Execution Examples

### Phase 2 — Foundational (launch together)

```
Task: "Add PodRef and cachedPodRef structs in internal/k8s/metrics.go (T004)"
Task: "Add RESTConfig() accessor to ClientFactory in internal/k8s/client.go (T010)"
```

### Phase 3 — US1 tests (launch together)

```
Task: "discoverKroPod unit tests in internal/k8s/metrics_test.go (T012)"
Task: "scrapeViaProxy unit tests in internal/k8s/metrics_test.go (T013)"
Task: "PodRefCache unit tests in internal/k8s/metrics_test.go (T014)"
```

### Phase 3 — US1 implementation (independent parts)

```
Task: "Remove --metrics-url flag in internal/cmd/root.go (T017)"
Task: "Remove MetricsURL from server.Config in internal/server/server.go (T018)"
# (then) T019 depends on T018
```

### Phase 4 — US2 backend + frontend (independent)

```
Task: "Add ?context= validation to GetMetrics handler (T022)"
Task: "Add getControllerMetricsForContext to web/src/lib/api.ts (T023)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — Phase 1 + 2 + 3)

1. Complete Phase 1: Read all files, run baseline checks
2. Complete Phase 2: Data structures + `RESTConfig()` + interface wiring
3. Complete Phase 3: US1 tests + handler rewrite + flag removal
4. **STOP and VALIDATE**: `make go CMD="test -race ./..."` + binary smoke test
5. MetricsStrip now shows correct context data — core bug is fixed

### Incremental Delivery

1. Setup + Foundational → data structures in place
2. US1 (P1) → MetricsStrip context-correct, `--metrics-url` removed (MVP)
3. US2 (P2) → Fleet metrics column + `?context=` param
4. US3 (P3) → Helm RBAC + final verification sweep
5. Polish → race detector, copyright, vet clean

---

## Notes

- All new `.go` files require the Apache 2.0 copyright header (§VI)
- `internal/k8s/metrics_test.go` is a **new file** — must be created from scratch
- `GOPROXY=direct GONOSUMDB="*"` is already set in the Makefile; use `make go CMD="..."` not bare `go`
- The `stubDynamic` / `stubResourceClient` pattern in `internal/api/handlers/handler_test.go` is the model for k8s-layer stubs in `metrics_test.go`
- `parseMetricLine` in `internal/k8s/metrics.go` is reused by `scrapeViaProxy` — do not duplicate it
- The existing `ScrapeMetrics(ctx, metricsURL)` function is **deleted** in T016/T019 (it is replaced by `MetricsDiscoverer.ScrapeMetrics`); existing `metrics_test.go` stub tests will need updating in T015
