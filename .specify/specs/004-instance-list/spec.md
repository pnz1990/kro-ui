# Feature Specification: Instance List

**Feature Branch**: `004-instance-list`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User views all live instances of an RGD (Priority: P1)

On the RGD detail page (Instances tab), the user sees a table of all live CR instances for that RGD across all namespaces — name, namespace, age, readiness, and a link to the instance detail page.

**Why this priority**: Without instance listing there is no way to navigate to the live observability view.

**Independent Test**: On the Instances tab of `dungeon-graph`, confirm `asdasda` (namespace: `default`) appears in the list with correct age and readiness.

**Acceptance Scenarios**:

1. **Given** an RGD with 2 live instances across 2 namespaces, **When** the Instances tab loads with no namespace filter, **Then** both instances appear
2. **Given** the user selects namespace `default` in the namespace filter, **When** the list updates, **Then** only instances in `default` appear
3. **Given** an instance whose `status.conditions` includes `Ready=True`, **When** the row renders, **Then** a green badge is shown
4. **Given** an instance with no conditions, **When** the row renders, **Then** a gray "Unknown" badge is shown
5. **Given** the user clicks an instance row, **When** navigating, **Then** the browser goes to `/rgds/:rgdName/instances/:namespace/:name`

---

### User Story 2 — User filters instances by namespace (Priority: P2)

A dropdown or segmented control lets the user filter the instance list by namespace, or show all namespaces. The filter persists while navigating within the RGD detail page.

**Why this priority**: In real clusters there are many namespaces. Filtering is essential for usability at scale.

**Independent Test**: Select namespace `kro-system` from the filter dropdown. Confirm only instances in that namespace are shown.

**Acceptance Scenarios**:

1. **Given** instances in 3 namespaces, **When** "All Namespaces" is selected, **Then** all instances are shown
2. **Given** instances in 3 namespaces, **When** `default` is selected, **Then** only `default` instances are shown
3. **Given** a namespace with 0 instances, **When** that namespace is selected, **Then** an empty state is shown

---

### Edge Cases

- What if the RGD has 0 instances? → Show an empty state with the message "No instances found. Create one with `kubectl apply`."
- What if the API call fails? → Show an error state with retry.
- What if an instance name is very long? → Truncate with a tooltip showing the full name.

## Requirements

### Functional Requirements

- **FR-001**: Instance list MUST fetch from `GET /api/v1/rgds/:name/instances` (all namespaces) or `GET /api/v1/rgds/:name/instances?namespace=:ns`
- **FR-002**: Each row MUST show: instance name, namespace, age, readiness badge, "Open" link
- **FR-003**: A namespace filter dropdown MUST be provided with "All Namespaces" as the default option
- **FR-004**: The list MUST show a loading state while fetching
- **FR-005**: The list MUST show an error state with retry on failure
- **FR-006**: The list MUST show an empty state when 0 instances exist
- **FR-007**: Clicking a row or "Open" MUST navigate to the instance detail page

### Key Entities

- **InstanceTable**: table with name, namespace, age, readiness badge, link
- **NamespaceFilter**: dropdown populated from the namespaces seen in the instance list
- **ReadinessBadge**: green/red/gray based on `Ready` condition

## Success Criteria

- **SC-001**: Instance list renders within 1 second of API response
- **SC-002**: Namespace filter correctly scopes results with no full page reload
- **SC-003**: Empty, loading, and error states are all visually distinct and informative
