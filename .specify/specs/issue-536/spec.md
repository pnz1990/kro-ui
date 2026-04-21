# spec: issue-536 — Instance bulk operations (multi-select + bulk YAML export)

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Instance bulk operations (🔲 → ✅)

---

## Constraint: Constitution §III (NON-NEGOTIABLE)

kro-ui is an observability tool. It MUST NOT issue any mutating Kubernetes API
call. Prohibited verbs: `create`, `update`, `patch`, `delete`, `apply`.

The original design doc item says "bulk delete" — this is **out of scope** per §III.
This spec implements the non-mutating subset: multi-select + bulk YAML export.

---

## Zone 1 — Obligations (falsifiable)

**O1**: The Instances table (`/instances`) MUST have a "Select" toggle button in the toolbar.
When activated, a checkbox column appears as the first column of the table.

**O2**: Selecting one or more rows MUST display a selection toolbar below the filter row showing:
- "{N} selected" count
- "Export YAML" button — downloads selected instances as a multi-document YAML file
- "Clear" button — deselects all and exits selection mode
- "Select all ({N})" toggle that selects/deselects all currently-filtered visible rows

**O3**: The bulk YAML export MUST download a file named `kro-instances-YYYY-MM-DD.yaml`
containing all selected instances concatenated with `---` separators, each fetched from
`GET /api/v1/instances/{namespace}/{name}?rgd={rgdName}` with `managedFields`,
`last-applied-configuration`, `resourceVersion`, and `uid` stripped (same cleaning
as the single-instance YAML copy button, PR #277).

**O4**: Pressing `Escape` while in selection mode MUST exit selection mode and clear all selections.

**O5**: The "Select" toggle button MUST only appear when instances are loaded (not during
loading or error states).

**O6**: No new npm or Go dependencies may be introduced.

**O7**: The checkbox column width is fixed (32px). Table layout must not shift when entering
or exiting selection mode.

---

## Zone 2 — Implementer's judgment

- Checkbox cell: `<td>` containing a native `<input type="checkbox">` with appropriate `aria-label`
- "Select all" affects visible (post-filter) rows only — same pattern as Catalog bulk export (PR #596)
- Export is client-side only: fetch each selected instance's YAML, concatenate, trigger download
- Failed fetches per-instance show as `# Failed to fetch {namespace}/{name}` comment in the YAML

---

## Zone 3 — Scoped out

- Bulk delete (violates Constitution §III)
- Server-side export (client-side only)
- Keyboard range-select (Shift+click)
