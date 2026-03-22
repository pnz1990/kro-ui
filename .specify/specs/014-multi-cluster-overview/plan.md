# Implementation Plan: Multi-Cluster Overview

**Spec**: `014-multi-cluster-overview`
**Status**: In Progress

---

## Tech Stack

- **Backend**: Go 1.25, `k8s.io/client-go/dynamic`, `k8s.io/client-go/discovery`,
  `golang.org/x/sync/errgroup` (already available via transitive deps — use stdlib
  `sync.WaitGroup` instead to avoid adding a dependency)
- **Frontend**: React 19, TypeScript strict, plain CSS via `tokens.css`
- **Routing**: chi (backend), React Router v7 (frontend)

---

## Architecture

### Backend

A new `GET /api/v1/fleet/summary` endpoint aggregates per-context summaries.

**How it works**:

1. Call `ClientFactory.ListContexts()` to enumerate all kubeconfig contexts.
2. For each context, build a throwaway per-context client using `clientcmd` (not switching
   the shared `ClientFactory` — that would affect concurrent users).
3. In parallel (goroutines + `sync.WaitGroup`), for each context:
   - List RGDs via the dynamic client with a 10s timeout.
   - For each RGD, count instances and check health (presence of `Ready=False` condition).
   - Determine health status: `healthy`, `degraded`, `unreachable`, `kro-not-installed`, or `auth-failed`.
4. Return all summaries — failures are isolated per-context via error capture; they
   never block other contexts.

**Health determination**:
- `unreachable`: dial error / connection refused
- `auth-failed`: 401/403 from the API server
- `kro-not-installed`: RGD CRD not found (discovery returns not-found or empty)
- `degraded`: at least one instance has `Ready=False` condition
- `healthy`: all reachable, kro installed, no degraded instances

**New files**:
- `internal/api/handlers/fleet.go` — `FleetSummary` handler
- `internal/api/handlers/fleet_test.go` — table-driven unit tests
- `internal/k8s/fleet.go` — `BuildContextClient()` helper (builds per-context dynamic+discovery)

**Modified files**:
- `internal/api/types/response.go` — add `FleetSummaryResponse`, `ClusterSummary`
- `internal/server/server.go` — register `GET /api/v1/fleet/summary`

### Frontend

**New files**:
- `web/src/pages/Fleet.tsx` + `Fleet.css` — Fleet overview page
- `web/src/components/ClusterCard.tsx` + `ClusterCard.css` — per-context summary card
- `web/src/components/ClusterCard.test.tsx` — unit tests (health states + click)
- `web/src/components/FleetMatrix.tsx` + `FleetMatrix.css` — RGD cross-cluster matrix

**Modified files**:
- `web/src/lib/api.ts` — add `getFleetSummary()`, `ClusterSummary`, `FleetSummaryResponse`
- `web/src/main.tsx` — add `/fleet` route
- `web/src/components/TopBar.tsx` + `TopBar.css` — add Fleet nav link

---

## API Contract

### GET /api/v1/fleet/summary

**Response** (200 OK):

```json
{
  "clusters": [
    {
      "context": "prod",
      "cluster": "prod-cluster",
      "health": "healthy",
      "rgdCount": 5,
      "instanceCount": 12,
      "degradedInstances": 0,
      "kroVersion": "v0.3.1",
      "error": ""
    },
    {
      "context": "staging",
      "cluster": "staging-cluster",
      "health": "degraded",
      "rgdCount": 3,
      "instanceCount": 7,
      "degradedInstances": 2,
      "kroVersion": "v0.3.0",
      "error": ""
    },
    {
      "context": "dev",
      "cluster": "dev-cluster",
      "health": "unreachable",
      "rgdCount": 0,
      "instanceCount": 0,
      "degradedInstances": 0,
      "kroVersion": "",
      "error": "connection refused"
    }
  ]
}
```

**Health values**: `healthy` | `degraded` | `unreachable` | `kro-not-installed` | `auth-failed`

---

## File Structure (changes only)

```
internal/
  api/
    handlers/
      fleet.go              NEW — FleetSummary handler
      fleet_test.go         NEW — unit tests
    types/
      response.go           MODIFIED — add fleet types
  k8s/
    fleet.go                NEW — BuildContextClient helper
  server/
    server.go               MODIFIED — register route
web/
  src/
    lib/
      api.ts                MODIFIED — add fleet API
    pages/
      Fleet.tsx             NEW
      Fleet.css             NEW
    components/
      ClusterCard.tsx       NEW
      ClusterCard.css       NEW
      ClusterCard.test.tsx  NEW
      FleetMatrix.tsx       NEW
      FleetMatrix.css       NEW
    main.tsx                MODIFIED — add route
    components/
      TopBar.tsx            MODIFIED — add Fleet nav link
```

---

## Constraints

- 10s timeout per cluster API call (NFR-003)
- `Promise.allSettled` Go equivalent: goroutines with per-context error capture (FR-003)
- All styles via `tokens.css` custom properties only (FR-006)
- No new Go dependencies — use stdlib `context`, `sync`, `time`
- TypeScript strict mode must pass (NFR-002)
- Read-only — no mutating Kubernetes calls (Constitution §III)
