# Spec: issue-684 — Designer Tab Focus Restoration

> Status: Active | Created: 2026-04-22

## Design reference

- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer tab focus restoration — persist active tab and selected
  node to `sessionStorage` so returning to `/author` restores last working context
  (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: The `/author` page MUST render a tab bar with four tabs: "Schema",
"Resources", "YAML", "Preview". The tab bar MUST be the primary navigation
between sections of the designer.

**O2**: Each tab MUST show the correct content:
- "Schema" — Metadata + Spec Fields + Status Fields sections of RGDAuthoringForm
- "Resources" — Resources section of RGDAuthoringForm
- "YAML" — YAMLPreview component (the generated YAML output)
- "Preview" — StaticChainDAG live DAG preview

**O3**: When the user navigates away from `/author` (e.g. clicks Overview in
nav) and then returns, the previously active tab MUST be restored.
Violation: returning always shows the "Schema" tab regardless of which tab
was active before navigation.

**O4**: The selected resource node ID (from DAG interaction) MUST be persisted
to `sessionStorage` and restored on return to `/author`.
Violation: selected node resets to null on every mount.

**O5**: The sessionStorage key for tab state MUST be `kro-ui-designer-tab-state`.
The stored value MUST be a JSON object: `{ activeTab: string, selectedNodeId: string | null }`.

**O6**: When the `?share=` URL param is present (readonly collaboration mode),
tab state is NOT persisted to sessionStorage (readonly mode is ephemeral).
Violation: a shared URL visit overwrites the user's own tab state.

**O7**: Tab state read from sessionStorage MUST be validated before use.
A corrupt or schema-mismatch value MUST be silently discarded (fall back to
default tab "Schema"). Violation: a malformed sessionStorage value crashes
the page.

**O8**: The active tab MUST have `aria-selected="true"` and the inactive tabs
MUST have `aria-selected="false"`. The tab bar MUST use `role="tablist"` and
each tab MUST use `role="tab"`. The content panel MUST use `role="tabpanel"`.

**O9**: Keyboard navigation: arrow keys (left/right) MUST move focus between
tabs. Enter/Space MUST activate the focused tab (WCAG 2.1 SC 2.1.1).

---

## Zone 2 — Implementer's judgment

- The tab bar style uses existing CSS tokens (`--color-nav-bg`, `--color-accent`,
  etc.) — no new tokens required.
- The "YAML" tab may reuse the existing `YAMLPreview` component and its validate
  button — no duplication.
- The "Preview" tab may reuse the existing `StaticChainDAG` component.
- `selectedNodeId` persisted to sessionStorage is a string key for a resource
  node in the DAG. The AuthorPage already passes `selectedNodeId` to
  `StaticChainDAG` — wire through.
- The 300ms DAG debounce continues to apply on the "Preview" tab.
- The right pane (DAG + YAML stacked) is replaced by the tab-based layout —
  the two-pane split simplifies to: form-sections-tabs on the left.

---

## Zone 3 — Scoped out

- Persisting which accordion items (templates, advanced) are expanded within
  Resources — too granular for this spec.
- Server-side tab state persistence — browser-local sessionStorage only.
- URL-based tab routing (e.g. `/author?tab=resources`) — deferred.
