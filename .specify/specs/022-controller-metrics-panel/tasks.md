# Tasks: Controller Metrics Panel

**Input**: Design documents from `/specs/022-controller-metrics-panel/`  
**Branch**: `022-controller-metrics-panel`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/metrics-api.md ✓

**Organization**: Tasks are grouped by user story. US1 (Home page strip) and US3 (queryable API) share the backend endpoint — US1's backend work is the foundation US3 builds on. US2 (auto-refresh) is wired into the same component.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no dependencies)
- **[Story]**: User story label (US1 = home page strip, US2 = auto-refresh, US3 = queryable API)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the `--metrics-url` flag through CLI → config → handler so every subsequent task has a stable integration point to build against.

- [x] T001 Add `MetricsURL string` field to `server.Config` in `internal/server/server.go`
- [x] T002 Add `--metrics-url` cobra flag (default `"http://localhost:8080/metrics"`) in `internal/cmd/root.go`, pass through to `server.Config`
- [x] T003 Add `metricsURL string` field to `Handler` struct in `internal/api/handlers/handler.go`; update `New()` signature to accept `metricsURL string`
- [x] T004 Update `NewRouter` call site in `internal/server/server.go` to pass `cfg.MetricsURL` into `handlers.New(factory, cfg.MetricsURL)`

**Checkpoint**: `go build ./...` passes. `kro-ui serve --help` shows `--metrics-url` flag.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Prometheus text parser and `ControllerMetrics` response type are shared by all user stories. Must be complete before any story work begins.

- [x] T005 Add `ControllerMetricsResponse` struct to `internal/api/types/response.go` with fields: `WatchCount *int64`, `GVRCount *int64`, `QueueDepth *int64`, `WorkqueueDepth *int64`, `ScrapedAt string`; all pointer fields use `json:",omitempty"` replaced by explicit `json:"watchCount"` tags (pointer encodes as `null` in JSON when nil)
- [x] T006 Create `internal/k8s/metrics.go` — define `ControllerMetrics` struct (pointer `*int64` fields for the four counters + `ScrapedAt time.Time`); define `ScrapeMetrics(ctx context.Context, metricsURL string) (*ControllerMetrics, error)` that: (a) issues a `GET metricsURL` with a 4-second timeout, (b) returns 503/502/504 sentinel errors on upstream failures, (c) parses the Prometheus text body line-by-line for `dynamic_controller_watch_count`, `dynamic_controller_gvr_count`, `dynamic_controller_queue_length`, and `workqueue_depth{name="dynamic-controller-queue"}`, (d) stores found values as non-nil `*int64`, leaves absent metrics as `nil`
- [x] T007 [P] Create `internal/k8s/metrics_test.go` — table-driven unit tests for `ScrapeMetrics`: (a) all four metrics present → all fields non-nil with correct values, (b) two metrics absent → absent fields nil, present fields non-nil, (c) upstream returns 500 → error returned, (d) body is empty → all fields nil, `ScrapedAt` set, no error, (e) `workqueue_depth` present with wrong name label → field nil

**Checkpoint**: `go test -race ./internal/k8s/...` passes.

---

## Phase 3: User Story 1 — View Controller Health at a Glance (Priority: P1) 🎯 MVP

**Goal**: Replace the 501 stub with a real `GET /api/v1/kro/metrics` endpoint and surface the four counters in a compact strip on the Home page.

**Independent Test**: `curl http://localhost:40107/api/v1/kro/metrics` returns a JSON object with the four counter fields (values or `null`). Loading the Home page shows a metrics strip above the RGD card grid with counter labels and values (or "Metrics unavailable" on error).

### Backend implementation

- [x] T008 [US1] Create `internal/api/handlers/metrics.go` — implement `GetMetrics(w, r)`: call `internal/k8s/ScrapeMetrics(r.Context(), h.metricsURL)`; on success marshal to `ControllerMetricsResponse` and respond 200; on upstream error respond 503/502/504 with JSON `{"error": "..."}` body matching the contract in `contracts/metrics-api.md`
- [x] T009 [US1] Create `internal/api/handlers/metrics_test.go` — table-driven handler unit tests using a stub `metricsSource` interface: (a) scraper returns full metrics → 200 with correct JSON, (b) all fields nil → 200 with all null fields, (c) scraper returns unreachable error → 503, (d) scraper returns bad-gateway error → 502, (e) scraper returns timeout error → 504
- [x] T010 [US1] Remove the `GetMetrics` stub from `internal/api/handlers/instances.go` (lines 123-125) and its test `TestGetMetrics` from `internal/api/handlers/instances_test.go`
- [x] T011 [P] [US1] Add `ControllerMetrics` TypeScript interface and `getControllerMetrics()` function to `web/src/lib/api.ts`
- [x] T012 [P] [US1] Create `web/src/components/MetricsStrip.tsx`: render 4 counter cells (`watchCount` = "Active watches", `gvrCount` = "GVRs served", `queueDepth` = "Queue depth (kro)", `workqueueDepth` = "Queue depth (client-go)"); display numeric value or "Not reported" for `null` fields; loading state (skeleton cells); degraded state (scoped error message) when `error !== null && data === null`; use `usePolling(getControllerMetrics, [], { intervalMs: 30000 })`
- [x] T013 [P] [US1] Create `web/src/components/MetricsStrip.css`: horizontal flex strip layout; 4 equal-width counter cells; all colors via `var(--token-*)` from `tokens.css`; degrade state uses `var(--color-error)` token; loading state uses skeleton animation consistent with `SkeletonCard`
- [x] T014 [US1] Create `web/src/components/MetricsStrip.test.tsx`: unit tests for all 4 render states: (a) loading (data=null, loading=true) → skeleton visible, no values, (b) healthy (data with values) → all 4 counter values rendered, (c) degraded (error, data=null) → "Metrics unavailable" message, no counter cells, (d) null fields (data with null counters) → "Not reported" rendered for each null field
- [x] T015 [US1] Import and render `<MetricsStrip />` in `web/src/pages/Home.tsx` above the RGD heading; the strip renders independently regardless of RGD load state

**Checkpoint**: `go test -race ./...` passes. `bun run typecheck` passes. `curl` to `/api/v1/kro/metrics` returns valid JSON. Home page shows strip above RGD grid; strip shows "Metrics unavailable" when `--metrics-url` points to an unreachable address; rest of Home page functions normally.

---

## Phase 4: User Story 2 — Metrics Data Refreshes Automatically (Priority: P2)

**Goal**: Counter values update every 30 seconds while the Home page is mounted; polling stops on unmount; the strip recovers silently after a transient failure.

**Independent Test**: Keep the Home page open and observe in browser DevTools (Network tab) that a new `GET /api/v1/kro/metrics` request fires every ~30 seconds. Navigate away; verify no further requests fire. Simulate a failed fetch mid-session; observe the strip recovers without a page reload.

*US2 is fully delivered by the `usePolling` wiring in T012 (intervalMs: 30 000, stop on unmount, silent recovery). No additional implementation tasks are required — this phase is a validation checkpoint.*

- [x] T016 [US2] Verify in `web/src/components/MetricsStrip.test.tsx` that the polling interval prop is `30000` (assert `usePolling` is called with `intervalMs: 30000`) and that unmount clears the timer (use `vi.useFakeTimers` to advance 60 s and assert exactly 2 fetches fired)

**Checkpoint**: Timer tests pass. No runaway polling after unmount in manual test.

---

## Phase 5: User Story 3 — Backend Metrics API is Independently Queryable (Priority: P3)

**Goal**: `GET /api/v1/kro/metrics` works correctly from a plain HTTP client with no browser involvement; response matches the contract in `contracts/metrics-api.md` exactly.

**Independent Test**: `curl -s http://localhost:40107/api/v1/kro/metrics | jq .` returns an object with the five documented fields. `curl -s http://localhost:40107/api/v1/kro/metrics` with the server pointed at an unreachable URL returns a JSON `{"error": "..."}` body (not an HTML page) with a non-200 status.

*The endpoint implementation is already complete after Phase 3. This phase adds contract-level hardening.*

- [x] T017 [P] [US3] Extend `internal/api/handlers/metrics_test.go` with response-shape tests: assert `Content-Type: application/json` header is set on all responses (200 and error); assert error responses never contain HTML; assert all five JSON fields are present in a 200 response (even when null)
- [x] T018 [P] [US3] Extend `internal/k8s/metrics_test.go` with a concurrent-call test: launch 5 goroutines calling `ScrapeMetrics` simultaneously against a test HTTP server; assert all return without data races (`go test -race`)

**Checkpoint**: `go test -race ./internal/api/handlers/... ./internal/k8s/...` passes with all new tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, build hygiene, and documentation alignment.

- [x] T019 [P] Run `go vet ./...` and resolve any issues in new/modified Go files
- [x] T020 [P] Run `bun run typecheck` (`tsc --noEmit`) and resolve any TypeScript errors
- [x] T021 Verify `go build ./...` produces a working binary; smoke-test `kro-ui serve --metrics-url http://localhost:8080/metrics --help`
- [x] T022 [P] Confirm all new `.go` files have the Apache 2.0 copyright header (constitution §VI)
- [x] T023 [P] Confirm `MetricsStrip.css` has no hardcoded hex values or `rgba()` literals — all colors reference `var(--token-*)` tokens (constitution §IX); add any missing tokens to `web/src/tokens.css`
- [x] T024 Confirm the Home page `document.title` is unchanged (`kro-ui` — set by `usePageTitle('')` in `Home.tsx`) after adding `MetricsStrip`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001–T004 must be done in order (each wires the next layer)
- **Phase 2 (Foundational)**: Depends on Phase 1 completion; T006 and T007 are parallelizable after T005 defines the response type
- **Phase 3 (US1 MVP)**: Depends on Phase 2; T008 depends on T006; T009 depends on T008; T010 is independent; T011–T013 are parallelizable; T014 depends on T012; T015 depends on T012
- **Phase 4 (US2)**: T016 extends T014 — can run immediately after T014 completes
- **Phase 5 (US3)**: T017 extends T009, T018 extends T007 — both parallelizable after respective phases
- **Phase 6 (Polish)**: All T019–T024 can run in parallel once all story phases are complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 foundational work; delivers the endpoint + strip
- **US2 (P2)**: Delivered entirely within US1's component (T012); T016 is the only additional task — can run immediately after T014
- **US3 (P3)**: Endpoint already exists after US1; adds contract hardening tests only

### Within Phase 3 (US1) parallel opportunities

```
After T005, T006, T007 complete:

Backend group (sequential):
  T008 → T009 → T010

Frontend group (parallel start, T014/T015 depend on T012):
  T011 (parallel)
  T012 + T013 (parallel to each other)
  T014 (depends on T012)
  T015 (depends on T012)
```

---

## Parallel Example: Phase 3 (US1)

```
# Backend and frontend can proceed in parallel after Phase 2:

Backend stream:
  Task T008: "Create internal/api/handlers/metrics.go — real GetMetrics handler"
  Task T009: "Create internal/api/handlers/metrics_test.go — handler unit tests"
  Task T010: "Remove GetMetrics stub from instances.go and instances_test.go"

Frontend stream (parallel to backend):
  Task T011: "Add ControllerMetrics interface + getControllerMetrics() to web/src/lib/api.ts"
  Task T012: "Create web/src/components/MetricsStrip.tsx"
  Task T013: "Create web/src/components/MetricsStrip.css"
  # Then, after T012:
  Task T014: "Create web/src/components/MetricsStrip.test.tsx"
  Task T015: "Add <MetricsStrip /> to web/src/pages/Home.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — wire the flag (T001–T004)
2. Complete Phase 2: Foundational — build the scraper (T005–T007)
3. Complete Phase 3: US1 — endpoint + strip (T008–T015)
4. **STOP and VALIDATE**: `curl /api/v1/kro/metrics` returns JSON; Home page shows strip
5. US2 auto-refresh is already wired (no extra work); US3 is hardening-only

### Incremental Delivery

1. Phase 1 + 2 → scraper library ready; endpoint replaces stub
2. Phase 3 → Home page strip visible; dashboard is shippable
3. Phase 4 → polling test coverage added (no user-visible change)
4. Phase 5 → contract hardening (no user-visible change)
5. Phase 6 → build hygiene sign-off; PR-ready

### Notes

- The stub `GetMetrics` in `instances.go` (T010) must be removed — it returns 501 and would shadow the new handler
- `workqueue_depth` uses a label filter `{name="dynamic-controller-queue"}` — the parser must match the label value, not just the metric name prefix
- All ALPHA metric names (`dynamic_controller_*`) may be absent on older kro versions — `nil` JSON response is always correct
- `usePolling` is already battle-tested in the codebase; no polling logic needs to be written from scratch
