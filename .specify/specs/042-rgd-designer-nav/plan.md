# Implementation Plan: 042-rgd-designer-nav

**Branch**: `042-rgd-designer-nav` | **Date**: 2026-03-25 | **Spec**: GitHub issue #196  
**Input**: Feature specification from GitHub issue #196 — "feat(web): RGD Designer — remove 'New RGD' mode from Generate tab, promote /author to nav as 'RGD Designer', add live DAG preview"

## Summary

Promote the `/author` RGD authoring page to a first-class navigation item renamed "RGD Designer", remove the now-redundant "New RGD" inline mode from the Generate tab, update empty-state CTAs in Home and Catalog, update E2E tests, and add a live DAG preview panel to AuthorPage that renders the dependency graph from form state (debounced, client-side only, using the existing `buildDAGGraph` + `StaticChainDAG` pipeline).

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 — frontend only; no backend changes  
**Primary Dependencies**: React Router v7 (`NavLink`), existing `@/lib/dag.ts` (`buildDAGGraph`), `@/components/StaticChainDAG.tsx`, `@/lib/generator.ts` (`RGDAuthoringState`, `generateRGDYAML`), `useDebounce` hook  
**Storage**: N/A — purely client-side; no persistence layer  
**Testing**: Playwright E2E (journeys), `bun typecheck` (`tsc --noEmit`)  
**Target Platform**: Browser SPA (same-origin embedded in Go binary)  
**Project Type**: Web application (frontend feature only)  
**Performance Goals**: DAG preview updates within 300ms of form change (debounced at 300ms); no network calls  
**Constraints**: No new npm dependencies; no CSS framework; all colors via `tokens.css` tokens; no hardcoded hex/rgba  
**Scale/Scope**: Small — 7 files changed (TopBar, GenerateTab, AuthorPage + CSS, Home, Catalog, E2E test)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | All prior specs merged; this spec is self-contained |
| §II Cluster Adaptability | PASS | No new kro field paths; DAG preview is client-only via existing `buildDAGGraph` |
| §III Read-Only | PASS | No mutating API calls; this is a pure UI feature |
| §IV Single Binary | PASS | No new runtime assets; all embedded via existing pipeline |
| §V Simplicity | PASS | Reuses existing `StaticChainDAG` + `buildDAGGraph`; no new deps |
| §VI Go Standards | N/A | No Go changes |
| §VII Testing | PASS | E2E journey 039 updated; typecheck required before commit |
| §IX Theme/UI | PASS | NavLink with existing `.top-bar__nav-link` class; tokens.css for new CSS |
| §XI API Performance | N/A | No API calls in this feature |
| §XII Graceful Degradation | PASS | DAG preview shows "Add resources…" hint when no resources defined |
| §XIII Frontend UX | PASS | `document.title` updated to "RGD Designer — kro-ui"; `data-testid` updated |

**Constitution violations**: None.

## Project Structure

### Documentation (this feature)

```text
specs/042-rgd-designer-nav/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (affected files)

```text
web/src/
├── components/
│   ├── TopBar.tsx                  # Replace <Link> button with <NavLink> inside <nav>; rename label
│   ├── TopBar.css                  # Remove .top-bar__new-rgd-btn class
│   ├── GenerateTab.tsx             # Remove 'rgd' mode, button, state, imports
│   └── GenerateTab.css             # Remove .generate-tab__mode-btn--rgd if present
├── pages/
│   ├── AuthorPage.tsx              # Update title, add live DAG preview column
│   ├── AuthorPage.css              # Three-column (or two-row) layout for form + DAG + YAML
│   ├── Home.tsx                    # Update empty-state CTA copy
│   └── Catalog.tsx                 # Update empty-state CTA copy
test/e2e/journeys/
└── 039-rgd-authoring-entrypoint.spec.ts  # Update testid + text assertions
```

**Structure Decision**: Single web application (Option 2 frontend). No backend changes. The live DAG preview is a new AuthorPage layout addition — form left, DAG center/top, YAML right/bottom.

## Complexity Tracking

> No constitution violations — this section is not applicable.
