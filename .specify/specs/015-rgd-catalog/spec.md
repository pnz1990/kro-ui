# Feature Specification: RGD Catalog / Registry Browser

**Feature Branch**: `015-rgd-catalog`
**Created**: 2026-03-20
**Status**: Draft
**Depends on**: `002-rgd-list-home` (merged)
**Constitution ref**: §II (Cluster Adaptability — dynamic client), §III (Read-Only),
§V (Simplicity), §IX (Theme)

---

## Context

As organizations scale kro adoption, they accumulate dozens of RGDs authored by
different teams. The home page (spec 002) shows a flat card grid. The catalog
extends this with search, filtering, sorting, and metadata enrichment —
making RGDs discoverable.

All data comes from the Kubernetes API server (RGD custom resources and their
instances). No external registry, no kro controller access.

---

## User Scenarios & Testing

### User Story 1 — Developer searches for an existing RGD (Priority: P1)

A developer opens the catalog page and types "database" in the search bar. The
RGD list filters to show only RGDs whose name, kind, or labels contain the
search term. Results update as the developer types (client-side filter, no API
call per keystroke).

**Why this priority**: Discoverability is the main pain point at scale. Without
search, developers must scroll through dozens of cards or use kubectl.

**Independent Test**: With 10 RGDs in the cluster, type "database" in the search
bar. Confirm: only RGDs with "database" in their name or kind are shown.

**Acceptance Scenarios**:

1. **Given** 10 RGDs including `database`, `user-database`, and `web-service`,
   **When** searching "database", **Then** 2 results are shown (`database` and
   `user-database`); `web-service` is hidden
2. **Given** a search term "WebApp", **When** searching, **Then** RGDs whose
   `spec.schema.kind` is "WebApp" are matched (case-insensitive)
3. **Given** an empty search term, **When** rendered, **Then** all RGDs are shown
4. **Given** a search with 0 results, **When** rendered, **Then** "No RGDs match
   your search" is shown

---

### User Story 2 — Platform engineer filters by label (Priority: P2)

The catalog has a label filter dropdown. Selecting a label (e.g.,
`team=platform`) filters the list to RGDs with that label. Multiple labels can
be combined (AND logic).

**Acceptance Scenarios**:

1. **Given** RGDs with labels `team=platform` and `team=security`, **When**
   filtering by `team=platform`, **Then** only platform team RGDs are shown
2. **Given** two filters `team=platform` AND `tier=production`, **When** applied,
   **Then** only RGDs matching both labels are shown
3. **Given** no RGDs match the selected labels, **When** rendered, **Then** an
   empty state is shown with a "Clear filters" button

---

### User Story 3 — Developer sees RGD metadata at a glance (Priority: P1)

Each catalog entry shows enriched metadata beyond what the home page card shows:
resource count, instance count (live, fetched once on page load), labels,
creation date, and which other RGDs reference it (chaining).

**Acceptance Scenarios**:

1. **Given** an RGD `database` with 3 resources and 5 instances, **When**
   rendered, **Then** the card shows "3 resources", "5 instances"
2. **Given** RGD `database` is referenced by `full-stack-app` (as a chained
   resource), **When** rendered, **Then** the card shows "Used by: full-stack-app"
3. **Given** an RGD with labels `team=platform, tier=production`, **When**
   rendered, **Then** labels are shown as clickable pills that activate the filter

---

### User Story 4 — Developer sorts the catalog (Priority: P2)

The catalog supports sorting by: name (A-Z), kind (A-Z), instance count
(most used first), resource count, and creation date (newest/oldest).

**Acceptance Scenarios**:

1. **Given** sorting by "Most instances", **When** applied, **Then** RGDs with
   the highest instance count appear first
2. **Given** sorting by "Newest first", **When** applied, **Then** RGDs are
   ordered by `metadata.creationTimestamp` descending

---

### Edge Cases

- RGD with no labels → show in catalog without label pills; not excluded by
  any filter
- Instance count fetching fails for one RGD → show "?" for that count; do NOT
  block other RGDs
- 100+ RGDs → client-side filtering is sufficient; no server-side pagination
  needed for v1
- Chaining detection: check all RGDs' `spec.resources[].template.kind` against
  other RGDs' `spec.schema.kind` — this is a client-side join

---

## Requirements

### Functional Requirements

- **FR-001**: Catalog page MUST fetch all RGDs and, in parallel, count instances
  for each RGD (one `GET /api/v1/rgds/:name/instances` per RGD, or a batch
  endpoint if available)
- **FR-002**: Search MUST filter client-side by name, kind, and label values
  (case-insensitive substring match)
- **FR-003**: Label filter MUST support multi-select with AND logic
- **FR-004**: Sorting MUST be client-side with options: name, kind, instance
  count, resource count, creation date
- **FR-005**: Chaining detection MUST be performed client-side by cross-
  referencing RGDs' resource template kinds against other RGDs' schema kinds
- **FR-006**: "Used by" linkage MUST be clickable, navigating to the referencing
  RGD's detail page
- **FR-007**: All styles MUST use CSS tokens from `tokens.css`

### Non-Functional Requirements

- **NFR-001**: Catalog renders within 2s for up to 50 RGDs
- **NFR-002**: Search filtering responds within 100ms (client-side)
- **NFR-003**: TypeScript strict mode MUST pass

### Key Components

- **`Catalog`** (`web/src/pages/Catalog.tsx`): catalog page with search, filter,
  sort, and enriched cards
- **`CatalogCard`** (`web/src/components/CatalogCard.tsx`): extended RGD card
  with instance count, labels, chaining info
- **`SearchBar`** (`web/src/components/SearchBar.tsx`): text input with debounced
  filtering
- **`LabelFilter`** (`web/src/components/LabelFilter.tsx`): multi-select label
  dropdown
- **`buildChainingMap`** (`web/src/lib/catalog.ts`): pure function that builds
  the "used by" relationship map from the RGD list

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/catalog.test.ts
describe("buildChainingMap", () => {
  it("detects when RGD A references RGD B's kind in its resources", () => { ... })
  it("returns empty map when no chaining exists", () => { ... })
  it("handles self-referencing RGD without infinite loop", () => { ... })
})

// web/src/pages/Catalog.test.tsx
describe("Catalog", () => {
  it("filters by search term across name and kind", () => { ... })
  it("filters by label selection", () => { ... })
  it("sorts by instance count descending", () => { ... })
  it("shows empty state when no results match", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: Search filters RGDs in real-time by name, kind, and labels
- **SC-002**: Label filter with AND logic works correctly
- **SC-003**: Instance counts are displayed per RGD
- **SC-004**: Chaining relationships ("Used by") are detected and displayed
- **SC-005**: TypeScript strict mode passes with 0 errors
