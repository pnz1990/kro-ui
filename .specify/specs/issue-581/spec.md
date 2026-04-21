# Spec: Accessibility audit expansion (issue-581)

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Accessibility audit expansion — extend axe-core coverage from 4 Tier-1 pages to 8 pages including RGD Designer, Fleet view, SRE dashboard, and Errors tab.

---

## Zone 1 — Obligations (falsifiable)

### O1 — Journey 074 covers RGD Designer (/author)
Journey 074 includes a step that navigates to `/author`, waits for the page to load,
and runs an axe-core WCAG 2.1 AA scan. Critical/serious violations fail the test.
Violation: journey 074 has no test step for `/author`.

### O2 — Journey 074 covers Fleet view (/fleet)
Journey 074 includes a step that navigates to `/fleet`, waits for the fleet cards,
and runs an axe-core scan. Critical/serious violations fail the test.
Violation: journey 074 has no test step for `/fleet`.

### O3 — Journey 074 covers SRE dashboard (Overview page with SRE widgets)
Journey 074 includes a step that navigates to `/` (Overview), waits for the health
summary bar, and runs an axe-core scan. Critical/serious violations fail the test.
Violation: journey 074 has no test step for the Overview/SRE dashboard.

### O4 — Journey 074 covers Errors tab on RGD detail
Journey 074 includes a step that navigates to the Errors tab on the test-app RGD detail
page, waits for the tab to render, and runs an axe-core scan. Critical/serious violations
fail the test.
Violation: journey 074 has no test step for the Errors tab.

### O5 — assertNoViolations helper is shared (not duplicated)
The existing `assertNoViolations` function is defined once at file scope and reused
by all steps. No duplicate copy of this function is added.
Violation: new steps define their own copy of assertNoViolations.

### O6 — New steps use waitForFunction (not waitForTimeout)
All new steps that wait for content use `page.waitForFunction()` polling the DOM,
not `waitForTimeout()`.
Violation: any new step uses `await page.waitForTimeout(N)`.

### O7 — Design doc updated (30-health-system.md 🔲 → ✅)
The 🔲 Future item for accessibility audit expansion is moved to ✅ Present.
Violation: design doc not updated in this PR.

---

## Zone 2 — Implementer's judgment

- Fleet and Designer steps may be skipped if the page cannot load due to cluster state
  (use `test.skip(condition, reason)` like existing steps).
- For the Designer page: wait for the main content area or `[data-testid="designer-canvas"]`
  or any text containing "Node" or "RGD".
- For Fleet: wait for `[data-testid^="fleet-card-"]` or `[class*="fleet"]`.
- For SRE dashboard (Overview): wait for the health summary bar or `[data-testid="overview-page"]`.
- For Errors tab: navigate to `/rgds/test-app?tab=errors`, wait for tab content.
- Axe exclusions: follow the same pattern as Step 2 (exclude complex SVG elements that
  are custom widgets with separate audit scope).

---

## Zone 3 — Scoped out

- Fixing any axe violations discovered by the new steps (that is a separate issue).
- Skip-to-main-content link (separate Future item in design doc).
- aria-live region for health state changes (separate Future item in design doc).
- Tier 2 pages not listed above (individual RGD instance detail is already covered by existing context).
