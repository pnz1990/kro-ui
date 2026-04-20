# spec: issue-534 — RGD list bulk export

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: RGD list: bulk operations (delete multiple, export selected)
  → scoped to **export selected** only; delete is blocked by Constitution §III (read-only)

---

## Zone 1 — Obligations (falsifiable)

**O1**: The Overview (Home) RGD grid MUST show a checkbox on each RGD card when the user
enters "selection mode". When no card is selected, only the "Select" toggle button is visible.

**O2**: A "Select all" checkbox MUST appear in the toolbar when any card is checked.
Checking it selects all currently-visible (post-filter) RGDs. Unchecking it clears all.

**O3**: When ≥1 RGDs are selected, an "Export YAML" button MUST appear in the toolbar.
Clicking it downloads a single `.yaml` file containing all selected RGDs' raw specs
separated by `---\n` (standard multi-document YAML format).

**O4**: The exported file MUST strip `managedFields`, `resourceVersion`, `uid`, and
`kubectl.kubernetes.io/last-applied-configuration` from every RGD object (same stripping
logic as the YAML tab per PR #291).

**O5**: The downloaded filename MUST be `kro-rgds-<ISO-date>.yaml`
(e.g. `kro-rgds-2026-04-20.yaml`).

**O6**: Exiting selection mode (toggle button or pressing Escape) MUST clear all selections
and hide the checkboxes.

**O7**: Selection state MUST be local (React useState) — no URL param, no localStorage.

**O8**: Cards retain their full-click navigation behavior when NOT in selection mode.
In selection mode, clicking a card body toggles selection instead of navigating.

**O9**: The component MUST add `aria-label="Select <RGD name>"` to each checkbox and
`aria-label="Export N selected RGDs"` to the export button.

**O10**: No new npm or Go dependencies may be introduced.

---

## Zone 2 — Implementer's judgment

- Checkbox placement within the card (corner overlay vs inline) — top-left corner overlay recommended.
- Toolbar placement — above the card grid, consistent with existing filter toolbar.
- Animation/transition on entering/exiting selection mode — keep or omit.
- Whether "Select" button is an icon or text — text is acceptable for clarity.

---

## Zone 3 — Scoped out

- Delete operations (blocked by Constitution §III — read-only tool)
- Bulk export from the Catalog page (separate item if desired)
- Persisting selection across page navigations
- Server-side export endpoint (client-side YAML serialization only)
