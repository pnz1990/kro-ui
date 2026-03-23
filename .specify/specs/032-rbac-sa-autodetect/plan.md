# Implementation Plan: RBAC Service Account Auto-Detection

**Branch**: `032-rbac-sa-autodetect` | **Date**: 2026-03-23 | **Spec**: `.specify/specs/032-rbac-sa-autodetect/spec.md`
**Input**: Feature specification from `/specs/032-rbac-sa-autodetect/spec.md`
**Fixes**: GitHub issues #115, #133

## Summary

Remove the hardcoded `("kro-system", "kro")` fallback from `ResolveKroServiceAccount`,
surface detection failure to the frontend as an empty SA + `serviceAccountFound=false`,
add a manual SA override (query-param-driven re-fetch), and update the Access tab
SA banner to display namespace and name as separately labeled elements.

## Technical Context

**Language/Version**: Go 1.25 backend / TypeScript 5.x + React 19 + Vite (all already present)
**Primary Dependencies**: `k8s.io/client-go/dynamic`, `github.com/go-chi/chi/v5`, React 19, React Router v7 — all already in use; no new dependencies
**Storage**: N/A — all state is local React `useState`; no persistence
**Testing**: `go test -race ./...` + `tsc --noEmit` + Vitest (already configured)
**Target Platform**: Kubernetes cluster + web browser
**Project Type**: Full-stack web observability tool (single-binary Go + embedded React)
**Performance Goals**: Access tab loads within 2s (existing NFR-001 from spec 018)
**Constraints**: No hardcoded SA names, namespaces, or SA name guesses (constitution §XIII); read-only Kubernetes access (constitution §III)
**Scale/Scope**: Small, targeted bug fix + UX enhancement; touches 4 files (2 Go, 2 TypeScript)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §I Iterative-First | PASS | Spec `018-rbac-visualizer` is merged; this fixes a bug in that spec |
| §II Cluster Adaptability | PASS | No typed clients; dynamic client used throughout; no kro field paths outside `rgd.go` |
| §III Read-Only | PASS | No mutating API calls; only `get`/`list` verbs used |
| §IV Single Binary | PASS | No new assets; no CDN; no separate server |
| §V Simplicity | PASS | No new dependencies; no ORMs/GraphQL/SSE; no state libraries |
| §VI Go Code Standards | PASS | Copyright headers present; error wrapping used; zerolog logging; no `util.go` |
| §VII Testing Standards | PASS | Table-driven tests; `testify/assert+require`; `-race` flag |
| §VIII Commit Conventions | PASS | Will use `fix(k8s): ...` and `fix(web): ...` |
| §IX Theme | PASS | CSS tokens only; no hardcoded colors |
| §XI API Performance | PASS | No new discovery calls; no unbounded loops |
| §XII Graceful Degradation | PASS | Empty SA → manual form (not error crash); missing SA info → "not found" state |
| §XIII No Hardcoded Config | **MUST FIX** | Current `rbac.go:104` returns `("kro-system", "kro", false)` — this spec removes it |

**Gate result**: PASS with one remediation — the hardcoded fallback is the bug being fixed.

## Project Structure

### Documentation (this feature)

```text
specs/032-rbac-sa-autodetect/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── access-api.md    # Updated contract for GET /api/v1/rgds/{name}/access
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code Changes

```text
internal/k8s/
├── rbac.go              # CHANGE: Remove hardcoded fallback; return ("","",false)
└── rbac_test.go         # CHANGE: Add "no deployment found" test case

internal/api/handlers/
└── access.go            # CHANGE: Accept saNamespace+saName query params

web/src/components/
├── AccessTab.tsx         # CHANGE: Manual override form; labeled SA banner
├── AccessTab.css         # CHANGE: Styles for manual form (token-based)
└── AccessTab.test.tsx    # CHANGE: New test cases for manual form + banner format
```

**Structure Decision**: Single project, existing kro-ui layout. No new files needed
beyond tests and CSS; all changes are surgical modifications to the 4 files listed.

## Complexity Tracking

> No constitution violations in this feature — the feature *fixes* a violation.

No entries required.
