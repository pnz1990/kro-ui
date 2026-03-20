# Feature Specification: RGD List — Home Page

**Feature Branch**: `002-rgd-list-home`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User opens the dashboard and sees all RGDs (Priority: P1)

A kro operator opens `http://localhost:10174` and immediately sees all ResourceGraphDefinitions in their cluster displayed as cards — name, API kind, resource count, instance count, age, and readiness status.

**Why this priority**: This is the entry point of the entire UI. Without it nothing else is discoverable.

**Independent Test**: With a running server and a cluster with ≥1 RGD, open the browser and confirm RGD cards are visible with correct names and metadata.

**Acceptance Scenarios**:

1. **Given** a cluster with 3 RGDs, **When** the home page loads, **Then** 3 cards are shown, each with the RGD name, generated kind, resource count, and age
2. **Given** an RGD whose `status.conditions` includes `Ready=True`, **When** the card renders, **Then** a green status indicator is shown
3. **Given** an RGD whose `status.conditions` includes `Ready=False`, **When** the card renders, **Then** a red/orange status indicator is shown
4. **Given** a cluster with 0 RGDs, **When** the home page loads, **Then** an empty state is shown with a message explaining how to create an RGD
5. **Given** the API call is in flight, **When** the page renders, **Then** skeleton loading cards are shown

---

### User Story 2 — User navigates to an RGD detail from the home page (Priority: P1)

From the home page, the user can click a "Graph" button on an RGD card to navigate to the RGD's detail/DAG view, and an "Instances" button to go directly to that RGD's instance list.

**Why this priority**: Navigation is the core UX flow. These buttons are the primary action on every card.

**Independent Test**: Click "Graph" on a card → URL changes to `/rgds/:name`. Click "Instances" → URL changes to `/rgds/:name?tab=instances`.

**Acceptance Scenarios**:

1. **Given** the home page with RGD cards, **When** "Graph" is clicked, **Then** the browser navigates to `/rgds/:name`
2. **Given** the home page with RGD cards, **When** "Instances" is clicked, **Then** the browser navigates to `/rgds/:name?tab=instances`
3. **Given** the user presses browser back, **When** navigating back to home, **Then** the card grid is shown again at the same scroll position

---

### User Story 3 — Top bar shows active cluster context (Priority: P2)

The top bar of the UI shows the active kubeconfig context name at all times so the user always knows which cluster they are looking at.

**Why this priority**: Context visibility prevents confusion when switching between clusters.

**Independent Test**: The top bar shows the context name matching what `kubectl config current-context` returns.

**Acceptance Scenarios**:

1. **Given** a running server with context `arn:aws:eks:us-west-2:123:cluster/my-cluster`, **When** any page loads, **Then** the top bar shows the cluster context name (truncated if needed, full name in tooltip)
2. **Given** a context switch has occurred via the context switcher, **When** the home page refreshes, **Then** the top bar shows the new context name and the RGD list reloads

---

### Edge Cases

- What if the API call to `/api/v1/rgds` fails? → Show an error state with the error message and a "Retry" button.
- What if an RGD has no `spec.schema.kind`? → Show the RGD name only, omit the kind badge.
- What if there are 50+ RGDs? → Cards render in a responsive grid; no pagination needed at this stage.

## Requirements

### Functional Requirements

- **FR-001**: Home page MUST fetch `/api/v1/rgds` on mount and render one card per RGD
- **FR-002**: Each card MUST show: name, generated kind, resource count (`spec.resources` length), instance count (from `status` or 0 if unavailable), age (from `metadata.creationTimestamp`), readiness status dot
- **FR-003**: Each card MUST have a "Graph" button and an "Instances" button
- **FR-004**: The top bar MUST show the active kubeconfig context name
- **FR-005**: A skeleton loading state MUST be shown while the API call is in flight
- **FR-006**: An error state MUST be shown if the API call fails, with a "Retry" button
- **FR-007**: An empty state MUST be shown if the cluster has no RGDs
- **FR-008**: The page MUST NOT auto-refresh (home page is static; instance detail refreshes, not this)
- **FR-009**: The UI MUST use the kro.run color palette and dark theme by default

### Key Entities

- **RGDCard**: displays one RGD's summary
- **StatusDot**: green/orange/red dot based on `Ready` condition
- **TopBar**: context name, theme toggle (phase 2)

## Success Criteria

- **SC-001**: Home page renders all cards within 1 second of API response
- **SC-002**: Clicking "Graph" navigates in under 100ms (client-side routing)
- **SC-003**: Status dot correctly reflects `Ready` condition for 100% of RGDs shown in manual testing
- **SC-004**: Empty state, loading state, and error state are all visible and clearly communicate the situation
