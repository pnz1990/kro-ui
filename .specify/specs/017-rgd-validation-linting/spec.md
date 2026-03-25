# Feature Specification: RGD Validation & Linting View

**Feature Branch**: `017-rgd-validation-linting`
**Created**: 2026-03-20
**Status**: Merged
**Depends on**: `003-rgd-detail-dag` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only),
§V (Simplicity), §IX (Theme)

---

## Context

kro performs static analysis on RGDs at apply time: topological sorting,
CEL type checking, schema validation, and cycle detection. The results are
stored in the RGD's `.status.conditions`. This spec surfaces those conditions
in a dedicated "Validation" tab, making the RGD detail page useful for
authoring and debugging — not just observability.

All data comes from the RGD's `.status` field on the Kubernetes API server.
No kro controller logs or internal APIs are required.

---

## Available Data (from `.status.conditions`)

kro sets these conditions on each RGD:

| Condition Type | Meaning |
|----------------|---------|
| `GraphVerified` | Dependency graph is valid (no cycles, all refs resolve) |
| `CustomResourceDefinitionSynced` | Generated CRD is applied to API server |
| `TopologyReady` | Topological sort succeeded |
| `Ready` | Overall readiness (all above are True) |

Each condition has: `type`, `status` (True/False/Unknown), `reason`, `message`,
and `lastTransitionTime`.

---

## User Scenarios & Testing

### User Story 1 — Platform engineer sees RGD validation status (Priority: P1)

On the RGD detail page, a "Validation" tab shows the status of each validation
condition as a checklist. Green checkmarks for passing conditions, red X marks
for failing ones, with the reason and message displayed inline.

**Why this priority**: When an RGD is stuck in `Ready=False`, the first question
is "which validation step failed?" Currently this requires `kubectl describe rgd`.
This tab answers it instantly.

**Independent Test**: With an RGD that has `GraphVerified=False` (due to a cycle),
open the Validation tab. Confirm: `GraphVerified` shows a red X with the error
message from the condition.

**Acceptance Scenarios**:

1. **Given** an RGD with all conditions `True`, **When** the Validation tab
   renders, **Then** all items show green checkmarks with "Passed" status
2. **Given** an RGD with `GraphVerified=False, reason=CycleDetected,
   message="cycle detected: A → B → A"`, **When** rendered, **Then**
   `GraphVerified` shows a red X, reason "CycleDetected", and the full
   message displayed in a monospace block
3. **Given** an RGD with `CustomResourceDefinitionSynced=False`, **When**
   rendered, **Then** the item shows red X with the sync error message
4. **Given** an RGD with no conditions (the connected kro version does not
   emit these condition types), **When** rendered, **Then** all absent items
   show a neutral `–` indicator with **"Not reported"** and the sub-text
   "Not emitted by the connected kro version" — **not** "Pending". This
   distinguishes "kro doesn't emit this condition on this version" from
   "kro emitted the condition but hasn't processed it yet".
5. **Given** an RGD where a condition IS present but has `status=Unknown`
   (controller has emitted it but hasn't finished processing), **When**
   rendered, **Then** the item shows a gray `○` indicator with "Pending"
   and "Awaiting controller processing" — distinct from the absent case above.
6. **Given** the Validation tab is open and the RGD conditions change (e.g.,
   controller processes it), **When** the user refreshes or navigates back,
   **Then** the updated conditions are shown

---

### User Story 2 — Platform engineer sees RGD resource summary (Priority: P2)

Below the validation checklist, the tab shows a resource summary extracted from
the RGD spec: total resource count, node type breakdown (how many resources,
collections, external refs), and a list of all CEL cross-references detected.

**Acceptance Scenarios**:

1. **Given** an RGD with 3 `NodeTypeResource`, 1 `NodeTypeCollection`, and
   1 `NodeTypeExternal`, **When** rendered, **Then** the summary shows:
   "5 resources: 3 managed, 1 collection, 1 external ref"
2. **Given** an RGD with CEL references `${database.status.endpoint}` and
   `${schema.spec.name}`, **When** rendered, **Then** the cross-reference list
   shows both expressions with source and target node labels

---

### Edge Cases

- RGD with unknown condition types (future kro version adds new ones) → render
  them generically with type name, status, and message; do NOT crash
- Condition `message` field is very long (500+ characters) → show first 200
  characters with "Show more" toggle
- Condition `lastTransitionTime` is zero/missing → show "N/A" for the timestamp

---

## Requirements

### Functional Requirements

- **FR-001**: Validation tab MUST read conditions from the already-loaded RGD
  object (no additional API call)
- **FR-002**: Each known condition type MUST be displayed with: type name,
   status icon (green ✓ / red ✗ / gray ○ / dash –), reason, message, last
   transition time. The status rendering MUST distinguish four states with the
   following normative CSS class names:
   - `True` → green ✓ "Passed" — CSS class: `condition-item--passed`
   - `False` → red ✗ with reason and message — CSS class: `condition-item--failed`
   - `Unknown` (condition present, status Unknown) → gray ○ "Pending / Awaiting controller processing" — CSS class: `condition-item--pending`
   - Absent (condition not in `status.conditions` at all) → dash `–` "Not reported / Not emitted by the connected kro version" — CSS class: `condition-item--absent`
- **FR-003**: Unknown condition types MUST be rendered generically
- **FR-004**: Resource summary MUST be computed client-side from `spec.resources`
  using the same node type classification as spec 003 (`buildDAGGraph`)
- **FR-005**: CEL cross-reference list MUST be extracted by parsing `${...}`
  tokens from resource templates
- **FR-006**: Validation tab MUST be accessible via `?tab=validation` URL param

### Non-Functional Requirements

- **NFR-001**: Validation tab renders within 200ms (no API call, data already loaded)
- **NFR-002**: TypeScript strict mode MUST pass

### Key Components

- **`ValidationTab`** (`web/src/components/ValidationTab.tsx`): validation
  checklist + resource summary
- **`ConditionItem`** (`web/src/components/ConditionItem.tsx`): single condition
  row with icon, reason, message, timestamp
- **`ResourceSummary`** (`web/src/components/ResourceSummary.tsx`): node type
  breakdown and CEL cross-reference list

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/components/ValidationTab.test.tsx
describe("ValidationTab", () => {
  it("shows green checkmark for True conditions", () => { ... })
  it("shows red X for False conditions", () => { ... })
  it('shows "Not reported" (–) with condition-item--absent for absent conditions', () => { ... })
  it('shows gray pending (○) for conditions present with status=Unknown', () => { ... })
  it("renders unknown condition types generically", () => { ... })
  it("shows resource summary with correct type breakdown", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: All known condition types displayed with correct status icons
- **SC-002**: Error messages shown verbatim for failed conditions
- **SC-003**: Resource summary matches the DAG node count
- **SC-004**: Unknown future condition types render without crashing
- **SC-005**: TypeScript strict mode passes with 0 errors
