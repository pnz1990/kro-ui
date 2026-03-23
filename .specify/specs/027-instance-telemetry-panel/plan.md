# Implementation Plan: Instance Telemetry Panel

**Branch**: `027-instance-telemetry-panel` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/027-instance-telemetry-panel/spec.md`
**Input**: Feature specification from `/specs/027-instance-telemetry-panel/spec.md`

## Summary

Add a compact **Instance Telemetry Panel** — a horizontal 4-cell strip rendered
above the DAG on the instance detail page — showing Age, Time in State, Children
health ratio, and Warning event count. All metrics are derived client-side from
already-polled data (`instance`, `nodeStateMap`, `events`). **No new backend
endpoints required.** Pure frontend change: one new lib module, one new component,
and a one-line integration in `InstanceDetail.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19, Go 1.25  
**Primary Dependencies**: React, React Router v7, Vite; no new npm deps  
**Storage**: N/A — all data is in-memory React state  
**Testing**: Vitest (frontend unit + component), `go test -race` (backend, unchanged)  
**Target Platform**: Browser (same-origin SPA)  
**Project Type**: Frontend-only feature addition  
**Performance Goals**: Age cell ticks at 1Hz; all derivations are O(N) where N ≤ 200 events or ≤ 50 children  
**Constraints**: No new API calls, no new npm deps, all CSS via `tokens.css` vars  
**Scale/Scope**: Rendered on every instance detail page; 5 new files, ~250 LoC total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|---|---|---|
| §II Cluster Adaptability — dynamic client only | ✅ Pass | No backend changes; frontend reads existing unstructured data |
| §III Read-Only — no mutating k8s calls | ✅ Pass | Component only reads props, no k8s API calls |
| §V Simplicity — no new libraries | ✅ Pass | No new npm deps; no new Go deps |
| §IX Colors — tokens.css only | ✅ Pass | `TelemetryPanel.css` will reference only `var(--token)` |
| §XII Graceful Degradation — no `?`/`undefined` renders | ✅ Pass | All absent-data paths render "Not reported" |
| §XIII UX — breadcrumbs, titles, no small link targets | ✅ Pass | Panel is informational, not navigable |
| §XI API Performance Budget | ✅ Pass | No new API calls introduced |
| Anti-pattern: hardcoded rgba() in component CSS | ✅ Guard | Flagged in tasks — must be verified before commit |
| Anti-pattern: duplicating helpers across files | ✅ Guard | All derivation lives in `telemetry.ts`; no copy-paste |

**Post-design Constitution re-check**: No violations. The prop surface is clean;
derivation is isolated; CSS pattern matches `MetricsStrip`. No constitution
amendments required.

## Project Structure

### Documentation (this feature)

```text
specs/027-instance-telemetry-panel/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (new files)

```text
web/src/lib/
├── telemetry.ts         # NEW: pure derivation functions
└── telemetry.test.ts    # NEW: unit tests

web/src/components/
├── TelemetryPanel.tsx   # NEW: React component
├── TelemetryPanel.css   # NEW: styles (token-only)
└── TelemetryPanel.test.tsx  # NEW: component render tests
```

### Source Code (modified files)

```text
web/src/pages/
└── InstanceDetail.tsx   # MODIFIED: import + render TelemetryPanel
```

**Structure Decision**: Single frontend project. Pure TypeScript/React addition —
no new backend files, no new API routes, no Helm chart changes.

## Complexity Tracking

> No constitution violations requiring justification.
