# Implementation Plan: RGD Authoring Global Entrypoint

**Branch**: `039-rgd-authoring-entrypoint` | **Date**: 2026-03-24 | **Spec**: `.specify/specs/039-rgd-authoring-entrypoint/spec.md`
**Input**: Feature specification from `.specify/specs/039-rgd-authoring-entrypoint/spec.md`

## Summary

The RGD authoring form ("New RGD" mode) is currently only reachable as a sub-mode
inside the Generate tab of an existing RGD detail page — it is completely
undiscoverable as a top-level workflow. This spec adds three surfaces to make it
accessible: a `+ New RGD` button in the top bar (global), a standalone `/author`
route, and "New RGD" links in the Home and Catalog empty states. The per-RGD
Generate tab's "New RGD" mode is preserved as a context-aware shortcut.

All changes are pure frontend (React/TypeScript). No new backend endpoints. No new
dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x / React 19 / React Router v7 / Vite
**Primary Dependencies**: React Router v7 (`<Link>`, `<Route>`), existing `RGDAuthoringForm`, `YAMLPreview`, `generator.ts` lib
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Browser (SPA embedded in Go binary)
**Project Type**: Frontend feature addition to existing web application
**Performance Goals**: Client-side only — no API calls on the `/author` route; render target <16ms
**Constraints**: No new npm/Go dependencies; tokens.css only for CSS; TypeScript strict 0 errors
**Scale/Scope**: 1 new page, 3 modified pages/components, 1 new E2E journey (4 steps)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | All prior specs merged; `026-rgd-yaml-generator` and `033-first-time-onboarding` both merged |
| §II Cluster Adaptability | PASS | AuthorPage is purely client-side; no cluster access needed |
| §III Read-Only | PASS | No mutating API calls; authoring produces YAML for user to apply manually |
| §IV Single Binary | PASS | New `.tsx`/`.css` files compiled into the embedded frontend |
| §V Simplicity | PASS | No new libraries; reuses `RGDAuthoringForm`, `YAMLPreview`, `generator.ts` |
| §IX Theme | PASS | All CSS via tokens.css custom properties; no hardcoded colors |
| §XIII Page titles | PASS | AuthorPage sets `"New RGD — kro-ui"` |
| §XIII Route completeness | PASS | `/author` registered before `*` catch-all |
| §XIII Interactive cards | N/A | No card pattern on AuthorPage |
| §XIII No hardcoded config | PASS | Route is `/author` (constant), no k8s resource names |

**Gate result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/039-rgd-authoring-entrypoint/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
web/src/
├── main.tsx                         # EDIT: add /author route
├── pages/
│   ├── AuthorPage.tsx               # NEW: standalone authoring page
│   ├── AuthorPage.css               # NEW: page layout styles
│   ├── Home.tsx                     # EDIT: add /author link in onboarding empty state
│   └── Catalog.tsx                  # EDIT: add /author link in zero-items empty state
└── components/
    ├── TopBar.tsx                   # EDIT: add "+ New RGD" Link button
    └── TopBar.css                   # EDIT: style the new button

test/e2e/journeys/
└── 039-rgd-authoring-entrypoint.spec.ts  # NEW: 4-step E2E journey
```

**Structure Decision**: Single web project. All changes are confined to the
`web/src/` tree. No backend changes required. The `/author` route reuses
existing `RGDAuthoringForm` + `YAMLPreview` + `generator.ts` — no new
abstractions needed.

## Complexity Tracking

> No constitution violations. No complexity justification required.
