# Spec: 26.8 — Multi-context persona anchor journey (journey 089)

## Design reference
- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: 26.8 — Multi-context persona anchor journey: journey 089 — operator switches kubeconfig context mid-session, verifies Overview reloads with the new cluster's data, confirms cache was flushed (stale cluster-A data not shown for cluster-B), navigates to Fleet page to confirm both contexts are present. (🔲 → ✅)

## Zone 1 — Obligations (must all be satisfied before merge)

1. **Journey file exists** at `test/e2e/journeys/089-multi-context-persona.spec.ts`.
2. **Journey is assigned to chunk-9** — `089` prefix appears in the `testMatch` pattern for `chunk-9` in `test/e2e/playwright.config.ts`.
3. **Context switcher is visible**: the journey verifies `[data-testid="context-switcher-btn"]` is present on the Overview page.
4. **Context switch flow**: the journey opens the context dropdown, reads the list of available contexts, and switches from the current context to a different one (uses existing `kro-ui-e2e-alt` or any alternate).
5. **Cache flush verification**: after switching context, the journey calls `/api/v1/contexts` to confirm the active context changed, then navigates to Overview and waits for the data to reload — asserts no JS crash.
6. **Fleet page verification**: the journey navigates to `/fleet` and verifies the fleet page renders (grid or empty state) without a crash overlay.
7. **Both contexts visible in fleet**: if the fleet page shows a grid, asserts at least one cluster card is visible.
8. **No crash overlay**: `vite-error-overlay` count is 0 at each navigation step.
9. **Page title check**: `page.title()` contains `kro-ui` on each page.
10. **Graceful skip**: each step uses `page.request.get()` to check prerequisite endpoints (SPA-safe); if unavailable calls `test.skip()` immediately followed by `return`.
11. **No `waitForTimeout`**: all waits use `page.waitForFunction()` with explicit DOM conditions.
12. **Design doc updated**: `docs/design/26-anchor-kro-ui.md` marks 26.8 as ✅.

## Zone 2 — Guidelines

- This journey is hermetic: the kind cluster has multiple contexts registered by `global-setup.ts` (`kro-ui-e2e-alt`). Use those rather than depending on external clusters.
- The context switch POST calls the server which flushes its in-memory cache. The journey doesn't need to inspect cache internals — just verify the page re-renders without errors.
- Use `page.route()` mock if needed for the fleet page to avoid cluster-API timeouts in CI.
- The `serial` project in `playwright.config.ts` owns Journey 007 which also does context switching. Journey 089 runs in `chunk-9` (parallel) and must not conflict — it should restore the context it switches away from, or the steps must be self-contained.

## Zone 3 — Scoped out

- Verifying different cluster *data* appears after context switch (both contexts point at the same kind cluster in CI).
- Testing context switch persistence across page reload (separate concern).
- Pixel-perfect fleet card layout verification.
