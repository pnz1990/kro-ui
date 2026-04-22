# Tasks: issue-664 — E2E slow-API / fetch-timeout scenario (27.19)

## Pre-implementation

- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-664 && GOPROXY=direct GONOSUMDB="*" go build ./...` — expected: 0 exit (ignore embed warning)

## Implementation

- [AI] Write `test/e2e/journeys/084-fetch-timeout.spec.ts` with 4 steps:
  - Step 1: server health check
  - Step 2: slow route (1s delay) — loading indicator visible
  - Step 3: abort route — error state shows non-empty message
  - Step 4: retry button triggers new fetch
- [AI] Update `test/e2e/playwright.config.ts` — add `084` to chunk-9 testMatch
- [AI] Update `docs/design/27-stage3-kro-tracking.md` — 27.19 🔲 → ✅ Present

## Post-implementation

- [CMD] Verify brace depth = 0 in journey 084
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-664 && GOPROXY=direct GONOSUMDB="*" go vet github.com/pnz1990/kro-ui/internal/... github.com/pnz1990/kro-ui/cmd/...` — expected: 0 exit
