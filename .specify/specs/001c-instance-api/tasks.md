# Tasks: 001c-instance-api

## Phase 1 — Code Fixes

- [x] 1.1 Fix `GetResource` to treat `_` in `{group}` path segment as core (empty) group (FR-005)
- [x] 1.2 Fix `GetMetrics` stub message to match spec: `"metrics integration not yet implemented (phase 2)"`

## Phase 2 — Test Infrastructure

- [x] 2.1 Enhance `stubDiscovery.ServerGroupsAndResources()` to return canned API resource lists from the `resources` map
- [x] 2.2 Add `labelItems` field to `stubResourceClient` to support label-selector filtering for children tests

## Phase 3 — Unit Tests

- [x] 3.1 Create `instances_test.go` with table-driven tests for `GetInstance`
  - Returns 400 when `?rgd=` is missing
  - Returns 404 for unknown instance
  - Returns 200 for valid instance
- [x] 3.2 Add table-driven tests for `GetInstanceEvents`
  - Returns 200 with events
  - Returns 200 with empty items when no events
- [x] 3.3 Add table-driven tests for `GetInstanceChildren`
  - Returns 200 with children
  - Skips subresources
  - Skips non-listable resources
  - Returns empty items when no matches
- [x] 3.4 Add table-driven tests for `GetResource`
  - Returns 200 for valid resource
  - Treats `_` group as core group
  - Returns 404 for missing resource
- [x] 3.5 Add test for `GetMetrics` always returns 501

## Phase 4 — Verify

- [x] 4.1 Run `go vet ./...` — must pass clean
- [x] 4.2 Run `go test -race ./internal/...` — all tests pass
- [x] 4.3 Mark tasks complete, commit
