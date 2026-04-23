# Tasks: issue-771

## Pre-implementation
- [CMD] `cd ../kro-ui.issue-771 && bun run typecheck 2>&1 | tail -3` — expected: no errors (baseline)

## Implementation
- [AI] Add `searchQuery` and `isSearchOpen` state to `LiveDAG` component
- [AI] Add keydown handler on the container div: open search box on `/`, close on `Escape`
- [AI] Render search box overlay with `role="searchbox"` and `aria-label="Search DAG nodes"`
- [AI] Apply opacity filter to nodes: 0.25 for non-matching, 1.0 for matching
- [AI] Handle `Enter` in search box: invoke `onNodeClick` for top match and close
- [AI] Add CSS for search overlay (tokens only, no hardcoded colors)
- [AI] Write unit tests in `LiveDAG.test.tsx`
- [AI] Update `docs/design/29-instance-management.md`: flip 🔲 to ✅ for 29.2

## Post-implementation
- [CMD] `cd ../kro-ui.issue-771 && bun run typecheck 2>&1 | tail -3` — expected: no errors
- [CMD] `cd ../kro-ui.issue-771 && bun test --run LiveDAG 2>&1 | tail -10` — expected: PASS
