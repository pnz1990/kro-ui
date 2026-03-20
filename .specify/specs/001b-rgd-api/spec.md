# Feature Specification: RGD API Endpoints

**Feature Branch**: `001b-rgd-api`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `001-server-core` (merged)
**Unblocks**: `002-rgd-list-home`, `003-rgd-detail-dag`
**Constitution ref**: §II (dynamic client, discovery), §III (read-only), §VI (Go standards)

---

## Context

This spec adds the three RGD-related endpoints to the running server:

- `GET /api/v1/rgds` — list all ResourceGraphDefinitions
- `GET /api/v1/rgds/{name}` — get a single RGD
- `GET /api/v1/rgds/{name}/instances` — list live CR instances of an RGD

These are the minimum endpoints required for spec 002 (home page) and spec 003 (DAG view).

All access uses the dynamic client via `ClientFactory.Dynamic()`. No typed kro clients.
The `internal/k8s/rgd.go` file is the **only** place that knows kro field paths like
`spec.schema.kind` — every other layer treats RGDs as `unstructured.Unstructured`.

---

## User Scenarios & Testing

### User Story 1 — API returns all RGDs in the cluster (Priority: P1)

`GET /api/v1/rgds` returns all ResourceGraphDefinitions as unstructured JSON.

**Independent Test**: With a running server connected to a kind cluster with the
`test-app` RGD applied:
```bash
curl http://localhost:10174/api/v1/rgds | jq '.items[].metadata.name'
# → "test-app"
```

**Acceptance Scenarios**:

1. **Given** a cluster with 2 RGDs, **When** `GET /api/v1/rgds` is called, **Then**
   it returns `{"items": [...]}` with both RGDs; each item has `metadata`, `spec`,
   and `status` fields
2. **Given** a cluster with 0 RGDs, **When** `GET /api/v1/rgds` is called, **Then**
   it returns `{"items": []}` — not an error
3. **Given** `GET /api/v1/rgds/web-service-graph`, **When** the RGD exists, **Then**
   the full RGD object is returned with `spec.schema.kind: "WebService"`
4. **Given** `GET /api/v1/rgds/does-not-exist`, **When** absent, **Then** returns
   `404 {"error": "resourcegraphdefinition \"does-not-exist\" not found"}`
5. **Given** the cluster API server is unreachable, **When** called, **Then** returns
   `503 {"error": "cluster unreachable: <wrapped error>"}`

---

### User Story 2 — API resolves and lists live instances of an RGD (Priority: P1)

`GET /api/v1/rgds/{name}/instances` resolves the generated CRD kind via server-side
discovery and returns all live CR instances.

**Independent Test**:
```bash
curl 'http://localhost:10174/api/v1/rgds/test-app/instances'
# → items array containing the test-instance CR
curl 'http://localhost:10174/api/v1/rgds/test-app/instances?namespace=kro-ui-e2e'
# → same, filtered
```

**Acceptance Scenarios**:

1. **Given** an RGD with `spec.schema.kind: TestApp`, **When**
   `GET /api/v1/rgds/test-app/instances` is called, **Then** all TestApp CRs
   across all namespaces are returned
2. **Given** `?namespace=kro-ui-e2e`, **When** called, **Then** only TestApp CRs
   in `kro-ui-e2e` are returned
3. **Given** a kind `Database` whose correct plural is `databases` (not `databases`
   from naive `+s`), **When** instances are listed, **Then**
   `discovery.ServerResourcesForGroupVersion` is called first; naive `+s` is only
   used if discovery fails
4. **Given** `spec.schema.group` is absent from the RGD, **When** resolving the
   instance GVR, **Then** it defaults to `kro.run`

---

### Edge Cases

- `spec.schema.kind` absent from the RGD → `422 {"error": "RGD has no spec.schema.kind"}`
- Discovery fails for the group/version → log warning with zerolog, fall back to
  naive `strings.ToLower(kind) + "s"`, continue (do not return an error)
- RGD exists but 0 instances of its kind → `{"items": []}` not an error

---

## Requirements

### Functional Requirements

- **FR-001**: `GET /api/v1/rgds` MUST list all RGDs using:
  `clientFactory.Dynamic().Resource(rgdGVR).List(ctx, metav1.ListOptions{})`
- **FR-002**: `GET /api/v1/rgds/{name}` MUST fetch using `.Get(ctx, name, ...)`
- **FR-003**: `GET /api/v1/rgds/{name}/instances` MUST:
  1. Fetch the RGD to extract `spec.schema.kind`, `spec.schema.group`,
     `spec.schema.apiVersion` using `unstructured.NestedString()`
  2. Call `discovery.ServerResourcesForGroupVersion(gv)` to resolve the plural
  3. Fall back to `strings.ToLower(kind) + "s"` only on discovery failure
  4. Query the dynamic client for the resolved GVR, optionally namespace-scoped
- **FR-004**: All kro field path access (`spec.schema.kind` etc.) MUST be isolated
  in `internal/k8s/rgd.go` — no other file may hardcode these paths
- **FR-005**: The `kro.run/v1alpha1` group/version MUST be the default but MUST be
  overridable by the RGD's own `spec.schema.apiVersion` field
- **FR-006**: No mutating k8s calls (constitution §III)

### Non-Functional Requirements

- **NFR-001**: `GET /api/v1/rgds` responds within 2s on a normally-loaded cluster
- **NFR-002**: `go test -race ./internal/api/handlers/...` passes
- **NFR-003**: `go vet ./...` passes

### Key Entities

| File | Contents |
|------|----------|
| `internal/api/handlers/rgds.go` | `ListRGDs`, `GetRGD`, `ListInstances` handlers |
| `internal/k8s/rgd.go` | `ExtractSchemaKind()`, `ExtractSchemaGroup()` — the ONLY kro-aware code |
| `internal/k8s/discover.go` | `DiscoverPlural(factory, group, version, kind) (string, error)` |

---

## Testing Requirements

### Unit Tests (required before merge)

```go
// internal/api/handlers/rgds_test.go
tests := []struct {
    name  string
    build func(*testing.T) (*Handler, *stubK8sClient)
    check func(*testing.T, *httptest.ResponseRecorder)
}{
    {name: "ListRGDs returns 200 with items array when RGDs exist", ...},
    {name: "ListRGDs returns 200 with empty items when no RGDs", ...},
    {name: "ListRGDs returns 503 when cluster unreachable", ...},
    {name: "GetRGD returns 200 for existing RGD", ...},
    {name: "GetRGD returns 404 for unknown RGD", ...},
    {name: "ListInstances returns 422 when spec.schema.kind absent", ...},
    {name: "ListInstances falls back to naive plural on discovery failure", ...},
    {name: "ListInstances filters by namespace when ?namespace= provided", ...},
}
```

---

## E2E User Journey

Steps 2–4 of `test/e2e/journeys/001-server-health.spec.ts` cover this spec:

- Step 2: `GET /api/v1/rgds` returns `test-app` fixture
- Step 3: `GET /api/v1/rgds/test-app` returns `spec.schema.kind === "TestApp"`
- Step 4: `GET /api/v1/rgds/test-app/instances` returns `test-instance`

---

## Success Criteria

- **SC-001**: `GET /api/v1/rgds` returns all RGDs within 2s
- **SC-002**: `GET /api/v1/rgds/test-app/instances` returns `test-instance` in
  the E2E kind cluster
- **SC-003**: Discovery is called before naive pluralization — verified by unit test
  with a stub that tracks call order
- **SC-004**: All unit tests pass with `go test -race ./internal/...`
