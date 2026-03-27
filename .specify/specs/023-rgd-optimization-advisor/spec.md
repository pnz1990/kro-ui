# Feature Specification: RGD Optimization Advisor

**Feature Branch**: `023-rgd-optimization-advisor`
**Created**: 2026-03-22
**Status**: Draft
**Depends on**: `003-rgd-detail-dag` (merged), `017-rgd-validation-linting` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §V (Simplicity),
§IX (Theme), §XII (Graceful Degradation), §XIII (UX Standards)
**Design ref**: `000-design-system` § DAG node visual identity

---

## Context

When authors write kro RGDs, they sometimes define multiple `NodeTypeResource`
entries that share the same `apiVersion`/`kind` and have structurally similar
templates — for example, three `apps/v1 Deployment` resources that differ only
by name or a single parameter. These are strong candidates for collapse into a
single `NodeTypeCollection` (forEach), which reduces RGD size, eliminates
duplication, and makes the resource set easier to reason about.

kro-ui is well-positioned to detect this pattern statically from the data it
already has on the RGD detail page. This spec adds a passive advisor: when two
or more sibling resources match the collapse criteria, a non-intrusive suggestion
appears in the Graph tab explaining the pattern, what would change, and linking
to the kro forEach documentation.

The advisor is **read-only and purely informational** — it never modifies the
RGD, never issues cluster mutations, and never blocks the user.

---

## Collapse Detection Rules

The static analysis examines sibling `NodeTypeResource` nodes only.
`NodeTypeCollection`, `NodeTypeExternal`, and `NodeTypeExternalCollection` are
excluded — they are already collections or references, not candidate templates.

Two or more resources form a **collapse candidate group** when ALL of the
following are true:

1. They share the same `apiVersion` and `kind` in their templates
2. Their template structures share ≥ 70% top-level key overlap (Jaccard
   similarity of key sets, not values) OR the group contains ≥ 3 resources
3. None of them already has a `forEach` field

The 70% threshold is intentionally conservative to minimize false positives. A
group of 3 or more identical-kind resources is always flagged regardless of key
overlap, as three identical kinds is unambiguous duplication.

---

## User Scenarios & Testing

### User Story 1 — Author sees a collapse suggestion on the DAG detail page (Priority: P1)

A platform engineer opens an RGD that has three `apps/v1 Deployment` resources
(e.g., `frontendDeployment`, `backendDeployment`, `workerDeployment`). After
the DAG renders, a suggestion area appears below the graph: "3 Deployment
resources could be a forEach collection." Clicking "Learn more" expands an
explanation panel describing what `forEach` means, what would change, and
providing a link to the kro forEach documentation.

**Why this priority**: The primary value of the advisor is making the pattern
visible to authors who may not know about `forEach`. Without this suggestion
the inefficiency is invisible in the UI.

**Independent Test**: Load the RGD detail page for an RGD with 3 resources of
the same `apiVersion/kind`. Confirm the suggestion area appears with the correct
kind and count. Confirm the area is absent on an RGD with no repeated kinds.

**Acceptance Scenarios**:

1. **Given** an RGD with `frontendDeploy`, `backendDeploy`, `workerDeploy` all
   of kind `apps/v1 Deployment`, **When** the Graph tab loads, **Then** a
   suggestion item appears: "3 `Deployment` resources share the same kind —
   consider a forEach collection"
2. **Given** the suggestion item is visible, **When** the author expands it
   (clicks "Learn more"), **Then** an explanation panel appears with: what
   `forEach` is, what would change, and a link to the kro forEach docs
3. **Given** an RGD with 2 `v1 ConfigMap` resources that have ≥ 70% top-level
   key overlap, **When** the page loads, **Then** a suggestion item appears
   for that pair
4. **Given** an RGD with 2 `v1 ConfigMap` resources with < 70% key overlap
   (structurally dissimilar), **When** the page loads, **Then** no suggestion
   is shown for that pair
5. **Given** an RGD with no repeated kinds, **When** the page loads, **Then**
   no suggestion area renders at all
6. **Given** an RGD with 1 `NodeTypeCollection` and 2 `Deployment`
   `NodeTypeResource` nodes, **When** analyzed, **Then** only the 2 plain
   resources are considered; the existing collection is excluded from analysis
7. **Given** the suggestion item is visible, **When** the author clicks the
   dismiss button (×), **Then** that item disappears for the remainder of
   the session (no persistent storage required)

---

### User Story 2 — Multiple collapse candidate groups are surfaced (Priority: P2)

An RGD has both 3 `Deployment` resources AND 2 `ConfigMap` resources with
similar templates. Both groups are surfaced as separate suggestion items.

**Why this priority**: Real-world RGDs can have multiple duplication patterns.
Surfacing all groups helps authors get the most out of forEach.

**Independent Test**: Load an RGD with two separate qualifying groups. Confirm
two distinct items appear, each identifying the correct kind and count. Dismiss
one and confirm the other remains visible.

**Acceptance Scenarios**:

1. **Given** an RGD with 3 qualifying `Deployment` nodes and 2 qualifying
   `ConfigMap` nodes, **When** rendered, **Then** both groups appear as
   separate suggestion items
2. **Given** both items are visible, **When** the author dismisses one,
   **Then** the other remains visible
3. **Given** a group where all members already have `forEach` set, **When**
   analyzed, **Then** that group is not included in the results

---

### User Story 3 — Suggestion panel explains what forEach would change (Priority: P2)

Expanding a suggestion shows a plain-language explanation of how the author
would refactor the resources into a forEach collection, including the
`${each.*}` variable pattern, and a link to the kro forEach documentation.

**Why this priority**: Knowing that something *could* be a forEach is only
useful if the author understands what that means and how to do it.

**Independent Test**: Expand a suggestion for 3 `Deployment` resources.
Confirm the explanation mentions `forEach`, the `${each.*}` variable pattern,
and includes a clickable link to the kro forEach documentation.

**Acceptance Scenarios**:

1. **Given** the suggestion is expanded, **Then** the panel shows:
   - A plain-language description of what `forEach` does in kro
   - A note that values that differ across instances would become `${each.value}`
     CEL references
   - A link labeled "kro forEach docs" pointing to
     `https://kro.run/docs/concepts/forEach`
2. **Given** the forEach docs link is clicked, **Then** it opens in a new
   browser tab
3. **Given** the explanation is shown, **Then** it contains no editable input
   fields, apply buttons, or mutation controls (advisor is read-only)

---

### Edge Cases

- RGD with 0 resources → no analysis, no suggestion area rendered
- RGD with all resources already being `NodeTypeCollection` → no suggestion
- RGD where resource templates have no `kind` field (malformed) → skip those
  resources silently; do not crash; do not surface a suggestion for them
- Two resources where one has `includeWhen` and one does not → both are still
  candidates; the `includeWhen` modifier does not disqualify a resource
- RGD where `apiVersion` is missing from a template but `kind` is present →
  use `kind` alone for grouping, treating missing `apiVersion` as an empty
  string (do not crash)
- Very large RGD (50+ resources) → analysis completes and the suggestion area
  renders with no visible delay; no jank introduced to the Graph tab

---

## Requirements

### Functional Requirements

- **FR-001**: The advisor MUST perform static analysis on the `spec.resources`
  array of the already-loaded RGD object — no additional API call is permitted
- **FR-002**: A pure function `detectCollapseGroups` MUST be added to
  `web/src/lib/dag.ts` (alongside existing DAG helpers, per constitution §IX
  shared helpers rule); it accepts an RGD `spec` object and returns
  `CollapseGroup[]`
- **FR-003**: A resource qualifies for analysis when it is classified as
  `NodeTypeResource` by the same classification rules as `buildDAGGraph`; any
  other node type is excluded
- **FR-004**: Two or more qualifying resources form a candidate group when:
  (a) they share the same `apiVersion` and `kind`, AND (b) their template
  top-level key sets have ≥ 70% Jaccard similarity OR the group size is ≥ 3,
  AND (c) none of them already has a `forEach` field
- **FR-005**: The suggestion area MUST appear in the Graph tab, below the DAG
  SVG, and MUST NOT render when there are no candidate groups
- **FR-006**: Each candidate group MUST produce a separate suggestion item
  showing: the candidate count, the `apiVersion/kind`, and an expand toggle
- **FR-007**: Expanding a suggestion item MUST show: a plain-language
  explanation of kro `forEach`, the `${each.*}` variable substitution pattern,
  and a link to `https://kro.run/docs/concepts/forEach`
- **FR-008**: The forEach docs link MUST open in a new tab (with
  `rel="noopener noreferrer"`)
- **FR-009**: Each suggestion item MUST have a dismiss button; dismissal
  hides the item for the current session only (no persistent storage)
- **FR-010**: `detectCollapseGroups` MUST return an empty array — not throw —
  when `spec.resources` is absent, null, or empty
- **FR-011**: Node type classification in `detectCollapseGroups` MUST reuse
  the classification logic from `buildDAGGraph`; the rules MUST NOT be
  duplicated

### Key Entities

- **CollapseGroup**: a detected candidate group — `apiVersion: string`,
  `kind: string`, `nodeIds: string[]` (the IDs of the qualifying resources)
- **CollapseGroupSuggestion**: per-group UI state — `group: CollapseGroup`,
  `dismissed: boolean`, `expanded: boolean`

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: The suggestion area appears within 100ms of the DAG rendering
  for any RGD with qualifying candidates (derived from already-loaded data,
  no network round-trip required)
- **SC-002**: No false positives: RGDs with only unique-kind resources produce
  zero suggestion items in 100% of defined test cases
- **SC-003**: The forEach docs link opens in a new tab in all major browsers
- **SC-004**: Dismissing one suggestion removes it immediately without
  affecting other visible suggestions or the DAG
- **SC-005**: The analysis function handles malformed or absent templates
  without throwing in 100% of the defined edge case tests
- **SC-006**: The feature introduces zero new API requests — all data is
  derived from the already-loaded RGD object
- **SC-007**: TypeScript strict mode passes with 0 errors

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/dag.test.ts (extend existing file)
describe("detectCollapseGroups", () => {
  it("returns empty array for RGD with no resources", () => { ... })
  it("returns empty array for RGD with all unique kinds", () => { ... })
  it("detects 3 Deployments of same apiVersion as a single candidate group", () => { ... })
  it("detects 2 ConfigMaps with >=70% key overlap as a candidate group", () => { ... })
  it("does NOT flag 2 ConfigMaps with <70% key overlap", () => { ... })
  it("excludes NodeTypeCollection nodes from analysis", () => { ... })
  it("excludes NodeTypeExternal nodes from analysis", () => { ... })
  it("groups by apiVersion+kind (not kind alone)", () => { ... })
  it("handles missing template field gracefully (no throw)", () => { ... })
  it("handles missing apiVersion in template — groups on kind alone", () => { ... })
  it("returns multiple groups when multiple qualifying sets exist", () => { ... })
  it("excludes resources that already have a forEach field", () => { ... })
})

// web/src/components/OptimizationAdvisor.test.tsx
describe("OptimizationAdvisor", () => {
  it("renders nothing when groups array is empty", () => { ... })
  it("renders one suggestion item per candidate group", () => { ... })
  it("expands explanation on toggle click", () => { ... })
  it("shows forEach docs link with target=_blank and rel=noopener noreferrer", () => { ... })
  it("removes a suggestion item on dismiss click", () => { ... })
  it("keeps other suggestions visible after one is dismissed", () => { ... })
})
```

### Key Components

- **`detectCollapseGroups`** in `web/src/lib/dag.ts`: pure function, accepts
  RGD `spec`, returns `CollapseGroup[]`
- **`OptimizationAdvisor`** (`web/src/components/OptimizationAdvisor.tsx`):
  renders the full suggestion area; accepts `groups: CollapseGroup[]`;
  manages dismiss/expand state locally with `useState`
- `OptimizationAdvisor` is rendered in `RGDDetail.tsx` (Graph tab only),
  below the `DAGGraph` component

---

## Assumptions

- The forEach docs URL `https://kro.run/docs/concepts/forEach` is assumed
  stable; if it changes it is updated in a single named constant
- Structural similarity uses shallow (top-level) key comparison only to keep
  analysis O(n) without deep JSON diffing
- Session-only dismissal with no `localStorage` is sufficient for v1;
  persistence across sessions can be added in a follow-up
- The suggestion area appears in the Graph tab only — not the YAML or
  Validation tabs, since the insight is structural, not textual
- No i18n required for v1; all explanation text is English
