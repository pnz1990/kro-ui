# Fix: FleetSummary timeout coherence + errgroup context + label constants

**Issue(s)**: #225, #226, #228
**Branch**: fix/issue-225-226-228-fleet-label-constants
**Labels**: bug, refactor

## Root Cause

- **#225**: `summariseContext` creates a 10s deadline on top of a parent context already bound by the 5s
  `middleware.Timeout`. The minimum wins, making the 10s a dead letter and the comments wrong.
  Fix: give the `/fleet/summary` route its own timeout (30s) outside the global 5s middleware.
- **#226**: `errgroup.WithContext(tctx)` derived context is discarded (`_`). Since all goroutines
  return `nil`, cancellation never fires, but passing `tctx` directly to the per-RGD goroutines
  means a context cancellation (from the parent) doesn't propagate correctly. Fix: use the
  derived `gctx` from errgroup so early cancellation propagates.
- **#228**: `"kro.run/instance-name"` appears as two inline string literals in `rgd.go:178` and
  `rgd.go:320`. `KroGroup` already exists in `client.go`. Fix: add `LabelInstanceName` and
  `LabelNodeID` constants alongside `KroGroup` and use them everywhere.

## Files to change

- `internal/server/server.go` — exempt `/fleet/summary` from global 5s timeout
- `internal/api/handlers/fleet.go` — fix 10s deadline comment + use derived gctx
- `internal/k8s/client.go` — add `LabelInstanceName`, `LabelNodeID` constants
- `internal/k8s/rgd.go` — replace inline label strings with constants
- `internal/api/handlers/fleet_test.go` — update if any deadline assertions change

## Tasks

### Phase 1 — #228: Add label constants to client.go
- [x] Add `LabelInstanceName = KroGroup + "/instance-name"` and `LabelNodeID = KroGroup + "/node-id"` constants in `internal/k8s/client.go` alongside `KroGroup`
- [x] Replace `"kro.run/instance-name"` at `rgd.go:178` with `LabelInstanceName`
- [x] Replace `"kro.run/instance-name"` at `rgd.go:320` with `LabelInstanceName`

### Phase 2 — #225 + #226: Fix fleet.go timeout + errgroup context
- [x] In `server.go`: move `/fleet/summary` registration outside the `r.Use(middleware.Timeout(5s))` block (or register a sub-router with a 30s timeout for fleet)
- [x] In `fleet.go`: update `summariseContext` comment — remove misleading "10s deadline per cluster (NFR-003)" since fleet now has its own 30s at the route level; remove the `context.WithTimeout(parent, 10*time.Second)` and use `parent` directly (the route-level timeout is the deadline)
- [x] In `fleet.go`: change `g, _ := errgroup.WithContext(tctx)` to `g, gctx := errgroup.WithContext(parent)` and pass `gctx` to per-RGD goroutines instead of `tctx`

### Phase 3 — Tests
- [x] Run `go vet ./...`
- [x] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...`

### Phase 4 — PR
- [ ] Commit: `fix(api): fleet timeout coherence + errgroup gctx + label constants — closes #225, closes #226, closes #228`
- [ ] Push and open PR
