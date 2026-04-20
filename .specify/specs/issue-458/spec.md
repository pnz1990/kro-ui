# Spec: issue-458 — SRE Persona Journey E2E

**Item**: `issue-458`
**Branch**: `feat/issue-458`
**Design ref**: `docs/design/26-anchor-kro-ui.md` §Future SRE persona journey

---

## Design reference

- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: SRE persona journey (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. **O1** — A file `test/e2e/journeys/072-sre-persona-journey.spec.ts` exists
   and is syntactically valid TypeScript (brace depth = 0).

2. **O2** — The journey file is registered in `test/e2e/playwright.config.ts`
   under a chunk whose `testMatch` pattern matches `072-*.spec.ts`. The journey
   is not silently skipped in CI.

3. **O3** — The journey has a `test.describe('072: SRE Persona Journey', ...)` block
   containing at minimum 5 sequential steps, each as its own `test('Step N: ...')`.

4. **O4** — Step 1 navigates to `/` (Overview) and asserts that the SRE dashboard
   grid (`[data-testid="widget-instances"]`) or the onboarding state renders.
   Uses `waitForFunction` to wait for DOM resolution (constitution §XIV).

5. **O5** — Step 2 asserts the W-3 RGD compile errors widget
   (`[data-testid="widget-rgd-errors"]`) is visible on the Overview page.
   Skips if the Overview dashboard is not present.

6. **O6** — Step 3 navigates to the RGD detail Errors tab for `test-app`
   (`/rgds/test-app?tab=errors`) and asserts `[data-testid="errors-tab"]` renders
   (showing errors, all-healthy, or empty state). Skips if `test-app` not found
   via `page.request.get` (constitution §XIV SPA-safe check).

7. **O7** — Step 4 navigates to the instance detail page for `test-instance`
   in namespace `kro-ui-e2e` and asserts `[data-testid="instance-detail-page"]`
   renders. Skips if instance not found via API check.

8. **O8** — Step 5 asserts the events panel (`[data-testid="events-panel"]`) or
   events empty state is visible on the instance detail page. Uses `waitForFunction`
   not `toHaveCount(0)` (constitution §XIV).

9. **O9** — Every `test.skip()` call is followed immediately by `return` so the
   test body does not continue executing after skip (constitution §XIV).

10. **O10** — No `waitForTimeout` is used; all waits use `waitForFunction` or
    Playwright built-in locator waits (constitution §XIV).

---

## Zone 2 — Implementer's judgment

- The exact test IDs used must match existing `data-testid` attributes in the codebase.
- Steps may check for multiple valid DOM states (e.g., errors found OR all-healthy OR empty).
- The `page.request.get()` checks must use the SPA-safe API endpoint, not `page.goto()` HTTP status.

---

## Zone 3 — Scoped out

- This spec does NOT add new UI components or backend APIs.
- This spec does NOT modify existing journey files.
- The journey does NOT test fleet view navigation — that is a separate anchor journey.
- This spec does NOT implement the Developer persona journey (issue-459).
