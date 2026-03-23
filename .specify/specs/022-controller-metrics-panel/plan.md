# Implementation Plan: Controller Metrics Panel

**Branch**: `022-controller-metrics-panel` | **Date**: 2026-03-22 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/022-controller-metrics-panel/spec.md`

## Summary

Replace the existing `GET /api/v1/kro/metrics` 501 stub with a real implementation that scrapes kro's Prometheus text endpoint and returns four operational counters as JSON (`watchCount`, `gvrCount`, `queueDepth`, `workqueueDepth`). Absent metrics return `null` rather than `0`. On the frontend, add a `MetricsStrip` component to the Home page that polls the endpoint every 30 seconds and degrades gracefully when the metrics source is unreachable.

## Technical Context

**Language/Version**: Go 1.25 (backend), TypeScript 5.x / React 19 (frontend)  
**Primary Dependencies**: `github.com/go-chi/chi/v5`, `github.com/rs/zerolog`, `github.com/spf13/cobra` (backend); React Router v7, Vite (frontend) — **no new dependencies added**  
**Storage**: N/A — stateless scrape, no persistence  
**Testing**: `go test -race` + `testify/assert`/`require` (backend); Vitest (frontend)  
**Target Platform**: Linux server (binary), any modern browser (frontend)  
**Project Type**: Web service + embedded SPA  
**Performance Goals**: `GET /api/v1/kro/metrics` responds within 5s under all conditions (4s upstream timeout + 1s margin)  
**Constraints**: No new Go module dependencies; no hardcoded service addresses; all colors via `tokens.css` custom properties  
**Scale/Scope**: Single endpoint, single strip component; no pagination or aggregation

## Constitution Check

*GATE: Must pass before implementation. Re-checked after design.*

| Rule | Check | Status |
|---|---|---|
| §I Iterative-First | This spec replaces an existing 501 stub — no unmerged dependencies | PASS |
| §II Cluster Adaptability | No new Kubernetes API calls; metrics scrape is an HTTP call to kro's own endpoint | PASS |
| §III Read-Only | `GET` only; no mutating Kubernetes verbs | PASS |
| §IV Single Binary | No new runtime assets; embedded frontend unchanged | PASS |
| §V Simplicity | No new Go or npm dependencies; stdlib HTTP + line-by-line Prometheus text parser | PASS |
| §VI Go Standards | Copyright headers, `fmt.Errorf` wrapping, zerolog, table-driven tests, no `util.go` | PASS |
| §VII Testing | `internal/k8s/metrics_test.go` + `internal/api/handlers/metrics_test.go` + `MetricsStrip.test.tsx` | PASS |
| §IX Theme/UI | All colors via `var(--token-*)` in `MetricsStrip.css`; no hardcoded hex/rgba | PASS |
| §XI Performance Budget | 4s upstream timeout enforced; handler respects 5s budget | PASS |
| §XII Graceful Degradation | `null` for absent metrics (not `0`); strip degrades independently of RGD grid | PASS |
| §XIII UX Standards | Home page `document.title` unchanged (already set); no new routes needed | PASS |

**No constitution violations. No Complexity Tracking entry required.**

## Project Structure

### Documentation (this feature)

```text
specs/022-controller-metrics-panel/
├── plan.md              # This file
├── research.md          # Phase 0 — metric names, parsing strategy, config
├── data-model.md        # Phase 1 — Go structs, TS interfaces, component model
├── contracts/
│   └── metrics-api.md   # GET /api/v1/kro/metrics contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code — files touched by this feature

```text
internal/
  cmd/
    root.go                          # +--metrics-url flag, pass to server.Config
  server/
    server.go                        # +MetricsURL in Config, pass to handlers.New
  api/
    handlers/
      handler.go                     # +metricsURL field on Handler, update New()
      metrics.go                     # NEW — GetMetrics handler (real impl)
      metrics_test.go                # NEW — handler unit tests with stub scraper
      instances.go                   # MODIFY — remove stub GetMetrics + its test
      instances_test.go              # MODIFY — remove TestGetMetrics stub test
    types/
      response.go                    # +ControllerMetricsResponse
  k8s/
    metrics.go                       # NEW — ControllerMetrics struct, ScrapeMetrics()
    metrics_test.go                  # NEW — parser unit tests (golden Prometheus text)

web/src/
  lib/
    api.ts                           # +ControllerMetrics interface, getControllerMetrics()
  components/
    MetricsStrip.tsx                 # NEW — strip component (4 counters, 4 render states)
    MetricsStrip.css                 # NEW — layout, token-only colors
    MetricsStrip.test.tsx            # NEW — unit tests all 4 render states
  pages/
    Home.tsx                         # MODIFY — render <MetricsStrip /> above RGD grid
```

**Structure Decision**: Single project layout following existing kro-ui conventions. Backend additions mirror `internal/k8s/rgd.go` (domain logic) + `internal/api/handlers/rgds.go` (thin handler) pattern.
