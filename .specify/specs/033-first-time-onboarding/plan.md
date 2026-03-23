# Implementation Plan: 033-first-time-onboarding

**Branch**: `033-first-time-onboarding` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/033-first-time-onboarding/spec.md`
**Input**: GitHub issue #120 — "ux: No onboarding — first-time visitor has zero context about what kro-ui is"

## Summary

Add minimal but complete first-time onboarding context to kro-ui:
a **tagline** in the top bar or home hero, a **site-wide footer** with links to
`https://kro.run` and the kro GitHub repository, and a **rich empty-state** on
the home page that explains what kro is and how to get started when no
ResourceGraphDefinitions exist in the connected cluster.

No backend changes are required. This is a pure frontend enhancement touching
`Layout.tsx`, `Home.tsx`, and the addition of a `Footer` component.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 (already in use)
**Primary Dependencies**: React Router v7, Vite — no new npm deps
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: Vitest unit tests for pure helpers; Playwright E2E journeys already in place
**Target Platform**: Browser (same-origin SPA served from Go binary)
**Project Type**: Web application — read-only Kubernetes dashboard
**Performance Goals**: Sub-100ms render; footer/empty-state are static content with no API calls
**Constraints**:
- No CSS frameworks (Tailwind, MUI, Bootstrap) — tokens.css only
- No hardcoded hex values in component CSS — must use `var(--token)` only
- No new npm packages
- No shadow tokens defined inline — any `box-shadow` with color must be a named token in `tokens.css`
- Fully offline after binary download (no external CDN, no runtime asset fetch)
- External links (`https://kro.run`, GitHub) must use `target="_blank" rel="noopener noreferrer"`
**Scale/Scope**: 3 touch-points (TopBar tagline, Footer, Home empty-state); ~4 new/modified files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Check | Notes |
|------|-------|-------|
| §I Iterative-First | PASS | Feature is independently shippable; no unmerged dependencies |
| §II Cluster Adaptability | PASS | No new k8s API calls; no hardcoded field paths |
| §III Read-Only | PASS | No mutating API calls; purely presentational |
| §IV Single Binary | PASS | No external CDN; all assets remain embedded |
| §V Simplicity — no banned deps | PASS | No new packages; plain CSS + React only |
| §IX No CSS frameworks / no hardcoded hex | **MUST VERIFY** | All colors via `var(--token)` in component CSS; any new shadow token defined in `tokens.css` |
| §IX Shared rendering helpers | N/A | No graph helpers involved |
| §XIII Page titles | PASS | Home page already sets title to "kro-ui"; footer/tagline don't change this |
| §XIII Interactive cards | N/A | No new cards |
| §XIII No hardcoded config | PASS | External URLs are documentation links, not k8s config |
| §XI Performance budget | PASS | Footer/tagline are static; zero API calls added |
| §XII Graceful degradation | PASS | Onboarding content is static; no fallback needed |

**Post-design re-check**: Re-verify §IX color token compliance after Phase 1 CSS is written.

## Project Structure

### Documentation (this feature)

```text
specs/033-first-time-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ui-components.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
web/src/
├── components/
│   ├── Footer.tsx             # NEW — site-wide footer with kro links + version
│   └── Footer.css             # NEW — footer styles using tokens.css variables
├── pages/
│   ├── Home.tsx               # MODIFIED — richer empty-state component
│   └── Home.css               # MODIFIED — new empty-state styles if needed
├── tokens.css                 # MODIFIED — add --shadow-footer token if needed
└── components/
    └── Layout.tsx             # MODIFIED — mount Footer below <Outlet>
```

**Structure Decision**: Single project (existing layout). Footer is a reusable
component added to `web/src/components/` and mounted once in `Layout.tsx` so it
appears on every page. The empty-state in `Home.tsx` is enhanced inline (no new
component) since `VirtualGrid` already accepts `emptyState: ReactNode`.

## Complexity Tracking

No constitution violations to justify.
