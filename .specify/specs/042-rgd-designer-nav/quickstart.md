# Quickstart: 042-rgd-designer-nav

**Branch**: `042-rgd-designer-nav`  
**Type**: Frontend-only feature

## What changes

1. **TopBar**: `+ New RGD` pill button → `RGD Designer` nav link inside `<nav>`
2. **GenerateTab**: Remove the `New RGD` mode (third button)
3. **AuthorPage**: Rename to "RGD Designer", add live DAG preview panel
4. **Home / Catalog**: Update empty-state CTA copy
5. **E2E test**: Update testid + text assertions in journey 039

## Prerequisites

```bash
# Frontend dev server (from worktree root)
make web            # builds web/dist — or run vite dev server:
bun --cwd web run dev
```

## Running the app

```bash
make build          # builds Go binary with embedded frontend
./kro-ui serve      # serves on :40107
```

## Typecheck

```bash
bun --cwd web run typecheck   # or: make web-typecheck
```

## E2E tests

```bash
make test-e2e       # full suite (requires kind cluster)
# or just journey 039:
npx playwright test --config test/e2e/playwright.config.ts \
  test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts
```

---

## Implementation order

Follow this order to avoid type errors mid-implementation:

1. **Add `rgdAuthoringStateToSpec`** to `web/src/lib/generator.ts`
   - Pure function, no imports needed
   - Add unit test in `web/src/lib/generator.test.ts`

2. **Update `GenerateTab.tsx`** — remove `'rgd'` mode
   - Remove button, state, imports
   - Optionally add subtle "Open RGD Designer →" link at the bottom
   - Verify `tsc --noEmit` passes

3. **Update `TopBar.tsx` + `TopBar.css`**
   - Move `<Link>` to `<NavLink>` inside `<nav>`
   - Delete `.top-bar__new-rgd-btn` CSS class
   - Change `data-testid` to `topbar-rgd-designer`

4. **Update `AuthorPage.tsx` + `AuthorPage.css`**
   - Change `usePageTitle('RGD Designer')`
   - Change `<h1>` text to `"RGD Designer"`
   - Import `useDebounce`, `rgdAuthoringStateToSpec`, `buildDAGGraph`, `StaticChainDAG`
   - Add debounced DAG computation
   - Add right-column split layout (DAG + YAML stacked)

5. **Update `Home.tsx`** — CTA text `"New RGD"` → `"Open RGD Designer"`

6. **Update `Catalog.tsx`** — link text `"in-app authoring tool"` → `"RGD Designer"`

7. **Update E2E test** `039-rgd-authoring-entrypoint.spec.ts`
   - `topbar-new-rgd` → `topbar-rgd-designer`
   - Text assertions: `'New RGD'` → `'RGD Designer'`
   - Title assertion: `/New RGD/` → `/RGD Designer/`
   - Step 4: replace `mode-btn-rgd` guard with DAG preview assertion

8. **Final typecheck + vet**:
   ```bash
   bun --cwd web run typecheck
   go vet ./...
   ```

---

## Key files reference

| File | Change |
|------|--------|
| `web/src/lib/generator.ts` | Add `rgdAuthoringStateToSpec` |
| `web/src/components/GenerateTab.tsx` | Remove `'rgd'` mode |
| `web/src/components/GenerateTab.css` | Remove `mode-btn--rgd` styles if present |
| `web/src/components/TopBar.tsx` | NavLink in nav, testid update |
| `web/src/components/TopBar.css` | Delete `.top-bar__new-rgd-btn` |
| `web/src/pages/AuthorPage.tsx` | Title, header, DAG preview |
| `web/src/pages/AuthorPage.css` | Three-section layout |
| `web/src/pages/Home.tsx` | CTA copy |
| `web/src/pages/Catalog.tsx` | CTA copy |
| `test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts` | Testid + text + step 4 |
