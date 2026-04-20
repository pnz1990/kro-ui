# Spec: issue-524 — Fleet Persona Anchor Journey (075)

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future — 27.3`
- **Implements**: Fleet persona anchor journey: 6-step journey covering multi-cluster fleet view → health matrix → context switch → per-cluster RGD count

---

## Zone 1 — Obligations (falsifiable)

**O1 — Journey file exists at `test/e2e/journeys/075-fleet-persona-journey.spec.ts`.**
Violation: the file is absent or named differently.

**O2 — Journey is assigned to a Playwright chunk in `playwright.config.ts`.**
Violation: the file is not covered by any `testMatch` pattern, causing it to be silently skipped in CI.

**O3 — Journey covers ≥ 4 distinct feature areas (Fleet view, health matrix, context switcher, RGD count).**
Violation: fewer than 4 steps or multiple steps test the same feature area.

**O4 — All existence checks use `page.request.get()`, never HTTP status of `page.goto()`.**
Violation: any `expect(response.status()).toBe(200)` after `page.goto()` — SPA always returns 200.

**O5 — All waits use `waitForFunction()`, never `waitForTimeout()` (fixed-ms waits).**
Violation: any `await page.waitForTimeout(N)` in the journey file.

**O6 — Every `test.skip()` is immediately followed by `return`.**
Violation: code executes after `test.skip()` call.

**O7 — No `locator.or()` is used when both elements may be simultaneously visible.**
Violation: `locator.or()` used where both branches could match.

**O8 — Journey skips gracefully (not fails) when pre-conditions are absent.**
Violation: a test fails with a network error or locator timeout when the kind cluster lacks the required resources.

**O9 — Journey validates the FleetMatrix health grid renders (or shows empty state).**
Violation: Step 3 doesn't check for `[data-testid="fleet-matrix-empty"]` or the matrix table.

**O10 — Journey validates context switcher renders current context name.**
Violation: Step 4 doesn't assert `[data-testid="context-name"]` is visible.

---

## Zone 2 — Implementer's judgment

- Step count: 6 steps (as specified in design doc 27.3). Steps may be named/organized
  as the implementer sees fit, as long as all 4 feature areas are covered.
- Test timeouts: follow the pattern from existing anchor journeys (25s for overview,
  15-20s for navigation, 90s for context-switcher option loading on throttled clusters).
- The journey may share constants (BASE, RGD_NAME, etc.) with existing journeys.
- FleetMatrix cell assertions: check for the matrix table's existence, not specific
  cell values, since cluster health data varies per environment.

---

## Zone 3 — Scoped out

- No new frontend code required — this is a read-only E2E test.
- No new backend endpoints.
- No assertion on specific RGD counts or health percentages (these vary by cluster state).
- No multi-cluster fleet testing (kind cluster has a single context; multi-context
  is tested in 007-context-switcher).
