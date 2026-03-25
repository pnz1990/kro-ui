# Implementation Plan: 038-live-dag-per-node-state

**Branch**: `038-live-dag-per-node-state` | **Date**: 2026-03-24 | **Spec**: `.specify/specs/038-live-dag-per-node-state/spec.md`
**Input**: Feature specification from `/specs/038-live-dag-per-node-state/spec.md`

## Summary

Upgrade the live DAG on the Instance Detail page so each node independently
reflects its own health state — alive, reconciling, error, pending (excluded by
`includeWhen`), or not-found — rather than inheriting a single instance-level
colour. This requires:

1. **Frontend-only state derivation**: inspect each child resource's own
   `status.conditions` (rather than only the CR-level conditions) to assign per-node
   state. No backend changes are needed.
2. **`pending` state implementation**: add the missing 5th state for nodes excluded
   by `includeWhen` (violet, dashed ring — tokens already exist in `tokens.css`).
3. **Tooltip wiring**: pass `nodeState` into `DAGTooltip` from `LiveDAG` so the
   live state label appears on hover for every node.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 + Vite (frontend only)
**Primary Dependencies**: React 19, React Router v7, no new npm dependencies
**Storage**: N/A
**Testing**: Vitest (unit), Playwright (E2E journeys)
**Target Platform**: Browser (SPA served by Go binary)
**Project Type**: web-application feature (frontend-only change)
**Performance Goals**: State derivation completes in <5ms per poll cycle even at 100+ child resources; DAG re-render stays within 60fps budget
**Constraints**:
  - No new npm dependencies (constitution §V)
  - No CSS framework or component library (constitution §V)
  - All colors via `tokens.css` custom properties — no inline hex (constitution §IX)
  - Shared helpers stay in `@/lib/` — no copy-paste across components (constitution §IX)
  - Backend is read-only; no new API endpoints (constitution §III)
  - `pending` tokens (`--node-pending-bg`, `--node-pending-border`) already defined in `tokens.css` — reuse them
**Scale/Scope**: Up to 50 DAG nodes per instance; children list up to ~200 resources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Check | Status |
|------|-------|--------|
| §I Iterative-first | Change is self-contained; no uncommitted code needed | PASS |
| §II Cluster adaptability | State derivation reads standard K8s `status.conditions` — no kro-specific field paths outside `rgd.go` | PASS |
| §III Read-only | No new Kubernetes write calls | PASS |
| §IV Single binary | Frontend change embedded via `go:embed` | PASS |
| §V Simplicity | No new npm/Go deps; no state management lib | PASS |
| §VI Go standards | No Go changes in this spec | N/A |
| §IX UI/theme | New CSS class `.dag-node-live--pending` uses existing `--node-pending-bg/border` tokens | PASS |
| §IX Shared helpers | `liveStateClass()` and `nodeStateForNode()` extended in `@/lib/dag.ts` — not duplicated | PASS |
| §XI Performance | `buildNodeStateMap()` runs once per poll tick; O(children) complexity | PASS |
| §XII Graceful degradation | Nodes with absent/unreadable conditions fall back to existing `alive`/`not-found` logic | PASS |
| §XIII Tooltip | `nodeState` prop already exists on `DAGTooltip` — just needs to be wired | PASS |

**Violations**: None.

## Project Structure

### Documentation (this feature)

```text
specs/038-live-dag-per-node-state/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── frontend-types.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (affected files)

```text
web/src/lib/
├── instanceNodeState.ts     # CHANGE: add 'pending' to NodeLiveState; add per-node condition inspection
├── dag.ts                   # CHANGE: extend liveStateClass() for 'pending' case

web/src/components/
├── LiveDAG.tsx              # CHANGE: pass nodeState to DAGTooltip
├── LiveDAG.css              # CHANGE: add .dag-node-live--pending CSS rule
├── DeepDAG.tsx              # CHANGE: pass nodeState to DAGTooltip (parity)
├── DAGTooltip.tsx           # CHANGE: extend stateClass() + STATE_LABEL for 'pending'
├── DAGTooltip.css           # CHANGE: add .dag-tooltip__state--pending rule

web/src/
└── tokens.css               # NO CHANGE — tokens already exist
```

**Structure Decision**: Pure frontend change. No new files required; all changes
are modifications to existing modules. The `pending` tokens are already defined.
The `DAGTooltip.nodeState` prop already exists and only needs wiring at the
call site.

## Complexity Tracking

> No violations to justify.
