# Spec: pickPod and pickPodFromClusterList coverage (84.6% → 100%)

## Design reference
- N/A — infrastructure change with no user-visible behavior

## Zone 1 — Obligations

O1. `pickPod` coverage is 100% after this change.
    Violation: `go test -coverprofile=... ./internal/k8s/...` shows `pickPod` < 100%.

O2. `pickPodFromClusterList` coverage is 100% after this change.
    Violation: `go test -coverprofile=... ./internal/k8s/...` shows `pickPodFromClusterList` < 100%.

O3. Dead code (`if ns == ""` NestedString fallback) is removed from `pickPodFromClusterList`.
    Rationale: `GetNamespace()` = `NestedString(Object, "metadata", "namespace")` — both
    read from the same field. The fallback can never return a different value.
    Violation: The `if ns == ""` NestedString branches still exist after the change.

O4. `TestPickPod` is added with a direct call with empty slice returning `(PodRef{}, false)`.
    Violation: No test exercises the `len(items) == 0` guard in `pickPod` directly.

O5. All existing tests continue to pass.
    Violation: Any test regression.

## Zone 2 — Implementer's judgment

- The test can be added to the existing `TestDiscoverKroPod` table or as a standalone `TestPickPod`.
  A standalone `TestPickPod` is preferred — it directly documents the function contract.

## Zone 3 — Scoped out

- No changes to `discoverKroPod`, `discoverWithSelector`, `scrapeViaProxy`, or any other function.
- No changes to `metrics.go` beyond removing the two dead `if ns == ""` branches in `pickPodFromClusterList`.
