# Implementation Plan: RGD List — Home Page

**Branch**: `002-rgd-list-home` | **Date**: 2026-03-20 | **Spec**: `.specify/specs/002-rgd-list-home/spec.md`
**Input**: Feature specification from `/specs/002-rgd-list-home/spec.md`

## Summary

Implement the kro-ui home page: a responsive card grid showing all
ResourceGraphDefinitions in the connected cluster. Each card displays the RGD
name, generated kind, resource count, age, and a status dot (green/red/gray)
derived from the `Ready` condition. Cards link to the graph and instances views.
The page includes skeleton loading, error, and empty states. A top bar shows
the active kubeconfig context name on every page via a shared Layout component.

This is a **frontend-only** spec. The backend API (`GET /api/v1/rgds`,
`GET /api/v1/contexts`) is already fully implemented and tested from specs
001/001b. No Go code changes are required.

## Technical Context

**Language/Version**: TypeScript ~5.7 (frontend), Go 1.25 (backend — no changes this spec)
**Primary Dependencies**: React 19, React Router v7.4, Vite 8, plain CSS with `tokens.css` custom properties
**Storage**: N/A (read-only Kubernetes API via Go backend proxy)
**Testing**: Vitest + React Testing Library (to be added — not yet in devDependencies)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari latest 2 versions)
**Project Type**: Web dashboard (single-page application embedded in Go binary)
**Performance Goals**: Cards render within 500ms of API response (NFR-001); client-side navigation <100ms
**Constraints**: No CSS frameworks, no state management libraries, no external component libraries (constitution §V); CSS tokens only from `tokens.css` (§IX); strict TypeScript — no `any`, no `@ts-ignore`
**Scale/Scope**: Up to 50+ RGDs displayed without pagination; single page with 6 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Constitution Gate | Status | Notes |
|---|-------------------|--------|-------|
| §I | Iterative-First: spec is independently shippable, 001 merged first | **PASS** | 001/001b/001c merged. Backend API complete. This spec adds frontend only. |
| §II | Cluster Adaptability: dynamic client, no hardcoded kro paths in frontend | **PASS** | Frontend consumes `K8sObject = Record<string, unknown>` from api.ts. Field extraction (`spec.schema.kind`, `spec.resources`, `status.conditions`) happens only in presentation components, not in the API client. |
| §III | Read-Only: no mutating API calls | **PASS** | This spec uses only `GET /api/v1/rgds` and `GET /api/v1/contexts`. No writes. |
| §IV | Single Binary: go:embed, no CDN | **PASS** | Frontend is built by Vite into `web/dist/`, embedded via `web/embed.go`. No external runtime fetches. Fonts fall back to system stack offline. |
| §V | Simplicity: no prohibited dependencies | **PASS** | React + React Router + Vite only. Vitest + RTL for testing (testing libs are permitted). No Redux, no Tailwind, no MUI. |
| §VI | Go Code Standards | **N/A** | No Go changes in this spec. |
| §VII | Testing: Vitest for frontend, no snapshots | **PASS** | Unit tests via Vitest + RTL. Table-driven pattern where applicable. No snapshot tests. |
| §VIII | Commits: Conventional Commits | **PASS** | Will follow `feat(web):` / `test(web):` pattern. |
| §IX | Theme/UI: all styles from tokens.css | **PASS** | All colors, fonts, radii, spacing from CSS custom properties. No hardcoded hex. |
| §X | License: Apache 2.0 headers on Go files | **N/A** | No new Go files. TypeScript files do not require headers per convention. |

**Gate result**: **PASS** — no violations, no complexity justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-rgd-list-home/
├── plan.md              # This file
├── research.md          # Phase 0: testing setup, age formatting, status extraction
├── data-model.md        # Phase 1: API response shapes, component props
├── quickstart.md        # Phase 1: dev workflow for running/testing
├── contracts/           # Phase 1: component API contracts, test contracts
│   ├── components.md    # Component prop interfaces and DOM contracts
│   └── tests.md         # Test case specifications
└── tasks.md             # Phase 2: ordered implementation checklist
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── main.tsx                        # Entry — already exists, routes defined
│   ├── tokens.css                      # Design tokens — already exists, complete
│   ├── pages/
│   │   └── Home.tsx                    # NEW: RGD card grid (currently stub)
│   │   └── Home.css                    # NEW: Home page styles
│   ├── components/
│   │   ├── Layout.tsx                  # REWRITE: top bar + <Outlet /> (currently stub)
│   │   ├── Layout.css                  # NEW: Layout styles
│   │   ├── TopBar.tsx                  # NEW: context name display + logo
│   │   ├── TopBar.css                  # NEW: TopBar styles
│   │   ├── RGDCard.tsx                 # NEW: single RGD summary card
│   │   ├── RGDCard.css                 # NEW: card styles
│   │   ├── StatusDot.tsx               # NEW: colored status indicator
│   │   ├── StatusDot.css               # NEW: status dot styles
│   │   ├── SkeletonCard.tsx            # NEW: loading placeholder card
│   │   └── SkeletonCard.css            # NEW: skeleton animation styles
│   ├── lib/
│   │   └── api.ts                      # EXISTS: typed API client (no changes)
│   │   └── format.ts                   # NEW: age formatting, status extraction helpers
│   └── hooks/
│       └── usePolling.ts               # EXISTS: polling hook (no changes needed)
├── package.json                        # UPDATE: add vitest, @testing-library/react, @testing-library/jest-dom
├── vite.config.ts                      # EXISTS: may need vitest config integration
└── vitest.config.ts                    # NEW: vitest configuration (or inline in vite.config.ts)

test/e2e/journeys/
└── 002-home-page.spec.ts              # NEW: Playwright E2E journey
```

**Structure Decision**: Frontend-only changes within the existing `web/src/`
directory structure established by spec 001. No new Go files. Component CSS is
colocated (one `.css` file per component) using plain CSS with `var()` token
references. Utility functions for data extraction go in `web/src/lib/format.ts`
to keep components focused on rendering.

## Complexity Tracking

> No constitution violations. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
