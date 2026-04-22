# Tasks: issue-714 — Multi-context persona anchor journey (journey 089)

## Phase 1 — Spec review
- [x] [CMD] Read design doc `docs/design/26-anchor-kro-ui.md` for 26.8 requirements
- [x] [CMD] Read journey 007 (context-switcher) for existing patterns
- [x] [CMD] Read journey 075 (fleet-persona) for fleet page patterns
- [x] [CMD] Read journey 087 (rbac-restricted-persona) for latest anchor journey pattern

## Phase 2 — Implementation
- [x] [AI] Write `test/e2e/journeys/089-multi-context-persona.spec.ts` (6+ steps)
- [x] [AI] Add `089` to chunk-9 testMatch in `test/e2e/playwright.config.ts`
- [x] [AI] Update `docs/design/26-anchor-kro-ui.md` — mark 26.8 as ✅

## Phase 3 — Validation
- [ ] [CMD] Run `go vet ./...`
- [ ] [CMD] Run `bun run typecheck` in `web/`
- [ ] [CMD] Verify chunk-9 testMatch includes `089`
