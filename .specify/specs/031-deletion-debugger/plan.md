# Implementation Plan: 031-deletion-debugger

**Branch**: `031-deletion-debugger` | **Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `.specify/specs/031-deletion-debugger/spec.md`

## Summary

Add a **Deletion Debugger** — a set of frontend-only diagnostics that surface `metadata.deletionTimestamp`, `metadata.finalizers`, and deletion-related events across the instance detail page, live DAG, instance table, and home cards. All required data is already present in existing API responses; no new backend endpoints are needed. The feature answers *"Why won't this delete?"* at a glance.

---

## Technical Context

**Language/Version**: Go 1.25 (backend — no changes), TypeScript 5.x + React 19 (frontend)  
**Primary Dependencies**: React 19, React Router v7, Vite — no new dependencies  
**Storage**: N/A — read-only, live polling only  
**Testing**: `go test -race ./...` (Go); `tsc --noEmit` (TypeScript); Playwright E2E  
**Target Platform**: Web (Chrome/Firefox/Safari), served by embedded Go binary  
**Project Type**: Web dashboard (read-only Kubernetes observability tool)  
**Performance Goals**: UI renders within 1 poll cycle (≤5s) of deletion being issued; no additional API calls  
**Constraints**: Read-only (§III); no new npm deps (§V); no CSS frameworks; all colors via tokens.css; no raw hex/rgba in component CSS  
**Scale/Scope**: Works at 500+ instances table, 5,000+ RGDs home page (virtualization already in place)  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Rule | Status |
|------|------|--------|
| **§III Read-Only** | No mutating k8s calls | PASS — frontend-only, reads only; no delete/patch/update |
| **§II Cluster Adaptability** | No hardcoded field paths outside `internal/k8s/` | PASS — all field reads use runtime unstructured helpers (`getNestedString`) in TS `lib/` |
| **§V Simplicity** | No new npm or Go deps | PASS — all features use existing React hooks + fetch |
| **§IX Theme** | No hardcoded hex/rgba | PASS — will use `--color-error` and any new named tokens only |
| **§IX Shared helpers** | Shared utils in `@/lib/`, not duplicated | PASS — will add `web/src/lib/k8s.ts` with `isTerminating`, `getFinalizers`, `isDeletionEvent` |
| **§XI Performance** | No new backend calls per-request | PASS — no new API endpoints; relies on already-polled data |
| **§XII Graceful Degradation** | Absent `deletionTimestamp` renders as healthy, not error | PASS — all fields optional; absent = no indicator |
| **§XIII UX Standards** | Page titles updated, fully-clickable cards, empty states | PASS — Terminating filter empty state handled; no new card patterns |

**No violations.** No Complexity Tracking required.

---

## Project Structure

### Documentation (this feature)

```text
specs/031-deletion-debugger/
├── plan.md              # This file
├── spec.md              # Feature requirements
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (frontend-only; no new API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code Changes (all frontend, no Go changes)

```text
web/src/
├── lib/
│   └── k8s.ts            # NEW: isTerminating(), getFinalizers(), getDeletionTimestamp(),
│                         #       isDeletionEvent()
├── components/
│   ├── FinalizersPanel.tsx       # NEW: collapsible finalizers list (used by instance + node panel)
│   ├── TerminatingBanner.tsx     # NEW: rose banner with relative time + ISO hover
│   ├── InstanceDetail.tsx        # MODIFIED: add TerminatingBanner, FinalizersPanel
│   ├── LiveNodeDetailPanel.tsx   # MODIFIED: FR-003/FR-006 — Terminating row + Finalizers
│   ├── EventsPanel.tsx           # MODIFIED: FR-004 — deletion event tagging
│   └── DeepDAG/                  # MODIFIED: FR-003 — ⊗ overlay badge on terminating nodes
│       └── (relevant sub-file)
├── pages/
│   ├── InstanceList.tsx          # MODIFIED: FR-005 — "Terminating only" toggle
│   └── Home.tsx                  # MODIFIED: FR-007 — ⊗ badge on home cards
└── tokens.css                    # MODIFIED if needed: add --color-terminating alias (optional)
```

**Structure Decision**: Single project (web-only changes within existing layout). All new
shared utilities go into `web/src/lib/k8s.ts`. All new components go into `web/src/components/`.
No new pages. No backend changes.
