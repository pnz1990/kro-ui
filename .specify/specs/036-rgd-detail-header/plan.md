# Implementation Plan: RGD Detail Header — Kind Label + Status Badge

**Branch**: `036-rgd-detail-header` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `.specify/specs/036-rgd-detail-header/spec.md`  
**GitHub Issue**: #130

---

## Summary

The RGD detail page (`/rgds/:name`) currently renders only the RGD name in its
header `<h1>`. The home page card (`RGDCard`) shows the same name alongside a
Kind badge (muted blue pill) and a `StatusDot` (green/red/gray circle). This
feature adds those two missing elements to the detail header using the exact
same extraction functions and components already used by `RGDCard` — no new
API calls, no new extraction logic, and no new components.

The change is a minimal, targeted CSS + JSX edit to `RGDDetail.tsx` and
`RGDDetail.css`.

---

## Technical Context

**Language/Version**: TypeScript 5.x + React 19 (frontend only; no backend changes)  
**Primary Dependencies**: React Router v7, existing `@/lib/format` utilities, existing `StatusDot` component  
**Storage**: N/A  
**Testing**: `bun run typecheck` (TypeScript), manual visual verification  
**Target Platform**: Browser (SPA embedded in Go binary)  
**Project Type**: Web application — frontend-only change  
**Performance Goals**: Zero additional API calls; header renders immediately from already-fetched RGD data  
**Constraints**: All colors must use `tokens.css` custom properties; no hardcoded hex/rgba; no new npm deps  
**Scale/Scope**: Single component edit — 2 files touched (`RGDDetail.tsx`, `RGDDetail.css`)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| § I Iterative-First | ✅ PASS | Single self-contained change; all dependencies already merged |
| § II Cluster Adaptability | ✅ PASS | Uses `extractRGDKind` / `extractReadyStatus` from `format.ts` — the only place that knows kro field paths |
| § III Read-Only | ✅ PASS | No mutation; no API change |
| § IV Single Binary | ✅ PASS | Frontend-only change; still embedded via `go:embed` |
| § V Simplicity — no new deps | ✅ PASS | Reuses `StatusDot` + extraction functions already present |
| § V Simplicity — no CSS frameworks | ✅ PASS | Plain CSS, tokens.css only |
| § VI Go Standards | ✅ PASS (N/A) | No Go changes |
| § IX No hardcoded colors | ✅ PASS | Will use `--color-primary-muted`, `--color-primary-text` tokens (same as `.rgd-card__kind`) |
| § IX Shared helpers | ✅ PASS | `extractRGDKind`, `extractReadyStatus`, `StatusDot` imported — not duplicated |
| § XII Graceful Degradation | ✅ PASS | Kind omitted when empty; StatusDot shows `unknown` when conditions absent |
| § XIII Page titles | ✅ PASS | `document.title` remains `<rgdName> — kro-ui` |
| § XIII No hardcoded config | ✅ PASS | No config values in this change |

**Post-design re-check**: No violations anticipated; feature is a subset of existing patterns.

---

## Project Structure

### Documentation (this feature)

```text
.specify/specs/036-rgd-detail-header/
├── plan.md              ← this file
├── spec.md              ← feature requirements
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
web/src/pages/
├── RGDDetail.tsx        ← add StatusDot + Kind badge to header (lines 198–201)
└── RGDDetail.css        ← add .rgd-detail-header-row, .rgd-detail-kind styles

# No new files. No backend changes.
```

**Structure Decision**: Single project, frontend-only. All logic lives in the
existing `web/src/pages/RGDDetail.tsx` and its companion CSS file. The change
is localized to the `{/* Header */}` block at line 198.

---

## Complexity Tracking

> No constitution violations — section left blank per template instructions.
