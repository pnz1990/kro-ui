# Feature Specification: RGD Static Chaining Graph

**Feature Branch**: `025-rgd-static-chain-graph`
**Created**: 2026-03-22
**Status**: Draft
**Depends on**: `003-rgd-detail-dag` (merged), `012-rgd-chaining-deep-graph` (merged)
**Constitution ref**: §V (Simplicity), §IX (Theme), §XII (No `?` kind labels)
**Design ref**: `000-design-system` § DAG node visual identity

---

## Context

The RGD detail DAG (spec 003) shows the static structure of a single RGD — its
managed resources, forEach collections, external refs, and the dependency edges
between them. It does not indicate when a managed resource's `kind` corresponds
to another RGD's custom resource.

kro supports RGD chaining: one RGD can include in its `spec.resources` a resource
whose `kind` matches another RGD's `spec.schema.kind`. For example, a `Platform`
RGD might declare a `Database` resource — and if a `database` RGD exists in the
cluster, that node is "chainable". In the current implementation (spec 003), that
node looks identical to any other managed resource; the relationship to the `database`
RGD is invisible.

This feature adds **static** chain awareness to the DAG: by comparing nodes' kinds
against all known RGDs' schema kinds (using already-loaded data, no new API calls
for detection), chainable nodes are visually marked and two affordances are provided:

1. **Expand toggle (`▸`)** — recursively inlines the chained RGD's own static DAG
   as a nested subgraph, using the same visual containment treatment as spec 012
   but driven entirely by RGD spec data (no live instance state).
2. **"View RGD →" navigation link** — navigates to the chained RGD's detail page,
   with a breadcrumb back to the originating RGD.

The two new affordances are visually distinct from each other and from the
live-instance expand icon introduced in spec 012.

---

## User Scenarios & Testing

### User Story 1 — Operator identifies chainable nodes in the static DAG (Priority: P1)

An operator opens the RGD detail Graph tab for a `Platform` RGD. One of its
managed-resource nodes has kind `Database`, and a `database` RGD exists in the
cluster. That node is visually marked as "chainable" — distinguishable from plain
managed-resource nodes — so the operator immediately understands that `Database`
is not a native Kubernetes kind but another kro-managed abstraction.

**Why this priority**: Detection and marking is the prerequisite for both
affordances. Without it the feature has no value. It also delivers standalone
value by making the relationship visible without requiring any interaction.

**Independent Test**: Load any RGD whose `spec.resources` contains at least one
resource with a `kind` that matches another RGD's `spec.schema.kind`. Confirm
that node has a distinct visual treatment (chainable badge/ring) and all other
nodes are unchanged.

**Acceptance Scenarios**:

1. **Given** a `Platform` RGD with a resource of `kind: Database` and a `database`
   RGD exists (detected via `spec.schema.kind: Database`), **When** the Graph tab
   renders, **Then** the `Database` node carries a "chainable" visual indicator
   (e.g., a secondary colored ring or `⛓` badge using `--color-chain-*` tokens)
   distinct from all five base node types and from spec 012's live expand icon
2. **Given** a resource whose `kind` does NOT match any known RGD schema kind,
   **When** rendered, **Then** it has no chainable indicator
3. **Given** RGD list data is already loaded on the page (from the home page fetch
   or an already-cached call), **When** the Graph tab renders, **Then** no
   additional network request is made solely to determine chainability
4. **Given** the cluster has zero RGDs other than the current one, **When** the
   Graph tab renders, **Then** no nodes are marked chainable and no UI change
   is visible

---

### User Story 2 — Operator expands a chainable node to view the chained RGD's static DAG (Priority: P1)

Clicking the `▸` expand toggle on a chainable node inlines the chained RGD's
own resource graph as a nested subgraph within the current DAG. The operator can
visually trace the full composition: the `Platform` node structure plus the
`Database` node structure — all without navigating away. Clicking `▾` collapses
the subgraph back to a single node.

**Why this priority**: This is the primary interactive value of the feature. It
removes the need to navigate away and lose context to understand what a chained
RGD contains.

**Independent Test**: With a `Platform` RGD that chains a `Database` RGD (which
has 3 resources), click `▸` on the `Database` node. Confirm: the node expands
into a nested subgraph showing 3 child nodes + 1 root CR node; the subgraph has
a visually contained boundary; clicking `▾` collapses it. No API calls are made
for expansion — the data comes from already-loaded RGD specs.

**Acceptance Scenarios**:

1. **Given** a chainable `Database` node, **When** `▸` is clicked, **Then** the
   node expands into a nested subgraph showing the `database` RGD's root CR plus
   all its resource nodes, with the same node-type visual treatment as the
   outer DAG, contained in a rounded border with a subtle background tint
2. **Given** the nested subgraph is expanded, **When** `▾` is clicked, **Then**
   the subgraph collapses back to a single chainable node
3. **Given** the nested subgraph is open, **When** a node inside it is clicked,
   **Then** the `NodeDetailPanel` opens for that inner node (same behavior as
   spec 003)
4. **Given** a 4-level chain (A chains B which chains C which chains D), **When**
   expanding recursively, **Then** all 4 levels are rendered; a 5th level that
   would exceed the limit shows a "Max depth" indicator node instead of expanding
5. **Given** A chains B and B chains A (a cycle), **When** attempting to expand,
   **Then** the cycle is detected; the re-entry node shows a "Cycle detected"
   indicator and is not expanded; no infinite loop occurs
6. **Given** a chainable node with `kind: Database` and the `database` RGD has
   itself a resource of `kind: Cache` (another chained RGD), **When** the outer
   expansion is open, **Then** the inner `Cache` node also shows its `▸` expand
   toggle (unless max depth is reached)
7. **Given** a chainable node is expanded, **When** the page is navigated away
   from and back, **Then** expansion state is NOT required to persist (stateless
   on reload is acceptable)

---

### User Story 3 — Operator navigates to the chained RGD's detail page via "View RGD →" (Priority: P2)

Alongside the expand toggle, each chainable node also shows a "View RGD →"
navigation link. Clicking it takes the operator to the chained RGD's full detail
page. A breadcrumb trail ("← Back to Platform") allows returning to the
originating RGD.

**Why this priority**: Operators often need the full RGD detail view (YAML tab,
instances list, etc.) of the chained RGD — not just the static subgraph. The
link affords that without manual navigation.

**Independent Test**: Click "View RGD →" on a chainable `Database` node from the
`Platform` detail page. Confirm navigation to `/rgds/database`, document title
updates to `database — kro-ui`, and a breadcrumb "← Platform" is present and
navigates back.

**Acceptance Scenarios**:

1. **Given** a chainable `Database` node, **When** "View RGD →" is clicked,
   **Then** the browser navigates to `/rgds/database` (the chained RGD's detail
   page)
2. **Given** the chained RGD's detail page is reached via "View RGD →", **When**
   the page renders, **Then** a breadcrumb "← [OriginRGD]" is displayed and
   clicking it returns to `/rgds/platform`
3. **Given** a deeply nested chain (Platform → Database → Cache), **When**
   "View RGD →" is clicked from within an already-expanded subgraph, **Then**
   navigation still goes to the directly chained RGD's page with one breadcrumb
   level back
4. **Given** the "View RGD →" link and the `▸` expand toggle both appear on the
   same chainable node, **When** rendered, **Then** the two controls are
   visually distinct: the `▸` toggle uses `--color-chain-expand-*` tokens and the
   "View RGD →" link uses `--color-primary` / `--color-primary-text` link styling;
   neither uses spec 012's live-instance expand icon styling

---

### Edge Cases

- RGD whose `spec.schema.kind` collides with a native Kubernetes kind (e.g., a
  user names their RGD kind `Deployment`) → treat the node as chainable only if
  the RGD's `spec.schema.kind` exactly matches; no fuzzy matching
- Chainable node whose target RGD is deleted mid-session → expansion shows
  "RGD not found" indicator in the subgraph container; no crash
- Chainable node with `kind` resolvable to multiple RGDs (impossible in valid kro
  clusters — one `spec.schema.kind` per RGD — but defensively: use first match,
  log a warning, do not crash)
- RGD with zero resources other than the root → expansion shows only the root CR
  node inside the subgraph container with "No managed resources" note
- Chainable node that also has `includeWhen` (conditional) → the conditional
  modifier (dashed border + `?` badge) stacks with the chainable indicator; both
  are visible
- Max depth indicator node MUST NOT show a `▸` expand toggle or "View RGD →" link
- Cycle indicator node MUST still show the "View RGD →" link (so the operator can
  navigate to the cycled RGD's page) but MUST NOT show `▸`

---

## Requirements

### Functional Requirements

- **FR-001**: The static DAG MUST detect chainable nodes by comparing each
  resource node's `kind` against the `spec.schema.kind` of all known RGDs, using
  already-loaded RGD list data; no additional API requests for detection
- **FR-002**: Chainable nodes MUST render a visual "chainable" indicator (badge or
  ring) using design tokens defined in `tokens.css`; the indicator MUST be
  distinct from all five base node types, from the `includeWhen` conditional
  modifier, and from spec 012's live-instance expand icon
- **FR-003**: Chainable nodes MUST render two visually distinct affordances:
  a) an expand/collapse toggle (`▸`/`▾`) using `--color-chain-expand-*` tokens and
  b) a "View RGD →" navigation link using `--color-primary` / link styling;
  the two affordances MUST NOT share visual styling with each other or with
  spec 012's live-instance `▸` icon
- **FR-004**: Clicking `▸` MUST inline the chained RGD's static DAG as a nested
  subgraph within the current node's boundary — a rounded container with
  `--color-chain-subgraph-bg` background tint and `--color-chain-subgraph-border`
  border — without navigating away
- **FR-005**: The nested subgraph MUST use the same node-type visual treatment
  (spec 003) as the outer DAG; it MUST NOT use live-state colors (no `--node-alive-*`,
  `--node-error-*`, etc.)
- **FR-006**: Recursion depth MUST be capped at 4 levels; nodes beyond depth 4
  MUST be replaced by a "Max depth" indicator node
- **FR-007**: Cycle detection MUST run before rendering any expansion; a node that
  would re-introduce an already-visited RGD in the current chain MUST be replaced
  by a "Cycle detected" indicator node; `▸` MUST NOT appear on it
- **FR-008**: Clicking `▾` on an expanded chainable node MUST collapse the subgraph
  back to a single node
- **FR-009**: Clicking `NodeDetailPanel` on any inner subgraph node MUST work
  identically to clicking outer DAG nodes (spec 003 FR-006)
- **FR-010**: Clicking "View RGD →" MUST navigate to `/rgds/:chainedRgdName`
- **FR-011**: The RGD detail page MUST render a breadcrumb "← [originRgdName]"
  when reached via "View RGD →"; clicking it returns to the originating RGD's
  detail page
- **FR-012**: The breadcrumb state MUST be passed via navigation (e.g., router
  state); it MUST NOT be stored in the URL path or query params
- **FR-013**: All chain detection logic MUST live in `web/src/lib/dag.ts` as pure
  functions, not in component files
- **FR-014**: New design tokens (`--color-chain-*`) MUST be defined in
  `web/src/tokens.css` with both dark and light mode values; no hardcoded
  colors in components
- **FR-015**: `document.title` on the chained RGD's detail page MUST follow the
  existing format: `[rgdName] — kro-ui`

### Key Entities

- **Chainable node**: A DAG node (any of the five node types) whose `kind` exactly
  matches another RGD's `spec.schema.kind`
- **Chained RGD**: The RGD whose `spec.schema.kind` is matched; the source of the
  nested subgraph data
- **Static nested subgraph**: A read-only, non-live rendering of a chained RGD's
  `spec.resources` using the same node-type visual rules as spec 003, but without
  live state colors
- **Expand path**: The ordered list of RGD names from root to current depth, used
  for cycle detection (e.g., `["platform", "database", "cache"]`)
- **Depth indicator node**: A synthetic node shown when max depth (4) is reached
  or a cycle is detected; not a real resource

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All chainable nodes in the RGD detail DAG are identified and marked
  without any additional network requests beyond the initial RGD list load
- **SC-002**: Expanding a chained RGD subgraph (1 level) completes in under 200ms
  from click to rendered subgraph (data is already loaded; no I/O)
- **SC-003**: A 4-level chain renders correctly with all levels visible; the 5th
  level consistently shows the "Max depth" indicator instead of content
- **SC-004**: Cycle detection prevents infinite recursion in 100% of tested
  circular chain configurations
- **SC-005**: The expand toggle (`▸`) and "View RGD →" link are visually
  distinguishable from each other and from spec 012's live-instance expand icon
  as assessed in peer review
- **SC-006**: Breadcrumb navigation returns the user to the exact originating RGD
  detail page in all tested flows
- **SC-007**: TypeScript strict mode passes with 0 errors (`tsc --noEmit`)
- **SC-008**: `go vet ./...` passes with 0 warnings (no backend changes expected,
  but the check is required per constitution)

---

## Assumptions

- The RGD list data (`GET /api/v1/rgds`) is already loaded or cached by the time
  the Graph tab renders; if not yet loaded, chainability detection is deferred
  until the data is available (no eager additional fetch)
- `spec.schema.kind` is unique across all RGDs in a given cluster (kro enforces
  this); if a collision is detected, the first matching RGD is used
- Breadcrumb depth is limited to one level (originating RGD); deep breadcrumb
  chains (Platform → Database → Cache all having back-links) are out of scope
- Expansion state is ephemeral (session-only, not persisted to URL or storage)
- No backend changes are required; all chain detection and subgraph rendering
  is purely client-side using already-available RGD spec data
- The chained RGD's subgraph does not show live instance counts or status; it is
  a static structural view identical to loading that RGD's Graph tab fresh
