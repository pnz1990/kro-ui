# Tasks: 001b-rgd-api

## Phase 1 — Setup

- [x] T01: Verify existing handler code compiles and passes `go vet`
- [x] T02: Review spec acceptance scenarios and map to test cases

## Phase 2 — Code Fixes

- [x] T03: Fix `ListRGDs` to use `r.Context()` instead of `context.Background()`
- [x] T04: Fix `GetRGD` to use `r.Context()` instead of `context.Background()`
- [x] T05: Fix `ListInstances` to use `r.Context()` instead of `context.Background()`
- [x] T06: Improve error handling in `ListRGDs` — return 503 for cluster errors (spec scenario 5)
- [x] T06b: Fix `GetRGD` 404 message format per spec (`resourcegraphdefinition "name" not found`)
- [x] T06c: Refactor `Handler.factory` from `*ClientFactory` to `k8sClients` interface (§VI)
- [x] T06d: Update `discoverPlural` to accept `k8sClients` interface

## Phase 3 — Test Infrastructure

- [x] T07: Create stub dynamic client infrastructure in `handler_test.go`
- [x] T08: Create stub discovery client infrastructure in `handler_test.go`

## Phase 4 — Unit Tests (TDD validation)

- [x] T09: Write `rgds_test.go` — `TestListRGDs` (3 cases: success, empty, cluster error)
- [x] T10: Write `rgds_test.go` — `TestGetRGD` (2 cases: found, not found/404)
- [x] T11: Write `rgds_test.go` — `TestListInstances` (7 cases: success, namespace filter, missing kind/422, discovery fallback, default group, RGD not found, empty instances)
- [x] T12: Write `discover_test.go` — `TestUnstructuredString` (6 cases: nested found, key not found, intermediate missing, wrong type, single-level, empty object)
- [x] T13: Write `discover_test.go` — `TestIsListable` (4 cases: listable, non-listable, subresource, empty verbs)
- [x] T14: Write `discover_test.go` — `TestDiscoverPlural` (6 cases: found, case-insensitive, not found, discovery fails, empty group, unregistered GV)

## Phase 5 — Polish

- [x] T15: Create `.dockerignore`
- [x] T16: Run `go test -race ./internal/api/handlers/...` — all 29 tests pass
- [x] T17: Run `go vet ./...` — clean
- [x] T18: Verify test coverage includes all spec acceptance scenarios
