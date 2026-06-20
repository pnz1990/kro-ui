# Tasks: issue-744 — E2E journey for CEL expression linter

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-744 && cd test/e2e && npx tsc --noEmit 2>&1 | tail -5` — expected: 0 errors

## Implementation
- [AI] Write `test/e2e/journeys/091-designer-cel-linter.spec.ts` with steps 1-6 per spec.md
- [AI] Register prefix `091` in `test/e2e/playwright.config.ts` chunk-9 testMatch pattern
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-744 && cd test/e2e && npx tsc --noEmit 2>&1 | tail -5` — expected: 0 errors
- [CMD] `grep -n "091" /home/runner/work/kro-ui/kro-ui.issue-744/test/e2e/playwright.config.ts` — expected: line showing 091 in chunk testMatch

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-744 && go vet ./... 2>&1 | tail -5` — expected: no output (pass)
- [CMD] `cd /home/runner/work/kro-ui/kro-ui.issue-744 && cd web && npx tsc --noEmit 2>&1 | tail -5` — expected: 0 errors
