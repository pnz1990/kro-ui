# Spec: 466 — k8s/rbac.go uncovered functions

## Design reference
- N/A — infrastructure change with no user-visible behavior

## Zone 1 — Obligations

- O1: `internal/k8s` package statement coverage ≥ 70%
- O2: `ResolveKroClusterRole` covered with ≥4 test cases (found, not found, non-ClusterRole roleRef, namespace mismatch, list error)
- O3: `splitAPIVersion` covered for group/version, core resource, custom group, empty string
- O4: `ComputeAccessResult` short-circuit (empty saNS) covered
- O5: `ComputeAccessResult` full permission matrix (SA resolved, resources present) covered
- O6: `fetchRoleRules` covered for found and not-found cases
- O7: No real k8s cluster required to run tests
- O8: All existing tests continue to pass

## Zone 2 — Implementer's judgment

- `extractRGDGVRs` tested indirectly through `ComputeAccessResult` (no direct test needed)
- Tests use existing `newStubDynamic`/`stubK8sClients`/`newStubDiscovery` infrastructure

## Zone 3 — Scoped out

- `FetchEffectiveRules` aggregated ClusterRole paths: already tested in existing tests
