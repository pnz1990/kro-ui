# Fix: 10-issue batch — API error safety, DAG fixes, a11y, docs, E2E journeys

**Issue(s)**: #229, #231, #232, #233, #246, #247, #248, #249, #250, #251
**Branch**: fix/issue-229-231-232-233-246-247-248-249-250-251
**Labels**: bug, enhancement, documentation

## Root Causes

- **#250**: `body.error ?? fallback` doesn't guard non-string values; `new Error(object)` → `"[object Object]"`
- **#249**: `setSearchParams({})` wipes all params including `?namespace=` when switching to Graph tab
- **#233**: `dagGraph` missing from `useEffect` dep array → stale node state map when overlay fires before memo settles
- **#247**: `buildDAGGraph` in `AuthorPage` useMemo has no try-catch → unhandled exception crashes page
- **#248**: `DAGTooltip` early-returns `null` when `readyWhen`/`includeWhen` are empty and `nodeState` is absent → no tooltip on plain resource nodes
- **#251**: `NodeDetailPanel` renders `extMeta.selector` as minified `JSON.stringify` — unreadable for complex selectors
- **#246**: `ContextSwitcher` updates `focusedIdx` but never calls `element.focus()` → screen readers can't navigate
- **#229**: `docs/design/proposals/` absent — required by Constitution §VIII
- **#231**: Missing E2E journey `026-rgd-yaml-generator.spec.ts`
- **#232**: Missing E2E journey `041-error-states-ux-audit.spec.ts`

## Files to change

- `web/src/lib/api.ts` — #250
- `web/src/pages/RGDDetail.tsx` — #249, #233
- `web/src/pages/AuthorPage.tsx` — #247
- `web/src/components/DAGTooltip.tsx` — #248
- `web/src/components/NodeDetailPanel.tsx` — #251
- `web/src/components/ContextSwitcher.tsx` — #246
- `docs/design/proposals/001-dynamic-client.md` — #229
- `docs/design/proposals/002-discovery-caching.md` — #229
- `docs/design/proposals/003-fleet-timeout-budget.md` — #229
- `test/e2e/journeys/026-rgd-yaml-generator.spec.ts` — #231
- `test/e2e/journeys/041-error-states-ux-audit.spec.ts` — #232

## Tasks

### Phase 1 — Bug fixes

- [x] #250: `web/src/lib/api.ts:10` — replace `body.error ??` with type-safe string check
- [x] #249: `web/src/pages/RGDDetail.tsx:301-306` — preserve non-tab params in `setTab('graph')`
- [x] #233: `web/src/pages/RGDDetail.tsx:240` — add `dagGraph` to overlay useEffect dep array
- [x] #247: `web/src/pages/AuthorPage.tsx:39-42` — wrap `buildDAGGraph` useMemo in try-catch
- [x] #248: `web/src/components/DAGTooltip.tsx:178` — remove early-return for plain resource nodes
- [x] #251: `web/src/components/NodeDetailPanel.tsx:195-197` — render selector via `<KroCodeBlock>` with pretty JSON
- [x] #246: `web/src/components/ContextSwitcher.tsx` — add `useEffect` to call `.focus()` when `focusedIdx` changes

### Phase 2 — Docs (#229)

- [x] Create `docs/design/proposals/` directory with three stub proposals

### Phase 3 — E2E journeys

- [x] #231: Write `test/e2e/journeys/026-rgd-yaml-generator.spec.ts`
- [x] #232: Write `test/e2e/journeys/041-error-states-ux-audit.spec.ts`

### Phase 4 — Unit tests

- [x] Add `web/src/lib/api.test.ts` — tests for `get()` non-string error body
- [x] Update `RGDDetail.test.tsx` — test that setTab('graph') preserves namespace param
- [x] Update `AuthorPage.test.tsx` — test that invalid form state doesn't crash

### Phase 5 — Verify

- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`
- [x] Commit, push, open PR
