# Spec: 27.21 — Fleet per-cluster inner deadline

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.21 — Fleet per-cluster inner deadline (context.WithTimeout 5s in summariseContext) (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: `summariseContext()` in `internal/api/handlers/fleet.go` MUST add `context.WithTimeout(parent, 5*time.Second)` as the first statement, giving each cluster probe a 5-second inner deadline independent of other goroutines.

**O2**: The context passed to `BuildClient`, the RGD list call, and the errgroup fan-out MUST be the new 5s-bounded context, not the raw `parent`.

**O3**: `TestFleetSummaryHandler_ContextTimeout` MUST exist in `internal/api/handlers/fleet_test.go`. It MUST inject a mock cluster that sleeps > 5s and assert that the response arrives in < 6 seconds and the slow cluster's `ClusterSummary.Health` is `"unreachable"` or `"kro-not-installed"` (i.e. the timeout fires, not an indefinite hang).

**O4**: The Go race detector MUST pass (`go test -race ./...`).

**O5**: `go vet ./...` MUST pass.

---

## Zone 2 — Implementer's judgment

- The 5s value matches the per-RGD goroutine timeout already used inside `summariseContext()`. Making the outer deadline also 5s is idiomatic — it bounds the entire cluster probe (BuildClient + List + fan-out) to the same budget.
- The proposal doc says 2s outer deadline but the code already has 5s per-RGD goroutines. 5s is the pragmatic choice that prevents a regression on throttled clusters.
- `cancel()` from `context.WithTimeout` must be deferred immediately after the call.
- The existing errgroup is constructed with `gctx` from `errgroup.WithContext(parent)`. After O2, it should use the new 5s context: `g, gctx := errgroup.WithContext(innerCtx)`.

---

## Zone 3 — Scoped out

- Configurable per-cluster timeout (defer)
- Controller metrics per-cluster timeout (already covered by the errgroup)
- Fleet streaming / SSE (separate spec)
