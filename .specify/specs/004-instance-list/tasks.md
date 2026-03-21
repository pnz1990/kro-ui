# Tasks: 004-instance-list

**Spec**: `.specify/specs/004-instance-list/spec.md`
**Branch**: `004-instance-list`
**Depends on**: `003-rgd-detail-dag` (merged), `001c-instance-api` (merged)

---

## Phase 1 — Backend API audit

- [x] Confirm `GET /api/v1/rgds/:name/instances` returns namespace, name, age, readiness conditions — check `internal/api/handlers/rgds.go`
- [x] Confirm `?namespace=` query param is supported by the instances handler
- [x] Add namespace filter support to the handler if missing (pass through to `internal/k8s/`)
- [x] Run `go vet ./...` — zero errors

## Phase 2 — Core frontend components

- [x] Create `web/src/components/ReadinessBadge.tsx` — colored badge from `Ready` condition (green / red / gray)
- [x] Create `web/src/components/ReadinessBadge.css` — tokens only, no hardcoded hex
- [x] Create `web/src/components/ReadinessBadge.test.tsx` — Ready=True, Ready=False with reason tooltip, no conditions
- [x] Create `web/src/components/NamespaceFilter.tsx` — `<select>` with "All Namespaces" + derived options
- [x] Create `web/src/components/NamespaceFilter.css`
- [x] Create `web/src/components/InstanceTable.tsx` — table rows: name, namespace, age, readiness badge, "Open" link
- [x] Create `web/src/components/InstanceTable.css`

## Phase 3 — Instances tab in RGDDetail page

- [x] Add `tab=instances` support to `web/src/pages/RGDDetail.tsx` (alongside existing `tab=graph` and `tab=yaml`)
- [x] Wire `InstanceTable` + `NamespaceFilter` into the Instances tab
- [x] Fetch from `GET /api/v1/rgds/:name/instances` on tab activation
- [x] Re-fetch on namespace filter change using `?namespace=` query param
- [x] Derive namespace dropdown options from the unfiltered response (FR-003)
- [x] Reflect and restore active namespace in `?namespace=` URL query param (FR-006)
- [x] Handle loading, error (with Retry button), and empty states (FR-007)

## Phase 4 — Navigation to instance detail

- [x] "Open" link in each row navigates to `/rgds/:rgdName/instances/:namespace/:name` (FR-005)
- [x] Confirm `web/src/pages/InstanceDetail.tsx` exists and has `data-testid="instance-detail-page"` (stub is sufficient for now)
- [x] Add route in `web/src/main.tsx` if not already present

## Phase 5 — Unit tests

- [x] Extend `web/src/pages/RGDDetail.test.tsx` — Instances tab: renders rows, empty state, error state, namespace param restore
- [x] Run `bun run --cwd web vitest run` — zero failures

## Phase 6 — E2E journey

- [x] Create `test/e2e/journeys/004-instance-list.spec.ts` — Steps 1–5 per spec.md
- [x] Run `bun run --cwd web tsc --noEmit` — zero errors
- [x] Run `go vet ./...` — zero errors

## Phase 7 — PR

- [ ] Commit: `feat(web): implement spec 004-instance-list — instance table with namespace filter`
- [ ] Push branch and open PR against `main`
- [ ] Confirm CI (build + govulncheck + CodeQL) passes; monitor e2e
