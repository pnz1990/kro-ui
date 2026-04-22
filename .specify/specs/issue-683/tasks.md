# Tasks: issue-683 — Designer axe-core Coverage

## Pre-implementation

- [CMD] `cd ../kro-ui.issue-683 && GOPROXY=direct GONOSUMDB="*" go build ./...` — expected: 0 exit

## Implementation

- [AI] Update journey 074 Step 7: change from `logViolations` (non-blocking) to `assertNoViolations` (blocking) for the Designer page; add explicit check that the tab bar is accessible.
- [AI] Update design doc `docs/design/31-rgd-designer.md`: move axe-core coverage from 🔲 Future to ✅ Present.

## Post-implementation

- [CMD] `cd ../kro-ui.issue-683/web && bun run typecheck` — expected: 0 exit
- [CMD] Verify brace depth = 0 in journey 074
