# Tasks: issue-663 — E2E Scale Fixture (27.18)

## Pre-implementation

- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-663 && GOPROXY=direct GONOSUMDB="*" go build ./...` — expected: 0 exit (ignore embed warning)

## Implementation

- [AI] Write `test/e2e/fixtures/scale-test-rgds.yaml` — `scale-wide` RGD with 20 ConfigMap resource nodes
- [AI] Write `test/e2e/fixtures/scale-test-instances.yaml` — one `ScaleWideApp` CR instance
- [AI] Update `test/e2e/fixture-state.ts` — add `scaleReady: boolean` to `FixtureState` interface and `DEFAULTS`
- [AI] Update `test/e2e/setup/global-setup.ts` — add `scaleReady` to `fixtureState` object and `6m` parallel fixture block
- [AI] Write `test/e2e/journeys/083-scale-fixture.spec.ts` — Overview TTI + DAG render smoke test
- [AI] Update `test/e2e/playwright.config.ts` — add `083` to chunk-9 `testMatch`
- [AI] Update `docs/design/27-stage3-kro-tracking.md` — 27.18 🔲 → ✅ Present

## Post-implementation

- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-663/web && bun run typecheck` — expected: 0 exit
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-663 && GOPROXY=direct GONOSUMDB="*" go vet ./...` — expected: 0 exit
- [CMD] Verify brace depth = 0 in journey 083
