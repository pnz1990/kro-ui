# Tasks: RBAC & Access Control Visualizer (018)

## Phase 1 — Setup & Types

- [X] Create plan.md with architecture and file structure
- [X] Add `AccessResponse`, `GVRPermission` types to `internal/api/types/response.go`

## Phase 2 — Backend: RBAC Logic

- [X] Create `internal/k8s/rbac.go`:
  - [X] Define `ResourcePermission` struct
  - [X] Define `AccessResult` struct
  - [X] Implement `ResolveKroServiceAccount(ctx, clients)` — reads kro Deployment SA name
  - [X] Implement `FetchEffectiveRules(ctx, clients, saNamespace, saName)` — reads ClusterRoleBindings + RoleBindings, resolves roles, handles aggregation
  - [X] Implement `CheckPermissions(rules, group, resource, required)` — wildcard-aware
  - [X] Implement `ComputeAccessResult(ctx, clients, rgd)` — orchestrates all of the above
- [X] Create `internal/k8s/rbac_test.go`:
  - [X] TestCheckPermissions — exact match
  - [X] TestCheckPermissions — wildcard apiGroup
  - [X] TestCheckPermissions — wildcard verb
  - [X] TestCheckPermissions — wildcard resource
  - [X] TestCheckPermissions — no binding
  - [X] TestFetchEffectiveRules — aggregated ClusterRole

## Phase 3 — Backend: HTTP Handler

- [X] Create `internal/api/handlers/access.go`:
  - [X] Implement `GetRGDAccess(w, r)` handler
  - [X] Extract RGD name from URL param
  - [X] Fetch RGD, call `ComputeAccessResult`, return JSON
  - [X] Proper error handling (404, 503, 422)
- [X] Register route in `internal/server/server.go`:
  - [X] Add `r.Get("/rgds/{name}/access", h.GetRGDAccess)`

## Phase 4 — Frontend: API Client

- [X] Add `AccessResponse` TypeScript type to `web/src/lib/api.ts`
- [X] Add `getRGDAccess(rgdName: string)` function

## Phase 5 — Frontend: Components

- [X] Create `web/src/components/PermissionCell.tsx` — ✓/✗ cell with color + text
- [X] Create `web/src/components/PermissionCell.css`
- [X] Create `web/src/components/RBACFixSuggestion.tsx` — kubectl fix command block
- [X] Create `web/src/components/RBACFixSuggestion.css`
- [X] Create `web/src/components/AccessTab.tsx` — full permission matrix
- [X] Create `web/src/components/AccessTab.css`
- [X] Create `web/src/components/AccessTab.test.tsx`:
  - [X] Test: shows green ✓ for granted permissions
  - [X] Test: shows red ✗ for missing permissions
  - [X] Test: shows warning banner when gaps exist
  - [X] Test: shows success banner when all permissions satisfied

## Phase 6 — Frontend: RGDDetail Integration

- [X] Add `"access"` to `TabId` type in `web/src/pages/RGDDetail.tsx`
- [X] Add "Access" tab button to tab bar
- [X] Render `<AccessTab>` for `activeTab === "access"`
- [X] Add Access tab styles to `web/src/pages/RGDDetail.css`

## Phase 7 — Validation

- [X] Run `go vet ./...`
- [X] Run `go test -race ./internal/k8s/...`
- [X] Run `bun run tsc --noEmit` (TypeScript strict check)
- [X] Run `bun run test` (Vitest frontend tests)
- [X] Run `go build ./...`
