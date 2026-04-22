# Spec: 26.9 — Designer round-trip anchor journey (journey 090)

## Design reference
- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: 26.9 — Designer round-trip anchor journey: journey 090 — operator uses Designer to create a minimal RGD (1 schema field, 1 resource), previews the generated YAML, imports it from cluster after applying manually, verifies the loaded form state matches the original. (🔲 → ✅)

## Zone 1 — Obligations (must all be satisfied before merge)

1. **Journey file exists** at `test/e2e/journeys/090-designer-roundtrip-persona.spec.ts`.
2. **Journey is assigned to chunk-9** — `090` prefix appears in the `testMatch` pattern for `chunk-9` in `test/e2e/playwright.config.ts`.
3. **Designer loads**: the journey verifies `/author` renders `[data-testid="rgd-authoring-form"]`.
4. **Form fill**: the journey fills in the RGD name field (`#rgd-name`) with a test value.
5. **YAML preview**: navigates to the YAML tab and verifies `[data-testid="yaml-preview"]` is present and contains content.
6. **Cluster import**: opens `[data-testid="cluster-import-toggle"]`, waits for the RGD dropdown, and loads the `test-app` fixture RGD.
7. **State verification**: after load, the form name field reflects the imported RGD's name (state was updated).
8. **No crash overlay**: `vite-error-overlay` count is 0 at each step.
9. **Page title check**: `page.title()` contains `kro-ui` on each page.
10. **Graceful skip**: each step uses `page.request.get()` to check prerequisite endpoints (SPA-safe); if unavailable calls `test.skip()` immediately followed by `return`.
11. **No `waitForTimeout`**: all waits use `page.waitForFunction()` with explicit DOM conditions.
12. **Design doc updated**: `docs/design/26-anchor-kro-ui.md` marks 26.9 as ✅.

## Zone 2 — Guidelines

- The "import from cluster" step uses `[data-testid="cluster-import-toggle"]` and `[data-testid="cluster-import-select"]` (existing from journey 082).
- The "round-trip" is: fill form → see YAML → import from cluster → verify state. This exercises create + export + import in one hermetic journey.
- If the cluster is unreachable (import fails), the journey logs a warning but does not fail: the create + YAML preview steps are still validated.

## Zone 3 — Scoped out

- Applying the created YAML to the cluster via kubectl (not supported in the E2E journey — CI doesn't have kubectl outside global-setup).
- Verifying every field is preserved after import (only the name field is checked).
