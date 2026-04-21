# spec issue-579 — GraphRevision YAML diff: line-level highlighting

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: GraphRevision diff: YAML diff panel in RevisionsTab adds line-level
  highlighting using the existing LCS diff from `@/lib/diff` (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: The YAML diff panel in `RevisionsTab` (triggered by selecting 2 revisions and
clicking "Compare YAML") MUST highlight lines that exist only in revision A with a red
background and lines that exist only in revision B with a green background. Identical
lines MUST have no background change.

**O2**: The diff MUST use the existing `computeLineDiff` from `@/lib/diff` — no new
dependencies may be introduced.

**O3**: Each column MUST show a 1-based line number in the gutter for lines that are
present in that column (absent/placeholder rows show no number).

**O4**: A "N lines differ" summary (or "YAML is identical") MUST be shown in the diff
panel header, using `countChangedLines` from `@/lib/diff`.

**O5**: The diff panel MUST be accessible: line numbers are `user-select: none`; each
column has an `aria-label` matching the revision name/number; the close button has an
accessible `aria-label`.

**O6**: The implementation MUST reuse the `.yaml-diff-table` CSS classes from
`InstanceYamlDiff.css` (import it into `RevisionsTab.tsx` or the new component). No
new duplicate CSS for the diff table rows.

**O7**: When `yamlDiffPair` is displayed, the close button dismisses the diff panel
and clears `selectedRevs`.

---

## Zone 2 — Implementer's judgment

- A dedicated `RevisionYamlDiff` sub-component may be extracted from `RevisionsTab`
  or the diff rendering may be inline. Keep it simple.
- The `max-height` for the scrollable body can be reused from `InstanceYamlDiff.css`
  (480px is acceptable).
- The column headers should show the revision name and number in the format:
  `Rev #N — <name>`.

---

## Zone 3 — Scoped out

- Navigate-by-change arrows (next/prev diff hunk) — not included in this spec.
- Wiring the YAML diff to the DAG diff (RGDDiffView) or to the live instance DAG —
  separate future item.
- Persisting the diff selection across page navigations.
