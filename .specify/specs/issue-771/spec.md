# Spec: issue-771

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: 29.2 — Live DAG node selection keyboard shortcut (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: Pressing `/` while the live DAG container is focused opens a node-search box.
  - Verification: `document.querySelector('.dag-node-search')` exists and is focused after `/` keydown.

**O2**: The search box filters visible DAG nodes by `node.label` or `node.kind` (case-insensitive substring match).
  - Violation: nodes whose label/kind do not match the query remain visually full-opacity.

**O3**: Pressing `Enter` while the search is active selects the top match (calls `onNodeClick`) and closes the search box.
  - Violation: Enter does not invoke `onNodeClick` or does not clear the search.

**O4**: Pressing `Escape` closes the search box without selecting any node.
  - Violation: Escape leaves the search box visible.

**O5**: The search box has `role="searchbox"` and `aria-label="Search DAG nodes"` (WCAG 2.1 SC 4.1.2).

**O6**: Non-matching nodes are rendered at reduced opacity (0.25), matching nodes at full opacity.

**O7**: `/` shortcut only fires when the DAG container itself (or a node inside it) is focused — not when a text input is active.

**O8**: The search input clears when the search box is closed.

---

## Zone 2 — Implementer's judgment

- Search box position: overlay at top-left of the `.live-dag-container`, with `position: absolute`.
- Animation: use existing `--transition-fast` for open/close.
- Minimum query length: 1 character (no debounce needed for an in-memory filter).
- The search is entirely client-side; no new API endpoints.

---

## Zone 3 — Scoped out

- Fuzzy matching (substring is sufficient).
- Persisting search state across re-renders or page navigations.
- Keyboard-navigating through multiple matches (Tab through results) — the first match auto-selects on Enter; arrow-key navigation is already in the DAG nodes.
