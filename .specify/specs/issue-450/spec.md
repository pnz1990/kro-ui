# Spec: issue-450 — Operator Persona Journey E2E

**Item**: `issue-450`
**Branch**: `feat/issue-450`
**Design ref**: `docs/design/26-anchor-kro-ui.md` §Present 26.1

---

## Design reference

- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Present`
- **Implements**: Operator persona journey (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. **O1** — A file `test/e2e/journeys/071-operator-persona-journey.spec.ts` exists
   and is syntactically valid TypeScript (brace depth = 0).

2. **O2** — The journey file is registered in `test/e2e/playwright.config.ts`
   under a chunk whose `testMatch` pattern matches `071-*.spec.ts`. The journey
   is not silently skipped in CI.

3. **O3** — The journey has a `test.describe('071: Operator Persona Journey', ...)` block
   containing at minimum 6 sequential steps, each as its own `test('Step N: ...')`.

4. **O4** — Step 1 navigates to `/` (Overview) and asserts that RGD cards or the
   "no RGDs" empty state renders. It uses `page.request.get('/api/v1/rgds')` to
   determine cluster state before asserting (SPA-safe per constitution §XIV).

5. **O5** — Step 2 navigates to `/catalog` and asserts the test-app card is visible,
   skipping with `test.skip` if the API check shows `test-app` not present.

6. **O6** — Step 3 navigates to the RGD detail Graph tab for `test-app` and asserts
   the DAG SVG renders. It skips if the API check shows `test-app` not present.

7. **O7** — Step 4 navigates to the Instances tab for `test-app` and asserts at
   least one instance row or the empty-state message renders.

8. **O8** — Step 5 navigates to the instance detail page for `test-instance` in
   namespace `kro-ui-e2e` and asserts the page container renders. It skips if
   the instance is not found via API check.

9. **O9** — Step 6 asserts that a health chip or status badge is visible on the
   instance detail page, using `waitForFunction` not `toHaveCount(0)` for loading
   states (constitution §XIV).

10. **O10** — Every `test.skip()` call is followed immediately by `return` so the
    test body does not continue executing after skip (constitution §XIV).

11. **O11** — No `waitForTimeout` is used; all waits use `waitForFunction` or
    Playwright built-in locator waits (constitution §XIV).

---

## Zone 2 — Implementer's judgment

- The exact test IDs used to assert health chips and page containers should
  match existing `data-testid` attributes in the codebase (read relevant
  component files before writing assertions).
- Steps may be extended with additional assertions (e.g., page title, breadcrumb)
  as long as they don't create false negatives when fixtures are temporarily
  missing from the cluster.
- The `fixtureState.testAppReady` flag from `fixture-state.ts` may be used to
  skip steps that depend on kro reconciliation.

---

## Zone 3 — Scoped out

- This spec does NOT add new UI components or backend APIs.
- This spec does NOT modify existing journey files.
- Stress-test fixture steps (crashloop-app, never-ready) are out of scope for
  this journey — they only run on the demo cluster.
- This spec does NOT implement the SRE or Developer persona journeys
  (those are separate 🔲 Future items in the design doc).
