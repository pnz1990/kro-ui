# Feature Specification: Instance Detail — Live View

**Feature Branch**: `005-instance-detail-live`
**Created**: 2026-03-20
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — User watches a live instance reconcile in real time (Priority: P1)

On the instance detail page, the user sees the RGD's resource dependency DAG with each node colored by its live state (alive/reconciling/pending/error/not-found). The view auto-refreshes every 5 seconds. A "reconciling" banner appears when kro is actively reconciling the instance.

**Why this priority**: Real-time observability of reconciliation is the core value proposition of the live view.

**Independent Test**: Open `/rgds/dungeon-graph/instances/default/asdasda`. Confirm the DAG shows with live state colors and the "refreshed Xs ago" counter updates every 5s.

**Acceptance Scenarios**:

1. **Given** a live instance, **When** the page loads, **Then** the DAG renders with each node showing its live state (green=alive, amber=reconciling, gray=unknown, red=error, dashed=not-found)
2. **Given** the instance is actively reconciling, **When** the page is open, **Then** a "kro is reconciling this instance" banner appears with a pulsing animation on reconciling nodes
3. **Given** 5 seconds have passed, **When** the watcher fires, **Then** node states update without the DAG re-layouting (positions stay stable, only colors change)
4. **Given** the page is open for 60 seconds, **When** the watcher has fired 12 times, **Then** the "refreshed Xs ago" counter shows the last refresh time and the memory footprint has not grown

---

### User Story 2 — User clicks a node to inspect its live YAML (Priority: P1)

Clicking any resource node in the live DAG opens a side panel with the node's metadata (kind, live state, concept explanation) and the live YAML fetched from the cluster. The panel stays open through watcher refreshes.

**Why this priority**: YAML inspection is the primary debugging action in the live view.

**Independent Test**: Click `bossCR` node → panel opens with "Kind: Boss", live state, and the full Boss YAML from the cluster (`kubectl get Boss asdasda-boss -n asdasda`).

**Acceptance Scenarios**:

1. **Given** a resource node (e.g., `bossCR`), **When** clicked, **Then** the panel opens with kind, state badge, and "⟳ fetching from cluster…" placeholder
2. **Given** the YAML fetch completes, **When** it arrives, **Then** the placeholder is replaced with the syntax-highlighted YAML and the kubectl command used
3. **Given** the resource does not exist in the cluster yet, **When** the YAML fetch completes, **Then** "Resource not found in cluster." is shown with the kubectl command
4. **Given** the panel is open and the watcher fires, **When** node states update, **Then** the panel stays open and the state badge updates without closing the panel
5. **Given** forEach node (multiple instances), **When** clicked, **Then** the panel shows metadata but a note "forEach node — multiple instances. Use deep view to inspect individual resources."

---

### User Story 3 — User views the instance spec, conditions, and events (Priority: P2)

Below the DAG, the instance detail page shows three sections: the current spec (key-value pairs from the CR's `spec` field), the status conditions, and Kubernetes events for the instance.

**Why this priority**: Spec + conditions + events complete the observability picture without navigating away.

**Independent Test**: Below the DAG of `asdasda`, confirm the spec section shows `difficulty: normal`, `heroClass: warrior`. Confirm the conditions section shows `Ready=True`. Confirm the events section shows "No events" or real events.

**Acceptance Scenarios**:

1. **Given** a live instance, **When** the page loads, **Then** the spec section iterates all `spec` fields and displays them as key-value pairs
2. **Given** a live instance with `status.conditions`, **When** rendered, **Then** each condition is shown with its type, status, reason, and message
3. **Given** a live instance with Kubernetes events, **When** rendered, **Then** events are listed newest-first with timestamp, reason, and message
4. **Given** no Kubernetes events exist, **When** rendered, **Then** "No events" is shown (not an empty broken section)

---

### Edge Cases

- What if the watcher stops (WS disconnect / poll failure)? → Show "Refresh paused" warning; retry automatically after 10s.
- What if the instance is deleted while the page is open? → Show "Instance not found — it may have been deleted" and stop polling.
- What if a node's YAML fetch is slow? → Show spinner for up to 15s then show "Timed out" with a "Retry" button.
- What if the instance has 50+ child resources? → All resources still shown in DAG; no pagination — the DAG scrolls.

## Requirements

### Functional Requirements

- **FR-001**: Page MUST fetch instance detail from `GET /api/v1/instances/:ns/:name?rgd=:rgdName` on mount
- **FR-002**: Page MUST poll every 5 seconds using the same endpoint; node states update without re-layouting the DAG
- **FR-003**: A "reconciling" banner MUST appear when the instance's `Progressing=True` condition is detected
- **FR-004**: Node state coloring MUST match: alive=green, reconciling=amber pulse, pending=indigo, error=red, not-found=dashed/gray, unknown=gray
- **FR-005**: Clicking a resource node MUST open the detail panel and trigger a YAML fetch from `GET /api/v1/resources/:ns/:group/:version/:kind/:name`
- **FR-006**: The detail panel MUST survive watcher refreshes — it MUST NOT close or reset when node states update
- **FR-007**: The spec, conditions, and events sections MUST be shown below the DAG and auto-update on each poll
- **FR-008**: Resource name inference MUST strip `CR`/`CRs` suffix from node labels to build the correct resource name (e.g., `bossCR` → `asdasda-boss`)
- **FR-009**: Child resources MUST be fetched from `GET /api/v1/instances/:ns/:name/children` and used to match node labels to actual resource names (priority over inference)

### Key Entities

- **InstanceDetail page**: DAG (top) + detail panel (right) + spec/conditions/events (bottom)
- **LiveDAG**: the DAGGraph component with live state overlays and polling
- **NodeDetailPanel**: metadata + live YAML, survives refreshes
- **SpecPanel**: dynamic key-value from `spec.*`
- **ConditionsPanel**: conditions list
- **EventsPanel**: events list

## Success Criteria

- **SC-001**: Live DAG renders with correct node colors on first load within 2 seconds
- **SC-002**: Node states update every 5s without any visible layout shift or panel close
- **SC-003**: YAML for `bossCR` (kind: Boss) correctly fetches `asdasda-boss` not `asdasda-bossCR`
- **SC-004**: Page memory usage does not grow over 10 minutes of polling (no watcher leak)
- **SC-005**: Detail panel state badge updates on refresh without the panel closing
