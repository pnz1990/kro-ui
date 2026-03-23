# Feature Specification: Multi-Cluster Overview

**Feature Branch**: `014-multi-cluster-overview`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `007-context-switcher` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §V (Simplicity),
§IX (Theme)

---

## Context

kro-ui connects to clusters via kubeconfig and supports runtime context
switching (spec 007). The multi-cluster overview extends this to show an
aggregated dashboard across all configured kubeconfig contexts — a "fleet view"
for platform teams running kro across multiple clusters.

All data is fetched from the Kubernetes API server of each cluster. No kro
controller access or metrics scraping is required.

---

## User Scenarios & Testing

### User Story 1 — Platform lead sees fleet-wide RGD health (Priority: P1)

The operator opens a "Fleet" page that shows a summary card for each kubeconfig
context: cluster name, kro version (from CRD metadata), total RGDs, total
instances, and a health indicator (all healthy / some degraded / unreachable).

**Why this priority**: Platform teams managing kro across staging/production/
regional clusters need a single view to detect problems without switching
contexts one by one.

**Independent Test**: With 3 kubeconfig contexts configured (dev, staging, prod),
open the Fleet page. Confirm: 3 cluster cards appear, each showing RGD count,
instance count, and health dot.

**Acceptance Scenarios**:

1. **Given** 3 kubeconfig contexts, **When** the Fleet page loads, **Then** 3
   cluster cards are rendered, each showing: context name, RGD count, instance
   count, and health indicator
2. **Given** cluster `prod` has 5 RGDs and 12 instances all healthy, **When**
   rendered, **Then** the card shows green health dot, "5 RGDs", "12 instances"
3. **Given** cluster `staging` is unreachable (connection refused), **When**
   rendered, **Then** the card shows gray health dot and "Unreachable" status;
   other cluster cards are NOT affected
4. **Given** cluster `dev` has 2 instances with `Ready=False`, **When** rendered,
   **Then** the card shows amber health dot and "2 degraded instances"
5. **Given** the Fleet page is open, **When** a cluster card is clicked, **Then**
   the context switches to that cluster and navigates to the home page (RGD list)

---

### User Story 2 — Platform lead compares RGD deployment across clusters (Priority: P2)

A "Compare" view shows which RGDs exist in which clusters. Displayed as a matrix:
rows are RGD names (by `spec.schema.kind`), columns are clusters. Each cell
shows: present (green), absent (empty), or degraded (amber).

**Acceptance Scenarios**:

1. **Given** RGD `web-application` exists in prod and staging but not dev,
   **When** the matrix renders, **Then** prod and staging cells are green; dev
   cell is empty
2. **Given** RGD `database` has `Ready=False` in staging, **When** rendered,
   **Then** the staging cell shows amber
3. **Given** 20 RGDs across 5 clusters, **When** rendered, **Then** the matrix
   is scrollable with sticky row/column headers

---

### Edge Cases

- Kubeconfig with 10+ contexts → all shown; no pagination for v1; table scrolls
- Context with expired credentials → show "Auth failed" in card, do NOT crash
- Context where kro is not installed (no RGD CRD) → show "kro not installed"
- Parallel API calls to all clusters → use `Promise.allSettled` pattern; do NOT
  let one slow cluster block the entire page
- Same RGD kind name in different clusters but different RGD spec → show as same
  row (matched by `spec.schema.kind`); the dashboard shows presence, not
  structural equality
- Multiple kubeconfig contexts pointing to the same physical cluster (same
  `cluster.server` URL, e.g. a full ARN alias and a short alias) → deduplicate
  into a single card showing the shorter/friendlier context name, with the
  aliases listed as a subtitle. Do NOT show duplicate cards with identical data
  (issue #62).

---

## Requirements

### Functional Requirements

- **FR-001**: Fleet page MUST call `GET /api/v1/contexts` to get all contexts,
  then call `GET /api/v1/rgds` and aggregate instance counts for each context
  in parallel
- **FR-002**: A new backend endpoint MUST be added:
  `GET /api/v1/fleet/summary` — returns per-context summaries (context name,
  RGD count, instance count, health status, reachability)
- **FR-003**: The backend MUST use `Promise.allSettled`-equivalent Go pattern
  (`errgroup` with per-context error isolation) — one unreachable cluster MUST
  NOT block others
- **FR-004**: Cluster card click MUST call `POST /api/v1/contexts/switch` and
  then navigate to `/` (home page)
- **FR-005**: Compare matrix MUST match RGDs across clusters by
  `spec.schema.kind` (not by RGD name, since names may differ)
- **FR-006**: All styles MUST use CSS tokens from `tokens.css`
- **FR-007**: Contexts pointing to the same cluster server URL MUST be
  deduplicated — show one card with aliases listed as subtitle (issue #62)
- **FR-008**: Fleet page MUST provide a manual "Refresh" button that re-fetches
  all cluster summaries. A "last refreshed N ago" timestamp MUST be shown
  (issue #72). Fleet data is fetched once on mount (not polled) — manual
  refresh is the update mechanism.

### Non-Functional Requirements

- **NFR-001**: Fleet page MUST load within 5s for up to 10 clusters
- **NFR-002**: TypeScript strict mode MUST pass
- **NFR-003**: Backend MUST set a 10s timeout per cluster API call

### Key Components

- **`Fleet`** (`web/src/pages/Fleet.tsx`): fleet overview page with cluster cards
- **`ClusterCard`** (`web/src/components/ClusterCard.tsx`): per-context summary
- **`FleetMatrix`** (`web/src/components/FleetMatrix.tsx`): RGD-across-clusters
  comparison matrix
- **Backend**: `internal/api/handlers/fleet.go` — new handler that iterates
  contexts and aggregates data

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/components/ClusterCard.test.tsx
describe("ClusterCard", () => {
  it("shows green health for all-healthy cluster", () => { ... })
  it("shows amber health for degraded cluster", () => { ... })
  it("shows gray health for unreachable cluster", () => { ... })
  it("navigates on click", () => { ... })
})
```

```go
// internal/api/handlers/fleet_test.go
func TestFleetSummary(t *testing.T) {
  // Table-driven tests:
  // - All clusters reachable → returns summaries for all
  // - One cluster unreachable → returns summary with error for that cluster,
  //   others succeed
  // - No contexts configured → returns empty array
}
```

---

## Success Criteria

- **SC-001**: Fleet page shows all kubeconfig contexts with correct counts
- **SC-002**: Unreachable cluster does not block other cluster cards
- **SC-003**: Cluster card click switches context and navigates to home
- **SC-004**: Compare matrix correctly shows RGD presence across clusters
- **SC-005**: TypeScript strict mode passes with 0 errors
