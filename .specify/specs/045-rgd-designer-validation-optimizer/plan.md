# Implementation Plan: RGD Designer — Validation & Optimizer

**Branch**: `045-rgd-designer-validation-optimizer` | **Date**: 2026-03-26 | **Spec**: `.specify/specs/045-rgd-designer-validation-optimizer/spec.md`
**Input**: Feature specification from `/specs/045-rgd-designer-validation-optimizer/spec.md`

## Summary

Add a targeted validation layer to the RGD Designer (`/author`) that surfaces
inline advisory messages for common authoring mistakes (empty required fields,
duplicate IDs, forEach/constraint problems) through a new pure function
`validateRGDState` in `generator.ts`, plus wrap `YAMLPreview` in `React.memo`
to prevent unnecessary reconciliation. All changes are frontend-only; no new
dependencies are introduced.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend); Go 1.25 (backend — no changes needed)
**Primary Dependencies**: React 19, Vite, plain CSS — no new npm or Go packages
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: Vitest (frontend unit), `go test -race` (backend, unchanged)
**Target Platform**: Web browser (Chrome/Firefox/Safari modern) + single Go binary
**Project Type**: Frontend feature within existing web application
**Performance Goals**: `validateRGDState` < 1ms for forms with ≤ 100 resources/fields (O(N) scan)
**Constraints**: No new npm or Go dependencies (FR-009); no hardcoded hex/rgba (FR-010); TypeScript strict mode 0 errors (NFR-001)
**Scale/Scope**: Affects 7 frontend files; 0 backend files; no API changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Section | Status | Notes |
|------|---------|--------|-------|
| No mutating Kubernetes API calls | §III Read-Only | ✅ Pass | Frontend-only; no k8s calls |
| Single binary distribution (go:embed) | §IV | ✅ Pass | No new assets; existing embed unchanged |
| No state management libraries | §V | ✅ Pass | All state is local `useState`; no Redux/Zustand |
| No CSS frameworks | §V, §IX | ✅ Pass | Plain CSS using tokens.css only |
| No code highlighting libraries | §V | ✅ Pass | No new highlighter; existing tokenizer reused |
| No component libraries | §V | ✅ Pass | No shadcn/Radix UI |
| No new npm dependencies | FR-009 / §V | ✅ Pass | `validateRGDState` is pure TS; `React.memo` is built-in |
| All colors via `tokens.css` tokens | §IX | ✅ Pass | Adding `--color-warning` token first; fixing existing fallback violation |
| No hardcoded hex/rgba in component CSS | §IX | ✅ Pass | New CSS uses only `var(--token-name)` |
| WCAG AA accessibility | §IX | ✅ Pass | `role="alert"` + `aria-live="polite"` on messages |
| Graceful degradation — never crash on partial input | §XII | ✅ Pass | `validateRGDState` never throws; all branches return valid state |
| Page title set | §XIII | ✅ Pass | `usePageTitle('RGD Designer')` already set; no change needed |
| Cards fully clickable | §XIII | N/A | No new cards introduced |
| Iterative-first | §I | ✅ Pass | Standalone shippable addition on top of merged `044` |
| Dynamic client / no hardcoded field paths | §II | N/A | Frontend-only; no k8s access |
| Performance budget (5s API response) | §XI | N/A | No API changes; frontend validation is synchronous <1ms |

**Constitution violations**: None. No justification table needed.

## Project Structure

### Documentation (this feature)

```text
specs/045-rgd-designer-validation-optimizer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── validation-api.md  # Phase 1 output — validateRGDState contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
web/src/
├── tokens.css                          # +--color-warning token (dark + light)
├── lib/
│   ├── generator.ts                    # +ValidationIssue, ValidationState, validateRGDState
│   └── generator.test.ts               # +validateRGDState test suite (100% branch)
└── components/
    ├── RGDAuthoringForm.tsx            # consume ValidationState, render inline messages + summary
    ├── RGDAuthoringForm.css            # +field-msg classes; fix --color-warning fallbacks
    ├── RGDAuthoringForm.test.tsx       # +validation rendering tests
    ├── YAMLPreview.tsx                 # wrap with React.memo
    └── YAMLPreview.test.tsx            # +memo render-count test (if file exists, add case)
```

**Structure Decision**: Single frontend project — standard web/src layout. No
new directories, no new Go packages, no backend changes.

## Complexity Tracking

> No Constitution violations — this section is blank.
