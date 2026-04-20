# Spec: test(k8s): metrics.go parseMetricLine, pickPodFromClusterList, error types

## Zone 1 — Obligations

- O1: `parseMetricLine` must reach 100% statement coverage (from 78.9%).
- O2: `pickPodFromClusterList` must reach ≥80% coverage (from 53.8%).
- O3: All 4 error type methods (ErrMetricsUnreachable.Error, ErrMetricsUnreachable.Unwrap, ErrMetricsBadGateway.Error, ErrMetricsTimeout.Error) must reach 100%.
- O4: All new tests must pass.

## Zone 2 — Implementer's judgment

- Use existing stub infrastructure (stubDynamicForMetrics, makePod).
- Keep test cases focused on the specific uncovered lines.

## Zone 3 — Scoped out

- NewMetricsDiscoverer, ScrapeMetrics, scrapeWithCache remain at 0% — they require a real ClientFactory with kubeconfig file and are integration-level concerns not suitable for unit tests.
- pickPod and scrapeViaProxy remaining gaps are left at current levels.

## Design reference

N/A — infrastructure change with no user-visible behavior.
