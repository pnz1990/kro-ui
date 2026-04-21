# Spec: Color-blind accessible health indicators (issue-580)

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Color-blind accessible health indicators — add secondary visual signals (icons) alongside color so users with color blindness can distinguish health states without relying solely on hue. WCAG 2.1 SC 1.4.1 (Use of Color).

---

## Zone 1 — Obligations (falsifiable)

### O1 — Single source of truth for health icons
A constant `HEALTH_STATE_ICON: Record<InstanceHealthState, string>` is exported from `web/src/lib/format.ts`.
Violation: any component defines its own health icon string for the same set of states.

### O2 — HealthPill shows icon prefix
`HealthPill` renders the icon from `HEALTH_STATE_ICON[health.state]` before the label text (e.g., "✓ Ready", "✗ Error").
Violation: HealthPill renders text-only for any non-loading, non-null health state.

### O3 — ReadinessBadge shows icon prefix
`ReadinessBadge` renders the icon from `HEALTH_STATE_ICON[status.state]` before the label text.
Violation: ReadinessBadge renders text-only for any health state.

### O4 — OverviewHealthBar chips show icon prefix
Each `Chip` in `OverviewHealthBar` renders the icon for its state before the count (e.g., "✓ 5 ready").
Violation: any chip renders count-only with no icon prefix.

### O5 — HealthChip segments remain unchanged
HealthChip already has per-segment icons (✗, ⚠, ↻, …, ?). This spec does not modify HealthChip.
Violation: HealthChip is modified in a way that removes or changes its existing icons.

### O6 — Icon + text, not icon alone
The icon is always accompanied by visible text. Color-blind accessible means icon is secondary signal, not replacement.
Violation: any component shows icon without adjacent text in the same element.

### O7 — Tokens only, no hardcoded color
No new hardcoded hex values or rgba() are added in any CSS or TSX file.
Violation: any new style uses a literal color value instead of a CSS custom property from tokens.css.

### O8 — Tests updated
All unit tests for modified components pass. New assertions verify icon presence in rendered output.
Violation: tests pass without asserting on icon content.

---

## Zone 2 — Implementer's judgment

- Icon characters: use Unicode characters that render universally without fonts:
  - ready: ✓ (U+2713)
  - error: ✗ (U+2717) — matches HealthChip
  - degraded: ⚠ (U+26A0) — matches HealthChip
  - reconciling: ↻ (U+21BB) — matches HealthChip
  - pending: … (U+2026) — matches HealthChip
  - unknown: ? (U+003F) — matches HealthChip
- Icon rendering: `<span aria-hidden="true">` wrapper to avoid double-reading by screen readers (the aria-label already describes the state)
- ReadyState (3-state) also gets an icon using the intersection of states: ready=✓, error=✗, reconciling=↻, unknown=?

---

## Zone 3 — Scoped out

- StatusDot: it is a colored dot with no text. Adding an icon would change the component's minimal design intent. This is out of scope — the dot's tooltip already provides text.
- Pattern fills (SVG hatching etc.): the simpler icon approach satisfies WCAG 1.4.1 at lower complexity.
- Dark-mode / light-mode icon contrast: icon characters inherit color from the parent element (same token).
- DAG node state icons: DAG nodes have separate state visualization; out of scope for this PR.
