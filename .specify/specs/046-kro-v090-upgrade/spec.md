# Feature Specification: kro v0.9.0 Upgrade — UI Compatibility & Feature Surfacing

**Feature Branch**: `046-kro-v090-upgrade`
**GH Issue**: (internal)
**Created**: 2026-03-26
**Updated**: 2026-03-26
**Status**: Draft
**Depends on**: `045-rgd-designer-validation-optimizer` (merged, PR #273)

---

## Context

kro v0.9.0 was released on 2026-03-24. It ships several significant changes that
kro-ui must absorb:

1. **`GraphRevision` CRD** (`internal.kro.run/v1alpha1`) — an immutable snapshot
   of each RGD version. This was the blocker for spec `009-rgd-graph-diff`.
   The CRD is now live in clusters running v0.9.0.
2. **`spec.schema.types`** — custom type definitions reusable across Spec fields.
   kro-ui's capabilities baseline has `hasTypes: false`; clusters on v0.9.0 will
   return `true`. The DocsTab and RGD Designer need to surface this.
3. **`spec.schema.scope`** — `Namespaced` (default) / `Cluster`. Partially
   handled in the RGD Designer since spec 044, but not surfaced on the RGD detail
   page header, instance list, or in the capabilities baseline.
4. **Cartesian forEach** — multi-dimension `forEach: [{region: "..."}, {tier: "..."}]`
   already rendered correctly in dag.ts; fixture and E2E journey exist. The
   baseline `hasForEach: true` is correct but the Designer's forEach UI only
   supports a single iterator. This should be extended.
5. **CEL comprehension macros** (`transformMap`, `transformList`,
   `transformMapEntry`) — kro's CEL environment now includes these. The
   highlighter must tokenise them correctly.
6. **`externalRef.metadata.selector`** — external collection by label selector.
   Already partially handled via `HasExternalRefSelector` capability; the
   baseline should be updated now that v0.9.0 ships it by default.
7. **`spec.schema.additionalPrinterColumns`** and **`spec.schema.metadata`** —
   new optional fields added to the RGD schema. These don't require active UI
   treatment but must not break parsing.
8. **`status.lastIssuedRevision`** — new status field on RGDs tracking the
   revision high-water mark. Should be surfaced in the RGD detail header.

### What this spec does NOT cover

- Full `009-rgd-graph-diff` implementation (side-by-side DAG diff view). That is
  a separate feature spec that is now unblocked. This spec only adds the
  capabilities detection and the `GraphRevision` list/get API endpoints that
  `009` will build on.
- kro v0.9.0 controller deployment changes (Docker image / Helm chart layout
  changes). Only capability detection is in scope.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Platform engineer sees scope badge on RGD card (Priority: P1)

A platform engineer browses the Overview page. Each RGD card that has
`spec.schema.scope: Cluster` shows a visible "Cluster-scoped" badge. Cards for
Namespaced RGDs show no badge (default is Namespaced, no noise).

**Why this priority**: Cluster-scoped RGDs have different operational semantics
(no namespace on instances). Surfacing scope at-a-glance prevents confusion.

**Independent Test**: Apply the `upstream-cluster-scoped` fixture RGD to a
cluster running kro v0.9.0. Open the Overview page. Confirm the card for
`upstream-cluster-scoped` shows a "Cluster" badge. Namespaced RGD cards do not.

**Acceptance Scenarios**:

1. **Given** an RGD with `spec.schema.scope: Cluster`, **When** viewing the
   Overview page, **Then** the RGD card displays a "Cluster" scope badge
2. **Given** an RGD with no `spec.schema.scope` field, **When** viewing the
   Overview page, **Then** no scope badge is shown (Namespaced is the default)
3. **Given** the RGD detail page header, **When** the RGD has `scope: Cluster`,
   **Then** the header also shows the "Cluster" scope badge alongside the Kind badge

---

### User Story 2 — Docs tab shows `types` section when present (Priority: P1)

A platform engineer opens the Docs tab for an RGD that uses custom `types:` in
its schema. The Types section lists each named type with its fields. On a cluster
where `hasTypes: false` (pre-v0.9.0), the section is hidden.

**Independent Test**: Apply a fixture RGD with a non-empty `spec.schema.types`
block. Open the Docs tab. Confirm a "Types" section appears and lists the type
names and their fields.

**Acceptance Scenarios**:

1. **Given** an RGD with `spec.schema.types: {Server: {host: string, port: integer}}`,
   **When** viewing the Docs tab, **Then** a "Types" section shows `Server` with
   fields `host (string)` and `port (integer)`
2. **Given** an RGD with no `spec.schema.types`, **When** viewing the Docs tab,
   **Then** no "Types" section is shown

---

### User Story 3 — CEL comprehension macros highlighted in YAML tab (Priority: P1)

A developer opens an RGD YAML tab that contains `transformMap`, `transformList`,
or `transformMapEntry` in a CEL expression. These identifiers are highlighted as
function tokens (same style as other CEL built-ins), not as plain strings.

**Independent Test**: Apply the `upstream-cel-comprehensions` fixture. Open the
YAML tab. Confirm `transformMap`, `transformList`, and `transformMapEntry` all
receive CEL token highlighting spans.

**Acceptance Scenarios**:

1. **Given** a CEL expression containing `transformMap(...)`, **When** rendered
   in KroCodeBlock, **Then** the full `${...}` block has the `.token-cel-expression`
   CSS class (existing behaviour — regression guard only)
2. **Given** all three comprehension macros in a template, **When** rendered,
   **Then** each appears as text content inside a `.token-cel-expression` span

---

### User Story 4 — GraphRevision API endpoints available (Priority: P1)

The backend exposes two new read-only endpoints:
- `GET /api/v1/kro/graph-revisions?rgd=<name>` — list GraphRevisions for an RGD,
  sorted descending by `.spec.revision`
- `GET /api/v1/kro/graph-revisions/<name>` — fetch a single GraphRevision by
  its k8s name (e.g. `my-app-1`)

These are no-ops on pre-v0.9.0 clusters (returns `{ items: [] }` / 404 with
graceful error) and automatically appear when `graphrevisions` is in
`knownResources`.

**Independent Test**: On a v0.9.0 cluster, apply a fixture RGD and wait for a
`GraphRevision` to be created. Call `GET /api/v1/kro/graph-revisions?rgd=<name>`.
Confirm the response lists at least one revision with `spec.revision`, `spec.snapshot.name`,
and `status.conditions`.

**Acceptance Scenarios**:

1. **Given** kro v0.9.0 cluster with one GraphRevision for `my-app`, **When**
   `GET /api/v1/kro/graph-revisions?rgd=my-app`, **Then** returns `{items: [{...}]}`
   sorted by `spec.revision` descending
2. **Given** pre-v0.9.0 cluster (no graphrevisions CRD), **When** same request,
   **Then** returns `{items: []}` (not an error)
3. **Given** a valid GraphRevision name, **When** `GET /api/v1/kro/graph-revisions/<name>`,
   **Then** returns the full `GraphRevision` object

---

### User Story 5 — `lastIssuedRevision` shown in RGD detail (Priority: P2)

On a kro v0.9.0 cluster, the RGD detail page header (or status section) shows the
`status.lastIssuedRevision` value when non-zero, as "Revision #N".

**Acceptance Scenarios**:

1. **Given** an RGD with `status.lastIssuedRevision: 3`, **When** viewing the
   RGD detail page, **Then** "Revision #3" appears in the header or status summary
2. **Given** an RGD with no `lastIssuedRevision` (pre-v0.9.0 or zero), **Then**
   the field is omitted (graceful degradation per §XII)

---

### User Story 6 — Capabilities baseline updated for v0.9.0 defaults (Priority: P2)

The kro v0.9.0 baseline reflects the new defaults. `hasExternalRefSelector` moves
from `false` to `true` in the baseline (it was stabilised in v0.9.0). Feature
gates `CELOmitFunction` and `InstanceConditionEvents` remain `false` (still Alpha).

**Acceptance Scenarios**:

1. **Given** a fresh kro-ui start with no capabilities data, **When** the
   BASELINE constant is used, **Then** `hasExternalRefSelector: true` is the
   default (instead of v0.8.x's `false`)
2. **Given** the capabilities API detects a cluster with `graphrevisions` in
   `knownResources`, **Then** `hasGraphRevisions: true` is returned

---

### User Story 7 — Designer forEach supports multiple iterators (cartesian) (Priority: P2)

A designer user adds a second iterator to a forEach resource (e.g. a second
dimension for cartesian product). The YAML preview emits both iterator entries
in the `forEach:` array.

**Acceptance Scenarios**:

1. **Given** a forEach resource with two iterators `region`/`tier`, **When**
   generating YAML, **Then** the output contains:
   ```yaml
   forEach:
   - region: ${schema.spec.regions}
   - tier: ${schema.spec.tiers}
   ```
2. The "Add iterator" button adds a new empty iterator row to the forEach section

---

## Requirements

### Functional Requirements

**Capabilities & Discovery**

- **FR-001**: `SchemaCapabilities.HasGraphRevisions` MUST be added; set `true`
  when `graphrevisions` appears in `kro.run/v1alpha1` resources
- **FR-002**: BASELINE `hasExternalRefSelector` MUST change from `false` to `true`
  (kro v0.9.0 ships this by default)
- **FR-003**: `KroCapabilities.schema` MUST gain `hasGraphRevisions bool` field

**Backend GraphRevision API**

- **FR-010**: `GET /api/v1/kro/graph-revisions?rgd=<name>` MUST return a list of
  `GraphRevision` objects filtered by `spec.snapshot.name == rgd`; sorted by
  `spec.revision` descending; returns `{items: []}` on clusters without the CRD
- **FR-011**: `GET /api/v1/kro/graph-revisions/<name>` MUST return a single
  `GraphRevision` or 404; uses the internal GVR
  `internal.kro.run/v1alpha1/graphrevisions`
- **FR-012**: Both endpoints MUST respect the ≤5s response budget (§XI)
- **FR-013**: The `GraphRevision` GVR MUST be discovered via `ServerResourcesForGroupVersion`
  for `internal.kro.run/v1alpha1`; never hardcoded

**Frontend Scope Badge**

- **FR-020**: RGD cards (Overview + Catalog) MUST show a "Cluster" scope badge
  when `spec.schema.scope === 'Cluster'`
- **FR-021**: RGD detail header MUST show the scope badge when `scope === 'Cluster'`
- **FR-022**: `scope: 'Namespaced'` (or absent) MUST NOT show any badge

**Frontend Types Display**

- **FR-030**: DocsTab MUST render a "Types" section when `spec.schema.types` is
  a non-empty object; gated on `hasTypes` capability
- **FR-031**: Each named type in `types` MUST list its fields with the same
  field-table format used for Spec fields

**CEL Highlighter**

- **FR-040**: CEL expressions containing `transformMap`, `transformList`,
  `transformMapEntry` MUST be tokenised as `celExpression` tokens (the entire
  `${...}` block). The existing tokenizer already handles this via the `${...}`
  pattern — this requirement is a regression guard. No new token sub-type is needed
  since kro-ui highlights the full CEL block, not individual function names within it.

**RGD Detail — lastIssuedRevision**

- **FR-050**: When `status.lastIssuedRevision` is present and > 0, display
  "Revision #N" in the RGD detail header alongside the existing status dot

**Designer — Cartesian forEach**

- **FR-060**: The "Add iterator" button in forEach resource form MUST add a new
  ForEachIterator row (second, third, …)
- **FR-061**: YAML generation MUST emit all iterators as separate entries in the
  `forEach:` array (already done by existing generator.ts; UI just needs the button)

### Non-Functional Requirements

- **NFR-001**: No new npm or Go dependencies
- **NFR-002**: `go test -race ./...` and `bun typecheck` MUST pass
- **NFR-003**: All handlers respect the 5-second response budget (§XI)
- **NFR-004**: Discovery for `internal.kro.run/v1alpha1` is cached ≥30s
- **NFR-005**: Graceful degradation: any absent field renders as "not reported",
  not an error

### Key Components

**Backend**

- `internal/k8s/capabilities.go` — add `HasGraphRevisions` to `SchemaCapabilities`;
  add `internal.kro.run/v1alpha1` discovery step
- `internal/api/handlers/graph_revisions.go` — new file: `ListGraphRevisions`,
  `GetGraphRevision`
- `internal/server/server.go` — register new routes

**Frontend**

- `web/src/lib/api.ts` — add `hasGraphRevisions` to `KroCapabilities.schema`;
  add `listGraphRevisions`, `getGraphRevision` API functions
- `web/src/lib/features.ts` — update BASELINE (`hasExternalRefSelector: true`,
  `hasGraphRevisions: false`); add `hasGraphRevisions`
- `web/src/lib/highlighter.ts` — add comprehension macros to function token set
- `web/src/components/RGDCard.tsx` — render "Cluster" scope badge
- `web/src/components/RGDDetailHeader.tsx` (or equivalent) — scope badge +
  `lastIssuedRevision`
- `web/src/components/DocsTab.tsx` — render `types` section
- `web/src/components/RGDAuthoringForm.tsx` — "Add iterator" second dimension
  support for cartesian forEach

---

## Testing Requirements

### Unit Tests (required before merge)

**Backend**

```go
// internal/k8s/capabilities_test.go
// Add: TestDetectsGraphRevisions — when graphrevisions in knownResources,
//       HasGraphRevisions is true
// Add: TestBaselineHasExternalRefSelectorTrue — baseline now has hasExternalRefSelector=true
```

```go
// internal/api/handlers/graph_revisions_test.go (new)
// - ListGraphRevisions returns empty list when CRD absent
// - ListGraphRevisions filters by rgd param
// - GetGraphRevision returns 404 for unknown name
```

**Frontend**

```typescript
// web/src/lib/highlighter.test.ts
// Add: transformMap/transformList/transformMapEntry classified as function tokens
```

```typescript
// web/src/lib/features.test.ts
// Add: BASELINE has hasExternalRefSelector=true, hasGraphRevisions=false
```

```typescript
// web/src/lib/generator.test.ts
// Add: emits two forEach dimensions in cartesian mode
// (mostly already covered — verify "Add iterator" code path)
```

---

## Fixture Updates

```bash
make dump-fixtures   # re-run after confirming kro v0.9.0 in go.mod
```

Verify `test/e2e/fixtures/upstream-cartesian-foreach-rgd.yaml` and
`upstream-cluster-scoped-rgd.yaml` still pass `kubectl apply --dry-run=server`
on a v0.9.0 cluster.

---

## Success Criteria

- **SC-001**: Build passes: `make go`, `bun typecheck`, `go test -race ./...`
- **SC-002**: `GET /api/v1/kro/graph-revisions?rgd=<name>` returns `{items: []}`
  gracefully on pre-v0.9.0 cluster
- **SC-003**: Cluster-scoped RGDs show "Cluster" badge on Overview cards
- **SC-004**: `transformMap`/`transformList`/`transformMapEntry` are highlighted
  as function tokens
- **SC-005**: DocsTab shows Types section for RGDs with `spec.schema.types`
- **SC-006**: BASELINE `hasExternalRefSelector` is `true`
- **SC-007**: All E2E journeys pass (including `043-cluster-scoped`,
  `043-cartesian-foreach`, `043-cel-comprehensions`)
