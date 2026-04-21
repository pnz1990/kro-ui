# spec: instance-full-yaml-diff

> Issue: #537 | Branch: feat/issue-537
> Status: In Progress

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Instance diff: full side-by-side comparison between two instance snapshots (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: When two instances are selected in InstanceTable, a "Compare full YAML" button MUST appear alongside the existing "Compare specs" button.

**O2**: Clicking "Compare full YAML" opens a side-by-side panel showing the full YAML of each instance (cleaned via `cleanK8sObject` — no managedFields, last-applied-config, resourceVersion, uid).

**O3**: Lines that exist only in instance A MUST be visually highlighted (removed — red/pink background). Lines that exist only in instance B MUST be visually highlighted (added — green background). Identical lines render with no background change.

**O4**: The YAML diff MUST produce a stable line-by-line result computed from `toYaml(cleanK8sObject(instance))` — no external diff library (Constitution §V).

**O5**: Each column header MUST show the instance's `namespace/name` label so the user always knows which side is which.

**O6**: A "Close" button dismisses the full YAML diff panel and clears the selection.

**O7**: The component MUST have unit tests for the core diff logic (`computeLineDiff`).

**O8**: The SpecDiffPanel (spec field table) is RETAINED as-is. The "Compare full YAML" button is a SECOND action that opens an alternate view. Both buttons are visible when 2 items are selected.

**O9**: No new npm dependencies (Constitution §V).

---

## Zone 2 — Implementer's judgment

- Layout: two columns with synchronized scroll is desirable but not required; independent scrollbars per column are acceptable.
- Line numbers in the gutter are a nice-to-have.
- The diff algorithm: longest-common-subsequence (LCS) produces fewer false positives than a naive line-set diff; implement a simple LCS-based diff to minimize noisy highlights on YAML structural lines.
- Token colors: use `--color-status-error-bg` / `--color-status-ready-bg` tokens (or equivalent) from `tokens.css` — do not add new inline hex colors.

---

## Zone 3 — Scoped out

- Persisting selected instances across page navigation
- Three-way or multi-way diff
- Inline edit of displayed YAML
- Diffing status or metadata sections separately from the full object
