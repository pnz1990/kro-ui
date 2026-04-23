# Spec: issue-766

## Design reference
- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: 31.1 — Designer onboarding guided tour (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

- **O1**: On first visit to `/author` (when `localStorage.getItem('kro-ui-designer-toured')` is absent/null/false), a 4-step overlay tour appears automatically. Falsifiable: render AuthorPage without the toured key in localStorage → `data-testid="designer-tour-overlay"` is visible.
- **O2**: The tour has exactly 4 steps in order: (1) "Schema field editor" highlighting the schema tab area, (2) "Resource node types" highlighting the resources tab area, (3) "YAML preview & live DAG" highlighting the YAML/preview tabs, (4) "Apply to cluster" highlighting the YAML tab action area. Falsifiable: tour step counter shows "1 of 4" through "4 of 4".
- **O3**: The tour can be dismissed at any step via a "Skip tour" button. After dismissal, `localStorage.getItem('kro-ui-designer-toured') === 'true'`. Falsifiable: click "Skip tour" → overlay disappears → localStorage key is set.
- **O4**: After completing step 4, the tour closes and sets `localStorage.getItem('kro-ui-designer-toured') === 'true'`. Falsifiable: advance through all 4 steps → overlay gone → key set.
- **O5**: A "?" (help) button is always visible in the AuthorPage header (not readonly mode) that re-triggers the tour by removing the toured key and showing the overlay. Falsifiable: `data-testid="tour-trigger-btn"` is visible in AuthorPage header; clicking it while toured → tour overlay reappears.
- **O6**: Tour overlay uses `--color-surface`, `--color-border`, `--color-text` tokens (no hardcoded hex/rgba in new CSS). Falsifiable: grep new CSS for `#[0-9a-fA-F]` and `rgba(` → empty.
- **O7**: Tour overlay has `role="dialog"` and `aria-label="Designer guided tour"`. Falsifiable: `screen.getByRole('dialog', {name: /guided tour/i})` renders during tour.
- **O8**: Tour does NOT appear in readonly/shared-URL mode. Falsifiable: render AuthorPage with `?share=...` param → tour overlay absent even when toured key is absent.

---

## Zone 2 — Implementer's judgment

- Highlight mechanism: a semi-transparent dark overlay (`position: fixed`, `inset: 0`, low `z-index`) with the tour step card rendered at center; the "highlighted region" is conveyed via text description in each step card (no complex CSS cutout needed — simpler and more reliable).
- Step card positioned: centered horizontally and vertically (`position: fixed`, `z-index: 1000`), same pattern as existing portal tooltips.
- Navigation: "Back" (disabled on step 1), "Next" (becomes "Finish" on step 4), "Skip tour".
- localStorage key: `kro-ui-designer-toured` (value `'true'` when complete/dismissed).
- Component: `DesignerTour` in `web/src/components/DesignerTour.tsx` + `DesignerTour.css`.
- Unit test: `DesignerTour.test.tsx` — renders, skip, finish, re-trigger.

---

## Zone 3 — Scoped out

- CSS cutout / spotlight highlight of specific DOM elements (too brittle)
- Tour analytics / step tracking to backend
- Tour in mobile viewport optimization
- Tour shown in readonly/shared-URL mode
