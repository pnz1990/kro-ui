# Tasks: 015-rgd-catalog

**Spec**: `.specify/specs/015-rgd-catalog/spec.md`
**Branch**: `015-rgd-catalog`
**Depends on**: `002-rgd-list-home` (merged), `001b-rgd-api` (merged)

---

## Phase 1 — Backend API audit

- [X] Confirm `GET /api/v1/rgds` returns labels and `spec.schema.kind` in the response (needed for chaining detection and label filter)
- [X] Confirm `GET /api/v1/rgds/:name/instances` is available per RGD for instance counting
- [X] No backend changes required — all catalog logic is client-side

## Phase 2 — Pure library: chaining detection

- [X] Create `web/src/lib/catalog.ts` — `buildChainingMap(rgds)`: cross-references `spec.resources[].template.apiVersion/kind` against other RGDs' `spec.schema.kind`; returns `Map<rgdName, string[]>` ("used by" list)
- [X] Create `web/src/lib/catalog.test.ts` — detects chaining, empty map, self-reference safety

## Phase 3 — Core components

- [X] Create `web/src/components/SearchBar.tsx` — controlled text input, fires `onSearch(value)` callback
- [X] Create `web/src/components/SearchBar.css`
- [X] Create `web/src/components/LabelFilter.tsx` — multi-select label dropdown, AND logic, fires `onFilter(labels)` callback
- [X] Create `web/src/components/LabelFilter.css`
- [X] Create `web/src/components/CatalogCard.tsx` — extended RGD card: name, kind, resource count, instance count, label pills (clickable → activates filter), "Used by" links, creation date
- [X] Create `web/src/components/CatalogCard.css`

## Phase 4 — Catalog page

- [X] Create `web/src/pages/Catalog.tsx` — fetches all RGDs on mount, fires parallel instance-count requests, applies client-side search/filter/sort
- [X] Create `web/src/pages/Catalog.css`
- [X] Search: case-insensitive substring match on name, kind, and label values (FR-002)
- [X] Label filter: multi-select AND logic (FR-003)
- [X] Sort options: name A-Z, kind A-Z, most instances, resource count, newest first (FR-004)
- [X] "Used by" links navigate to `/rgds/:name` (FR-006)
- [X] Empty state when 0 results: "No RGDs match your search" with "Clear filters" button
- [X] Instance count fetch failure per RGD → show "?" (never block page)

## Phase 5 — Routing

- [X] Add `/catalog` route in `web/src/main.tsx`
- [X] Add "Catalog" navigation link in `web/src/components/TopBar.tsx` or layout

## Phase 6 — Unit tests

- [X] Create `web/src/pages/Catalog.test.tsx` — search filter, label filter, sort by instance count, empty state
- [X] Run `bun run --cwd web vitest run` — zero failures
- [X] Run `bun run --cwd web tsc --noEmit` — zero errors

## Phase 7 — PR

- [X] Commit: `feat(web): implement spec 015-rgd-catalog — searchable RGD catalog with filtering and chaining`
- [ ] Push branch and open PR against `main`
- [ ] Confirm CI (build + govulncheck + CodeQL) passes
