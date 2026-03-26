# Fix: 11-issue batch — UX polish, bug fixes, deduplication

**Issue(s)**: #252, #253, #254, #255, #256, #257, #258, #259, #260, #261, #263
**Branch**: fix/issue-252-253-254-255-256-257-258-259-260-261-263
**Labels**: bug, enhancement
**Note**: #262 already fixed (RGDCard.tsx already has `Boolean(name)`)

## Root Causes

- **#252**: `itemStatus()` returns `'unknown'`; label renders "Unknown" — constitution §XII requires "Not reported" for absent data
- **#253**: `listContexts()` failure sets `activeContext = ''` → blank button label
- **#254**: `instanceFilter` uses `===` exact match; placeholder implies substring
- **#255**: `fittedHeight` duplicated in `DAGGraph.tsx` and `LiveDAG.tsx` — anti-pattern
- **#256**: `AbortController.signal` never passed to `switchContext()`/`post()` — zombie requests
- **#257**: `allChildrenLabelless` computed from all `children`, not the node-filtered `items`
- **#258**: `m.includes('503')` too broad — matches port numbers and resource names
- **#259**: Fleet tick is 15s — "Updated X ago" lags up to 14s
- **#260**: Events polling indicator only shown in empty state, not when events are visible
- **#261**: `retryLoad` in RGDDetail duplicates the initial useEffect fetch body
- **#263**: Home empty state has two primary CTAs; "Open RGD Designer" should be secondary

## Files to change

- `web/src/components/CollectionPanel.tsx` — #252, #257
- `web/src/components/Layout.tsx` — #253
- `web/src/pages/Events.tsx` — #254, #260
- `web/src/lib/dag.ts` — #255
- `web/src/components/DAGGraph.tsx` — #255
- `web/src/components/LiveDAG.tsx` — #255
- `web/src/lib/api.ts` — #256
- `web/src/lib/errors.ts` — #258
- `web/src/pages/Fleet.tsx` — #259
- `web/src/pages/RGDDetail.tsx` — #261
- `web/src/pages/Home.tsx` — #263

## Tasks

### Phase 1 — Fixes

- [x] #252: CollectionPanel.tsx — rename `'unknown'` → `'not-reported'`; label → "Not reported"
- [x] #257: CollectionPanel.tsx — compute `allChildrenLabelless` from `items` not `children`
- [x] #253: Layout.tsx — set `activeContext` to `'(unavailable)'` on error; avoid blank button
- [x] #254: Events.tsx line 164 — `===` → `.toLowerCase().includes()`
- [x] #255: dag.ts — export `fittedHeight`; DAGGraph.tsx + LiveDAG.tsx — remove local copy, import
- [x] #256: api.ts — add signal param to `post()`; api.ts switchContext + ContextSwitcher
- [x] #258: errors.ts line 92 — replace `m.includes('503')` with `\b503\b` word-boundary regex
- [x] #259: Fleet.tsx line 110 — `15_000` → `1_000`
- [x] #260: Events.tsx — show polling indicator in header always (not just empty state)
- [x] #261: RGDDetail.tsx — extract fetch to `useCallback fetchRGD`; call from effect + retryLoad
- [x] #263: Home.tsx line 144 — add `home__empty-cta--secondary` to "Open RGD Designer"

### Phase 2 — Tests

- [x] CollectionPanel.test.tsx — assert "Not reported" label; assert allChildrenLabelless uses items scope
- [x] errors.test.ts — assert '503' in resource name doesn't match; 'http 503' does
- [x] Events.test.tsx — assert partial instance filter works
- [x] Run full vitest suite

### Phase 3 — Verify

- [x] `bun run --cwd web tsc --noEmit`
- [x] `bun run --cwd web vitest run`
- [x] `go vet ./...`

### Phase 4 — PR

- [x] Commit, push, open PR
