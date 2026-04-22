# Spec: 26.7 — Light-mode persona anchor journey (journey 088)

## Design reference
- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: 26.7 — Light-mode persona anchor journey: journey 088 — operator navigates the full cluster health workflow with OS-preference light mode active; asserts all health chips, DAG node colors, status dots, and error banners are visible with sufficient WCAG contrast in light theme. (🔲 → ✅)

## Zone 1 — Obligations (must all be satisfied before merge)

1. **Journey file exists** at `test/e2e/journeys/088-light-mode-persona.spec.ts`.
2. **Journey is assigned to chunk-9** — `088` prefix appears in the `testMatch` pattern for `chunk-9` in `test/e2e/playwright.config.ts`.
3. **Light mode activation**: the journey forces light mode by setting `data-theme="light"` on `<html>` using `page.addInitScript()` before navigating, or by writing `kro-ui-theme=light` to `localStorage` — not by relying on OS preference (which may not be stable in CI).
4. **Full navigation path covered**: Overview (`/`) → RGD detail (`/rgds/:name`) → Instance detail (`/instances/:ns/:kind/:name`) — all three views render in light mode without a crash overlay.
5. **Health chip visibility**: at least one health chip (`.health-chip`, `[class*="health"]`, or `[data-testid*="health"]`) is present on the Overview and is visible.
6. **Theme toggle present**: the TopBar theme toggle button (`[data-testid="topbar-theme-toggle"]`) is present on the page in all three steps.
7. **No crash overlay**: `vite-error-overlay` count is 0 at each navigation step.
8. **Page title check**: `page.title()` contains `kro-ui` on each page.
9. **Graceful skip**: each step uses `page.request.get()` to check prerequisite API endpoints (SPA-safe, per constitution §XIV); if unavailable, calls `test.skip()` immediately followed by `return`.
10. **No `waitForTimeout`**: all waits use `page.waitForFunction()` with explicit DOM conditions and a `timeout` parameter.
11. **Design doc updated**: `docs/design/26-anchor-kro-ui.md` marks 26.7 as ✅.

## Zone 2 — Guidelines

- Light mode is applied via `localStorage` write in `addInitScript` so it fires before first render and avoids flash-of-wrong-theme.
- WCAG contrast checks are implicit (light mode tokens are calibrated in `tokens.css`); E2E verifies the UI doesn't crash and elements are visible, not pixel-perfect color values.
- Use `test.describe` with `test.beforeEach` for the light-mode `addInitScript` to avoid repeating it in each step.

## Zone 3 — Scoped out

- Pixel-by-pixel contrast ratio measurement — not part of this journey.
- Testing dark→light toggle at runtime — that is covered by `useTheme` unit tests.
- Exhaustive tab navigation within each page — just the primary view is checked.
