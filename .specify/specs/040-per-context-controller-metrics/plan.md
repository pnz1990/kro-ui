# Implementation Plan: Per-Context Controller Metrics

**Branch**: `040-per-context-controller-metrics` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `.specify/specs/040-per-context-controller-metrics/spec.md`

## Summary

Replace the hardcoded `--metrics-url` CLI flag with per-context pod-proxy
discovery: find the kro controller pod via the Kubernetes dynamic client, then
proxy the `/metrics` scrape through the kube-apiserver's built-in pod proxy.
Add a `?context=` query param to support Fleet-page per-cluster metrics fan-out.
Remove the `--metrics-url` flag entirely.

## Technical Context

**Language/Version**: Go 1.25 (backend) + TypeScript 5.x / React 19 (frontend)  
**Primary Dependencies**: `k8s.io/client-go/dynamic` (pod discovery), `k8s.io/client-go/rest` (proxy HTTP client), `github.com/go-chi/chi/v5` (routing), `github.com/rs/zerolog` (logging), React 19 + React Router v7 + Vite  
**Storage**: N/A — in-process TTL cache (sync.RWMutex map, 60s TTL)  
**Testing**: `go test -race`, `github.com/stretchr/testify`, table-driven; `tsc --noEmit`  
**Target Platform**: Linux server (Docker/Helm) + local macOS dev  
**Project Type**: Web service (Go binary embedding React SPA)  
**Performance Goals**: `GET /api/v1/kro/metrics` ≤4.5s p99; pod discovery cache hit <1ms  
**Constraints**: 5s API response budget (Constitution §XI); no new npm/Go dependencies  
**Scale/Scope**: Single binary; fleet fan-out across N kubeconfig contexts (typically 1–20)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| §I Iterative-First: spec is independently shippable | PASS | All prior specs merged; this spec requires no unreleased code |
| §II Cluster Adaptability: dynamic client only | PASS | Pod discovery via `dynamic.Interface`; REST proxy via `rest.HTTPClientFor` — no typed `CoreV1()` client |
| §III Read-Only: no mutating verbs | PASS | Only `get`/`list` on pods; `get` on `pods/proxy`. No `create`/`patch`/`delete`. |
| §IV Single Binary: no external assets | PASS | No new assets; pod reference is in-process cache only |
| §V Simplicity: no new dependencies | PASS | Uses only `k8s.io/client-go/rest` (already a transitive dep) and `sync.RWMutex` from stdlib |
| §VI Go Standards: copyright, error wrapping, zerolog | PASS | All new files must include Apache 2.0 header; errors wrapped with context |
| §VII Testing: table-driven, testify, -race | PASS | New functions have table-driven unit tests; existing tests updated |
| §IX Theme: no hardcoded hex, tokens.css only | PASS | Fleet metrics column uses existing tokens; no new colors introduced |
| §XI API Performance Budget: ≤5s, discovery cached | PASS | Pod ref cache 60s TTL; proxy adds ≤200ms; cache invalidated on context switch |
| §XII Graceful Degradation | PASS | Pod not found → 200 OK with null fields; existing MetricsStrip degradation preserved |
| §XIII Frontend UX: no hardcoded config | PASS | No new hardcoded names; pod discovery is label-driven |

**Constitution violations**: None. No Complexity Tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/040-per-context-controller-metrics/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
internal/
  k8s/
    metrics.go           # MODIFIED: add PodRef, PodRefCache, discoverKroPod,
                         #   ScrapeViaProxy. Remove direct HTTP ScrapeMetrics.
    metrics_test.go      # NEW: table-driven tests for discoverKroPod + ScrapeViaProxy
  api/
    handlers/
      handler.go         # MODIFIED: remove metricsURL; add metricsDiscoverer interface field
      metrics.go         # MODIFIED: use metricsDiscoverer; add ?context= param
      metrics_test.go    # MODIFIED: update stubs; add ?context= test cases
      fleet.go           # MODIFIED: add per-cluster metrics fan-out
  cmd/
    root.go              # MODIFIED: remove --metrics-url flag
  server/
    server.go            # MODIFIED: remove MetricsURL from Config; update wiring

web/
  src/
    lib/
      api.ts             # MODIFIED: add getControllerMetricsForContext(context)
    pages/
      Fleet.tsx          # MODIFIED: metrics fan-out + Metrics column in matrix

helm/
  kro-ui/
    templates/
      clusterrole.yaml   # MODIFIED: add pods/proxy get rule
```

**Structure Decision**: Single project layout. Feature touches both backend and
frontend but stays within existing directory structure; no new packages required.
The only structural addition is `internal/k8s/metrics_test.go` (new test file for
the new k8s-layer functions).
