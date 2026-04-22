# Tasks: issue-684 — Designer Tab Focus Restoration

## Pre-implementation

- [CMD] `cd ../kro-ui.issue-684 && GOPROXY=direct GONOSUMDB="*" go build ./...` — expected: 0 exit
- [CMD] `cd ../kro-ui.issue-684 && cd web && bun run typecheck` — expected: 0 exit

## Implementation

- [AI] Add `DesignerTabBar` component + CSS: renders 4 tabs (Schema/Resources/YAML/Preview) with role=tablist, role=tab, aria-selected, keyboard navigation (left/right arrows).
- [CMD] `cd ../kro-ui.issue-684/web && ls src/components/DesignerTabBar*` — expected: .tsx and .css files
- [AI] Refactor `AuthorPage.tsx`: split RGDAuthoringForm into section-specific props OR render conditionally by tab; add `activeTab` state; add `selectedNodeId` state for DAG node selection.
- [AI] Add sessionStorage read/write helpers: `readTabState()` and `writeTabState()` in AuthorPage. Key: `kro-ui-designer-tab-state`. Validate on read (silently discard corrupt values).
- [AI] Wire sessionStorage: on mount read → set initial tab/selectedNodeId; on tab change → write; skip write when `readonly=true` (share URL mode).
- [CMD] `cd ../kro-ui.issue-684/web && bun run typecheck` — expected: 0 exit
- [AI] Add `DesignerTabBar.test.tsx` unit test: renders 4 tabs, keyboard navigation, aria attributes.
- [AI] Add/extend `AuthorPage.test.tsx`: tab restoration from sessionStorage mock, corrupt sessionStorage fallback to Schema, readonly mode skips write.
- [CMD] `cd ../kro-ui.issue-684/web && bun run test --run` — expected: all pass
- [AI] Extend E2E journey 073: add Step 6 (navigate to Resources tab), Step 7 (navigate away and back, verify Resources tab is still active).

## Post-implementation

- [CMD] `cd ../kro-ui.issue-684 && GOPROXY=direct GONOSUMDB="*" go build ./...` — expected: 0 exit
- [CMD] `cd ../kro-ui.issue-684 && go vet ./...` — expected: 0 exit
- [CMD] `cd ../kro-ui.issue-684/web && bun run typecheck` — expected: 0 exit
- [CMD] `cd ../kro-ui.issue-684/web && bun run test --run` — expected: all pass
