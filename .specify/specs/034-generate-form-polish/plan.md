# Implementation Plan: Generate Form Polish + DAG Legend + Overlay Fixes

**Branch**: `034-generate-form-polish` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/034-generate-form-polish/spec.md`
**Input**: Feature specification from `/specs/034-generate-form-polish/spec.md`

## Summary

Four fix areas, all frontend-only:
1. **Issue #121** — Generate tab `InstanceForm`: add visible required/optional legend,
   update `title` attrs on `●` indicators, add `aria-required` to form controls.
2. **Issue #121** — `RGDAuthoringForm`: rename `req` label to `Required`.
3. **Issue #118** — DAG: add `DAGLegend` component below the static chain DAG
   explaining `?` / `∀` / `⬡` badge symbols.
4. **Bugs** — Overlay crash ("t is not iterable") from `items: null` in children API
   response; expanded subgraph overlap fixed with accordion behavior.

No new backend endpoints. No new npm dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x + React 19
**Primary Dependencies**: React 19, React Router v7, Vite (all already present)
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: Vitest via `bun run --cwd web test`
**Target Platform**: Browser (Chrome, Firefox, Safari — WCAG AA)
**Project Type**: Web application (frontend only; no backend changes)
**Performance Goals**: No-op — attribute additions and legend rendering are trivial
**Constraints**: No new npm deps; no hex/rgba literals; TypeScript strict 0 errors
**Scale/Scope**: 4 existing files changed + 2 new files (DAGLegend.tsx/css)

## Constitution Check

| Rule | Status |
|------|--------|
| §III Read-Only — no mutating k8s calls | ✅ Pass — no k8s calls at all |
| §V Simplicity — no new dependencies | ✅ Pass — no new deps |
| §IX Theme — no hardcoded hex/rgba | ✅ Pass — all via token vars |
| §XII Graceful Degradation — null items handled | ✅ This spec directly fixes it |
| §XIII UX — WCAG AA accessibility | ✅ This spec adds `aria-required` and visible legend |
| §XIII UX — tooltips on complex elements | ✅ Legend + title attrs satisfy the requirement |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/034-generate-form-polish/
├── plan.md              # This file
├── spec.md              # Feature requirements (updated)
├── research.md          # Phase 0 output (updated)
├── data-model.md        # Phase 1 output (updated)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code Changed

```text
web/src/components/
├── InstanceForm.tsx          # Legend header, title attrs, aria-required
├── InstanceForm.css          # .instance-form__legend styles
├── RGDAuthoringForm.tsx      # "req" → "Required" label
├── DAGLegend.tsx             # NEW — badge legend component
├── DAGLegend.css             # NEW — legend styles
├── StaticChainDAG.tsx        # Accordion expand + DAGLegend at depth 0
└── GenerateTab.test.tsx      # Update assertions for aria-required

web/src/pages/
└── RGDDetail.tsx             # childrenRes.items ?? [] null-coerce
```
