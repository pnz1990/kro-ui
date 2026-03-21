# Implementation Plan: Context Switcher

**Branch**: `007-context-switcher` | **Date**: 2026-03-20 | **Spec**: `specs/007-context-switcher/spec.md`
**Input**: Feature specification from `/specs/007-context-switcher/spec.md`

## Summary

Add runtime kubeconfig context switching to kro-ui. The Go backend already has a
`ClientFactory.SwitchContext` method (thread-safe, `sync.RWMutex`-protected) and
HTTP handlers (`GET /api/v1/contexts`, `POST /api/v1/contexts/switch`) fully
implemented and tested. The remaining work is entirely frontend: build the
`ContextSwitcher` dropdown component, integrate it into the `TopBar`/`Layout`,
handle loading/error states, truncate long context names, and wire the switch
callback to refetch the RGD list.

## Technical Context

**Language/Version**: Go 1.25.1 (backend, fully implemented) + TypeScript 5.7 / React 19 (frontend, remaining work)
**Primary Dependencies**: chi v5, zerolog, client-go v0.35.3 (backend); React 19, React Router v7, Vite 8, Vitest 4 (frontend)
**Storage**: N/A (reads kubeconfig file only)
**Testing**: `go test -race` + testify (backend, done); Vitest + @testing-library/react (frontend, to write)
**Target Platform**: Single binary serving embedded SPA, port 40107
**Project Type**: Web dashboard (Go backend + React SPA)
**Performance Goals**: Context switch completes in <3s for reachable clusters (NFR-001)
**Constraints**: No CSS frameworks, no state management libs, no external highlighters (Constitution §V). Read-only cluster access (§III). Strict TypeScript — no `any`, no `@ts-ignore` (NFR-002).
**Scale/Scope**: 1 new component (`ContextSwitcher`), 1 updated component (`TopBar`), 1 updated component (`Layout`), 1 new CSS file, ~5 frontend unit tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| §I | Iterative-first | PASS | Spec 007 depends on 002 (merged). All prior specs shipped. |
| §II | Cluster adaptability — dynamic client | PASS | Backend uses `k8s.io/client-go/dynamic` exclusively. No typed clients. |
| §II | Discovery-based pluralization | PASS | No new resource access added. Existing discovery intact. |
| §II | Upstream-only features | PASS | Context switching is a kubeconfig feature, not kro-specific. |
| §III | Read-only | PASS | `SwitchContext` only rebuilds clients from kubeconfig. No cluster mutations. |
| §IV | Single binary | PASS | Frontend embedded via `go:embed`. No new external assets. |
| §V | No CSS frameworks | PASS | Will use plain CSS with `tokens.css` custom properties. |
| §V | No state management libs | PASS | React state + hooks only. |
| §V | No component libraries | PASS | Custom dropdown built from scratch. |
| §VI | Error wrapping | PASS | Backend errors use `fmt.Errorf("...: %w", err)`. |
| §VI | Logging via zerolog | PASS | Context switch logs via `zerolog.Ctx(ctx)`. |
| §VI | Copyright headers | PASS | All Go files have Apache 2.0 header. N/A for TSX. |
| §VI | Interface at consumption site | PASS | `contextManager` defined in `handlers/contexts.go`. |
| §VII | Table-driven build/check tests | PASS | Backend tests follow pattern. Frontend tests use Vitest describe/it. |
| §VII | No snapshot tests | PASS | Will use behavioral assertions only. |
| §VIII | Conventional commits | PASS | Will follow `feat(web):` / `test(web):` format. |
| §IX | Color tokens only | PASS | CSS will reference `var(--token)` exclusively. |
| §IX | Dark mode default | PASS | Dropdown uses surface/border tokens that auto-adapt. |
| §X | Apache 2.0 | PASS | License present. Go files have headers. |

**Gate result**: ALL PASS. No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-context-switcher/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # HTTP API contract (already implemented)
└── tasks.md             # Already exists
```

### Source Code (repository root)

```text
# Backend (Go) — ALREADY IMPLEMENTED, NO CHANGES NEEDED
internal/
  k8s/
    client.go            # ClientFactory: SwitchContext, ListContexts, ActiveContext
    client_test.go       # Table-driven tests: unknown ctx, valid switch, concurrent race
  api/
    handlers/
      handler.go         # Handler struct, respond(), respondError()
      contexts.go        # ListContexts, SwitchContext HTTP handlers
      contexts_test.go   # Handler tests: 200, 400 empty, 400 unknown, 400 invalid JSON
    types/
      response.go        # ContextsResponse, SwitchContextRequest, SwitchContextResponse
  server/
    server.go            # Routes: GET /contexts, POST /contexts/switch

# Frontend (TypeScript/React) — REMAINING WORK
web/src/
  lib/
    api.ts               # listContexts(), switchContext() — ALREADY IMPLEMENTED
  components/
    ContextSwitcher.tsx   # NEW: dropdown component (currently stub)
    ContextSwitcher.css   # NEW: dropdown styles using tokens.css
    ContextSwitcher.test.tsx  # NEW: unit tests
    TopBar.tsx            # UPDATE: integrate ContextSwitcher, change props
    TopBar.css            # UPDATE: add context-switcher positioning
    TopBar.test.tsx       # UPDATE: adjust for new props/behavior
    Layout.tsx            # UPDATE: pass contexts + onSwitch callback
    Layout.test.tsx       # UPDATE: test context switch flow

# E2E
test/e2e/journeys/
  007-context-switcher.spec.ts  # NEW: Playwright journey
```

**Structure Decision**: Existing repository layout. Backend complete, frontend
uses the established component structure in `web/src/components/`. No new
directories needed.

## Complexity Tracking

No constitution violations to justify. All work fits within existing patterns.
