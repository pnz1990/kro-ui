# Feature Specification: Instance Detail — Live View

**Feature Branch**: `005-instance-detail-live`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `004-instance-list` (merged)
**Constitution ref**: §II (dynamic client, adaptability), §III (read-only),
§V (polling not WebSocket), §VI (error handling, logging), §VII (testing)

---

## User Scenarios & Testing

### User Story 1 — Operator watches live reconciliation state (Priority: P1)

On the instance detail page, the operator sees the resource dependency DAG with
each node colored by its live state. The view polls the API every 5 seconds.
A reconciling banner appears when kro is actively reconciling.

**Why this priority**: Real-time reconciliation observability is the core value
proposition of this tool. Without live state coloring the DAG is inert.

**Independent Test**: Open `/rgds/dungeon-graph/instances/default/asdasda`.
Confirm: DAG renders with colored nodes; a "refreshed Xs ago" counter updates
every 5 seconds; no layout shift occurs between refreshes.

**Acceptance Scenarios**:

1. **Given** a live instance where all resources are ready, **When** the page
   loads, **Then** all resource nodes appear green (`--color-alive`); the root
   CR node is also green
2. **Given** kro is actively reconciling the instance
   (`status.conditions Progressing=True`), **When** the page is open, **Then**
   a banner "kro is reconciling this instance" appears; reconciling nodes pulse
   with an amber animation (`--color-reconciling`)
3. **Given** a resource that has not been created yet (`includeWhen=false`),
   **When** rendered, **Then** the node is shown with a dashed border and
   `--color-unknown` fill (`not-found` state)
4. **Given** 5 seconds have elapsed, **When** the poll fires and new data
   arrives, **Then** node state colors update without any change to node
   positions (no re-layout)
5. **Given** the page is open for 10 minutes (120 poll cycles), **When**
   observed, **Then** the browser memory footprint has not measurably grown
   (no watcher leak, no accumulating DOM nodes)

---

### User Story 2 — Operator inspects live YAML of a resource node (Priority: P1)

Clicking a resource node opens a side panel with the node's kind, live state
badge, kro concept explanation, and the live YAML fetched from the cluster. The
panel stays open through poll refreshes.

**Why this priority**: YAML inspection is the primary debugging action in the
live view. Operators need to see the actual resource state from the cluster, not
just a color.

**Independent Test**: Click the `bossCR` node. Panel opens with "Kind: Boss".
YAML section shows "⟳ fetching…" then is replaced by the actual Boss YAML
matching `kubectl get Boss asdasda-boss -n asdasda -o yaml`. After the next poll
fires (5s), the panel remains open and the state badge updates.

**Acceptance Scenarios**:

1. **Given** a resource node `bossCR` (kind: Boss), **When** clicked, **Then**
   the panel opens immediately (no API call needed for metadata) with kind,
   state badge, and "⟳ fetching from cluster…" placeholder in the YAML section
2. **Given** the YAML fetch completes, **When** the response arrives, **Then**
   the placeholder is replaced by the syntax-highlighted YAML and the kubectl
   command used (e.g., `kubectl get Boss asdasda-boss -n asdasda -o yaml`)
3. **Given** the resource does not exist in the cluster, **When** the YAML
   fetch completes, **Then** "Resource not found in cluster." is shown with the
   kubectl command — not a crash, not an empty panel
4. **Given** the panel is open and the 5s poll fires, **When** node states
   update, **Then** the panel remains open; the state badge updates to reflect
   the new state; the YAML is NOT re-fetched automatically (stale YAML is
   acceptable until the user explicitly re-opens the node)
5. **Given** a `forEach` fan-out node, **When** clicked, **Then** the panel
   shows node metadata and a note:
   "forEach node — multiple resources exist. Use Deep View to inspect each one."
   — no YAML fetch attempted

---

### User Story 3 — Operator reads spec, conditions, and events below the DAG (Priority: P2)

Below the DAG, the instance detail page shows three collapsible sections: the
current spec (live `spec.*` key-value pairs), the status conditions, and
Kubernetes events for the instance. All three update on every poll cycle.

**Why this priority**: Spec + conditions + events complete the observability
picture. They are also what a kro operator checks when an RGD reconciliation
fails.

**Independent Test**: Below the `asdasda` DAG: spec section shows
`difficulty: normal`, `heroClass: warrior`. Conditions section shows
`Ready=True` with last transition time. Events section shows "No events" or
real events with timestamps.

**Acceptance Scenarios**:

1. **Given** a live instance, **When** the page loads, **Then** the spec section
   iterates all `spec.*` fields dynamically — no hardcoded field list
2. **Given** a live instance with `status.conditions`, **When** rendered, **Then**
   each condition shows type, status, reason, message, and last transition time
3. **Given** Kubernetes events exist for the instance, **When** rendered, **Then**
   events are listed newest-first with timestamp, reason, and message
4. **Given** no events exist, **When** rendered, **Then** "No events" is shown —
   not a blank section, not an error

---

### User Story 4 — Resource name is correctly inferred from node label (Priority: P1)

The node inspection correctly maps node labels (e.g., `bossCR`) to actual
cluster resource names (e.g., `asdasda-boss`) using the child resources list
from the API before falling back to label-based inference.

**Why this priority**: Without correct name resolution the YAML fetch always
returns "Resource not found". This was a concrete bug observed in open-krode.

**Acceptance Scenarios**:

1. **Given** child resources returned by
   `GET /api/v1/instances/default/asdasda/children` include
   `{kind: "Boss", name: "asdasda-boss", namespace: "asdasda"}`, **When** the
   `bossCR` node is clicked, **Then** the YAML is fetched for
   `Boss/asdasda/asdasda-boss` — not `Boss/asdasda/asdasda-bossCR`
2. **Given** a resource NOT in the children list (e.g., not yet created),
   **When** the node is clicked, **Then** the name is inferred by stripping the
   `CR`/`CRs` suffix from the node label and prepending the instance name:
   `asdasda-boss` (label `bossCR` → strip `CR` → `boss` → `asdasda-boss`)
3. **Given** an inferred name returns "not found" from the API, **When**
   displayed, **Then** the panel shows "Resource not found in cluster." with the
   `kubectl get` command used — the operator can copy-paste to debug

---

### Edge Cases

- Poll failure (network error) → show "Refresh paused — retrying in 10s" in the
  top bar; retry automatically; do NOT close or reset the panel
- Instance deleted while page is open → next poll returns 404; show
  "Instance not found — it may have been deleted" and stop polling
- YAML fetch takes > 15s → show "Fetch timed out" with a "Retry" button in the
  YAML section; do NOT block the panel
- Instance has 50+ child resources → all shown in DAG; DAG scrolls horizontally
- `Progressing` condition absent from status → treat as `not reconciling` (no
  banner); never crash on absent conditions

---

## Requirements

### Functional Requirements

- **FR-001**: Page MUST fetch these endpoints in parallel on mount:
  1. `GET /api/v1/instances/:ns/:name?rgd=:rgdName` — instance detail
  2. `GET /api/v1/instances/:ns/:name/events?rgd=:rgdName` — events
  3. `GET /api/v1/instances/:ns/:name/children?rgd=:rgdName` — child resources
  4. `GET /api/v1/rgds/:rgdName` — RGD spec (for DAG structure)
- **FR-002**: Page MUST re-poll endpoints (1), (2), and (3) every 5 seconds
  using the `usePolling` hook; endpoint (4) is fetched once only (RGD spec is
  static between deployments)
- **FR-003**: Reconciling banner MUST appear when the instance has a condition
  with `type=Progressing` and `status=True`
- **FR-004**: Node state mapping:

  | Cluster state | Node color |
  |---------------|-----------|
  | Resource exists and `Ready=True` | `--color-alive` (green) |
  | kro is actively reconciling | `--color-reconciling` (amber, pulsing) |
  | Resource not yet created / `includeWhen=false` | dashed, `--color-unknown` |
  | `Ready=False` | `--color-error` (red) |
  | Not in children list, status unknown | `--color-unknown` (gray) |

- **FR-005**: Node color updates MUST NOT cause a DAG re-layout — positions
  are computed once from the RGD spec and are stable
- **FR-006**: Clicking a resource node MUST open `NodeDetailPanel` and trigger
  a YAML fetch from
  `GET /api/v1/resources/:ns/:group/:version/:kind/:name`
- **FR-007**: Resource name resolution MUST first check the children list
  (canonical), then fall back to label-based inference (strip `CR`/`CRs`,
  prepend instance name)
- **FR-008**: `NodeDetailPanel` MUST survive poll refreshes — it MUST NOT close
  or re-mount when node states update
- **FR-009**: Spec, conditions, and events sections MUST update on every
  successful poll cycle
- **FR-010**: `forEach` node clicks MUST NOT trigger a YAML fetch — show the
  guidance note instead

### Non-Functional Requirements

- **NFR-001**: Initial page load (all 4 parallel fetches) MUST complete within
  3s on a normally-loaded cluster
- **NFR-002**: Poll cycle (update node states + spec + events) MUST complete
  in under 2s and MUST NOT cause any visible layout shift
- **NFR-003**: After 100 poll cycles, browser memory MUST NOT have grown by
  more than 5MB (verified by browser DevTools memory snapshot — not automated)
- **NFR-004**: YAML fetch timeout MUST be 15s; on timeout, show error in panel
  without affecting the poll cycle

### Key Components

- **`InstanceDetail`** (`web/src/pages/InstanceDetail.tsx`): page component,
  orchestrates all fetches and polling
- **`LiveDAG`** (`web/src/components/LiveDAG.tsx`): wraps `DAGGraph` with live
  state overlay and onClick handler
- **`NodeDetailPanel`** (`web/src/components/NodeDetailPanel.tsx`): slide-in
  panel; shared with spec 003; extended with live state badge and YAML section
- **`SpecPanel`** (`web/src/components/SpecPanel.tsx`): dynamic key-value
  rendering of `spec.*` fields — no hardcoded field list
- **`ConditionsPanel`** (`web/src/components/ConditionsPanel.tsx`): table of
  conditions with type, status, reason, message, last transition time
- **`EventsPanel`** (`web/src/components/EventsPanel.tsx`): event list,
  newest-first
- **`usePolling`** (`web/src/hooks/usePolling.ts`): generic interval-based hook;
  `intervalMs=5000`, stops on unmount, pauses on error and retries after 10s

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/hooks/usePolling.test.ts
describe("usePolling", () => {
  it("calls fetcher on mount", () => { ... })
  it("calls fetcher again after intervalMs", () => { ... })
  it("stops polling on unmount", () => { ... })
  it("sets error state on fetch failure", () => { ... })
})

// web/src/lib/instanceNodeState.test.ts
// Tests for the function that maps child resources + conditions → node state map
describe("buildNodeStateMap", () => {
  it("returns alive when Ready=True", () => { ... })
  it("returns reconciling when Progressing=True", () => { ... })
  it("returns not-found when resource absent from children", () => { ... })
  it("returns error when Ready=False", () => { ... })
})

// web/src/lib/resolveResourceName.test.ts
describe("resolveResourceName", () => {
  it("returns name from children list when present", () => { ... })
  it("infers name by stripping CR suffix when not in children", () => { ... })
  it("infers name by stripping CRs suffix", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Live DAG renders with correct node colors on first load within 3s
- **SC-002**: Node states update every 5s with no visible layout shift or panel
  close — verified manually and by `usePolling` unit tests
- **SC-003**: `bossCR` node click fetches `asdasda-boss` not `asdasda-bossCR`
  — verified by `resolveResourceName` unit tests
- **SC-004**: `usePolling` stops on component unmount — verified by unit test
  with fake timers
- **SC-005**: TypeScript strict mode passes with 0 errors
- **SC-006**: All unit tests pass with `vitest run`
