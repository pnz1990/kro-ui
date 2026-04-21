# spec: issue-535 — Catalog saved searches and filter presets

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: Catalog: saved searches and filter presets (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: The Catalog toolbar MUST include a "Save filter" button that is visible when any
filter is active (searchQuery non-empty OR activeLabels non-empty OR statusFilter !== 'all'
OR sortOption !== 'name'). When no filter is active the button is hidden.

**O2**: Clicking "Save filter" MUST open a small inline name-input form (not a modal) where
the user types a preset name and confirms. On confirm the preset is saved to `localStorage`
under key `"catalog-filter-presets"` as a JSON array.

**O3**: A "Presets" dropdown MUST appear in the toolbar that lists all saved presets by name.
Clicking a preset name MUST restore all five filter fields:
`searchQuery`, `activeLabels`, `sortOption`, `statusFilter`.

**O4**: Each preset in the dropdown MUST have a delete (×) button. Clicking it removes only
that preset from `localStorage` without affecting other presets or current filter state.

**O5**: Presets MUST persist across page reloads via `localStorage` (Constitution §V allows
localStorage; spec 062 precedent: `"overview-layout"` and `"overview-health-chart"` keys).

**O6**: The presets dropdown MUST be keyboard-accessible: `Tab` focuses it, `Enter`/`Space`
opens it, `Arrow` keys navigate items, `Escape` closes it.

**O7**: No new npm or Go dependencies may be introduced.

**O8**: Maximum 20 presets. When the limit is reached, "Save filter" is disabled and shows
tooltip "Maximum 20 presets reached — delete one first".

---

## Zone 2 — Implementer's judgment

- Dropdown implementation: custom CSS dropdown vs native `<select>` — custom recommended for O4/O6
- Preset save form location: inline below toolbar vs popover — inline is simpler and avoids portal
- Preset ordering: most-recently-saved first or alphabetical — most-recently-saved first
- Empty presets state: "No saved presets" placeholder in dropdown

---

## Zone 3 — Scoped out

- Server-side preset sync (localStorage only)
- Preset sharing (URL encoding of presets is a separate future item)
- Preset reordering via drag-and-drop
