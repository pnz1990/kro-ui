# Feature Specification: Live DAG — Per-Node State Coloring and Legend

**Feature Branch**: `038-live-dag-per-node-state`
**Created**: 2026-03-24
**Status**: Draft
**Extends**: `005-instance-detail-live` (live DAG), `029-dag-instance-overlay` (shares state-map logic)
**GH Issues**: #166 (per-node state), #167 (live DAG legend)
**Input**: User description: "live instance DAG per-node state and legend"

---

## Context

The instance detail page (`/rgds/*/instances/*/*`) displays a live DAG that polls
every 5 seconds. Today, only the root CR node (the instance itself) receives a
live-state color (green/amber/red/gray). All managed resource nodes — the Namespace,
the ConfigMap, each CR — remain permanently unstyled, showing no operational signal.

The fix is a two-part delivery:

1. **Per-node state coloring**: extend the live poll to also fetch the child resources
   for the instance, then map each DAG node to a state derived from whether its
   corresponding Kubernetes object exists in the cluster.
2. **Live-state legend**: add a color legend below the live DAG so users know what
   each color means.

**Approach selected — Option A (existence check)**:
Each child resource node is colored based on whether its Kubernetes object is present
in the cluster's child resource list. A node whose object exists is `alive`; one whose
object is absent is `not-found`. This requires zero additional API calls beyond the
`getInstanceChildren` fetch that the page already performs, and directly answers the
operator's primary question: "did kro create this resource?"

Option B (per-resource `status.conditions`) was considered but deferred — it requires
N additional API calls per poll cycle and adds significant complexity out of proportion
to the incremental signal it provides at this stage.

---

## User Scenarios & Testing

### User Story 1 — Operator sees live state for every resource node in the DAG (Priority: P1)

An operator navigating to an instance detail page sees all managed resource nodes
colored according to their live state — not just the root CR. After one poll cycle,
a ConfigMap node turns green (it exists), a not-yet-created Hero CR stays gray (it
does not exist), and a Namespace being deleted shows an error color.

**Why this priority**: The entire point of the live DAG is operational visibility.
A DAG where only 1 of 16 nodes shows color is actively misleading — it suggests
only 1 resource is being tracked. This is the core defect.

**Independent Test**: Open an instance detail page for an RGD with 3+ managed resources.
After one poll cycle, count the nodes with a live-state color. The count must equal
the number of managed resource nodes, not just 1.

**Acceptance Scenarios**:

1. **Given** an instance with 5 managed resource nodes (e.g. Namespace, Hero, Boss,
   ConfigMap, Monster), **When** the page loads and completes its first poll cycle,
   **Then** every one of those 5 nodes has a live-state color — not just the root CR
2. **Given** a resource that has been created by kro and exists in the cluster,
   **When** the live DAG renders, **Then** its node is colored green (alive state)
3. **Given** a resource that has not yet been created by kro,
   **When** the live DAG renders, **Then** its node shows the gray dashed "not found"
   state — not blank, not an error
4. **Given** a resource whose Kubernetes object has a deletion timestamp set (terminating),
   **When** the live DAG renders, **Then** its node shows the error color
5. **Given** the DAG contains `forEach` collection nodes,
   **When** the live DAG renders, **Then** the collection node state reflects whether
   any collection member objects exist in the cluster
6. **Given** state nodes in the DAG (condition-gated routing nodes),
   **When** the live DAG renders, **Then** those state nodes are never given a
   live-state color (they produce no Kubernetes objects)

---

### User Story 2 — Operator reads the live-state legend (Priority: P2)

Below the live DAG, a compact legend identifies each live-state color with its
meaning. The operator can refer to it at any time to understand what green, amber,
rose, and gray dashed mean — without having to leave the page or consult documentation.

**Why this priority**: Without a legend, the color coding requires prior knowledge.
The legend is a small addition but dramatically improves the first-time experience
and is required before the per-node coloring is useful to new users.

**Independent Test**: Navigate to any instance detail page. The legend is visible
below the DAG, shows at least 4 state labels, and uses the same colors as the DAG nodes.

**Acceptance Scenarios**:

1. **Given** the instance detail page, **When** the live DAG is visible,
   **Then** a legend component is visible directly below the DAG SVG
2. **Given** the legend, **When** inspected, **Then** it shows entries for:
   Alive (green), Reconciling (amber), Error (rose), Not Found (gray dashed)
3. **Given** the legend, **When** the user hovers over a live node colored amber,
   **Then** the node color and the "Reconciling" legend entry use the same visual
   treatment — confirming they represent the same state
4. **Given** the static RGD Graph tab (non-live), **When** rendered,
   **Then** the legend is also visible, helping users understand the DAG node type
   color coding on that page as well

---

### User Story 3 — Live state survives continuous polling without drift (Priority: P1)

The per-node state updates correctly on every poll cycle. If a resource is created
between polls, its node transitions from gray to green on the next cycle. If a resource
is deleted, its node transitions back to gray. The panel and DAG layout are unaffected.

**Why this priority**: Correctness of the state update loop is essential. A stale
or incorrect state is worse than no state — it causes operators to make wrong decisions.

**Independent Test**: With a multi-resource instance, delete one child resource using
kubectl. After the next poll cycle (≤5 seconds), the corresponding DAG node transitions
from alive to not-found without any page reload or layout shift.

**Acceptance Scenarios**:

1. **Given** a live DAG with all nodes alive, **When** a child resource is deleted
   externally and 5 seconds elapse, **Then** that node's color transitions to
   not-found on the next successful poll
2. **Given** a live DAG with a not-found node, **When** kro creates that resource
   and 5 seconds elapse, **Then** that node's color transitions to alive
3. **Given** the `NodeDetailPanel` is open on a specific node, **When** a poll
   fires and updates node states, **Then** the panel remains open and the state
   badge in the panel updates — the panel does not close or re-mount
4. **Given** a poll cycle fails (network error), **When** the failure occurs,
   **Then** the last known node states are preserved (not reset to unstyled);
   a "Refresh paused" indicator is shown in the header

---

### Edge Cases

- An instance with 0 child resources (just created, kro not yet reconciled) → all
  resource nodes show not-found; the root CR shows alive (it exists). This is a valid
  and expected transitional state, not an error.
- An RGD with multiple resources of the same `kind` (e.g., two ConfigMaps) → the
  first child object of each kind found in the children list maps to the node; the
  second is not separately represented in the state map. This is a known limitation of
  Option A's kind-keyed approach.
- State nodes in the DAG → never overlaid with live-state color regardless of any
  condition; they represent routing logic, not Kubernetes objects.
- `forEach` collection nodes → if any member object of the expected kind is found in
  the children list, the collection node is alive; if none are found, not-found.
- The `NodeDetailPanel` YAML section → not affected by this spec; YAML is fetched
  on demand and is not changed by the per-node state mapping.
- Children fetch fails independently → node states fall back to "all not-found" for
  resource nodes; root CR state from instance conditions is preserved.

---

## Requirements

### Functional Requirements

- **FR-001**: The live DAG poll cycle MUST re-fetch child resources on every tick,
  in parallel with the instance and events fetches (no additional serial delay)
- **FR-002**: After each poll cycle, every managed resource node in the live DAG
  MUST have an explicit live-state color — none may remain in the unstyled (base)
  state when the overlay is active
- **FR-003**: Live-state derivation for resource nodes MUST follow this rule:
  - Child object found in children list, no deletion timestamp → `alive`
  - Child object found but deletion timestamp is set → `error` (terminating)
  - Child object not found in children list → `not-found`
  - Root CR node (`nodeType === instance`) → derived from instance `status.conditions`
    (unchanged from current behavior)
- **FR-004**: State nodes (`nodeType === state`) MUST never receive a live-state
  color class; they represent routing logic, not Kubernetes objects
- **FR-005**: The child-to-node mapping MUST key by lowercase `kind` of the child
  resource. If no matching child is found for a DAG node, that node MUST receive an
  explicit `not-found` entry — not be omitted from the state map
- **FR-006**: A live-state legend MUST be rendered directly below the live DAG SVG
  on the instance detail page
- **FR-007**: The legend MUST contain at minimum four labeled entries:
  Alive · Reconciling · Error · Not Found — each using the same color treatment
  as the corresponding DAG node state
- **FR-008**: A live-state legend MUST be visible on the instance detail page. Whether
  the existing static-graph legend (spec `003-rgd-detail-dag`) is extended to include
  live-state swatches or a separate live-state legend is placed only on the instance
  detail page is an implementation choice — the requirement is that the legend is
  present and accurate on the instance detail page
- **FR-009**: Node state color updates MUST NOT cause any change to DAG node
  positions, sizes, edge paths, or labels — layout is computed once from the RGD spec
  and is stable between polls
- **FR-010**: The `NodeDetailPanel` MUST remain open and its state badge MUST update
  to reflect the latest poll data without closing or re-mounting the panel
- **FR-011**: All legend and live-state colors MUST reference named tokens from
  `tokens.css` via `var()`; no hardcoded hex or `rgba()` values in component CSS
- **FR-012**: When the children fetch fails independently of the instance fetch,
  all resource nodes MUST fall back to `not-found` state; the root CR state from
  instance conditions MUST be preserved

### Key Entities

- **Live DAG node state**: the visual state of a single DAG node during live polling.
  Five possible values: `alive`, `reconciling`, `error`, `not-found`, or unstyled
  (for state nodes). Derived from child resource presence and instance conditions.
- **Children list**: the set of Kubernetes objects managed by a specific instance,
  returned by the instance children API. Re-fetched on every poll cycle.
- **Live-state legend**: a visual key displayed below the live DAG that maps each
  color to its human-readable state name.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: After the first poll cycle on an instance detail page, the number of
  DAG nodes with a live-state color equals the number of managed resource nodes
  in the RGD — verified by the E2E journey asserting more than 1 node has a
  live-state class
- **SC-002**: No managed resource node remains permanently unstyled (zero nodes with
  the base/neutral style when the live poll has completed at least once)
- **SC-003**: A resource that transitions from absent to present in the cluster
  reflects its new `alive` state within one poll cycle (≤ 5 seconds), without a
  page reload — verified by E2E or manual observation
- **SC-004**: The live-state legend is visible on the instance detail page at all
  viewport widths ≥ 320px without requiring any scroll
- **SC-005**: All existing E2E journeys for the instance detail page (`005-live-instance.spec.ts`)
  continue to pass after this change — no regressions in existing node coloring,
  panel behavior, or polling
- **SC-006**: Unit tests for the state-mapping function confirm that a state map
  produced for an RGD with N managed resource nodes contains entries for all N
  nodes — including explicit `not-found` entries for nodes absent from the children list
