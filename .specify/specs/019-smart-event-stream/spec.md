# Feature Specification: Smart Event Stream

**Feature Branch**: `019-smart-event-stream`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `001c-instance-api` (merged)
**Constitution ref**: §II (Cluster Adaptability — dynamic client), §III (Read-Only),
§V (Simplicity — polling not WebSocket), §IX (Theme)

---

## Context

Kubernetes Events are the primary debugging primitive, but they're noisy. A
namespace with 200 kro instances generates thousands of events. The smart event
stream filters to kro-relevant events, groups them by instance/RGD/resource,
and highlights anomalies.

All data comes from the Kubernetes Events API. No kro controller logs or
metrics endpoint required.

---

## User Scenarios & Testing

### User Story 1 — SRE sees live kro events filtered from noise (Priority: P1)

An "Events" page shows a live stream of Kubernetes Events relevant to kro:
events on RGDs and on kro-managed instance CRs. The stream polls every 5
seconds and prepends new events at the top.

**Why this priority**: When something breaks, events are the first thing an SRE
checks. Filtering out non-kro noise saves critical time during incidents.

**Independent Test**: With a kro instance that's actively reconciling, open the
Events page. Confirm: only events related to kro resources appear; non-kro
events (e.g., kube-system pod events) are excluded.

**Acceptance Scenarios**:

1. **Given** a namespace with kro instances and other workloads, **When** the
   Events page loads, **Then** only events whose `involvedObject.uid` matches
   a known RGD UID or kro instance CR UID are shown
2. **Given** new events arrive, **When** the 5s poll fires, **Then** new events
   are prepended at the top; existing events are NOT duplicated
3. **Given** a Warning event, **When** rendered, **Then** the row has an amber
   left border; Normal events have a subtle gray border
4. **Given** 500+ events, **When** rendered, **Then** only the most recent 200
   are shown with a "Load more" button at the bottom
5. **Given** no kro events exist, **When** rendered, **Then** an empty state
   shows "No kro-related events found"

---

### User Story 2 — SRE groups events by instance (Priority: P1)

A grouping toggle lets the SRE switch between "Stream" (chronological) and
"By Instance" (events grouped under their parent instance, collapsible).

**Acceptance Scenarios**:

1. **Given** events from 3 different instances, **When** grouped by instance,
   **Then** 3 collapsible sections appear, each with the instance name as header
   and its events inside (newest first)
2. **Given** an instance with 10 Warning events in the last 5 minutes, **When**
   grouped, **Then** the section header shows a red badge with the warning count
3. **Given** the user expands instance A's section, **When** a new event for
   instance A arrives on poll, **Then** the section stays expanded and the new
   event is prepended

---

### User Story 3 — SRE spots anomalies at a glance (Priority: P2)

The event stream highlights anomalous patterns: repeated requeue events (same
reason occurring > 5 times in 10 minutes), stuck reconciliation (Progressing
events without a terminal Ready event), and error bursts (> 10 Warning events
in 1 minute for the same instance).

**Acceptance Scenarios**:

1. **Given** an instance with 6 "Reconciling" events in the last 10 minutes
   and no "Ready" event, **When** rendered, **Then** a banner appears:
   "Instance X appears stuck — reconciling for 10+ minutes without completing"
2. **Given** 12 Warning events for instance Y in the last 60 seconds, **When**
   rendered, **Then** a banner appears: "Error burst detected on instance Y —
   12 warnings in the last minute"
3. **Given** no anomalies detected, **When** rendered, **Then** no banners appear

---

### Edge Cases

- Events API returns events from previous resource incarnations (same name,
  different UID) → filter by `involvedObject.uid` to avoid stale events
- Child resource event attribution: events on child resources created by kro
  are NOT included in the stream. Only events directly on RGDs and instance
  CRs are shown. This is intentional — owner-reference chain traversal requires
  O(n) serial API calls across all resource types and causes 75s+ response times
  on large clusters (see: https://github.com/pnz1990/kro-ui/issues/57). If child
  resource events are needed in future, implement with a cached discovery layer
  and parallel bounded-timeout list calls per constitution §XI.
- Events page opened with `?instance=X` query param → pre-filter to that instance
- Events page opened with `?rgd=Y` query param → pre-filter to instances of that RGD

---

## Requirements

### Functional Requirements

- **FR-001**: Events page MUST fetch Kubernetes Events filtered by namespace
  and kro-relevant `involvedObject` UIDs
- **FR-002**: kro-relevance MUST be determined by UID matching: event is on an
  RGD (UID in RGD list) or event is on a kro instance CR (UID in instance list).
  Child resource owner-reference chain traversal is intentionally excluded —
  it requires O(n) serial `ServerGroupsAndResources` + per-type `List` calls
  across all API resource types (200+ on EKS), causing 75s+ response times.
  See constitution §XI and issue #57.
- **FR-003**: Events MUST be de-duplicated by `metadata.uid` across poll cycles
- **FR-004**: Grouping toggle MUST support: "Stream" (chronological) and
  "By Instance" (grouped/collapsible)
- **FR-005**: Anomaly detection MUST be computed client-side from the event list:
  - Stuck reconciliation: > 5 Progressing events in 10 minutes without Ready
  - Error burst: > 10 Warning events in 1 minute for same instance
- **FR-006**: Page MUST poll every 5 seconds using `usePolling` hook
- **FR-007**: Page MUST support URL params `?instance=X` and `?rgd=Y` for
  pre-filtering, AND MUST provide visible input controls (text input for instance,
  dropdown or text input for RGD) that update these URL params on change — URL
  params alone without input fields is not acceptable (see constitution §XIII,
  issue #66)
- **FR-008**: A new backend endpoint MUST be added:
  `GET /api/v1/events?namespace=X&rgd=Y` — returns kro-filtered events

### Non-Functional Requirements

- **NFR-001**: Event stream renders within 1s for up to 200 events
- **NFR-002**: Poll cycle adds new events without visible flicker
- **NFR-003**: TypeScript strict mode MUST pass

### Key Components

- **`Events`** (`web/src/pages/Events.tsx`): events page with stream and grouped
  views
- **`EventRow`** (`web/src/components/EventRow.tsx`): single event with type
  indicator, timestamp, reason, message, and source
- **`EventGroup`** (`web/src/components/EventGroup.tsx`): collapsible instance
  group with warning count badge
- **`AnomalyBanner`** (`web/src/components/AnomalyBanner.tsx`): alert banner for
  detected anomalies
- **`detectAnomalies`** (`web/src/lib/events.ts`): pure function that scans the
  event list for anomalous patterns
- **Backend**: `internal/api/handlers/events.go` — event listing with kro
  filtering

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/events.test.ts
describe("detectAnomalies", () => {
  it("detects stuck reconciliation (5+ Progressing without Ready)", () => { ... })
  it("detects error burst (10+ Warnings in 1 minute)", () => { ... })
  it("returns no anomalies for healthy event stream", () => { ... })
})

// web/src/pages/Events.test.tsx
describe("Events", () => {
  it("filters to kro-relevant events only", () => { ... })
  it("de-duplicates events across polls", () => { ... })
  it("groups events by instance when toggled", () => { ... })
  it("pre-filters by ?instance= query param", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Only kro-relevant events are shown (non-kro noise excluded)
- **SC-002**: Events update on 5s poll without duplicates
- **SC-003**: Grouping by instance works with correct event attribution
- **SC-004**: Anomaly detection identifies stuck reconciliation and error bursts
- **SC-005**: TypeScript strict mode passes with 0 errors
