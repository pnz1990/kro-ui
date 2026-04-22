# Tasks: issue-715 — Designer round-trip anchor journey (journey 090)

## Phase 1 — Spec review
- [x] [CMD] Read design doc `docs/design/26-anchor-kro-ui.md` for 26.9 requirements
- [x] [CMD] Read journey 073 (developer-persona) for Designer authoring patterns
- [x] [CMD] Read journey 082 (designer-cluster-import) for cluster import patterns

## Phase 2 — Implementation
- [x] [AI] Write `test/e2e/journeys/090-designer-roundtrip-persona.spec.ts` (6+ steps)
- [x] [AI] Add `090` to chunk-9 testMatch in `test/e2e/playwright.config.ts`
- [x] [AI] Update `docs/design/26-anchor-kro-ui.md` — mark 26.9 as ✅

## Phase 3 — Validation
- [ ] [CMD] Verify brace depth = 0
- [ ] [CMD] Verify no waitForTimeout or .or() in code
- [ ] [CMD] Verify 090 in chunk-9 testMatch
