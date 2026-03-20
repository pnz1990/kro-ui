# Feature Specification: Instance List

**Feature Branch**: `004-instance-list`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `003-rgd-detail-dag` (merged) — rendered inside the Instances tab
**Constitution ref**: §II (dynamic client), §V (Simplicity — no pagination library)

---

## User Scenarios & Testing

### User Story 1 — Operator lists all live instances of an RGD (Priority: P1)

On the Instances tab of an RGD detail page, the operator sees a table of all
live CR instances for that RGD — across all namespaces by default — with enough
information to identify which instance to inspect.

**Why this priority**: Without instance listing there is no path to the live
observability view (spec 005).

**Independent Test**: Navigate to `/rgds/dungeon-graph?tab=instances` with a
live cluster. Confirm the `asdasda` instance (namespace: `default`) appears with
its age and readiness badge.

**Acceptance Scenarios**:

1. **Given** 2 live instances of `dungeon-graph` across 2 namespaces, **When**
   the Instances tab loads with no namespace filter, **Then** both rows are
   shown with correct name, namespace, age, and readiness badge
2. **Given** an instance with `status.conditions` `Ready=True`, **When**
   rendered, **Then** a green "Ready" badge is shown
3. **Given** an instance with `status.conditions` `Ready=False`, **When**
   rendered, **Then** a red "Not Ready" badge is shown with the `reason` value
   in a tooltip
4. **Given** an instance with no conditions, **When** rendered, **Then** a gray
   "Unknown" badge is shown — never blank
5. **Given** 0 instances exist, **When** the tab loads, **Then** an empty state
   is shown: "No instances found. Create one with `kubectl apply`."
6. **Given** the API call fails, **When** the tab renders, **Then** an error
   state with a "Retry" button is shown
7. **Given** a row is clicked, **When** navigating, **Then** the browser goes
   to `/rgds/:rgdName/instances/:namespace/:name`

---

### User Story 2 — Operator filters instances by namespace (Priority: P2)

A dropdown allows the operator to scope the instance list to a specific
namespace or view all namespaces.

**Why this priority**: Production clusters have many namespaces. Without
filtering, a table with 100+ rows across namespaces is unusable.

**Independent Test**: Select `default` from the namespace dropdown. Confirm only
instances in `default` appear. Select "All Namespaces" → all instances return.

**Acceptance Scenarios**:

1. **Given** instances in 3 namespaces, **When** "All Namespaces" is selected
   (default), **Then** all instances are shown
2. **Given** instances in 3 namespaces, **When** `default` is selected, **Then**
   only `default` instances are shown; the URL updates to
   `/rgds/:name?tab=instances&namespace=default`
3. **Given** a namespace with 0 instances, **When** selected, **Then** the
   empty state is shown (not an error)
4. **Given** the user reloads with `?namespace=default` in the URL, **When**
   the page renders, **Then** the namespace filter is pre-selected to `default`

---

### Edge Cases

- Instance name longer than 63 characters → truncate with `…` and show full
  name in a `title` tooltip
- `spec.schema.kind` absent from the RGD → the API cannot resolve instances;
  show a clear error: "Cannot list instances: RGD has no spec.schema.kind"
- namespace filter options populated from the instance list returned by "all
  namespaces" call — not a separate API call
- Discovery failure on irregular plural → API falls back per spec 001 FR-005;
  UI shows results normally

---

## Requirements

### Functional Requirements

- **FR-001**: Instance list MUST fetch from `GET /api/v1/rgds/:name/instances`
  (no namespace filter) on initial load
- **FR-002**: Namespace filter MUST re-fetch from
  `GET /api/v1/rgds/:name/instances?namespace=:ns` when a namespace is selected
- **FR-003**: Namespace dropdown options MUST be derived from the namespaces
  present in the unfiltered instance list — no separate API call
- **FR-004**: Each row MUST show: name, namespace, age, readiness badge, and an
  "Open" link
- **FR-005**: "Open" link MUST navigate to
  `/rgds/:rgdName/instances/:namespace/:name`
- **FR-006**: Active namespace selection MUST be reflected in and restored from
  the `?namespace=` URL query parameter
- **FR-007**: Loading, error, and empty states MUST all be handled
- **FR-008**: Readiness badge tooltip MUST show the `reason` and `message` from
  the `Ready` condition when `Ready=False`
- **FR-009**: TypeScript strict mode must be satisfied

### Non-Functional Requirements

- **NFR-001**: Instance table renders within 1s of API response
- **NFR-002**: Namespace filter change triggers re-render in under 200ms
- **NFR-003**: No pagination library — for v0.1.0 all rows are rendered; virtual
  scrolling is out of scope

### Key Components

- **`InstanceTable`** (`web/src/components/InstanceTable.tsx`): table rendering
  name, namespace, age, readiness badge, link per row
- **`NamespaceFilter`** (`web/src/components/NamespaceFilter.tsx`): `<select>`
  element with "All Namespaces" + derived namespace options
- **`ReadinessBadge`** (`web/src/components/ReadinessBadge.tsx`): colored badge
  derived from the `Ready` condition; gray for missing conditions

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/components/ReadinessBadge.test.tsx
describe("ReadinessBadge", () => {
  it("renders green Ready badge when Ready=True", () => { ... })
  it("renders red Not Ready badge when Ready=False with reason tooltip", () => { ... })
  it("renders gray Unknown badge when conditions are absent", () => { ... })
})

// web/src/pages/RGDDetail.test.tsx (Instances tab section)
describe("Instances tab", () => {
  it("renders a row per instance item", () => { ... })
  it("shows empty state when items is empty", () => { ... })
  it("shows error state on fetch failure with retry button", () => { ... })
  it("filters by namespace when namespace param is in URL", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Instance table renders within 1s of API response
- **SC-002**: Namespace filter scopes results correctly without full page reload
- **SC-003**: Readiness badge accurately reflects `Ready` condition in all 3
  states, verified by unit tests
- **SC-004**: Active namespace is preserved in and restored from the URL
- **SC-005**: TypeScript strict mode passes with 0 errors

---

## E2E User Journey

**File**: `test/e2e/journeys/004-instance-list.spec.ts`
**Cluster pre-conditions**: kind cluster running, kro installed, `test-app` RGD
applied, `test-instance` CR applied in namespace `kro-ui-e2e`

### Journey: Operator finds and opens a live instance

```
Step 1: Navigate to Instances tab
  - Navigate to http://localhost:10174/rgds/test-app?tab=instances
  - Assert: [data-testid="tab-instances"] has aria-selected="true"
  - Assert: [data-testid="instance-table"] is visible

Step 2: Test instance appears in table
  - Assert: [data-testid="instance-row-test-instance"] is visible
  - Assert: within that row, [data-testid="instance-name"] has text
    "test-instance"
  - Assert: within that row, [data-testid="instance-namespace"] has text
    "kro-ui-e2e"
  - Assert: within that row, [data-testid="instance-age"] is visible and
    non-empty
  - Assert: within that row, [data-testid="readiness-badge"] is visible

Step 3: Namespace filter scopes results
  - Select "kro-ui-e2e" in [data-testid="namespace-filter"]
  - Assert: URL contains ?namespace=kro-ui-e2e
  - Assert: [data-testid="instance-row-test-instance"] is still visible
  - Select "kro-system" in [data-testid="namespace-filter"] (kro pods live here;
    no TestApp instances in kro-system)
  - Assert: [data-testid="instance-empty-state"] is visible
  - Assert: [data-testid="instance-row-test-instance"] is not visible

Step 4: Namespace filter persists on reload
  - Navigate to /rgds/test-app?tab=instances&namespace=kro-ui-e2e
  - Assert: [data-testid="namespace-filter"] selected value is "kro-ui-e2e"
  - Assert: [data-testid="instance-row-test-instance"] is visible

Step 5: Navigate to instance detail
  - Click [data-testid="instance-row-test-instance"] [data-testid="btn-open"]
  - Assert: URL is /rgds/test-app/instances/kro-ui-e2e/test-instance
  - Assert: [data-testid="instance-detail-page"] is visible
```

**What this journey does NOT cover** (unit tests only):
- ReadinessBadge color logic for all 3 states
- Error state on API failure
- Instance name truncation for very long names
