# Tasks: Smart Event Stream (019)

## Phase 1: Setup

- [X] Create plan.md
- [X] Create tasks.md

## Phase 2: Backend

- [X] **T-BE-01**: Create `internal/api/handlers/events.go` — `ListEvents` handler
  - `GET /api/v1/events?namespace=X&rgd=Y`
  - Lists k8s Events, filters by kro-relevance (RGD + instance UIDs)
  - Returns standard K8sList JSON

- [X] **T-BE-02**: Create `internal/api/handlers/events_test.go`

- [X] **T-BE-03**: Register `/events` route in `internal/server/server.go`

## Phase 3: Frontend Library

- [X] **T-FE-01**: Create `web/src/lib/events.ts`

- [X] **T-FE-02**: Create `web/src/lib/events.test.ts`

## Phase 4: Frontend Components

- [X] **T-FE-03**: Create `web/src/components/EventRow.tsx` + `EventRow.css`

- [X] **T-FE-04**: Create `web/src/components/EventGroup.tsx` + `EventGroup.css`

- [X] **T-FE-05**: Create `web/src/components/AnomalyBanner.tsx` + `AnomalyBanner.css`

## Phase 5: Events Page

- [X] **T-FE-06**: Create `web/src/pages/Events.tsx`

- [X] **T-FE-07**: Create `web/src/pages/Events.css`

- [X] **T-FE-08**: Create `web/src/pages/Events.test.tsx`

## Phase 6: Integration

- [X] **T-INT-01**: Add `listEvents` to `web/src/lib/api.ts`

- [X] **T-INT-02**: Register `/events` route in `web/src/main.tsx`

- [X] **T-INT-03**: Add "Events" `<NavLink>` to `web/src/components/TopBar.tsx`

## Phase 7: Validation

- [X] **T-VAL-01**: `go vet ./...` passes
- [X] **T-VAL-02**: `GOPROXY=direct GONOSUMDB="*" go test -race ./...` passes
- [X] **T-VAL-03**: `bun run typecheck` passes (0 errors)
- [X] **T-VAL-04**: `bun run test` passes
