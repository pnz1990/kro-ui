# Implementation Plan: 041 — Error States, Empty States, and Symbol Legend UX Audit

**Branch**: `041-error-states-ux-audit` | **Date**: 2026-03-25 | **Spec**: `spec.md`  
**GH Issue**: #187

---

## Summary

Full audit and fix of all error states, empty states, and symbol-legend gaps across the
kro-ui frontend. The root cause is the absence of an error translation layer: `api.ts`
forwards raw Go/Kubernetes API error strings verbatim to component render paths. The fix
introduces `web/src/lib/errors.ts` (a pure translation utility with no dependencies) and
threads it through every error render site. Separately, 14 empty-state messages are enriched
with actionable guidance, and 12 symbol/legend gaps are filled.

**6 HIGH + 14 MEDIUM + 12 LOW = 32 findings total. All frontend-only changes.**

---

## Technical Context

**Language/Version**: TypeScript 5.x + React 19  
**Primary Dependencies**: React Router v7, Vite (build only) — no new npm dependencies  
**Storage**: N/A — read-only observability UI  
**Testing**: Vitest (unit), existing Playwright E2E (journeys must pass unmodified)  
**Target Platform**: Browser (Chrome/Firefox/Safari via same-origin SPA)  
**Project Type**: Web application (SPA frontend + Go backend)  
**Performance Goals**: No new API calls, no new polling — pure rendering/display changes  
**Constraints**: No CSS frameworks; no state management libraries; all colours via `tokens.css`
`var()` references; no new npm packages; no hardcoded `rgba()`/hex in component CSS  
**Scale/Scope**: 21 component/page files modified; 2 new files (`errors.ts`, `errors.test.ts`)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Compliance | Notes |
|---|---|---|
| §I Iterative-First | ✅ PASS | Spec builds on already-merged base (all prior specs merged) |
| §II Cluster Adaptability | ✅ PASS | No new k8s API paths; all changes in render layer |
| §III Read-Only | ✅ PASS | No mutating calls; purely display-layer changes |
| §IV Single Binary | ✅ PASS | No new assets; no CDN calls |
| §V Simplicity | ✅ PASS | `errors.ts` is a pure function with zero dependencies |
| §VI Go Standards | ✅ N/A | No Go changes |
| §VII Testing Standards | ✅ PASS | `errors.test.ts` with table-driven tests; E2E journeys unmodified |
| §VIII Commit Conventions | ✅ PASS | Will use `fix(web):` scope |
| §IX Theme/UI Standards | ✅ PASS | All colours via `var()` tokens; no hardcoded hex; legend uses existing `--color-*` tokens |
| §X Licensing | ✅ PASS | Apache 2.0 header on all new TS files |
| §XI API Performance | ✅ PASS | No new API calls |
| §XII Graceful Degradation | ✅ PASS | This spec *implements* graceful degradation — it is the fix |
| §XIII Frontend UX Standards | ✅ PASS | All fixes align with or exceed the standards |

**No violations. Phase 0 may proceed.**

---

## Project Structure

### Documentation (this feature)

```text
specs/041-error-states-ux-audit/
├── plan.md              # This file
├── spec.md              # Feature specification (32 FRs)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
web/src/lib/
├── errors.ts            # NEW — translateApiError() utility
├── errors.test.ts       # NEW — unit tests (table-driven)
├── api.ts               # UNCHANGED — error forwarding stays as-is; translation at render
├── conditions.ts        # UNCHANGED — isHealthyCondition, rewriteConditionMessage already correct

web/src/pages/
├── RGDDetail.tsx        # FR-002, FR-003, FR-017
├── InstanceDetail.tsx   # FR-009, FR-021
├── Home.tsx             # FR-008
├── Catalog.tsx          # FR-008, FR-033
├── Fleet.tsx            # FR-008, FR-013
└── Events.tsx           # FR-008 (+ Retry button)

web/src/components/
├── ErrorsTab.tsx        # FR-004, FR-030
├── AccessTab.tsx        # FR-005
├── InstanceOverlayBar.tsx   # FR-006, FR-007, FR-029
├── LiveNodeDetailPanel.tsx  # FR-010
├── CollectionPanel.tsx      # FR-011, FR-027, FR-028
├── ExpandableNode.tsx       # FR-012, FR-026
├── EventsPanel.tsx          # FR-014, FR-024
├── SpecPanel.tsx            # FR-015
├── StaticChainDAG.tsx       # FR-016, FR-025, FR-026
├── FleetMatrix.tsx          # FR-018, FR-019
├── ClusterCard.tsx          # FR-020
├── ConditionsPanel.tsx      # FR-031
├── MetricsStrip.tsx         # FR-032
├── LiveDAG.tsx              # FR-022, FR-023
└── DeepDAG.tsx              # FR-022
```

**Structure Decision**: Flat `web/src/lib/` for the new utility module (consistent with all
existing `lib/` modules). No new subdirectories needed.

---

## Complexity Tracking

*No constitution violations. No complexity justification needed.*
