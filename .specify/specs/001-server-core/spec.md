# Feature Specification: Server Core

**Feature Branch**: `001-server-core`
**Created**: 2026-03-20
**Status**: Merged (PR #12) — pre-workflow spec; plan.md not required
**Depends on**: nothing — this is the foundation
**Constitution ref**: §IV (Single Binary), §VI (Go Code Standards), §VII (Testing),
§VIII (Commit conventions)

---

## Context

This spec covers the minimum Go binary needed to unblock all other specs:

- A working `kro-ui serve` command that starts an HTTP server
- The `go:embed` frontend serving infrastructure
- The `/api/v1/healthz` endpoint
- The `ClientFactory` k8s client (dynamic + discovery, runtime context switch)
- The `GET /api/v1/contexts` and `POST /api/v1/contexts/switch` endpoints

**Not in scope here** — RGD endpoints (spec 001b), instance endpoints (spec 001c).

**Go module note**: `proxy.golang.org` is blocked in this environment. All `go`
commands must use `GOPROXY=direct GONOSUMDB="*"`. The Makefile `tidy` target
must set these env vars.

---

## User Scenarios & Testing

### User Story 1 — Developer starts the server (Priority: P1)

`./kro-ui serve` starts, connects to the current kubeconfig context, and serves
the embedded frontend at `http://localhost:40107`.

**Why this priority**: Nothing else runs without this.

**Independent Test**: `./bin/kro-ui serve`, then `curl http://localhost:40107/api/v1/healthz` → `200 ok`.

**Acceptance Scenarios**:

1. **Given** a valid kubeconfig, **When** `kro-ui serve` is run, **Then** the
   server binds to `:40107`, logs the active context name as a structured zerolog
   field, and `/healthz` returns `200`
2. **Given** `--port 9000`, **When** the server starts, **Then** it binds to `:9000`
3. **Given** `--context staging`, **When** the server starts, **Then** it uses
   the `staging` kubeconfig context
4. **Given** `--kubeconfig /path/to/config`, **When** the server starts, **Then**
   it loads that file
5. **Given** no kubeconfig exists and not in-cluster, **When** `kro-ui serve` is
   run, **Then** it exits non-zero with a descriptive error before binding any port
6. **Given** `./bin/kro-ui version`, **When** run, **Then** it prints version,
   commit, and build date baked in by `-ldflags`

---

### User Story 2 — Frontend is served from the embedded binary (Priority: P1)

`GET /` serves `index.html` from the embedded `web/dist`. All unknown routes
(SPA client-side routing) also serve `index.html`.

**Why this priority**: Spec 002 depends on the browser being able to load the app.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** `GET /` is requested, **Then** it
   returns `200` with `Content-Type: text/html` and the body contains `<div id="root">`
2. **Given** `GET /rgds/web-service-graph` (a client-side React Router path),
   **When** requested, **Then** it returns `200` with `index.html` — not a 404
3. **Given** `GET /assets/main.js` (a real static asset in `web/dist/assets/`),
   **When** requested, **Then** the correct JS file is returned with the right
   `Content-Type`

---

### User Story 3 — Operator lists and switches kubeconfig contexts (Priority: P1)

`GET /api/v1/contexts` returns all available contexts and the active one.
`POST /api/v1/contexts/switch` switches the active context at runtime.

**Why this priority**: Required by spec 007 and displayed in every page's top bar.

**Acceptance Scenarios**:

1. **Given** a kubeconfig with 2 contexts, **When** `GET /api/v1/contexts` is
   called, **Then** it returns `{"contexts": [...], "active": "context-name"}`
2. **Given** `POST /api/v1/contexts/switch` with `{"context": "other-context"}`,
   **When** the context exists, **Then** it returns `200 {"active": "other-context"}`
   and subsequent cluster calls use the new context
3. **Given** `POST /api/v1/contexts/switch` with `{"context": ""}`, **When**
   called, **Then** it returns `400 {"error": "..."}`
4. **Given** `POST /api/v1/contexts/switch` with an unknown context name, **When**
   called, **Then** it returns `400 {"error": "..."}`

---

### Edge Cases

- `--kubeconfig` file does not exist → exit with `fmt.Errorf("kubeconfig not found: %w", err)`
- `--context` names a context not in the kubeconfig → exit with descriptive error
- `web/dist` is empty at embed time (frontend not built yet) → use a minimal stub
  `web/dist/index.html` with `<div id="root"></div>` so the binary compiles

---

## Requirements

### Functional Requirements

- **FR-001**: Binary MUST be invoked as `kro-ui serve`; `kro-ui --help` shows usage
- **FR-002**: `serve` MUST accept `--port int` (default 40107), `--kubeconfig string`,
  `--context string`
- **FR-003**: `GET /api/v1/healthz` MUST return `200 ok` within 10ms (no cluster I/O)
- **FR-004**: Server MUST embed `web/dist` via `//go:embed all:../../web/dist` and
  serve `index.html` for all non-API, non-asset routes (SPA fallback)
- **FR-005**: `ClientFactory` MUST use `k8s.io/client-go/dynamic` and
  `k8s.io/client-go/discovery`; context switch MUST be `sync.RWMutex`-protected
- **FR-006**: `GET /api/v1/contexts` MUST return all contexts + active context name
- **FR-007**: `POST /api/v1/contexts/switch` MUST reload clients atomically; return
  `400` for empty or unknown context name
- **FR-008**: Every `.go` file MUST begin with the Apache 2.0 copyright header
- **FR-009**: All error wrapping MUST use `fmt.Errorf("context: %w", err)`
- **FR-010**: Logging MUST use zerolog via `zerolog.Ctx(ctx)` with structured fields

### Non-Functional Requirements

- **NFR-001**: `/api/v1/healthz` responds in under 10ms
- **NFR-002**: `go vet ./...` passes with zero findings
- **NFR-003**: All unit tests pass with `go test -race ./...`

### Key Entities (implementation targets)

| File | Contents |
|------|----------|
| `cmd/kro-ui/main.go` | calls `cmd.Execute()` |
| `internal/cmd/root.go` | cobra root + serve + version commands |
| `internal/server/server.go` | HTTP server, `go:embed`, chi router, SPA fallback |
| `internal/k8s/client.go` | `ClientFactory` with `SwitchContext`, `ListContexts` |
| `internal/api/handlers/handler.go` | `Handler` struct, `respond()`, `respondError()` |
| `internal/api/handlers/contexts.go` | `ListContexts`, `SwitchContext` handlers |
| `internal/version/version.go` | ldflags version vars |
| `web/dist/index.html` | minimal stub `<div id="root"></div>` so embed compiles |

---

## Testing Requirements

### Unit Tests (required before merge)

```go
// internal/api/handlers/contexts_test.go
tests := []struct {
    name  string
    build func(*testing.T) (*Handler, *stubClientFactory)
    check func(*testing.T, *httptest.ResponseRecorder, *stubClientFactory)
}{
    {
        name: "ListContexts returns all contexts and active",
        build: func(t *testing.T) (*Handler, *stubClientFactory) { ... },
        check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
            require.Equal(t, http.StatusOK, rr.Code)
            assert.Contains(t, rr.Body.String(), `"active"`)
            assert.Contains(t, rr.Body.String(), `"contexts"`)
        },
    },
    {name: "SwitchContext returns 200 for valid context", ...},
    {name: "SwitchContext returns 400 for empty context", ...},
    {name: "SwitchContext returns 400 for unknown context", ...},
}

// internal/k8s/client_test.go
// Test SwitchContext with -race:
// go test -race ./internal/k8s/...
```

---

## E2E User Journey

**File**: `test/e2e/journeys/001-server-health.spec.ts` (already written — covers
healthz, RGD list (spec 001b), and contexts)

The context-related steps in journey 001 validate FR-006 and FR-007 of this spec.

---

## Success Criteria

- **SC-001**: `GET /api/v1/healthz` returns `200` in under 10ms
- **SC-002**: `GET /` serves `index.html` with `<div id="root">`
- **SC-003**: `GET /rgds/any-path` returns `index.html` (SPA fallback)
- **SC-004**: `POST /api/v1/contexts/switch` with valid context returns `200`
- **SC-005**: `go test -race ./...` passes with zero failures
- **SC-006**: `go vet ./...` passes with zero findings
- **SC-007**: Binary compiles and embeds frontend stub correctly
