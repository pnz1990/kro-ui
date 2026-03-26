# 003 — Fleet Multi-Cluster Timeout Budget

**Status**: Accepted  
**Deciders**: @pnz1990  
**Date**: 2025-03  
**Refs**: `internal/api/handlers/fleet.go`, `AGENTS.md` §Performance budget

---

## Problem statement

The Fleet page (`/fleet`) summarises all kubeconfig contexts in a single view.
For each context the backend must: (1) switch to the context, (2) list RGDs,
(3) count instances, (4) optionally scrape controller metrics. If any one
cluster is slow or unreachable, a naive sequential or unbounded-parallel
approach blocks the entire response for minutes.

---

## Proposal / overview

Use `golang.org/x/sync/errgroup` with a derived context that carries a 2-second
per-cluster deadline. Each cluster probe runs in its own goroutine. Errors are
captured into a `ClusterSummary.Error` field (graceful degradation) rather than
aborting the entire fan-out.

---

## Design details

- `FleetSummaryHandler` creates one goroutine per context using `errgroup.Go`.
- The shared `errgroup` context has a 5-second overall deadline to bound
  worst-case response time.
- Each goroutine has an inner 2-second `context.WithTimeout` for its own
  cluster operations.
- A timed-out or errored cluster produces a `ClusterSummary` with
  `health: "unreachable"` and a human-readable `error` string.
- The frontend renders this as a degraded row rather than an error page
  (graceful degradation — constitution §XII).
- Controller metrics scraping uses the same per-cluster timeout; absent metrics
  return `null` fields (rendered as "Not reported").

---

## Alternatives considered

| Alternative | Reason rejected |
|---|---|
| Sequential cluster probing | Latency = sum of all clusters; unacceptable at fleet scale |
| Unbounded parallel, no timeout | One hung cluster blocks the response indefinitely |
| Client-side parallel fetches | Requires CORS + auth forwarding; leaks cluster credentials to browser |
| Server-sent events / streaming | Premature; adds protocol complexity; HTTP/JSON polling suffices for 5s refresh |

---

## Testing strategy

- `TestFleetSummaryHandler_ContextTimeout` in `internal/api/handlers/fleet_test.go`
  injects a mock cluster that sleeps 3s and asserts the response arrives within
  2.5s with `health: "unreachable"`.
- E2E journey `013-multi-cluster-overview.spec.ts` asserts the Fleet page renders
  within 5s with the kind cluster as the sole context.
