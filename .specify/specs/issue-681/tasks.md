# Tasks: issue-681 — DAG keyboard navigation (Arrow keys)

## Pre-implementation
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && GOPROXY=direct GONOSUMDB="*" go vet ./...` — expected: 0 exit (no errors)

## Implementation
- [AI] Add `onArrowKey?: (direction: 'prev' | 'next') => void` prop to `NodeGroup`; add `onKeyDown` handler for Arrow keys calling `onArrowKey`
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && grep -c "ArrowUp\|ArrowDown\|ArrowLeft\|ArrowRight" web/src/components/DAGGraph.tsx` — expected: 4 (one per key)
- [AI] In `DAGGraph`, compute sorted node list by (y ASC, x ASC); implement `handleArrowKey(nodeId, direction)` that finds the current node's index, computes next/prev, and calls `document.querySelector('[data-testid="dag-node-<id>"]')?.focus()`
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && npx tsc -p web/tsconfig.json --noEmit 2>&1 | tail -5` — expected: no errors
- [AI] Write unit test for Arrow key navigation in `DAGGraph.test.tsx` (or add to existing test file)
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && npx vitest run web/src/components/DAGGraph.test.tsx 2>&1 | tail -10` — expected: all pass

## Post-implementation
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1 2>&1 | tail -5` — expected: ok
- [CMD] `cd /home/runner/work/kro-ui.issue-681 && npx tsc -p web/tsconfig.json --noEmit 2>&1 | tail -3` — expected: no errors
