# Feature Specification: RGD List — Home Page

**Feature Branch**: `002-rgd-list-home`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `001-go-api-server` (merged)
**Constitution ref**: §I (Iterative-First), §V (Simplicity), §IX (Theme)

---

## User Scenarios & Testing

### User Story 1 — Operator opens the dashboard and sees all RGDs (Priority: P1)

A kro operator opens `http://localhost:40107` and immediately sees all
ResourceGraphDefinitions in their cluster as cards. Each card shows enough
information to understand the RGD's purpose and status without kubectl.

**Why this priority**: This is the entry point of the entire UI. Nothing else is
discoverable without it.

**Independent Test**: With a running server and ≥1 RGD in the cluster, open the
browser and confirm RGD cards are visible with correct name, kind, and status.

**Acceptance Scenarios**:

1. **Given** a cluster with 3 RGDs (`web-service-graph`, `data-pipeline-graph`, `worker-pool-graph`),
   **When** the home page loads, **Then** 3 cards are rendered, each showing:
   - RGD name (`web-service-graph`)
   - Generated kind (`WebService`)
   - Resource count (number of entries in `spec.resources`)
   - Age (derived from `metadata.creationTimestamp`)
   - Status indicator (green/orange/red dot based on `Ready` condition)
2. **Given** an RGD whose `status.conditions` has `Ready=True`, **When** the
   card renders, **Then** the status dot is green (`--color-status-ready`)
3. **Given** an RGD whose `status.conditions` has `Ready=False`, **When** the
   card renders, **Then** the status dot is red (`--color-status-error`)
4. **Given** an RGD with no conditions, **When** the card renders, **Then** the
   status dot is gray (`--color-status-unknown`) — never blank, never broken
5. **Given** the `GET /api/v1/rgds` call is in-flight, **When** the page
   renders, **Then** skeleton loading cards are shown (not a spinner over
   empty content)
6. **Given** a cluster with 0 RGDs, **When** the home page loads, **Then** an
   empty state is displayed explaining that no RGDs were found and linking to
   the kro documentation
7. **Given** `GET /api/v1/rgds` returns a non-2xx status, **When** the page
   renders, **Then** an error state is displayed with the error message and a
   "Retry" button

---

### User Story 2 — Operator navigates from a card to an RGD (Priority: P1)

Every RGD card is fully clickable — clicking anywhere on the card body navigates
to the RGD's Graph tab. An explicit "Instances" action button provides direct
access to the instances list.

**Why this priority**: Card navigation is the primary UX flow. Without it the
home page is a dead end. Cards with only small text links as the sole navigation
target are a UX violation (see constitution §XIII, issue #65).

**Independent Test**: Click anywhere on the `web-service-graph` card body →
URL becomes `/rgds/web-service-graph`. Click the "Instances" button → URL
becomes `/rgds/web-service-graph?tab=instances`. Press browser Back → home
page at same scroll position.

**Acceptance Scenarios**:

1. **Given** an RGD card, **When** the card body is clicked anywhere (other
   than the "Instances" button), **Then** the browser navigates to `/rgds/:name`
   using React Router (`<Link>`, no full page reload)
2. **Given** an RGD card, **When** the "Instances" button is clicked, **Then**
   the browser navigates to `/rgds/:name?tab=instances`
3. **Given** the user navigates away and presses the browser Back button,
   **When** returning to the home page, **Then** the card grid is shown at the
   same scroll position (React Router preserves state)

---

### User Story 3 — Active cluster context is always visible (Priority: P2)

The top bar shows the active kubeconfig context name on every page. The operator
always knows which cluster they are looking at.

**Why this priority**: Without context visibility, an operator might act on
production data believing they are on staging. This is a safety concern.

**Independent Test**: The top bar shows the string matching
`kubectl config current-context` for the connected server context.

**Acceptance Scenarios**:

1. **Given** a running server connected to context
   `arn:aws:eks:us-west-2:123:cluster/my-cluster`, **When** any page loads,
   **Then** the top bar shows the context name, truncated if longer than ~40
   characters, with the full name in a `title` tooltip
2. **Given** a context name of `minikube`, **When** displayed, **Then** no
   truncation is applied

---

### Edge Cases

- `GET /api/v1/rgds` network error (DNS failure, connection refused)`database` → show
  error state with the underlying message and a "Retry" button
- RGD card with missing `spec.schema.kind``database` → show RGD name only, omit kind
  badge; do not crash
- 50+ RGDs`database` → responsive CSS grid, all cards rendered; no pagination required
  for v0.1.0
- RGD name contains special URL characters`database` → URL-encode on `<Link to>`;
  decode in the route component

---

## Requirements

### Functional Requirements

- **FR-001**: Home page MUST fetch `GET /api/v1/rgds` on mount and render one
  `RGDCard` component per item in the `items` array
- **FR-002**: Each `RGDCard` MUST display: name, kind (from
  `spec.schema.kind`), resource count (`spec.resources.length`), age, status dot
- **FR-003**: Status dot MUST be derived from `status.conditions`:
  `Ready=True``database` → green, `Ready=False``database` → red, absent/unknown`database` → gray
- **FR-004**: Each card MUST be fully clickable — the entire card body MUST be
  wrapped in a `<Link>` to `/rgds/:name`. An "Instances" `<Link>` to
  `/rgds/:name?tab=instances` MUST remain as a secondary action button.
- **FR-005**: A skeleton loading state (CSS-only, no library) MUST be shown
  while the API call is in-flight
- **FR-006**: An error state with "Retry" button MUST be shown on API failure
- **FR-007**: An empty state with a link to kro docs MUST be shown when the
  cluster has 0 RGDs
- **FR-008**: Home page MUST NOT auto-refresh — it is a static snapshot
- **FR-009**: Top bar MUST display the active context name from
  `GET /api/v1/contexts` (`.active` field)
- **FR-010**: All styles MUST use the CSS tokens defined in `tokens.css`
  (constitution §IX); no inline styles except for dynamic values

### Non-Functional Requirements

- **NFR-001**: Cards MUST render within 500ms of receiving the API response
- **NFR-002**: TypeScript strict mode MUST be satisfied — no `any`, no `@ts-ignore`
- **NFR-003**: No external component libraries (constitution §V)
- **NFR-004**: The home page MUST be usable with keyboard navigation (tab to
  card buttons, Enter to activate)

### Key Components

- **`Home`** (`web/src/pages/Home.tsx`): fetches RGD list, renders grid
- **`RGDCard`** (`web/src/components/RGDCard.tsx`): displays one RGD summary
- **`StatusDot`** (`web/src/components/StatusDot.tsx`): colored dot with
  `title` tooltip showing condition details
- **`SkeletonCard`** (`web/src/components/SkeletonCard.tsx`): CSS animation
  placeholder, same dimensions as `RGDCard`
- **`Layout`** (`web/src/components/Layout.tsx`): top bar + `<Outlet />`
- **`TopBar`** (`web/src/components/TopBar.tsx`): context name + theme toggle
  (theme toggle is display-only for v0.2.0)

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/components/StatusDot.test.tsx
describe("StatusDot", () => {
  it("renders green when Ready=True", () => { ... })
  it("renders red when Ready=False", () => { ... })
  it("renders gray when no conditions", () => { ... })
})

// web/src/pages/Home.test.tsx
describe("Home", () => {
  it("shows skeleton cards while loading", () => { ... })
  it("renders one card per RGD item", () => { ... })
  it("shows empty state when items is empty", () => { ... })
  it("shows error state and retry button on fetch failure", () => { ... })
})
```

Framework: Vitest + React Testing Library (already in Vite ecosystem).
No snapshot tests.

---

## Success Criteria

- **SC-001**: Home page renders all cards within 500ms of receiving API data
- **SC-002**: "Graph" and "Instances" links navigate in under 100ms (client-side)
- **SC-003**: Status dot correctly reflects `Ready` condition in all 3 states
  (green/red/gray) verified by unit tests
- **SC-004**: Skeleton, empty, and error states are all reachable via unit tests
  and visually distinct when observed manually
- **SC-005**: TypeScript strict mode passes — `tsc --noEmit` reports 0 errors
- **SC-006**: Keyboard navigation: Tab`database` → card buttons reachable; Enter`database` → navigates

---

## E2E User Journey

**File**: `test/e2e/journeys/002-home-page.spec.ts`
**Cluster pre-conditions**: kind cluster running, kro installed, `test-app` RGD
applied and `Ready=True`, `test-instance` CR applied

### Journey: Operator opens dashboard and navigates to an RGD

```
Step 1: Open the dashboard
  - Navigate to http://localhost:40107
  - Assert: page title contains "kro-ui"
  - Assert: top bar is visible and contains the kind cluster context name
    (data-testid="context-name")

Step 2: RGD card renders
  - Assert: element [data-testid="rgd-card-test-app"] is visible
  - Assert: within that card, [data-testid="rgd-name"] has text "test-app"
  - Assert: within that card, [data-testid="rgd-kind"] has text "TestApp"
  - Assert: within that card, [data-testid="status-dot"] has CSS class
    containing "alive" or "unknown" (Ready condition may not be True yet in
    test fixture — either is acceptable; red/error is NOT acceptable for a
    healthy test RGD)

Step 3: Navigate to RGD graph via "Graph" button
  - Click [data-testid="rgd-card-test-app"] [data-testid="btn-graph"]
  - Assert: URL is /rgds/test-app (no full reload — React Router navigation)
  - Assert: [data-testid="dag-svg"] is visible

Step 4: Navigate back and use "Instances" button
  - Click browser back button
  - Assert: URL is /
  - Assert: [data-testid="rgd-card-test-app"] is still visible (scroll position
    preserved)
  - Click [data-testid="rgd-card-test-app"] [data-testid="btn-instances"]
  - Assert: URL is /rgds/test-app?tab=instances
  - Assert: [data-testid="instance-table"] is visible
```

**What this journey does NOT cover** (unit tests only):
- Skeleton/loading/error/empty states (no network interception in E2E)
- Status dot color logic for all 3 states (covered by StatusDot unit tests)
