# Tasks: Multi-Cluster Overview

**Spec**: `014-multi-cluster-overview`
**Plan**: `plan.md`

---

## Phase 1 — Backend

### 1.1 API Types
- [x] Add `ClusterSummary` and `FleetSummaryResponse` structs to `internal/api/types/response.go`

### 1.2 k8s Fleet Helper
- [x] Create `internal/k8s/fleet.go` — `BuildContextClient(kubeconfigPath, context string)` helper
  that returns ephemeral dynamic+discovery clients for a given context (used by fleet handler;
  does NOT mutate the shared `ClientFactory`)

### 1.3 Fleet Handler (TDD — tests before implementation)
- [x] Create `internal/api/handlers/fleet_test.go` — table-driven tests:
  - All clusters reachable → all summaries returned
  - One cluster unreachable → that summary has health="unreachable", others succeed
  - No contexts configured → empty clusters array
- [x] Create `internal/api/handlers/fleet.go` — `FleetSummary` handler:
  - Lists all contexts via `contextManager`
  - Builds per-context clients via `fleetClientBuilder` interface
  - Calls in parallel (goroutines + WaitGroup + channel) with 10s timeout each
  - Determines health: healthy / degraded / unreachable / kro-not-installed / auth-failed

### 1.4 Route Registration
- [x] Add `r.Get("/fleet/summary", h.FleetSummary)` to `internal/server/server.go`

---

## Phase 2 — Frontend API

### 2.1 API Client
- [x] Add `ClusterSummary`, `FleetSummaryResponse` interfaces and `getFleetSummary()` to
  `web/src/lib/api.ts`

---

## Phase 3 — Frontend Components

### 3.1 ClusterCard (TDD)
- [x] Create `web/src/components/ClusterCard.test.tsx` — tests:
  - Shows green health dot for healthy
  - Shows amber health dot for degraded
  - Shows gray health dot for unreachable
  - Navigates on click
- [x] Create `web/src/components/ClusterCard.tsx` — per-context summary card
- [x] Create `web/src/components/ClusterCard.css`

### 3.2 FleetMatrix
- [x] Create `web/src/components/FleetMatrix.tsx` — cross-cluster RGD comparison matrix
- [x] Create `web/src/components/FleetMatrix.css`

### 3.3 Fleet Page
- [x] Create `web/src/pages/Fleet.tsx` — fleet overview page (fetches /fleet/summary,
  renders ClusterCard grid + FleetMatrix)
- [x] Create `web/src/pages/Fleet.css`

---

## Phase 4 — Wiring

### 4.1 Routing
- [x] Add `/fleet` route to `web/src/main.tsx`
- [x] Add Fleet nav link to `web/src/components/TopBar.tsx`

---

## Phase 5 — Validation

### 5.1 Go verification
- [x] Run `go vet ./...` — must pass
- [x] Run `go test -race ./internal/api/handlers/...` — must pass
- [x] Run `go build ./...` — must pass

### 5.2 TypeScript verification
- [x] Run `bun run typecheck` — must pass with 0 errors

---

## Completion Checklist

- [x] SC-001: Fleet page shows all kubeconfig contexts with correct counts
- [x] SC-002: Unreachable cluster does not block other cluster cards
- [x] SC-003: Cluster card click switches context and navigates to home
- [x] SC-004: Compare matrix correctly shows RGD presence across clusters
- [x] SC-005: TypeScript strict mode passes with 0 errors
