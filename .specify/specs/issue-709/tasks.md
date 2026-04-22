# Tasks: issue-709 — Light-mode persona anchor journey (journey 088)

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-709 && GOPROXY=direct GONOSUMDB="*" go build ./... 2>&1 | tail -3` — expected: 0 exit (no output)
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-709 && cd web && bun run typecheck 2>&1 | tail -5` — expected: 0 exit

## Implementation
- [AI] Write `test/e2e/journeys/088-light-mode-persona.spec.ts` — light mode anchor journey covering Overview → RGD detail → Instance detail with all Zone 1 obligations
- [CMD] `ls test/e2e/journeys/088-light-mode-persona.spec.ts` — expected: file exists
- [AI] Add `088` to the `testMatch` pattern in `chunk-9` in `test/e2e/playwright.config.ts`
- [CMD] `grep '088' test/e2e/playwright.config.ts` — expected: line containing 088 in chunk-9
- [AI] Update `docs/design/26-anchor-kro-ui.md` — move 26.7 from 🔲 to ✅

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-709 && cd web && bun run typecheck 2>&1 | tail -5` — expected: 0 exit
- [CMD] `cd /home/runner/work/kro-ui/kro-ui/../kro-ui.issue-709 && GOPROXY=direct GONOSUMDB="*" go vet ./... 2>&1 | tail -3` — expected: 0 exit
