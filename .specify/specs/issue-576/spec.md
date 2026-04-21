# Spec: 27.14 — Frontend Code Splitting

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future 27.14`
- **Implements**: Frontend code splitting: route-based React.lazy + Suspense to reduce initial bundle below 200KB; raise perf.yml threshold to 70 (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. **Route-based code splitting**: Every page component imported in `web/src/main.tsx` MUST use `React.lazy()` instead of a static import. Violation: any static `import Home from './pages/Home'` style import remains for a page component.

2. **Suspense boundary**: A `<Suspense>` wrapper with a non-null `fallback` MUST wrap all lazy-loaded routes in the router. Violation: `React.lazy` is used without a `<Suspense>` ancestor, causing React to throw.

3. **Loading fallback renders**: The Suspense fallback MUST be a visible inline loading indicator (not a blank screen). The fallback component MUST render within the existing `Layout` shell (nav stays visible during route load). Violation: blank white screen during chunk load.

4. **TypeScript types**: `bun run build` (or `tsc --noEmit`) MUST produce zero type errors after the change. Violation: any TypeScript error in the output.

5. **Tests pass**: All existing page-level unit tests (`*.test.tsx`) MUST continue to pass. A page wrapped in `React.lazy` is still importable synchronously in tests via normal `import`. Violation: any test failure introduced by this change.

6. **perf.yml threshold raised**: After code splitting ships, the `THRESHOLD` in `.github/workflows/perf.yml` MUST be raised from `50` to `70`. This threshold change ships in the same PR. Violation: perf.yml still says `THRESHOLD=50` after merge.

7. **No new npm dependencies**: No new packages are added to `web/package.json`. `React.lazy` and `Suspense` are built-in to React 19. Violation: any new entry in `dependencies` or `devDependencies`.

---

## Zone 2 — Implementer's judgment

- The exact visual design of the loading fallback (spinner, skeleton, pulse) is left to the implementer. A simple centered spinner or skeleton bar is acceptable.
- Whether to use a single top-level `<Suspense>` wrapping all routes, or per-route `<Suspense>` wrappers, is left to the implementer. A single top-level boundary is simpler and acceptable.
- Vite chunking configuration (manual chunks, `rollupOptions`) may be added if it improves splitting, but is not required if `React.lazy` alone achieves the bundle-size goal.
- The Suspense fallback component may be defined inline in `main.tsx` or extracted to a separate file.

---

## Zone 3 — Scoped out

- Component-level code splitting (splitting individual heavy components, not routes) is out of scope.
- Progressive loading / prefetching of route chunks on hover is out of scope.
- Bundle size measurement tooling (bundle analyzer) is out of scope for this PR.
- The `27.16` Google Fonts self-hosting is a separate item and is out of scope.
- Verifying Lighthouse score numerically in CI (the perf.yml threshold raise is sufficient) is out of scope beyond the threshold change.
