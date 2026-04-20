# Spec: 465 — server NewRouter test coverage

## Design reference
- N/A — infrastructure change with no user-visible behavior

## Zone 1 — Obligations

- O1: `internal/server` package statement coverage ≥ 65%
- O2: Tests use table-driven `build`/`check` pattern per constitution
- O3: No real k8s cluster required to run tests
- O4: `TestVersionEndpoint` covers GET /api/v1/version returning valid JSON with version/commit/buildDate fields
- O5: `TestAPIRoutesRegisteredWithFactory` covers the `factory != nil` branch of `NewRouter`
- O6: All existing tests continue to pass

## Zone 2 — Implementer's judgment

- Helper functions (`newTestRouter`, `newTestRouterWithFactory`, `writeTestKubeconfig`) extracted for reuse
- CORS and SPA fallback tests added as bonuses

## Zone 3 — Scoped out

- `Run` function: requires a live listening server — not unit-testable
- `factory != nil` error paths: require mock k8s API server
