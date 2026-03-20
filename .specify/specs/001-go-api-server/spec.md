# Feature Specification: Go API Server

**Feature Branch**: `001-go-api-server`
**Created**: 2026-03-20
**Status**: Draft
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §IV (Single Binary),
§VI (Go Code Standards), §VII (Testing Standards)

---

## User Scenarios & Testing

### User Story 1 — Operator starts the dashboard locally (Priority: P1)

A kro operator runs `./kro-ui serve` and the server starts, connects to their
current kubeconfig context, and is reachable at `http://localhost:10174`.

**Why this priority**: Nothing else works without the server running. All other
features are blocked on this.

**Independent Test**: `go run ./cmd/kro-ui serve`, then
`curl http://localhost:10174/api/v1/healthz` → `200 ok` within 10ms.

**Acceptance Scenarios**:

1. **Given** a valid kubeconfig at `~/.kube/config`, **When** `kro-ui serve` is
   run with no flags, **Then** the server binds to `:10174`, logs the active
   context name as a structured field, and `/api/v1/healthz` returns `200`
2. **Given** the server is running, **When** `GET /api/v1/healthz` is called,
   **Then** it returns `200 OK` with body `ok` in under 10ms (no cluster call)
3. **Given** `--port 9000` is passed, **When** the server starts, **Then** it
   binds to `:9000`
4. **Given** `--context staging` is passed, **When** the server starts, **Then**
   it uses the `staging` kubeconfig context and logs the context name
5. **Given** `--kubeconfig /path/to/config` is passed, **When** the server
   starts, **Then** it loads that specific kubeconfig file
6. **Given** no kubeconfig exists and the binary is not in-cluster, **When**
   `kro-ui serve` is run, **Then** it exits non-zero with a human-readable error
   message before binding any port

---

### User Story 2 — API returns ResourceGraphDefinitions (Priority: P1)

The API exposes kro's RGDs as plain JSON so the frontend and tooling can
consume them without needing kubectl.

**Why this priority**: Every frontend view is derived from RGD data. No other
spec can proceed without this.

**Independent Test**: With a cluster running kro and at least one RGD,
`curl http://localhost:10174/api/v1/rgds` returns a non-empty JSON list.

**Acceptance Scenarios**:

1. **Given** a cluster with kro installed and 3 RGDs, **When**
   `GET /api/v1/rgds` is called, **Then** it returns a JSON object with an
   `items` array containing all 3 RGD objects including `metadata`, `spec`,
   and `status`
2. **Given** a cluster with 0 RGDs, **When** `GET /api/v1/rgds` is called,
   **Then** it returns `{"items": []}` — not a 404 or error
3. **Given** `GET /api/v1/rgds/dungeon-graph`, **When** the RGD exists, **Then**
   the full unstructured RGD object is returned
4. **Given** `GET /api/v1/rgds/does-not-exist`, **When** the RGD is absent,
   **Then** the API returns `404` with `{"error": "resourcegraphdefinition
   \"does-not-exist\" not found"}`
5. **Given** the cluster API server is temporarily unreachable, **When** any
   RGD endpoint is called, **Then** the API returns `503` with
   `{"error": "cluster unreachable: <underlying error>"}`

---

### User Story 3 — API resolves and lists live instances of an RGD (Priority: P1)

Given an RGD name, the API resolves the generated CRD kind using server-side
discovery and returns all live CR instances.

**Why this priority**: Instance listing feeds the live observability view.

**Independent Test**: `curl 'http://localhost:10174/api/v1/rgds/dungeon-graph/instances'`
returns all `Dungeon` CRs. `curl '...?namespace=default'` returns only instances
in `default`.

**Acceptance Scenarios**:

1. **Given** an RGD with `spec.schema.kind: Dungeon`, **When**
   `GET /api/v1/rgds/dungeon-graph/instances` is called, **Then** all Dungeon
   CRs across all namespaces are returned
2. **Given** `?namespace=default`, **When** the call is made, **Then** only
   Dungeon CRs in namespace `default` are returned
3. **Given** a kind with an irregular plural (`Hero` → `heroes`), **When**
   instances are listed, **Then** the correct plural is resolved via
   `discovery.ServerResourcesForGroupVersion` — not naive `kind + "s"`
4. **Given** `spec.schema.group` is absent from the RGD, **When** resolving
   the instance GVR, **Then** it defaults to `kro.run`

---

### User Story 4 — API returns instance detail, events, and child resources (Priority: P2)

Individual instance endpoints expose the full CR state, Kubernetes events, and
all child resources owned by the instance.

**Why this priority**: Required for the live view but independent from listing.

**Independent Test**: `curl 'http://localhost:10174/api/v1/instances/default/asdasda/events?rgd=dungeon-graph'`
returns the Kubernetes event list for that instance.

**Acceptance Scenarios**:

1. **Given** a live instance `asdasda` in namespace `default`, **When**
   `GET /api/v1/instances/default/asdasda?rgd=dungeon-graph` is called,
   **Then** the full instance object is returned
2. **Given** a live instance, **When**
   `GET /api/v1/instances/default/asdasda/events?rgd=dungeon-graph` is called,
   **Then** Kubernetes events with `involvedObject.name=asdasda` are returned
   newest-first
3. **Given** a live instance, **When**
   `GET /api/v1/instances/default/asdasda/children?rgd=dungeon-graph` is called,
   **Then** all resources carrying label `kro.run/instance-name=asdasda` are
   returned across all discoverable API groups
4. **Given** `GET /api/v1/resources/asdasda/game.k8s.example/v1alpha1/Boss/asdasda-boss`,
   **When** the resource exists, **Then** its full unstructured JSON is returned
5. **Given** `GET /api/v1/metrics`, **Then** `501 Not Implemented` is returned
   with body `{"error": "metrics integration not yet implemented (phase 2)"}` —
   this endpoint is an explicit placeholder per §V

---

### Edge Cases

- Kubeconfig missing or unparseable → server exits with error before binding any port
- Cluster unreachable mid-request → `503` with wrapped error message
- Discovery fails for a given group/version → log a warning with
  `log.Warn().Str("gv", gv).Err(err).Msg("discovery failed")`, fall back to
  naive lowercase pluralization, continue
- Context switch requested while requests are in-flight → in-flight requests
  complete against the old context; all subsequent requests use the new context
  (protected by `sync.RWMutex`)
- `spec.schema.group` is an empty string in an RGD → treat as `kro.run`

---

## Requirements

### Functional Requirements

- **FR-001**: Binary MUST be invoked as `kro-ui serve` (cobra subcommand); root
  command shows help
- **FR-002**: `serve` subcommand MUST accept flags: `--port int` (default 10174),
  `--kubeconfig string`, `--context string`
- **FR-003**: Server MUST embed the compiled frontend via `//go:embed all:../../web/dist`
  and serve it on all routes not matching `/api/`
- **FR-004**: All k8s resource access MUST use `k8s.io/client-go/dynamic` —
  typed clients are not used for any kro resource (constitution §II)
- **FR-005**: Resource plural resolution MUST call
  `discovery.ServerResourcesForGroupVersion` first; naive `strings.ToLower(kind) + "s"`
  is a fallback of last resort only
- **FR-006**: Runtime context switching MUST be implemented in `ClientFactory`
  protected by `sync.RWMutex` — the server MUST NOT restart on context switch
- **FR-007**: All API responses MUST set `Content-Type: application/json` and
  return valid JSON
- **FR-008**: All error responses MUST use `{"error": "<message>"}` with an
  appropriate HTTP status code (`400`, `404`, `503`, etc.)
- **FR-009**: `GET /api/v1/metrics` MUST return `501` — stub for phase 2
- **FR-010**: No mutating Kubernetes API call may be issued (constitution §III)
- **FR-011**: Every `.go` file MUST carry the Apache 2.0 copyright header
  (constitution §X)
- **FR-012**: Structured logging MUST use zerolog via `zerolog.Ctx(ctx)`;
  every log entry MUST include at minimum the relevant resource name or endpoint

### Non-Functional Requirements

- **NFR-001**: Binary size MUST be under 30MB (frontend embedded)
- **NFR-002**: `/api/v1/healthz` MUST respond in under 10ms (no cluster I/O)
- **NFR-003**: All exported Go symbols MUST have godoc comments
- **NFR-004**: `go vet ./...` and `golangci-lint run` MUST pass with zero
  findings before any PR is merged

### Key Entities

- **`ClientFactory`** (`internal/k8s/client.go`): holds dynamic + discovery
  clients for the active context. `sync.RWMutex`-protected. Exposes
  `Dynamic()`, `Discovery()`, `SwitchContext(name string) error`,
  `ListContexts() ([]Context, string, error)`
- **`Handler`** (`internal/api/handlers/handler.go`): shared struct holding
  `*ClientFactory`. All route handlers are methods on `Handler`.
  `respond(w, status, v)` and `respondError(w, status, msg)` are unexported helpers.
- **REST endpoint inventory**:

  | Method | Path | Handler |
  |--------|------|---------|
  | GET | `/api/v1/healthz` | inline |
  | GET | `/api/v1/contexts` | `Handler.ListContexts` |
  | POST | `/api/v1/contexts/switch` | `Handler.SwitchContext` |
  | GET | `/api/v1/rgds` | `Handler.ListRGDs` |
  | GET | `/api/v1/rgds/{name}` | `Handler.GetRGD` |
  | GET | `/api/v1/rgds/{name}/instances` | `Handler.ListInstances` |
  | GET | `/api/v1/instances/{namespace}/{name}` | `Handler.GetInstance` |
  | GET | `/api/v1/instances/{namespace}/{name}/events` | `Handler.GetInstanceEvents` |
  | GET | `/api/v1/instances/{namespace}/{name}/children` | `Handler.GetInstanceChildren` |
  | GET | `/api/v1/resources/{namespace}/{group}/{version}/{kind}/{name}` | `Handler.GetResource` |
  | GET | `/api/v1/metrics` | `Handler.GetMetrics` (501 stub) |

---

## Testing Requirements

### Unit Tests (required before merge)

Following kro's table-driven `build`/`check` pattern:

```go
// internal/api/handlers/rgds_test.go
tests := []struct {
    name  string
    build func(t *testing.T) (*Handler, *stubK8sClient)
    check func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubK8sClient)
}{
    {
        name: "returns 200 with items when RGDs exist",
        build: func(t *testing.T) (*Handler, *stubK8sClient) { ... },
        check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubK8sClient) {
            require.Equal(t, http.StatusOK, rr.Code)
            assert.Contains(t, rr.Body.String(), `"items"`)
        },
    },
}
```

Required test cases per handler:

| Handler | Required cases |
|---------|---------------|
| `ListRGDs` | 200 with items; 200 empty list; 503 cluster unreachable |
| `GetRGD` | 200 found; 404 not found |
| `ListInstances` | 200 all namespaces; 200 filtered; irregular plural resolved |
| `SwitchContext` | 200 valid context; 400 empty body; 400 unknown context |
| `GetResource` | 200 found; 404 not found |
| `GetMetrics` | 501 always |

### Integration Tests (deferred to 001-go-api-server v1.1)

Ginkgo suite against `envtest` API server. Required before v1.0 release tag.

---

## Success Criteria

- **SC-001**: `GET /api/v1/healthz` returns `200` in under 10ms
- **SC-002**: `GET /api/v1/rgds` returns the correct list within 2s on a live cluster
- **SC-003**: Irregular plural (`Hero` → `heroes`) is correctly resolved for
  `dungeon-graph` instances without falling back to naive pluralization
- **SC-004**: Context switch via `POST /api/v1/contexts/switch` takes effect for
  the next request; zero server restart required
- **SC-005**: `go vet ./...` passes; `golangci-lint run` passes with zero findings
- **SC-006**: All unit tests pass with `-race` flag
- **SC-007**: Binary embeds frontend and runs fully offline
