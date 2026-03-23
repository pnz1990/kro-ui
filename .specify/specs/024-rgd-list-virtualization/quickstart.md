# Quickstart: RGD List Virtualization

**Branch**: `024-rgd-list-virtualization`
**Date**: 2026-03-22

## Prerequisites

- Node.js / Bun installed (`bun --version`)
- Go 1.25 (`go version`)
- Working kro-ui checkout on the `024-rgd-list-virtualization` worktree

## Development Setup

```bash
# All commands from the worktree root
cd ~/Projects/kro-ui.024-rgd-list-virtualization

# Start the frontend dev server
make web-dev          # or: cd web && bun run dev

# Type-check (required before committing)
cd web && bunx tsc --noEmit

# Run frontend unit tests
cd web && bun run test

# Build full binary
make build
```

## Key Files to Touch

| File | Change |
|------|--------|
| `web/src/hooks/useDebounce.ts` | CREATE — generic debounce hook |
| `web/src/hooks/useDebounce.test.ts` | CREATE — Vitest unit tests (fake timers) |
| `web/src/hooks/useVirtualGrid.ts` | CREATE — pure windowing arithmetic hook |
| `web/src/hooks/useVirtualGrid.test.ts` | CREATE — Vitest unit tests |
| `web/src/components/VirtualGrid.tsx` | CREATE — generic windowed grid component |
| `web/src/components/VirtualGrid.css` | CREATE — spacer/container styles |
| `web/src/pages/Home.tsx` | AMEND — add search state + useDebounce + VirtualGrid |
| `web/src/pages/Home.css` | AMEND — remove .home__grid grid definition (moved to VirtualGrid) |
| `web/src/pages/Catalog.tsx` | AMEND — wire useDebounce + replace sorted.map with VirtualGrid |
| `web/src/pages/Catalog.css` | AMEND — remove .catalog__grid grid definition |
| `.specify/memory/constitution.md` | AMEND — §XIII scale 100+ → 5,000+ |

## Card Height Constants

- `RGDCard`: `130` px (use as `itemHeight` prop on Home's `VirtualGrid`)
- `CatalogCard`: `160` px (use as `itemHeight` prop on Catalog's `VirtualGrid`; enforce via `min-height: 160px` in `CatalogCard.css`)

## Testing the Virtual Scroll

To test with a large dataset locally without a real cluster, temporarily mock
`listRGDs` in `Home.tsx` during development:

```typescript
// Temporary dev mock — remove before committing
const items = Array.from({ length: 5000 }, (_, i) => ({
  metadata: { name: `rgd-${i}`, creationTimestamp: new Date().toISOString() },
  spec: { schema: { kind: `Kind${i % 10}` } },
}));
```

Verify in browser DevTools → Elements that the card count in `.virtual-grid__items`
stays bounded (≤ ~60 nodes) while scrolling.

## Commit Convention

```
feat(web): add VirtualGrid component with row-based windowing
feat(web): add useDebounce and useVirtualGrid hooks
feat(web): virtualize Home page RGD grid with debounced search
feat(web): virtualize Catalog page RGD grid with debounced search
docs(constitution): update scale requirement to 5,000+ RGDs (§XIII)
```
