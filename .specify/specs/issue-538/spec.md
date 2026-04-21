# Spec: instance-538 — Instance Resource Graph

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Instance resource graph: show all k8s resources owned by this instance (🔲 → ✅)

## Zone 1 — Obligations

**O1**: When the instance detail page loads, all k8s resources owned by the instance SHALL be
shown in a "Resources" section below the DAG panels. Violation: section absent or empty when
children exist.

**O2**: Resources SHALL be grouped by kind. Violation: flat list with no kind grouping.

**O3**: Each resource SHALL display: kind (as group header), name, namespace (or "cluster-scoped"),
age, and a health status indicator (running/pending/error/not-reported). Violation: any of
these fields missing.

**O4**: The section SHALL show a count badge on the group header: "Deployment (3)".
Violation: no count shown.

**O5**: When children are still loading, the section SHALL show a skeleton/loading state.
When children are empty, it SHALL show "No managed resources found" empty state.
Violation: blank white space or error text during load.

**O6**: Each resource row SHALL be clickable to open the LiveNodeDetailPanel for that resource.
The panel opens by resolving to the child resource's GVR and fetching its YAML.
Violation: resource rows are not interactive.

**O7**: The component SHALL be covered by a unit test that renders it with mock children data
and asserts grouped output and empty-state rendering.

## Zone 2 — Implementer's judgment

- Panel placement: below existing SpecPanel/ConditionsPanel/EventsPanel row.
- Collapsed by default per kind group (accordion) or expanded — engineer's choice.
- Status derivation reuses `itemStatus()` logic from CollectionPanel.
- Resource rows can be simplified (no expand/YAML inline) — clicking opens the existing side panel.
- Re-use existing `StatusDot` component for health indicators.
- Grouping: `kind` from `metadata` or top-level `kind` field of the K8sObject.

## Zone 3 — Scoped out

- Instance mutation or YAML editing in this view
- Custom sorting within groups
- Pagination (all resources shown; use list if count < 500 per group)
- Export of resource list as YAML
