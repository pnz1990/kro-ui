# Spec: 27.17 — OS-preference light mode with localStorage override

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ 27.17`
- **Implements**: OS-preference light mode: `useTheme()` hook reads `window.matchMedia('(prefers-color-scheme: light)')` on mount, syncs `document.documentElement.setAttribute('data-theme', ...)`, listens for OS preference changes, and supports localStorage override (`kro-ui-theme`); theme toggle button in TopBar (☀/☾); WCAG 2.1 SC 1.4.3 contrast calibrated per mode. (🔲 → ✅)

## Zone 1 — Obligations (must all be satisfied before merge)

1. **`useTheme()` hook exists** at `web/src/hooks/useTheme.ts` and exports `UseThemeResult` with `{ theme, setTheme, hasOverride }`.
2. **OS preference detection**: on mount, reads `window.matchMedia('(prefers-color-scheme: light)')` to determine effective theme when no localStorage override is set.
3. **localStorage persistence**: `setTheme('light'|'dark')` writes to `localStorage` key `'kro-ui-theme'`; `setTheme(null)` removes the key and reverts to OS preference.
4. **DOM sync**: `applyTheme()` sets `data-theme="light"` on `<html>` for light mode; removes the attribute for dark mode (dark is the default via `:root` tokens).
5. **OS preference change listener**: `mediaQuery.addEventListener('change', ...)` fires when the OS switches theme; it is only applied if no localStorage override is active; listener is removed on unmount.
6. **Graceful fallback**: all `localStorage` reads/writes are wrapped in try/catch to handle private browsing mode.
7. **TopBar toggle button**: ☀ (when dark, clicking switches to light) / ☾ (when light, clicking switches to dark); `aria-label` meets WCAG 2.1 SC 1.4.3.
8. **Layout integration**: `Layout.tsx` calls `useTheme()` to activate theme sync on app mount.
9. **Unit tests**: `web/src/hooks/useTheme.test.ts` covers OS preference, localStorage override, change listener, setTheme(null) revert, and private-browsing fallback.
10. **Design doc updated**: `docs/design/27-stage3-kro-tracking.md` marks 27.17 as ✅.

## Zone 2 — Guidelines (strong preference, deviation requires justification)

- Flash-of-wrong-theme avoided by applying theme synchronously in the `useState` initializer.
- `hasOverride` exposed to TopBar so the button accurately reflects manual vs OS-driven state.
- No new npm or Go dependencies introduced.

## Zone 3 — Notes

- Dark mode remains the default (`:root` tokens in `tokens.css` are dark).
- `data-theme="light"` selector in `tokens.css` overrides tokens for light mode.
- The E2E journey `070-catalog-status-filter.spec.ts` has a `colorScheme: 'dark'` Playwright contextOption added to ensure the test runs in a known theme state.
