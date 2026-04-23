# Tasks: issue-765

## Pre-implementation
- [CMD] `cd ../kro-ui.issue-765 && go vet ./... 2>&1 | tail -3` — expected: no new errors

## Implementation
- [AI] Add `RECONCILE_SLOW_FACTOR` constant and `isReconcilingSlow` utility to InstanceDetail.tsx — O1, O3
- [AI] Render "taking longer than usual" banner in InstanceDetail.tsx between existing reconciling banner and live DAG — O1, O2, O4
- [AI] Write unit tests for `isReconcilingSlow` logic — O5
- [CMD] Verify no hex/rgba in new banner CSS

## Post-implementation
- [CMD] `cd ../kro-ui.issue-765 && go vet ./... 2>&1 | tail -3` — expected: no new errors
