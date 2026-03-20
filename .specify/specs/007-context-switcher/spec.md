# Feature Specification: Context Switcher

**Feature Branch**: `007-context-switcher`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `002-rgd-list-home` (merged) — context name is shown in `TopBar`
**Constitution ref**: §II (ClientFactory must be runtime-switchable), §III
(switch is read-only — no cluster mutations), §VI (sync.RWMutex, error wrapping)

---

## User Scenarios & Testing

### User Story 1 — Operator switches between clusters without restarting the server (Priority: P1)

From the top bar context switcher, the operator selects a different kubeconfig
context. The Go server reloads its Kubernetes clients for that context. The UI
reloads the home page RGD list from the new cluster.

**Why this priority**: Multi-cluster workflows are the normal operational mode
for platform engineers. Requiring a server restart per context switch is a hard
blocker for adoption.

**Independent Test**: With two contexts in kubeconfig (`staging`, `production`),
start the server connected to `staging`. Switch to `production` via the dropdown.
Confirm: top bar updates to `production`; RGD list reloads; the new list reflects
the `production` cluster's RGDs.

**Acceptance Scenarios**:

1. **Given** a kubeconfig with 3 contexts, **When** the context switcher
   dropdown is opened, **Then** all 3 contexts are listed; the active one is
   visually marked (checkmark or bold text)
2. **Given** a valid context `production`, **When** it is selected from the
   dropdown, **Then**:
   - `POST /api/v1/contexts/switch` is called with `{"context": "production"}`
   - On success, the top bar updates to `production`
   - The home page RGD list refetches from `GET /api/v1/rgds`
3. **Given** an unreachable context is selected, **When** the switch fails,
   **Then** an error message is shown and the previous context remains active
   in both the server and the top bar
4. **Given** only 1 context exists in the kubeconfig, **When** the dropdown
   opens, **Then** the single context is shown but not selectable as a switch
   target (it is already active)

---

### User Story 2 — Active context name is always visible (Priority: P1)

The top bar always shows the active kubeconfig context name. Long EKS ARN
strings are truncated with the full value accessible via tooltip.

**Why this priority**: Without visible context, an operator can unknowingly
act on the wrong cluster. This is a safety concern that applies to every page
in the UI.

**Independent Test**: With context
`arn:aws:eks:us-west-2:319279230668:cluster/krombat`, confirm the top bar shows
a truncated form (e.g., `…/krombat`) with the full ARN in a `title` tooltip.
With context `minikube`, confirm the full name is shown untruncated.

**Acceptance Scenarios**:

1. **Given** context name `minikube` (≤40 chars), **When** displayed in the top
   bar, **Then** the full name is shown with no truncation
2. **Given** context name
   `arn:aws:eks:us-west-2:319279230668:cluster/krombat` (>40 chars), **When**
   displayed, **Then** the name is truncated to show the most identifiable
   part (e.g., the cluster name suffix after the last `/`) with the full string
   in a `title` attribute
3. **Given** context changes via the switcher, **When** displayed, **Then** the
   top bar updates immediately after the switch response

---

### Edge Cases

- `POST /api/v1/contexts/switch` takes > 10s → show loading spinner in the
  dropdown button; cancel and show error after 10s; the previous context
  remains active
- kubeconfig has 0 contexts → dropdown shows "No contexts available"
- New context's cluster is unreachable → server returns error; show toast
  "Could not connect to cluster: [error]"; top bar reverts to the previous
  context name
- Context switch requested while a poll is running on the instance detail page →
  poll in flight completes against the old context; next poll uses the new
  context (protected by `sync.RWMutex` in `ClientFactory`)

---

## Requirements

### Functional Requirements (Go backend)

- **FR-001**: `ClientFactory.SwitchContext(name string) error` MUST:
  1. Load a new `*rest.Config` for the given context name from the kubeconfig
  2. Build a new `dynamic.Interface` and `discovery.DiscoveryInterface` from
     that config
  3. Atomically replace the old clients under `sync.Mutex.Lock()` — all
     concurrent readers finish against the old clients before the swap
  4. Return a wrapped error if the context name is unknown or the new config
     fails to build: `fmt.Errorf("failed to switch to context %q: %w", name, err)`
- **FR-002**: `POST /api/v1/contexts/switch` MUST:
  - Accept `{"context": "name"}` JSON body
  - Return `400` if the body is missing or `context` is empty
  - Return `400` with a descriptive error if the context name does not exist
    in the kubeconfig
  - Return `200` with `{"active": "name"}` on success
- **FR-003**: `GET /api/v1/contexts` MUST return:
  ```json
  {
    "contexts": [
      {"name": "staging", "cluster": "staging-cluster", "user": "staging-user"},
      ...
    ],
    "active": "staging"
  }
  ```
- **FR-004**: The context switch MUST NOT restart the HTTP server, MUST NOT
  drop any in-flight requests, and MUST NOT trigger a server-side reload of any
  cached data

### Functional Requirements (Frontend)

- **FR-005**: `ContextSwitcher` dropdown MUST fetch `GET /api/v1/contexts` on
  mount and populate options from `contexts[].name`
- **FR-006**: Active context MUST be visually marked in the dropdown (checkmark
  icon or bold text); it MUST NOT be a selectable option (clicking it is a no-op)
- **FR-007**: Selecting a context MUST call `POST /api/v1/contexts/switch` and
  on success:
  1. Update the displayed context name in the top bar
  2. Invalidate and refetch `GET /api/v1/rgds` (home page data)
  3. Close the dropdown
- **FR-008**: A loading state (spinner in the button or dropdown) MUST be shown
  while the switch request is in-flight
- **FR-009**: On switch failure, a visible error message MUST be shown (inline
  in the dropdown or as a top-of-page banner); the displayed context name MUST
  NOT change
- **FR-010**: Context names longer than 40 characters MUST be truncated in the
  top bar display with the full name in a `title` attribute

### Non-Functional Requirements

- **NFR-001**: Context switch (server + UI update) MUST complete within 3s for
  a reachable cluster
- **NFR-002**: TypeScript strict mode — no `any`, no `@ts-ignore`
- **NFR-003**: Go unit test for `ClientFactory.SwitchContext` MUST cover:
  unknown context name, valid context, concurrent switch under load (race
  detector must report no races)

### Key Components

- **`ClientFactory.SwitchContext`** (`internal/k8s/client.go`): thread-safe,
  `sync.Mutex`-protected context switch
- **`Handler.SwitchContext`** (`internal/api/handlers/contexts.go`): HTTP
  handler; thin wrapper over `ClientFactory.SwitchContext`
- **`ContextSwitcher`** (`web/src/components/ContextSwitcher.tsx`): dropdown
  component in `TopBar`; manages fetch, selection, loading, and error states

---

## Testing Requirements

### Go Unit Tests (required before merge)

Following kro's table-driven `build`/`check` pattern:

```go
// internal/k8s/client_test.go
func TestClientFactory_SwitchContext(t *testing.T) {
    tests := []struct {
        name  string
        build func(*testing.T) *ClientFactory
        check func(*testing.T, error)
    }{
        {
            name: "returns error for unknown context name",
            build: func(t *testing.T) *ClientFactory { ... },
            check: func(t *testing.T, err error) {
                require.Error(t, err)
                assert.Contains(t, err.Error(), "unknown context")
            },
        },
        {
            name: "switches active context successfully",
            build: func(t *testing.T) *ClientFactory { ... },
            check: func(t *testing.T, err error) {
                require.NoError(t, err)
                assert.Equal(t, "new-context", factory.ActiveContext())
            },
        },
    }
    // Run with -race:
    // go test -race ./internal/k8s/...
}
```

### Frontend Unit Tests (required before merge)

```typescript
// web/src/components/ContextSwitcher.test.tsx
describe("ContextSwitcher", () => {
  it("renders all context names from API", () => { ... })
  it("marks the active context as selected", () => { ... })
  it("shows loading state during switch request", () => { ... })
  it("shows error message on switch failure", () => { ... })
  it("updates displayed context on successful switch", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Context switch completes (server reload + top bar update) within
  3s for a reachable cluster
- **SC-002**: After a successful switch, the RGD list reflects the new cluster's
  data — verified manually with two live clusters
- **SC-003**: EKS ARN context names are truncated in the top bar — verified by
  visual inspection
- **SC-004**: `go test -race ./internal/k8s/...` reports no data races under
  concurrent context switch + read
- **SC-005**: TypeScript strict mode passes with 0 errors
- **SC-006**: All unit tests pass (Go with `-race`, TypeScript with `vitest run`)
