# Implementation Plan: Feature Flag System

**Branch**: `008-feature-flags` | **Date**: 2026-03-20 | **Spec**: `specs/008-feature-flags/spec.md`
**Input**: Feature specification from `/specs/008-feature-flags/spec.md`

## Summary

Add a three-layer feature flag system to kro-ui: (1) a Go backend capability
detection endpoint that introspects the connected cluster's kro installation
via the discovery API, (2) a frontend `useCapabilities()` hook that gates UI
features based on what the cluster actually supports, and (3) an experimental
mode (`?experimental=true`) for alpha/upcoming features. The capabilities
endpoint uses a 30-second in-memory cache and never hardcodes version strings —
all detection is done via CRD schema introspection and API discovery.

## Technical Context

**Language/Version**: Go 1.25.1 (backend) + TypeScript / React 19 (frontend)
**Primary Dependencies**: chi v5, zerolog, client-go dynamic+discovery (backend); React 19, Vite (frontend)
**Storage**: N/A (read-only cluster access, in-memory 30s cache only)
**Testing**: `go test -race` + testify (backend); Vitest (frontend); Playwright (E2E)
**Target Platform**: Linux/macOS server (single binary with embedded frontend)
**Project Type**: Web dashboard (Go backend + React SPA, `go:embed`)
**Performance Goals**: Capabilities endpoint responds within 2 seconds; 30-second cache avoids repeated API server round-trips
**Constraints**: Read-only cluster access (§III), no typed clients (§II), no CSS/state-mgmt frameworks (§V), `GOPROXY=direct` required
**Scale/Scope**: 1 new API endpoint, 4 new Go files (2 with tests), 3 new TS files, 1 new E2E journey, route registration update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Section | Gate | Status | Notes |
|---------|------|--------|-------|
| §I Iterative-First | Depends only on merged code | PASS | Depends on `001-server-core` (merged). All prior specs that this builds on are merged. |
| §II Cluster Adaptability | Dynamic client, discovery-based, no hardcoded field paths | PASS | Capabilities use discovery API + CRD OpenAPI schema introspection. kro field paths isolated to `internal/k8s/capabilities.go`. No version string parsing. |
| §III Read-Only | No mutating API calls | PASS | Only `get`, `list` verbs used. Discovery is read-only. |
| §IV Single Binary | Embedded frontend, no runtime fetching | PASS | No new external assets. |
| §V Simplicity | No prohibited deps | PASS | Standard library + existing deps only. In-memory cache via `sync.RWMutex` + `time.Time`. |
| §VI Go Code Standards | Apache header, error wrapping, zerolog, table-driven tests | PASS | All new Go files follow established patterns. |
| §VII Testing Standards | Same-package tests, testify, hand-written stubs, `-race` | PASS | Tests use existing `stubDiscovery` infrastructure. |
| §IX UI Standards | tokens.css only, no CSS frameworks | PASS | Experimental badge uses `tokens.css` custom properties. |

**Fork guard**: `specPatch` and `stateFields` MUST NOT appear in capabilities. Hardcoded exclusion in `capabilities.go` with test assertion.

## Project Structure

### Documentation (this feature)

```text
specs/008-feature-flags/
├── plan.md              # This file
├── research.md          # Phase 0: kro discovery patterns, CRD schema introspection
├── data-model.md        # Phase 1: KroCapabilities type, cache structure
├── quickstart.md        # Phase 1: integration guide for other specs
├── contracts/           # Phase 1: API contract for capabilities endpoint
│   └── capabilities-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Backend (Go) — new files for this spec
internal/
  k8s/
    capabilities.go          # Capability detection: CRD introspection, feature gate detection
    capabilities_test.go     # Table-driven tests with stubbed discovery
  api/
    handlers/
      capabilities.go        # GetCapabilities HTTP handler + 30s cache
      capabilities_test.go   # Handler tests with stub factory
    types/
      response.go            # Add CapabilitiesResponse type (extend existing file)
  server/
    server.go                # Add GET /api/v1/kro/capabilities route (extend existing file)

# Frontend (TypeScript) — new files for this spec
web/src/
  lib/
    features.ts              # KroCapabilities type, conservative baseline, experimental mode
    api.ts                   # Add getCapabilities() export (extend existing file)
  hooks/
    useCapabilities.ts       # useCapabilities() hook with 30s stale-while-revalidate

# E2E — new journey
test/e2e/
  journeys/
    008-feature-flags.spec.ts  # Capabilities endpoint + frontend gating E2E
```

**Structure Decision**: Follows the established kro-ui repo layout. Backend
detection logic lives in `internal/k8s/` (the only place that knows kro field
paths per §II). The handler is a thin HTTP layer in `internal/api/handlers/`.
Frontend uses the existing hook pattern from `usePolling.ts` adapted for
stale-while-revalidate semantics.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
