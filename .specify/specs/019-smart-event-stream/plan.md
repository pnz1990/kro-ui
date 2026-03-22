# Implementation Plan: Smart Event Stream (019)

**Branch**: `019-smart-event-stream`
**Spec**: `spec.md` in this directory
**Created**: 2026-03-21

---

## Tech Stack

- **Backend**: Go 1.25, chi router, zerolog, `k8s.io/client-go/dynamic`
- **Frontend**: React 19, TypeScript (strict), Vite, plain CSS with `tokens.css` custom properties
- **Testing**: Go `testing` + `testify`, Vitest + `@testing-library/react`

---

## Architecture

### Backend

New handler file: `internal/api/handlers/events.go`

The `GET /api/v1/events` endpoint:
- Accepts `?namespace=X` and `?rgd=Y` query params
- Lists Kubernetes Events (core/v1) using the dynamic client
- Filters by kro-relevance: events whose `involvedObject.kind` is one of:
  - A known kro RGD kind (resolved via discovery)
  - A resource with owner references tracing back to a kro instance
- Uses `involvedObject.uid` to ensure correct event attribution
- Returns `K8sList` (same schema as other list responses)

**Why namespace-scoped**: Events are namespace-scoped in Kubernetes. Cross-namespace listing requires ClusterRole `list events`. We scope to the provided namespace; if empty, we list across all namespaces (if RBAC allows).

**kro-relevance filter strategy** (client-side in handler — no extra round trips):
1. List all events in the namespace
2. List all kro instances in that namespace (via `h.factory` dynamic client, label selector `kro.run/resource-graph-definition=Y` if rgd param present)
3. Build a set of UIDs: all known kro instance UIDs + all RGD UIDs
4. Keep events where `involvedObject.uid` is in the UID set

This avoids expensive per-event owner-chain traversal while still being accurate for direct kro events. Child resource events are attributed by `involvedObject.name` matching `kro.run/instance-name` label owners.

### Frontend

```
web/src/
  lib/
    events.ts           # KubeEvent type, detectAnomalies(), groupByInstance(), sortEvents()
    events.test.ts      # unit tests for detectAnomalies
  components/
    EventRow.tsx        # single event row (type border, timestamp, reason, message, source)
    EventRow.css
    EventGroup.tsx      # collapsible instance group with warning badge
    EventGroup.css
    AnomalyBanner.tsx   # alert banner for anomaly
    AnomalyBanner.css
  pages/
    Events.tsx          # main page: stream/grouped toggle, polling, URL params, anomaly banners
    Events.css
    Events.test.tsx     # unit tests
```

### API Client

Add to `web/src/lib/api.ts`:
```typescript
export const listEvents = (namespace?: string, rgd?: string) => { ... }
```

### Router

Add to `web/src/main.tsx`:
```tsx
<Route path="/events" element={<Events />} />
```

Add to `web/src/components/TopBar.tsx`:
```tsx
<NavLink to="/events">Events</NavLink>
```

---

## File Structure (new files only)

```
internal/api/handlers/events.go         # backend handler
internal/api/handlers/events_test.go    # handler unit tests
web/src/lib/events.ts                   # pure TS lib: types + detectAnomalies
web/src/lib/events.test.ts              # unit tests
web/src/components/EventRow.tsx
web/src/components/EventRow.css
web/src/components/EventGroup.tsx
web/src/components/EventGroup.css
web/src/components/AnomalyBanner.tsx
web/src/components/AnomalyBanner.css
web/src/pages/Events.tsx
web/src/pages/Events.css
web/src/pages/Events.test.tsx
```

**Modified files**:
```
internal/server/server.go               # register /events route
web/src/lib/api.ts                      # add listEvents
web/src/main.tsx                        # add /events route
web/src/components/TopBar.tsx           # add Events nav link
```

---

## Key Design Decisions

1. **Polling not streaming** (constitution §V): `usePolling` hook, 5s interval
2. **De-duplication by `metadata.uid`**: frontend merges new events into a Map keyed by uid
3. **Anomaly detection is pure client-side**: `detectAnomalies()` is a pure function on `KubeEvent[]`
4. **Grouping is view-only**: same event list, different render mode — no separate fetch
5. **URL param pre-filtering**: `?instance=X` and `?rgd=Y` set initial filter state
6. **Max 200 events**: slice to most recent 200 after merge; "Load more" button for pagination
7. **No external deps**: all new code uses existing patterns

---

## Anomaly Detection Logic

```typescript
function detectAnomalies(events: KubeEvent[]): Anomaly[] {
  const now = Date.now()
  const TEN_MIN = 10 * 60 * 1000
  const ONE_MIN = 60 * 1000
  const anomalies: Anomaly[] = []

  // Group by instance label (involvedObject.name or annotations)
  const byInstance = groupByInstance(events)

  for (const [instanceName, instanceEvents] of byInstance) {
    // Stuck reconciliation: > 5 Progressing events in 10min without Ready
    const recent10 = instanceEvents.filter(e => now - new Date(e.lastTimestamp).getTime() < TEN_MIN)
    const progressingCount = recent10.filter(e => e.reason === 'Progressing').length
    const hasReady = recent10.some(e => e.reason === 'Ready' || e.reason === 'Synced')
    if (progressingCount > 5 && !hasReady) {
      anomalies.push({ type: 'stuck', instanceName, count: progressingCount })
    }

    // Error burst: > 10 Warning events in 1 minute
    const recent1 = instanceEvents.filter(e => now - new Date(e.lastTimestamp).getTime() < ONE_MIN)
    const warningCount = recent1.filter(e => e.type === 'Warning').length
    if (warningCount > 10) {
      anomalies.push({ type: 'burst', instanceName, count: warningCount })
    }
  }

  return anomalies
}
```

---

## Testing Strategy

### Backend (`events_test.go`)

Table-driven tests using a stub `k8sClients` that returns fixture event lists.
Tests cover:
- Namespace filtering
- RGD filtering
- Empty result
- k8s client error propagation

### Frontend (`events.test.ts` + `Events.test.tsx`)

Per spec:
- `detectAnomalies`: 3 cases (stuck, burst, healthy)
- `Events` page: filtering, de-duplication, grouping, URL params
