# Feature Specification: RGD Designer — Nav Promotion & Live DAG Preview

**Feature Branch**: `042-rgd-designer-nav`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "read gh issue 196"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Up Generate Tab (Priority: P1)

A user viewing an existing RGD's Generate tab currently sees a confusing "New RGD" option alongside the contextual "Instance Form" and "Batch" modes. Creating a brand-new RGD has nothing to do with the current RGD being viewed. This story removes that mode entirely, leaving only the two genuinely contextual modes.

**Why this priority**: Removing the misleading "New RGD" mode reduces cognitive confusion immediately and is a prerequisite for the nav promotion being coherent. It is the simplest, most bounded change.

**Independent Test**: Can be fully tested by navigating to any RGD detail page, opening the Generate tab, and confirming only "Instance Form" and "Batch" modes are present. Delivers a cleaner, less confusing authoring interface on its own.

**Acceptance Scenarios**:

1. **Given** a user is on the Generate tab of any RGD detail page, **When** they look at the mode selector, **Then** they see only "Instance Form" and "Batch" — no "New RGD" option.
2. **Given** the Generate tab is rendered, **When** the user inspects the page, **Then** no RGD authoring state, form, or YAML preview from the removed mode is rendered anywhere on the page.
3. **Given** the "New RGD" mode previously showed a link to the authoring page, **When** the mode is removed, **Then** an optional subtle text link — "Authoring a new RGD? Open the RGD Designer →" — may appear at the bottom of the Generate tab for discoverability, but the mode button itself must not exist.

---

### User Story 2 - RGD Designer as First-Class Nav Item (Priority: P1)

A user wants to author a new RGD. Currently, the entry point is a styled blue pill button labeled "+ New RGD" outside the main navigation. This looks like a secondary action rather than a full application section. This story promotes the authoring tool into the top navigation bar alongside Overview, Catalog, Fleet, and Events, relabeled as "RGD Designer".

**Why this priority**: Elevating the designer into the nav gives it equal visual weight with other major views, signals that it is a persistent tool (not a one-time wizard), and aligns with the application's information architecture.

**Independent Test**: Can be tested by verifying the top navigation bar contains an "RGD Designer" link that behaves identically to other nav links (active underline when on `/author`, same visual style). The old pill button must not be present.

**Acceptance Scenarios**:

1. **Given** the application is loaded on any page, **When** the user looks at the top navigation bar, **Then** they see "RGD Designer" as a nav link alongside Overview, Catalog, Fleet, and Events.
2. **Given** the user navigates to `/author`, **When** the nav renders, **Then** the "RGD Designer" link shows an active underline indicator matching the style of other active nav links.
3. **Given** the user is on any page other than `/author`, **When** the nav renders, **Then** the "RGD Designer" link shows no active indicator.
4. **Given** the old "+ New RGD" pill button was rendered outside `<nav>`, **When** the change is applied, **Then** no such button or pill-styled element exists anywhere in the top bar.
5. **Given** the user navigates to `/author`, **When** the page loads, **Then** the document title reads "RGD Designer — kro-ui".
6. **Given** the Home (Overview) or Catalog page shows an empty state with a call-to-action, **When** that CTA is rendered, **Then** its label reads "Open RGD Designer" rather than "Author your first RGD".

---

### User Story 3 - Live DAG Preview in RGD Designer (Priority: P2)

A user authoring a new RGD in the Designer currently sees a static YAML preview on the right. This story adds a live DAG visualization that updates in real time as the user fills in the form, showing how the resources they define relate to each other — giving immediate visual feedback on the dependency graph being constructed, without requiring any cluster connection.

**Why this priority**: The live DAG preview is a significant UX enhancement that makes the authoring experience substantially more powerful. It depends on the nav promotion (Story 2) being stable, but can be tested and delivered independently once the Designer exists as a first-class page.

**Independent Test**: Can be tested by opening the RGD Designer, adding resources, and verifying the DAG updates in real time to reflect the current form state, using the same visual style as the existing Graph tab.

**Acceptance Scenarios**:

1. **Given** the user opens the RGD Designer with no resources defined, **When** the page loads, **Then** the DAG area shows only the root `schema` node with hint text: "Add resources to see the dependency graph".
2. **Given** the user adds a resource via the form, **When** the resource is added, **Then** a new node appears in the DAG within 300ms.
3. **Given** the user removes a resource from the form, **When** the deletion is applied, **Then** the corresponding node disappears from the DAG within 300ms.
4. **Given** a resource's CEL expression references another resource by name, **When** the DAG renders, **Then** a directed edge appears between those nodes, consistent with the existing static Graph tab.
5. **Given** the designer is in the two-column layout, **When** the DAG panel is present, **Then** the DAG occupies the upper portion of the right column and the YAML preview occupies the lower portion, both visible simultaneously.
6. **Given** the DAG uses the same rendering pipeline as the existing Graph tab, **When** it renders, **Then** node visual styles (dark theme, token colors) are identical to those on the Graph tab.

---

### Edge Cases

- What happens when a resource's CEL expression references a resource name that does not yet exist in the form? The DAG should show the node without the edge; the edge appears only when both referenced nodes exist.
- What happens when the Kind field is empty? The root `schema` node label should fall back gracefully (e.g., display "schema") rather than showing `undefined` or a blank label.
- What happens when the user rapidly adds and removes resources? The 300ms debounce must coalesce changes so the DAG does not flash or render intermediate invalid states.
- What happens if a user had previously set the Generate tab to "New RGD" mode (in-memory state)? The Generate tab should default to "Instance Form" mode when the `'rgd'` mode is no longer valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Generate tab MUST NOT include a "New RGD" mode option; only "Instance Form" and "Batch" modes may be present.
- **FR-002**: All state, memos, and render branches associated with the removed `'rgd'` mode MUST be deleted from the Generate tab component.
- **FR-003**: The top navigation bar MUST include "RGD Designer" as a navigation link alongside Overview, Catalog, Fleet, and Events.
- **FR-004**: The "RGD Designer" navigation link MUST display an active visual indicator (underline) when the current route is `/author`, using the same style as all other active navigation links.
- **FR-005**: The pill-button entry point for the authoring page (previously "+ New RGD") MUST be removed from the top bar markup and its associated CSS class removed from the stylesheet.
- **FR-006**: The test identifier on the RGD Designer nav link MUST be `topbar-rgd-designer`.
- **FR-007**: The RGD Designer page document title MUST read `"RGD Designer — kro-ui"`.
- **FR-008**: Empty-state call-to-action text on the Overview and Catalog pages that previously read "Author your first RGD" MUST be updated to "Open RGD Designer".
- **FR-009**: The RGD Designer page MUST display a live DAG visualization that updates within 300ms (debounced) after any form change.
- **FR-010**: When no resources are defined, the DAG area MUST show only the root `schema` node with the hint: "Add resources to see the dependency graph".
- **FR-011**: Adding a resource MUST cause a corresponding DAG node to appear; removing a resource MUST cause the node to disappear.
- **FR-012**: CEL expression references between resources MUST be reflected as directed edges in the live DAG, consistent with the behavior of the existing static Graph tab.
- **FR-013**: The live DAG MUST use the same node styles (dark theme, token colors) as the existing RGD detail Graph tab.
- **FR-014**: The right column of the RGD Designer MUST show the live DAG in the upper portion and the YAML preview in the lower portion, both simultaneously visible.
- **FR-015**: All automated test references to the old test identifier `topbar-new-rgd` MUST be updated to `topbar-rgd-designer`.

### Key Entities

- **RGD Designer**: The `/author` page — a standalone, persistent tool for authoring new ResourceGraphDefinitions, decoupled from any specific existing RGD.
- **Generate Tab**: The context-dependent tab on an RGD detail page that produces YAML for instances of the currently viewed RGD. After this change it operates exclusively in "Instance Form" and "Batch" modes.
- **Live DAG**: A real-time, client-side dependency graph visualization computed entirely from the RGD Designer's form state, requiring no cluster connection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users viewing the Generate tab of any RGD detail page see exactly two mode options with zero occurrences of a "New RGD" mode button anywhere on that page.
- **SC-002**: The "RGD Designer" link appears in the top navigation bar on every page of the application and is visually indistinguishable in style from the Overview, Catalog, Fleet, and Events navigation links.
- **SC-003**: The RGD Designer live DAG reflects any form change (add resource, remove resource, edit CEL expression) within 300ms on a standard development machine.
- **SC-004**: All automated end-to-end journeys that previously referenced `topbar-new-rgd` continue to pass after being updated to reference `topbar-rgd-designer`.
- **SC-005**: When no resources are defined in the Designer, the DAG area shows legible hint text rather than a blank or empty panel.
- **SC-006**: The node colors, edge styling, and dark theme of the live DAG in the Designer are visually identical to the Graph tab on a real RGD detail page when given equivalent spec data.

## Assumptions

- The existing DAG building function (used by the static Graph tab) accepts only `rgd.spec`-shaped data and requires no cluster connectivity, making it directly reusable for the live DAG without modification to its core logic.
- The two-column layout of the RGD Designer (form left, preview right) is the established baseline from spec `039-rgd-authoring-entrypoint`; the DAG panel is added to the upper half of the right column.
- The subtle text link at the bottom of the Generate tab ("Authoring a new RGD? Open the RGD Designer →") is an optional addition — it is not required for acceptance. The issue states it "can either be removed entirely or kept".
- In-memory Generate tab mode state referencing the now-removed `'rgd'` mode will fall back to `'form'` mode with no persistent storage migration required.
- The `RGDAuthoringForm` component and the starter RGD state constant remain available in the codebase (used by `/author`) — they are only removed from the Generate tab's imports and render tree.
