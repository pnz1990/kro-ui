# Implementation Plan: 030-error-patterns-tab

**Branch**: `030-error-patterns-tab` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/030-error-patterns-tab/spec.md`  
**Input**: Feature specification from `/specs/030-error-patterns-tab/spec.md`

## Summary

Add an **Errors** tab to the RGD detail page that aggregates `status.conditions`
failures from all instances of the RGD, groups them by `(conditionType, reason)`,
shows human-readable rewrites via the existing `rewriteConditionMessage()` helper,
and provides deep-link navigation to individual instances. Frontend-only: no new
backend endpoints.

## Technical Context

**Language/Version**: Go 1.25 (backend — no changes) / TypeScript 5.x + React 19  
**Primary Dependencies**: React Router v7, Vite — all already present; no new npm deps  
**Storage**: N/A — all state is local React `useState`; no persistence  
**Testing**: Vitest (frontend unit tests for pure functions); Playwright E2E for
  journey coverage of the new tab  
**Target Platform**: Browser (Chrome/Firefox/Safari); embedded in Go single binary  
**Project Type**: Web application (frontend component addition)  
**Performance Goals**: Tab content renders within the 5s API budget (§XI); exactly
  one `listInstances` call; no per-instance fan-out  
**Constraints**: 
  - No new npm dependencies
  - No hardcoded hex/rgba (§IX)
  - No backend changes
  - Must handle 500+ instances without breakage (NFR-002)
  - Must use existing `rewriteConditionMessage()` — no duplication (§IX shared helpers)
**Scale/Scope**: One new component file (~200 LOC), one CSS file, one page modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-First | PASS | Builds on merged `026-rgd-yaml-generator`; independently shippable |
| §II Cluster Adaptability | PASS | Uses untyped `K8sObject` via `listInstances`; no kro field paths hardcoded |
| §III Read-Only | PASS | No mutating API calls; only reads `listInstances` |
| §IV Single Binary | PASS | Frontend embedded via `go:embed`; no changes to binary structure |
| §V Simplicity | PASS | No new npm deps; plain React `useState` + `useMemo`; plain CSS |
| §VI Go Standards | PASS | No Go changes |
| §IX Theme/UI | PASS | All colors via `var(--token)`; reuse `rewriteConditionMessage()` instead of duplicating |
| §XI API Performance | PASS | Exactly 1 API call; `getInstanceEvents` fan-out explicitly prohibited |
| §XII Graceful Degradation | PASS | Absent conditions skipped silently; empty/error states handled |
| §XIII Frontend UX | PASS | Tab uses URL param; all-clear + empty state defined; instance items are full links |

**Verdict**: No violations. No complexity justification required.

## Project Structure

### Documentation (this feature)

```text
specs/030-error-patterns-tab/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
web/src/
├── pages/
│   └── RGDDetail.tsx                  # MODIFIED — add "errors" TabId + tab button + dispatch
├── components/
│   ├── ErrorsTab.tsx                  # NEW — groups error patterns, renders list
│   └── ErrorsTab.css                  # NEW — styles using tokens.css vars only
```

**Structure Decision**: Single-project web application layout. Only two new files
(`ErrorsTab.tsx`, `ErrorsTab.css`) plus a targeted modification to `RGDDetail.tsx`.
No backend files touched.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
