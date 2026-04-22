# Spec: issue-683 — Designer axe-core Coverage

> Status: Active | Created: 2026-04-22

## Design reference

- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Future`
- **Implements**: Designer axe-core coverage — add explicit axe-core WCAG 2.1 AA
  assertions for the `/author` RGD Designer page including the new tab bar
  (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: Journey 074 Step 7 MUST use `assertNoViolations` (blocking) rather
than `logViolations` (non-blocking) for the Designer page.
Violation: the Designer scan logs violations but does not fail CI when
critical/serious WCAG violations are present.

**O2**: The axe-core scan for the Designer MUST include the tab bar
(`[data-testid="designer-tab-bar"]`) within its scope.
Violation: the tab bar is excluded from accessibility scanning.

**O3**: The design doc `docs/design/31-rgd-designer.md` MUST have the
axe-core coverage item updated from `🔲 Future` to `✅ Present`.

---

## Zone 2 — Implementer's judgment

- If the blocking assertion reveals pre-existing violations in the Designer,
  they should be fixed as part of this PR rather than deferring to follow-up.
- The `DesignerTabBar` uses existing CSS patterns from `RGDDetail.css`
  (role=tablist, role=tab, aria-selected) which should be axe-compliant.

---

## Zone 3 — Scoped out

- CEL editor inside the Designer — complex custom widget, excluded via `svg`
  and any CodeMirror-specific selectors.
- Full WCAG AAA compliance — only AA is required.
