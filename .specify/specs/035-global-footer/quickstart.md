# Quickstart: 035-global-footer

## What this feature does

Adds a global footer to every page in kro-ui. The footer shows the "kro-ui" label
and three external links: kro.run, the kro GitHub repository, and the Apache 2.0
license. It appears below all page content and requires no user interaction.

## Files changed

| File | Change |
|---|---|
| `web/src/components/Footer.tsx` | NEW — footer component |
| `web/src/components/Footer.css` | NEW — footer styles (tokens only) |
| `web/src/components/Layout.tsx` | EDIT — import + render `<Footer />` |

No backend changes. No new npm packages. No tokens.css changes.

## Running locally

```bash
# from worktree root
make web        # builds frontend
make go         # builds Go binary with embedded frontend
./kro-ui serve  # starts server on :40107
```

Then open http://localhost:40107 — the footer should appear at the bottom of every page.

## Verifying the implementation

1. Navigate to Home, Catalog, Fleet, Events, RGD detail, Instance detail, and 404 page
2. Each page must show the footer below all content
3. The footer must contain:
   - "kro-ui" label on the left
   - Three links on the right: kro.run, GitHub, License
4. All three links must open in a new tab
5. In light mode (`data-theme="light"` on `<html>`), the footer must adapt correctly
6. Inspect Element → verify no `rgba()` or hex literals appear in Footer.css (token compliance)

## Typecheck

```bash
cd web && npx tsc --noEmit
```

## Build

```bash
make go
```
