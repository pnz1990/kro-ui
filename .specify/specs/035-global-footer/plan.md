# Implementation Plan: 035-global-footer

**Branch**: `035-global-footer` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/035-global-footer/spec.md`
**Input**: Feature specification from GitHub issue #127 — "No links to kro docs, GitHub, or community anywhere in the UI"

## Summary

Add a minimal global footer to every page in kro-ui that surfaces links to kro.run,
the kro GitHub repository, and optionally community resources. The footer is a
net-new React component (`Footer.tsx` + `Footer.css`) inserted into the existing
`Layout.tsx` shell as a third flex child after `<main>`. It must use only existing
design-system tokens; any new token needed (e.g. a border/background for the footer
divider) must be added to `tokens.css` in both `:root` and `[data-theme="light"]`
blocks before being used.

No backend changes. No new npm packages. No state management.

---

## Technical Context

**Language/Version**: TypeScript 5.x + React 19  
**Primary Dependencies**: React Router v7, Vite (already present — no new deps)  
**Storage**: N/A — purely presentational component, no persistence  
**Testing**: Vitest (unit); Playwright E2E for presence assertion  
**Target Platform**: Browser (all modern); kro-ui SPA served from Go binary  
**Project Type**: Web application (frontend-only change)  
**Performance Goals**: Footer is static markup; renders in < 1ms  
**Constraints**: No new npm packages; tokens-only CSS; WCAG AA contrast; offline-capable (no external requests)  
**Scale/Scope**: One component, rendered on all ~8 routes

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | Self-contained; no dependency on unmerged specs |
| §II Cluster Adaptability | PASS | Pure UI; no k8s API calls |
| §III Read-Only | PASS | No mutating calls |
| §IV Single Binary | PASS | New `.tsx`/`.css` files are embedded via `go:embed all:dist` |
| §V Simplicity (no CSS frameworks) | PASS | Plain CSS with `tokens.css` vars only |
| §V Simplicity (no new npm deps) | PASS | No new packages |
| §IX No hardcoded hex/rgba in component CSS | **GATE** | Any color used in Footer.css MUST be a token from tokens.css — not inline `rgba()` or hex. Any new token must be added to both `:root` and `[data-theme="light"]` blocks |
| §IX Shadow tokens | PASS | Existing `--shadow-*` tokens can be reused; if a new shadow is needed it gets a named token |
| §IX Shared rendering helpers | PASS | Footer needs no shared helpers |
| §XIII UX — page titles | PASS | Footer has no `document.title` requirement |
| §XIII UX — card clickability | PASS | N/A (footer links, not cards) |
| §X Licensing | PASS | No new Go files; new TSX files do not require copyright headers |

**Post-design re-check**: Token compliance must be verified after `Footer.css` is written. Fail if any `rgba()`, hex literal, or hardcoded shadow appears outside `tokens.css`.

---

## Project Structure

### Documentation (this feature)

```text
specs/035-global-footer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (frontend-only change)

```text
web/src/
├── tokens.css                         # ADD: new footer tokens if needed
├── components/
│   ├── Layout.tsx                     # EDIT: add <Footer /> as third flex child
│   ├── Layout.css                     # EDIT: no change expected (footer auto-sticks)
│   ├── Footer.tsx                     # NEW: footer component
│   └── Footer.css                     # NEW: footer styles (tokens only)
```

**Structure Decision**: Single-project web app, frontend-only. `Footer.tsx` mirrors the
`TopBar.tsx` / `TopBar.css` naming and placement conventions. No backend, no new routes.

---

## Complexity Tracking

> No constitution violations requiring justification.
