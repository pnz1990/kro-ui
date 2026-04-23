# Tasks: issue-767

## Pre-implementation
- [CMD] `cd ../kro-ui.issue-767 && bun run typecheck 2>&1 | tail -5` — expected: 0 errors (baseline)
- [CMD] `cd ../kro-ui.issue-767 && go vet ./... 2>&1 | tail -3` — expected: no output

## Implementation
- [AI] Add `computeRevisionNodeDiff` pure function to `web/src/lib/format.ts` — O6
- [AI] Fetch revisions in RGDDetail when `hasRevisions=true` and `activeTab === "graph"` — O1
- [AI] Render `RevisionChangesBanner` in Graph tab content area — O1, O2, O3, O4
- [AI] Create `RevisionChangesBanner.tsx` + `RevisionChangesBanner.css` — O5
- [AI] Write unit tests for `computeRevisionNodeDiff` — O6
- [AI] Write component test for `RevisionChangesBanner` — O1, O2, O3

## Post-implementation
- [CMD] `cd ../kro-ui.issue-767 && bun run typecheck 2>&1 | tail -5` — expected: 0 errors
- [CMD] `cd ../kro-ui.issue-767 && GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1 2>&1 | tail -5` — expected: ok
- [CMD] `cd ../kro-ui.issue-767 && go vet ./... 2>&1` — expected: no output
