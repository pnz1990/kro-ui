# Tasks: issue-764

## Pre-implementation
- [CMD] `cd ../kro-ui.issue-764 && go vet ./...` — expected: PASSED (baseline)
- [CMD] `cd ../kro-ui.issue-764 && bun run typecheck` — expected: PASSED (baseline)

## Implementation
- [AI] Create `web/src/components/ReconciliationTimeline.tsx` (O1, O3, O4, O5)
- [AI] Create `web/src/components/ReconciliationTimeline.css` (O6)
- [AI] Add `ReconciliationTimeline` into `ConditionsPanel.tsx` below conditions list (O2)
- [AI] Create `web/src/components/ReconciliationTimeline.test.tsx` (O7)

## Post-implementation
- [CMD] `cd ../kro-ui.issue-764 && go vet ./...` — expected: PASSED
- [CMD] `cd ../kro-ui.issue-764 && bun run typecheck` — expected: PASSED
- [CMD] `cd ../kro-ui.issue-764 && bun test ReconciliationTimeline` — expected: PASSED
