# Feature Specification: Instance API Endpoints

**Feature Branch**: `001c-instance-api`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `001b-rgd-api` (merged)
**Unblocks**: `004-instance-list`, `005-instance-detail-live`
**Constitution ref**: §II (dynamic client, discovery), §III (read-only), §VI (Go standards)

---

## Context

This spec adds the instance-level endpoints and the raw resource endpoint:

- `GET /api/v1/instances/{namespace}/{name}` — get a single CR instance
- `GET /api/v1/instances/{namespace}/{name}/events` — Kubernetes events
- `GET /api/v1/instances/{namespace}/{name}/children` — child resources by label
- `GET /api/v1/resources/{namespace}/{group}/{version}/{kind}/{name}` — raw resource YAML
- `GET /api/v1/metrics` — 501 stub for phase 2

All instance endpoints require `?rgd=<name>` to resolve the correct GVR.
The `/children` endpoint uses server-side discovery to find all listable resource
types that carry the `kro.run/instance-name` label — this is what makes it
future-proof when kro introduces new resource kinds.

---

## User Scenarios & Testing

### User Story 1 — API returns a single instance (Priority: P1)

`GET /api/v1/instances/{namespace}/{name}` returns the full CR object.

**Independent Test**:
```bash
curl 'http://localhost:40107/api/v1/instances/kro-ui-e2e/test-instance?rgd=test-app'
# → full TestApp CR JSON
```

**Acceptance Scenarios**:

1. **Given** a live instance `test-instance` in `kro-ui-e2e`, **When**
   `GET /api/v1/instances/kro-ui-e2e/test-instance?rgd=test-app` is called,
   **Then** the full instance object is returned with `metadata`, `spec`, `status`
2. **Given** the instance does not exist, **When** called, **Then** returns
   `404 {"error": "..."}`
3. **Given** `?rgd=` is missing, **When** called, **Then** returns
   `400 {"error": "rgd query parameter is required"}`

---

### User Story 2 — API returns Kubernetes events for an instance (Priority: P1)

`GET /api/v1/instances/{namespace}/{name}/events` returns events for the instance.

**Acceptance Scenarios**:

1. **Given** a live instance, **When** events are requested, **Then** events with
   `involvedObject.name=<instance-name>` are returned ordered newest-first
2. **Given** no events exist, **When** called, **Then** returns `{"items": []}` not
   an error

---

### User Story 3 — API returns child resources owned by an instance (Priority: P1)

`GET /api/v1/instances/{namespace}/{name}/children` discovers and returns all
resources in the namespace carrying the `kro.run/instance-name=<name>` label.

**Why this matters**: The UI uses this list to map DAG node labels to actual
resource names, avoiding the CR-suffix inference fallback.

**Acceptance Scenarios**:

1. **Given** a reconciled `test-instance`, **When** children are requested, **Then**
   the response includes the ConfigMap named `kro-ui-test-config` with kind
   `ConfigMap` and namespace `kro-ui-test`
2. **Given** kro introduces a new CRD kind in the future, **When** children are
   requested, **Then** it appears in the response without any code change — because
   discovery enumerates all API groups dynamically
3. **Given** an instance with 0 child resources, **When** called, **Then** returns
   `{"items": []}` not an error

---

### User Story 4 — API returns raw YAML for any resource (Priority: P1)

`GET /api/v1/resources/{namespace}/{group}/{version}/{kind}/{name}` returns the
full unstructured JSON of any cluster resource. Used by the node YAML inspection
panel in the live view.

**Acceptance Scenarios**:

1. **Given** a ConfigMap `kro-ui-test-config` in namespace `kro-ui-test`, **When**
   `GET /api/v1/resources/kro-ui-test//v1/ConfigMap/kro-ui-test-config` is called
   (empty group for core resources), **Then** the ConfigMap JSON is returned
2. **Given** the resource does not exist, **When** called, **Then** returns `404`
3. **Given** `GET /api/v1/metrics`, **Then** always returns
   `501 {"error": "metrics integration not yet implemented (phase 2)"}`

---

### Edge Cases

- Discovery fails for a specific API group during `/children` → skip that group
  silently, log warning with zerolog, continue with remaining groups; never return
  a partial error
- `/children` with 100+ API groups → complete within 5s; use parallel goroutines
  with `errgroup` or plain goroutines + `sync.WaitGroup`; cap concurrency at 10
- Core resources (empty group string) in the `/resources` route → handle `_` or
  empty string in the `{group}` path parameter as the core API group

---

## Requirements

### Functional Requirements

- **FR-001**: All instance endpoints MUST require `?rgd=` query parameter to
  resolve the instance GVR (reuses `resolveInstanceGVR` from spec 001b)
- **FR-002**: `GET .../events` MUST use field selector
  `involvedObject.name=<name>,involvedObject.namespace=<namespace>`
- **FR-003**: `GET .../children` MUST use server-side discovery
  (`discovery.ServerGroupsAndResources()`) to enumerate all listable resource types,
  then label-select with `kro.run/instance-name=<name>` in the given namespace
- **FR-004**: `/children` MUST skip subresources (any resource name containing `/`)
  and non-listable resources
- **FR-005**: `GET /api/v1/resources/{namespace}/{group}/{version}/{kind}/{name}`
  MUST call `discoverPlural` to resolve the correct plural; fall back to naive `+s`
  on failure; treat `_` in the `{group}` path segment as the core (empty) group
- **FR-006**: `GET /api/v1/metrics` MUST return `501 Not Implemented` always
- **FR-007**: No mutating k8s calls (constitution §III)

### Non-Functional Requirements

- **NFR-001**: `/children` completes within 5s even with 50+ API groups
- **NFR-002**: All unit tests pass with `go test -race ./internal/...`

### Key Entities

| File | Contents |
|------|----------|
| `internal/api/handlers/instances.go` | `GetInstance`, `GetInstanceEvents`, `GetInstanceChildren`, `GetResource`, `GetMetrics` |
| `internal/api/handlers/helpers.go` | `resolveInstanceGVR`, `discoverPlural`, `listChildResources`, `unstructuredString`, `isListable` |

---

## Testing Requirements

### Unit Tests (required before merge)

```go
// internal/api/handlers/instances_test.go
tests := []struct{ name string; build ...; check ... }{
    {name: "GetInstance returns 400 when rgd param missing", ...},
    {name: "GetInstance returns 404 for unknown instance", ...},
    {name: "GetInstanceEvents returns 200 with empty items when no events", ...},
    {name: "GetInstanceChildren skips subresources", ...},
    {name: "GetInstanceChildren skips non-listable resources", ...},
    {name: "GetResource treats _ group as core group", ...},
    {name: "GetMetrics always returns 501", ...},
}

// internal/api/handlers/helpers_test.go
func TestIsListable(t *testing.T) { ... }
func TestUnstructuredString(t *testing.T) { ... }
```

---

## E2E User Journey

Steps 4 of `test/e2e/journeys/001-server-health.spec.ts` covers the instance
list endpoint (from spec 001b). The instance detail, events, children, and
resource YAML endpoints are exercised in depth by journeys 004 and 005.

---

## Success Criteria

- **SC-001**: `GET /api/v1/instances/kro-ui-e2e/test-instance?rgd=test-app`
  returns the test-instance CR in the E2E kind cluster
- **SC-002**: `GET .../children` returns the `kro-ui-test-config` ConfigMap
  (created by kro during reconciliation of test-instance)
- **SC-003**: `GET /api/v1/metrics` always returns `501`
- **SC-004**: All unit tests pass with `go test -race ./internal/...`
