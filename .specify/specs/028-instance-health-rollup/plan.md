# Implementation Plan: 028-instance-health-rollup

**Branch**: `028-instance-health-rollup` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/028-instance-health-rollup/spec.md`
**Input**: Feature specification from `/specs/028-instance-health-rollup/spec.md`

## Summary

Surface per-instance and per-RGD health summaries across three UI surfaces:
1. RGD home cards gain an async instance health chip (`{ready}/{total} ready`)
2. `InstanceTable` gains 5-state health badges (adding `reconciling` and `pending`)
3. Instance detail header gains a `HealthPill` component showing the rolled-up state
4. `ConditionsPanel` is fixed to use "Not reported" for absent conditions and omit absent fields

All changes are pure frontend. No new backend endpoints or Go changes required.

## Technical Context

**Language/Version**: Go 1.25 (backend — no changes) / TypeScript 5.x + React 19  
**Primary Dependencies**: React 19, React Router v7, Vite — all already present; no new npm deps  
**Storage**: N/A — all state is local React `useState`; no persistence  
**Testing**: Vitest (frontend unit tests)  
**Target Platform**: Browser (desktop) — embedded in the Go binary via `go:embed`  
**Project Type**: Web application (frontend-only changes for this spec)  
**Performance Goals**: Home page RGD card renders immediately (chip is async, fire-and-forget); chip resolves within 5s per card  
**Constraints**: No CSS frameworks; no state management libraries; all colors via `tokens.css`; no hardcoded hex/rgba  
**Scale/Scope**: Home page up to 5,000 RGDs (virtualized via spec 024 — health chip fetches are per-visible-card only)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Compliance | Notes |
|------|-----------|-------|
| §II Cluster Adaptability | ✅ PASS | No new kro field paths hardcoded; all reads via existing dynamic client and `extractReadyStatus` pattern |
| §III Read-Only | ✅ PASS | All frontend reads from existing API endpoints; no mutating calls |
| §IV Single Binary | ✅ PASS | Frontend only; embedded via `go:embed` unchanged |
| §V Simplicity | ✅ PASS | No new npm dependencies; no state management library; plain React `useState` for async chip state |
| §IX Theme/UI | ✅ PASS | All colors via `tokens.css` custom properties; `--color-alive`, `--color-status-error`, `--color-status-warning`, `--color-status-unknown` are already defined |
| §XI Performance Budget | ✅ PASS | Home page chip fetch is fire-and-forget (non-blocking); 5s timeout; chip simply absent on error |
| §XII Graceful Degradation | ✅ PASS | Chip absent on fetch error (not error state); "Not reported" for absent conditions; absent fields omitted |
| §XIII UX Standards | ✅ PASS | Worst-first sort (error→reconciling→pending→unknown→ready); all new components avoid hardcoded colors |

**No violations detected. Gate passes.**

## Project Structure

### Documentation (this feature)

```text
specs/028-instance-health-rollup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — API contract doc (read-only; existing endpoints)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
web/src/
├── components/
│   ├── HealthChip.tsx       # NEW — compact pill for RGDCard ("3 / 5 ready")
│   ├── HealthChip.css       # NEW
│   ├── HealthPill.tsx       # NEW — larger status pill for InstanceDetail header
│   ├── HealthPill.css       # NEW
│   ├── ReadinessBadge.tsx   # EXTEND — 3 states → 5 states
│   ├── ReadinessBadge.css   # EXTEND — add reconciling/pending styles
│   ├── ConditionsPanel.tsx  # EXTEND — summary header + "Not reported" empty state
│   ├── ConditionsPanel.css  # EXTEND — summary row styles
│   └── RGDCard.tsx          # EXTEND — add HealthChip with async load
├── pages/
│   └── InstanceDetail.tsx   # EXTEND — add HealthPill to header
└── lib/
    └── format.ts            # EXTEND — add extractInstanceHealth() (5-state function)

web/src/lib/
└── format.test.ts           # EXTEND — add extractInstanceHealth unit tests

web/src/components/
└── HealthChip.test.tsx      # NEW — unit tests for HealthChip

test/e2e/journeys/
└── 028-instance-health-rollup.spec.ts   # NEW — E2E journey
```

**Structure Decision**: Single web application (frontend-only). No new backend files.
All modifications to existing Go files: none.

## Complexity Tracking

> No constitution violations detected — this section is N/A.
