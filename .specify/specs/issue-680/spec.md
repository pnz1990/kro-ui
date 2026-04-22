# Spec: issue-680 — GraphRevision diff navigate-by-change arrows

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: GraphRevision diff: the two-panel line-level diff view with navigate-by-change arrows (🔲 → ✅)

---

## Zone 1 — Obligations

**O1** — The `RevisionYamlDiff` component in `RevisionsTab.tsx` MUST show a
"← prev change" / "next change →" navigation bar when `changedCount > 0`.
The bar renders between the legend and the two-column diff table.

**O2** — Pressing "next change →" MUST scroll both columns so that the next
changed row (status `added` or `removed`, relative to the current position)
is visible in the viewport. If no next change exists, the button is disabled.

**O3** — Pressing "← prev change" MUST scroll to the previous changed row.
If no previous change exists, the button is disabled.

**O4** — A counter "N / M" MUST appear between the two arrow buttons, where
N is the 1-indexed current change index and M is the total number of changes.

**O5** — When the diff is first rendered (`changedCount > 0`), the first
change MUST be scrolled into view automatically (initial focus on change 1).

**O6** — When `changedCount === 0` the navigation bar MUST NOT render.

**O7** — The navigate buttons MUST be keyboard accessible (Tab + Enter/Space).

**O8** — Each changed row in the diff table MUST have a stable `data-change-idx`
attribute (0-indexed) so the scroll logic can find it via DOM query.

---

## Zone 2 — Implementer's judgment

- Scroll implementation: `element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
  on a single ref per column is acceptable. Finding the row by `data-change-idx` is acceptable.
- CSS tokens: use existing `--color-border`, `--space-*` tokens. No new tokens needed.
- Component placement: the navigation bar lives inside `RevisionYamlDiff`, not in a new component.
- The feature targets the YAML diff panel only (not the DAG diff SVG — the DAG diff already
  uses node click for navigation).

---

## Zone 3 — Scoped out

- Navigate-by-change arrows for the DAG diff SVG (nodes are navigable by click already)
- Jump-to-line number input
- Keyboard shortcut (Ctrl+↓ / ↑) — not required; arrow buttons satisfy O7
