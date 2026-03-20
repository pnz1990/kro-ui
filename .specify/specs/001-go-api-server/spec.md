# Feature Specification: Go API Server

**Feature Branch**: `001-go-api-server`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Developer starts the dashboard locally (Priority: P1)

A developer runs `./kro-ui serve` (or `make run`) and the server starts, connects to their current kubeconfig context, and is reachable at `http://localhost:10174`.

**Why this priority**: Nothing else works without the server running. This is the foundation for all other features.

**Independent Test**: Run `./kro-ui serve`, curl `http://localhost:10174/api/v1/healthz`, expect `200 ok`.

**Acceptance Scenarios**:

1. **Given** a valid kubeconfig exists, **When** `kro-ui serve` is run, **Then** the server starts on port 10174 and logs the active context name
2. **Given** the server is running, **When** `GET /api/v1/healthz` is called, **Then** it returns `200 OK` with body `ok`
3. **Given** `--port 9000` is passed, **When** the server starts, **Then** it binds to port 9000
4. **Given** `--context my-context` is passed, **When** the server starts, **Then** it uses that kubeconfig context
5. **Given** no kubeconfig exists, **When** `kro-ui serve` is run, **Then** it exits with a clear error message

---

### User Story 2 — API returns RGDs from the cluster (Priority: P1)

The frontend (or curl) can fetch all ResourceGraphDefinitions from the connected cluster.

**Why this priority**: All UI features depend on this data.

**Independent Test**: With a live cluster, `GET /api/v1/rgds` returns a JSON list of RGD objects.

**Acceptance Scenarios**:

1. **Given** a cluster with kro installed and RGDs present, **When** `GET /api/v1/rgds` is called, **Then** it returns a JSON array of RGD objects with `metadata.name`, `spec`, and `status`
2. **Given** a cluster with no RGDs, **When** `GET /api/v1/rgds` is called, **Then** it returns an empty items array (not an error)
3. **Given** `GET /api/v1/rgds/:name`, **When** the RGD exists, **Then** it returns the full RGD object
4. **Given** `GET /api/v1/rgds/:name`, **When** the RGD does not exist, **Then** it returns `404` with `{"error": "..."}` 

---

### User Story 3 — API returns instances of an RGD (Priority: P1)

Given an RGD name, the API resolves the generated CRD kind and lists all live CR instances.

**Why this priority**: Instance listing is core to observability.

**Independent Test**: `GET /api/v1/rgds/dungeon-graph/instances` returns all Dungeon CRs across all namespaces.

**Acceptance Scenarios**:

1. **Given** an RGD named `dungeon-graph` with `spec.schema.kind: Dungeon`, **When** `GET /api/v1/rgds/dungeon-graph/instances` is called, **Then** it returns all Dungeon CRs
2. **Given** `?namespace=default` is added, **When** the call is made, **Then** only instances in `default` namespace are returned
3. **Given** the generated CRD kind uses an irregular plural (e.g., `Hero` → `heroes`), **When** instances are listed, **Then** the correct plural is resolved via server-side discovery (not naive `+s`)
4. **Given** the RGD's `spec.schema.group` is empty, **When** instances are listed, **Then** it defaults to `kro.run` as the group

---

### User Story 4 — API returns instance detail, events, and children (Priority: P2)

The API exposes endpoints for a single instance's full detail, its Kubernetes events, and its child resources.

**Why this priority**: Required for the live instance view but independent of listing.

**Independent Test**: `GET /api/v1/instances/default/asdasda/events` returns the event list for that instance.

**Acceptance Scenarios**:

1. **Given** a live instance, **When** `GET /api/v1/instances/:ns/:name/events?rgd=dungeon-graph` is called, **Then** Kubernetes events for that object are returned
2. **Given** a live instance, **When** `GET /api/v1/instances/:ns/:name/children?rgd=dungeon-graph` is called, **Then** all child resources carrying `kro.run/instance-name` label are returned across all kinds
3. **Given** `GET /api/v1/resources/:ns/:group/:version/:kind/:name`, **When** the resource exists, **Then** its full unstructured JSON is returned
4. **Given** `GET /api/v1/metrics`, **Then** it returns `501 Not Implemented` with a message indicating phase 2

---

### Edge Cases

- What happens when the kubeconfig file is missing or malformed? → Server exits with a clear error before binding the port.
- What happens when the cluster is unreachable mid-flight? → API returns `503` with `{"error": "cluster unreachable: ..."}`.
- What happens when discovery fails for a resource kind? → Falls back to naive lowercase pluralization, logs a warning.
- What happens when a context switch is requested mid-flight while requests are in progress? → Requests in flight complete against the old context; new requests use the new context.

## Requirements

### Functional Requirements

- **FR-001**: Server MUST start with `kro-ui serve` and bind to port 10174 by default
- **FR-002**: Server MUST accept `--port`, `--kubeconfig`, and `--context` flags
- **FR-003**: Server MUST embed the frontend via `go:embed` and serve it on all non-API routes
- **FR-004**: All k8s access MUST use the dynamic client (`k8s.io/client-go/dynamic`) — no typed clients for kro resources
- **FR-005**: Resource kind resolution MUST use server-side discovery first, with naive pluralization as a fallback only
- **FR-006**: Context switching MUST be possible at runtime via `POST /api/v1/contexts/switch` without restarting the server
- **FR-007**: All API responses MUST be JSON with `Content-Type: application/json`
- **FR-008**: Error responses MUST use `{"error": "message"}` format with appropriate HTTP status codes
- **FR-009**: The metrics endpoint MUST return `501` — it is a stub for phase 2 (Prometheus integration)
- **FR-010**: The server MUST NOT perform any mutating operations on the cluster

### Key Entities

- **ClientFactory**: Holds the dynamic client + discovery client for the active context. Thread-safe. Supports `SwitchContext()`.
- **Handler**: Thin HTTP handler that calls the k8s layer and marshals JSON responses.
- **REST endpoint set**: `/api/v1/contexts`, `/api/v1/rgds`, `/api/v1/instances`, `/api/v1/resources`, `/healthz`

## Success Criteria

### Measurable Outcomes

- **SC-001**: `GET /api/v1/healthz` returns `200` within 10ms (no cluster call)
- **SC-002**: `GET /api/v1/rgds` returns the correct list within 2 seconds on a reachable cluster
- **SC-003**: `GET /api/v1/rgds/:name/instances` correctly resolves irregular plurals (e.g., `Hero` → `heroes`) via discovery
- **SC-004**: Context switch via `POST /api/v1/contexts/switch` takes effect for the next request with no server restart
- **SC-005**: Binary size is under 30MB including embedded frontend assets
