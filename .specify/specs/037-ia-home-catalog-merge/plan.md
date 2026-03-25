# Implementation Plan: IA Home & Catalog Differentiation

**Branch**: `037-ia-home-catalog-merge` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/037-ia-home-catalog-merge/spec.md`

## Summary

Resolve the information architecture ambiguity where Home (`/`) and Catalog
(`/catalog`) appear identical at first glance despite having meaningfully
different purposes. **Option A — Distinguish** is chosen: rename the Home page
to "Overview" (operational health dashboard) and reinforce the Catalog page as
the browsing/discovery directory, via targeted copy + labeling changes only.

No new components, no new API calls, no routing changes, no backend changes.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 + Vite (frontend); Go 1.25 (backend — unchanged)
**Primary Dependencies**: React Router v7 (NavLink, usePageTitle hook), plain CSS custom properties
**Storage**: N/A
**Testing**: Playwright E2E (`002-home-page.spec.ts`, `015-rgd-catalog.spec.ts`); Go test race (unchanged)
**Target Platform**: Modern browser (same as existing)
**Project Type**: Web application (read-only Kubernetes observability dashboard)
**Performance Goals**: No change — this spec introduces no new data fetching or rendering
**Constraints**: CSS tokens only (`tokens.css`); no hardcoded hex/rgba in component CSS
**Scale/Scope**: 5 file edits (3 source + 2 E2E tests); 0 new files except `Catalog.css` addition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | Smallest possible change; both pages remain independently shippable |
| §II Cluster Adaptability | PASS | No cluster API changes |
| §III Read-Only | PASS | No mutating Kubernetes API calls introduced |
| §IV Single Binary | PASS | No new assets, no CDN |
| §V Simplicity | PASS | No new components, no new dependencies |
| §VI Go Standards | PASS | No Go code changes |
| §VII Testing | PASS | E2E assertions updated; no tests deleted |
| §VIII Commit Conventions | PASS | Will use `feat(web): rename home to overview — differentiate IA` |
| §IX Theme/UI Standards | PASS | CSS tokens only; `--color-text-muted` for subtitle; no hardcoded colors |
| §XI API Performance | PASS | No new API calls |
| §XII Graceful Degradation | PASS | No data handling changes |
| §XIII Frontend UX | PASS | Page titles updated (AC-001, AC-002); nav label updated (AC-004) |

**GATE RESULT: ALL PASS — no violations. No complexity tracking required.**

**Post-design re-check** (after Phase 1): All gates still pass. The only
design addition (`.catalog__subtitle` CSS class) uses `var(--color-text-muted)`
— a named token — consistent with §IX.

## Project Structure

### Documentation (this feature)

```text
specs/037-ia-home-catalog-merge/
├── plan.md              # This file
├── spec.md              # Feature specification (written as part of this plan)
├── research.md          # Phase 0 output — IA decision rationale
├── data-model.md        # Phase 1 output — copy change table, CSS class additions
├── quickstart.md        # Phase 1 output — step-by-step implementation guide
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (affected files only)

```text
web/
├── src/
│   ├── pages/
│   │   ├── Home.tsx           # usePageTitle, <h1>, .home__tagline text
│   │   ├── Catalog.tsx        # Add subtitle <p> below <h1>
│   │   └── Catalog.css        # Add .catalog__subtitle rule
│   └── components/
│       └── TopBar.tsx         # Nav link label "Home" → "Overview"
test/
└── e2e/
    └── journeys/
        ├── 002-home-page.spec.ts      # Update heading/title/nav assertions
        └── 015-rgd-catalog.spec.ts    # Update nav link assertion if present
```

**Structure Decision**: Web application, existing layout. No new directories.
All changes are targeted edits to existing files (+ one new CSS rule).

## Complexity Tracking

> No constitution violations — this section is not required.
