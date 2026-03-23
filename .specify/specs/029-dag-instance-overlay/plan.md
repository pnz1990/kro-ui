# Implementation Plan: 029-dag-instance-overlay

**Branch**: `029-dag-instance-overlay` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `.specify/specs/029-dag-instance-overlay/spec.md`

---

## Summary

Add a live instance overlay to the RGD detail **Graph tab**. The user selects
any live instance of the current RGD from an inline picker; the static DAG
nodes colorize with live health states (alive/reconciling/error/not-found) using
the existing `LiveDAG` color tokens. No new backend endpoints — all required API
calls already exist. Zero Go changes.

Key technical approach:
1. Extract shared `nodeStateForNode()` from `LiveDAG`/`DeepDAG` into `dag.ts`.
2. Add optional `nodeStateMap` prop to `StaticChainDAG`.
3. Add live-state CSS rules scoped to `.static-chain-dag-container`.
4. Extend `DAGTooltip` with optional `nodeState` prop.
5. New `InstanceOverlayBar` component handles picker + summary bar.

---

## Technical Context

**Language/Version**: Go 1.25 (backend — no changes) / TypeScript 5.x + React 19  
**Primary Dependencies**: React Router v7, Vite (all present; no new npm deps)  
**Storage**: N/A — all state is local React `useState`; no persistence  
**Testing**: `bun typecheck` (TS), existing E2E journeys (Playwright/kind)  
**Target Platform**: Browser SPA served by Go binary at `:40107`  
**Project Type**: Web application (frontend-only change)  
**Performance Goals**: Overlay activation ≤5 s (two API calls; both already have the 5s budget per constitution §XI)  
**Constraints**: No new npm deps; no CSS frameworks; no hardcoded hex; no polling on Graph tab  
**Scale/Scope**: ~2 new files, ~7 modified files; no backend changes

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| §I Iterative-first | PASS | Feature is independently shippable; all predecessor specs are merged |
| §II Cluster Adaptability | PASS | Uses existing dynamic client; no new kro field paths; overlay is data-driven |
| §III Read-only | PASS | No mutating API calls; overlay is GET only |
| §IV Single Binary | PASS | No new assets; no CDN; frontend embedded via go:embed |
| §V Simplicity — no new deps | PASS | No new npm packages; standard `<select>` for picker |
| §V Simplicity — no state mgmt lib | PASS | Plain React useState |
| §V Simplicity — no CSS frameworks | PASS | Plain CSS with tokens.css |
| §VI Copyright headers | N/A | Frontend only; no new Go files |
| §IX Color tokens | PASS | Live-state tokens already exist; no new hex literals |
| §IX Shadow tokens | PASS | No new shadows |
| §IX Shared helpers | PASS | `nodeStateForNode()` extracted to dag.ts; `liveStateClass()` already there |
| §XI Performance budget | PASS | Two API calls each with existing 5s budget |
| §XII Graceful degradation | PASS | Absent conditions → "Unknown"; fetch failure → non-blocking error; DAG unaffected |
| §XIII Page titles | N/A | No new pages |
| §XIII Tooltip viewport clamping | PASS | DAGTooltip already has portal + viewport clamping |
| §XIII Hardcoded config | PASS | No hardcoded names/namespaces |

**Constitution violations requiring justification**: None.

---

## Project Structure

### Documentation (this feature)

```text
specs/029-dag-instance-overlay/
├── plan.md              # This file
├── spec.md              # Feature requirements and acceptance criteria
├── research.md          # Phase 0 output — all unknowns resolved
├── data-model.md        # Phase 1 output — state shape, prop contracts
├── quickstart.md        # Phase 1 output — dev guide, file list, walkthrough
├── contracts/
│   └── component-contracts.md   # Prop interfaces + behavioral contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (affected files)

```text
web/src/lib/
└── dag.ts                        # + nodeStateForNode() export (refactor)

web/src/components/
├── DAGTooltip.tsx                # + optional nodeState?: NodeLiveState prop
├── StaticChainDAG.tsx            # + nodeStateMap prop, nodeBaseClass() extended
├── StaticChainDAG.css            # + live-state rect override rules
├── LiveDAG.tsx                   # replace inline nodeState() with nodeStateForNode()
├── DeepDAG.tsx                   # replace inline nodeState() with nodeStateForNode()
├── InstanceOverlayBar.tsx        # NEW — picker + summary bar component
└── InstanceOverlayBar.css        # NEW — BEM styles

web/src/pages/
└── RGDDetail.tsx                 # + overlay state + picker effect + InstanceOverlayBar
```

**Structure Decision**: Single modified frontend, no backend changes. Follows
existing kro-ui component structure (one component per file, BEM CSS).

---

## Phase 0 — Research

**Output**: [`research.md`](./research.md)

All unknowns resolved. Key findings:

| # | Unknown | Resolution |
|---|---------|-----------|
| R-001 | Does `DAGTooltip` need a new prop? | Yes — add optional `nodeState?: NodeLiveState`; also relax render gate |
| R-002 | How to add live CSS to `StaticChainDAG`? | Scoped rules in `StaticChainDAG.css`; `reconciling-pulse` already global in `tokens.css` |
| R-003 | Where is `nodeState()` logic? | Duplicated in LiveDAG + DeepDAG; extract to `dag.ts` as `nodeStateForNode()` |
| R-004 | Picker fetch trigger? | `useEffect` when `activeTab === 'graph'`; lazy, same pattern as Instances tab |
| R-005 | `nodeBaseClass()` location? | `StaticChainDAG.tsx:83–89`; extend with optional `liveState?` param |
| R-006 | `StaticChainDAG` prop design? | Optional `nodeStateMap?: NodeStateMap`; backward compat; no change to callers |
| R-007 | Separate component file? | Yes — `InstanceOverlayBar.tsx` + CSS; matches existing patterns |
| R-008 | Picker CSS: reuse NamespaceFilter? | No — different DOM; own BEM class hierarchy |
| R-009 | Polling on Graph tab? | No — spec explicitly prohibits |
| R-010 | Root node state in overlay? | Aggregate over stateMap values; same logic as LiveDAG |

---

## Phase 1 — Design & Contracts

**Output**: [`data-model.md`](./data-model.md), [`contracts/component-contracts.md`](./contracts/component-contracts.md), [`quickstart.md`](./quickstart.md)

### New entities / state

- `PickerItem { namespace: string; name: string }` — overlay picker item
- `RGDDetail` gains 7 new state variables (see `data-model.md §1`)
- `nodeStateForNode(node, stateMap)` exported from `dag.ts`

### Component changes

| Component | Change type | Key detail |
|-----------|------------|-----------|
| `dag.ts` | New export | `nodeStateForNode()` — extracted from LiveDAG + DeepDAG |
| `DAGTooltip` | Prop addition | `nodeState?: NodeLiveState`; render gate relaxed |
| `StaticChainDAG` | Prop addition + render | `nodeStateMap?`; `nodeBaseClass()` extended |
| `StaticChainDAG.css` | New rules | 4 live-state override blocks |
| `LiveDAG` | Refactor | Inline `nodeState()` → `nodeStateForNode()` from `dag.ts` |
| `DeepDAG` | Refactor | Inline `nodeState()` → `nodeStateForNode()` from `dag.ts` |
| `RGDDetail` | State + render | 7 new state vars; picker fetch effect; `InstanceOverlayBar` render |
| `InstanceOverlayBar` | New component | Picker `<select>` + summary bar + error states |

### Post-design constitution re-check

Re-checked §IX (shared helpers): `nodeStateForNode()` in `dag.ts` satisfies the
prohibition on copy-pasted graph helpers. The duplicate `nodeState()` in
`LiveDAG` and `DeepDAG` is removed. All other constitution rules remain PASS.
