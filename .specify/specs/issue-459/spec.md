# Spec: issue-459 — Developer Persona Journey E2E

**Item**: `issue-459`
**Branch**: `feat/issue-459`
**Design ref**: `docs/design/26-anchor-kro-ui.md` §Future Developer persona journey

---

## Design reference

- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: Developer persona journey (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. **O1** — A file `test/e2e/journeys/073-developer-persona-journey.spec.ts` exists
   and is syntactically valid TypeScript (brace depth = 0).

2. **O2** — The journey file is registered in `test/e2e/playwright.config.ts`
   under a chunk whose `testMatch` pattern matches `073-*.spec.ts`.

3. **O3** — The journey has a `test.describe('073: Developer Persona Journey', ...)` block
   containing at minimum 5 sequential steps.

4. **O4** — Step 1 navigates to `/author` (Designer) and asserts that
   `[data-testid="rgd-authoring-form"]` or `.author-page` renders.
   Uses `waitForFunction` to wait for DOM resolution.

5. **O5** — Step 2 asserts the YAML preview panel
   (`[data-testid="yaml-preview"]`) is visible on the Designer page.

6. **O6** — Step 3 asserts the DAG preview pane renders — either the hint text
   ("Add resources to see the dependency graph"), the DAG SVG, or the error hint.
   Uses `waitForFunction` not `toHaveCount(0)`.

7. **O7** — Step 4 asserts the Designer nav link is reachable — the top bar
   contains a link to `/author`. Uses `waitForSelector` on `a[href="/author"]`.

8. **O8** — Step 5 asserts that the RGD authoring form has the scope section
   (`[data-testid="scope-namespaced"]` or `[data-testid="scope-cluster"]`).

9. **O9** — Every `test.skip()` call is followed immediately by `return`.

10. **O10** — No `waitForTimeout` is used; all waits use `waitForFunction` or
    Playwright built-in locator waits (constitution §XIV).

---

## Zone 2 — Implementer's judgment

- The journey should be resilient: it tests the Designer in isolation (no cluster dependency).
- Steps should check for valid alternative DOM states rather than single exact strings.

---

## Zone 3 — Scoped out

- This spec does NOT test actual RGD submission or mutation.
- This spec does NOT modify existing journey files.
- Fleet persona journeys are out of scope.
