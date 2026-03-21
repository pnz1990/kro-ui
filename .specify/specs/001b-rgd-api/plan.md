# Implementation Plan: 001b-rgd-api

## Summary

Add three RGD API endpoints to the kro-ui backend, plus comprehensive unit tests.
The handler code (`rgds.go`, `discover.go`) was scaffolded during the server-core
work and needs: (a) correctness fixes, (b) full unit test coverage matching the
spec's acceptance scenarios.

## Tech Stack

- **Language**: Go 1.25
- **Router**: chi v5 (already wired in `server.go`)
- **K8s client**: `k8s.io/client-go/dynamic` + `discovery` via `ClientFactory`
- **Testing**: `testing` + `testify/assert` + `testify/require`, table-driven build/check

## Architecture

### Files Modified

| File | Change |
|------|--------|
| `internal/api/handlers/rgds.go` | Fix error codes (503 for cluster errors), use `r.Context()` |
| `internal/api/handlers/rgds_test.go` | NEW — full unit tests for ListRGDs, GetRGD, ListInstances |
| `internal/api/handlers/discover_test.go` | NEW — unit tests for unstructuredString, isListable, discoverPlural |
| `internal/api/handlers/handler_test.go` | Extend stub to support dynamic + discovery mocking |
| `.dockerignore` | NEW — Docker build ignore patterns |

### Test Strategy

Unit tests use hand-written stubs (no mockery/gomock per constitution). The stubs
implement `dynamic.Interface` and `discovery.DiscoveryInterface` at the minimum
surface area needed — only `Resource()` and `ServerResourcesForGroupVersion()`.

The test pattern follows the existing `contexts_test.go` build/check structure:
- `build` sets up stub data + constructs the Handler
- `check` asserts HTTP status code and response body content

### Stub Design

Since `rgds.go` calls `h.factory.Dynamic().Resource(gvr).List/Get(...)`, we need:
1. A stub `ClientFactory` that returns a stub `dynamic.Interface`
2. The stub `dynamic.Interface` returns a stub `dynamic.ResourceInterface` for specific GVRs
3. The stub `dynamic.ResourceInterface` implements `List` and `Get`

This is more involved than the context stubs but follows the same pattern of
hand-written unexported types implementing the minimum interface surface.
