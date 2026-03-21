# Research: RGD List — Home Page

**Spec**: `002-rgd-list-home`
**Date**: 2026-03-20

---

## Decision 1: Frontend Testing Setup (Vitest + React Testing Library)

**Decision**: Add Vitest 4.x + React Testing Library 16.x + jsdom 29.x as
devDependencies. Configure inline in `vite.config.ts`.

**Rationale**:
- Vitest 4.x has first-class Vite 8 support (`vite ^6 || ^7 || ^8` peer dep)
- RTL 16.x has explicit React 19 support (`react ^18 || ^19` peer dep)
- Inline vitest config in `vite.config.ts` avoids duplicating plugin/alias/proxy
  configuration in a separate file
- jsdom is the standard DOM environment for Vitest; lighter than happy-dom with
  better compatibility
- `@testing-library/jest-dom` provides custom matchers (`.toBeInTheDocument()`)
  via a dedicated `@testing-library/jest-dom/vitest` entry point

**Alternatives considered**:
- Separate `vitest.config.ts` — rejected because it duplicates the React plugin
  and path alias configuration already in `vite.config.ts`
- Jest — rejected because Vitest integrates natively with Vite's transform
  pipeline, avoiding separate Babel/SWC config
- happy-dom — rejected because jsdom has broader compatibility and is the
  standard recommendation for RTL

**Packages to add** (all devDependencies):

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^4.1.0` | Test runner |
| `@testing-library/react` | `^16.3.2` | React component testing |
| `@testing-library/dom` | `^10.4.1` | Required peer dep of RTL 16 |
| `@testing-library/jest-dom` | `^6.9.1` | Custom DOM matchers |
| `@testing-library/user-event` | `^14.6.1` | User interaction simulation |
| `jsdom` | `^29.0.1` | DOM environment for Vitest |

**Configuration**:
- Add `test` block to `vite.config.ts` with `globals: true`, `environment: 'jsdom'`,
  `css: false`, `setupFiles: ['src/test/setup.ts']`
- Create `web/src/test/setup.ts` with `import '@testing-library/jest-dom/vitest'`
- Add `"types": ["vitest/globals"]` to `tsconfig.json` compilerOptions
- Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to package.json

---

## Decision 2: Age Formatting (ISO 8601 → kubectl-style)

**Decision**: Pure TypeScript function using `Date.parse()` arithmetic. No
external library.

**Rationale**:
- `Date.parse()` handles ISO 8601 natively in all target browsers
- kubectl uses single-unit display (`3d`, not `3d2h`), keeping it scannable
- The arithmetic is trivial (~20 lines) and makes an external library unjustifiable
- Pure function with no side effects enables easy unit testing

**Alternatives considered**:
- `Intl.RelativeTimeFormat` — rejected because it produces verbose strings
  (`"3 days ago"`) instead of terse kubectl-style (`3d`)
- `date-fns` / `dayjs` — rejected per constitution §V (simplicity, minimize deps)
- Multi-unit format (`3d2h`) — rejected to match kubectl convention

**Implementation** (`web/src/lib/format.ts`):
- `formatAge(isoTimestamp: string): string`
- Thresholds: days → hours → minutes → seconds
- Returns `'Unknown'` for empty/invalid input, `'0s'` for future timestamps
- Tests use `vi.useFakeTimers()` for deterministic time

---

## Decision 3: Status Extraction from Unstructured K8s Objects

**Decision**: Type guard + runtime narrowing. No `any` assertions.

**Rationale**:
- The API client returns `K8sObject = Record<string, unknown>` intentionally
  (constitution §II — cluster adaptability)
- TypeScript `strict: true` + NFR-002 prohibit `any` and `@ts-ignore`
- Runtime type guards (`isCondition()`) provide safe narrowing from `unknown`
- Returning a `ReadyStatus` struct (state + reason + message) gives components
  everything needed for both the dot color and the tooltip text

**Alternatives considered**:
- `as` type assertion without guards — rejected as unsafe under strict mode
- Zod/io-ts schema validation — rejected per constitution §V (unnecessary dep)
- Returning raw string — rejected because components need reason/message for
  tooltips (spec line 148: "StatusDot with title tooltip")

**Implementation** (`web/src/lib/format.ts`):
- `K8sCondition` interface: `{ type, status, reason?, message?, lastTransitionTime? }`
- `ReadyState` union: `'ready' | 'error' | 'unknown'`
- `ReadyStatus` interface: `{ state, reason, message }`
- `extractReadyStatus(obj: K8sObject): ReadyStatus` — safely walks
  `obj.status.conditions[]`, finds `type === 'Ready'`, maps `status` string
- `readyStateColor(state: ReadyState): string` — returns CSS variable name
  (e.g., `'--color-status-ready'`), never a hex value (§IX compliance)

---

## Decision 4: CSS Architecture

**Decision**: Colocated plain CSS files with BEM-inspired naming. One `.css`
file per component, imported at the top of the component `.tsx` file.

**Rationale**:
- Constitution §V and §IX prohibit CSS frameworks. Plain CSS with `var()` tokens
  is the only permitted approach
- Colocated CSS (e.g., `RGDCard.css` alongside `RGDCard.tsx`) keeps styles
  discoverable and scoped to the component
- BEM-inspired naming (`.rgd-card`, `.rgd-card__name`, `.rgd-card--loading`)
  prevents class name collisions without CSS Modules (which would add build
  complexity)
- CSS Modules are available in Vite but unnecessary for this project's scale

**Alternatives considered**:
- CSS Modules (`*.module.css`) — rejected because the project has ~10 components;
  BEM naming is sufficient and simpler to grep/debug
- Single `styles.css` — rejected because it creates a monolithic file that's
  harder to maintain as component count grows
- Inline styles — rejected per spec FR-010 ("no inline styles except for dynamic
  values")

**Naming convention**:
- Block: component name, kebab-case (`.rgd-card`, `.status-dot`, `.top-bar`)
- Element: `__` separator (`.rgd-card__name`, `.rgd-card__kind`)
- Modifier: `--` separator (`.status-dot--ready`, `.status-dot--error`)
- All values reference tokens: `color: var(--color-text)`, never hex

---

## Decision 5: RGD Field Extraction Strategy

**Decision**: Extract `spec.schema.kind` and `spec.resources` in the
presentation layer (Home page / RGDCard), not in the API client.

**Rationale**:
- The API client (`api.ts`) intentionally returns `K8sObject` (unstructured) to
  comply with constitution §II (cluster adaptability)
- Moving field extraction to a utility function in `format.ts` keeps it testable
  and isolated: if kro changes field paths, only `format.ts` needs updating
- Frontend components call extraction helpers, not raw property access chains

**Helpers to implement** (`web/src/lib/format.ts`):
- `extractRGDName(obj: K8sObject): string` — `metadata.name`
- `extractRGDKind(obj: K8sObject): string` — `spec.schema.kind`
- `extractResourceCount(obj: K8sObject): number` — `spec.resources.length`
- `extractCreationTimestamp(obj: K8sObject): string` — `metadata.creationTimestamp`

All return safe defaults (empty string, 0) for missing fields. Never throw.

---

## Decision 6: Layout and Routing Strategy

**Decision**: Implement `Layout.tsx` as a shared wrapper with `TopBar` +
`<Outlet />`. TopBar fetches context name once on mount (no polling).

**Rationale**:
- The existing `Layout` component is a stub that does NOT render `<Outlet />`,
  which means no child routes render. Fixing this is a prerequisite for
  everything else
- React Router v7 `<Outlet />` renders the matched child route inside the
  layout, preserving scroll position on Back navigation (spec US2.3)
- The context name is fetched from `GET /api/v1/contexts` and displayed in the
  TopBar. No polling is needed (FR-008: "Home page MUST NOT auto-refresh")
- TopBar is extracted as a separate component for clarity, even though it's
  only used by Layout

**Alternatives considered**:
- Fetching context in every page component — rejected because the context is the
  same across all pages; Layout is the natural owner
- Polling context — rejected per FR-008 (static snapshot)

---

## Decision 7: Skeleton Loading Implementation

**Decision**: CSS-only skeleton cards using `@keyframes` shimmer animation on
`::after` pseudo-element. Same dimensions as `RGDCard`.

**Rationale**:
- Spec FR-005 requires CSS-only skeleton, no library
- Matching dimensions prevents layout shift when real cards replace skeletons
- A shimmer gradient animation (left-to-right sweep) communicates "loading" more
  clearly than a static gray block
- Three skeleton cards shown regardless of expected count (we don't know how
  many RGDs exist until the response arrives)

**Implementation**:
- `SkeletonCard.tsx` renders the same card shell with gray placeholder bars
  instead of text
- `SkeletonCard.css` defines a `@keyframes skeleton-shimmer` animation
- Home page renders 3 `SkeletonCard` instances during the loading state
