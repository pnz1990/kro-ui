# Spec: test(handlers): InvalidateCapabilitiesCache, GetCapabilities, GraphRevision coverage

## Zone 1 — Obligations

- O1: `InvalidateCapabilitiesCache()` must be tested — call it after populating the cache and verify cache is nil afterward.
- O2: `ListGraphRevisions` unexpected server error (non-CRD-absent) must return 500 with "failed to list graph revisions" message.
- O3: `GetGraphRevision` unexpected server error (non-CRD-absent, non-not-found) must return 500 with "failed to get graph revision" message.
- O4: `isCRDNotFound(nil)` must return false.
- O5: `isNotFound(nil)` must return false.
- O6: All targeted functions must reach 100% statement coverage.

## Zone 2 — Implementer's judgment

- Use existing stub infrastructure (stubDynamic, stubNamespaceableResource, newGRTestHandler).
- Keep test cases focused and minimal — no duplicate scenarios from existing tests.

## Zone 3 — Scoped out

- GetCapabilities is left at 75% — the remaining 25% requires controlling the output of DetectCapabilities (a package-level function not suitable for direct stubbing without major refactoring).
- kroVersionFromInstances is left at 89.3% — already covered well by TestKroVersionFallbackFromInstances.

## Design reference

N/A — infrastructure change with no user-visible behavior.
