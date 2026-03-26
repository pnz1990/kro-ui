# Fix: LABEL_NODE_ID dedup + usePolling stale reset + dag.ts pending state + RGDCard double fetch

**Issue(s)**: #227, #230, #234, #235
**Branch**: fix/issue-227-230-234-235-frontend-fixes
**Labels**: bug, enhancement

## Root Cause

- **#227**: `LABEL_NODE_ID = 'kro.run/node-id'` copy-pasted in `CollectionBadge.tsx` and
  `CollectionPanel.tsx`. Should be a single export in `web/src/lib/kro.ts`.
- **#230**: `nodeStateForNode()` in `dag.ts` returns `undefined` for the root `instance`
  node when `stateMap` is empty (children in-flight). `liveStateClass(undefined)` → `dag-node-live--notfound`.
  Should return `'pending'`.
- **#234**: `usePolling.ts` effect never resets `data`/`error` when `deps` change.
  Add `setData(null); setError(null)` at the top of the effect.
- **#235**: `RGDCard.tsx` fires a redundant `listInstances` per card when `Home.tsx` already
  fetches it. Pass `healthSummary` prop from `Home.tsx`; remove the per-card `useEffect`.

## Files to change

- `web/src/lib/kro.ts` — new file: shared kro label constants
- `web/src/components/CollectionBadge.tsx` — import `LABEL_NODE_ID` from `kro.ts`
- `web/src/components/CollectionPanel.tsx` — import `LABEL_NODE_ID` from `kro.ts`
- `web/src/lib/dag.ts` — return `'pending'` instead of `undefined` for empty stateMap
- `web/src/hooks/usePolling.ts` — reset `data` + `error` at top of effect
- `web/src/components/RGDCard.tsx` — add `healthSummary` prop; remove `listInstances` useEffect
- `web/src/pages/Home.tsx` — compute `HealthSummary` alongside `terminatingCounts`; pass to RGDCard
- `web/src/lib/dag.test.ts` — verify `nodeStateForNode` returns `'pending'` for empty stateMap
- `web/src/hooks/usePolling.test.ts` — verify data reset on dep change (if test file exists)

## Tasks

### Phase 1 — #227: Extract LABEL_NODE_ID to shared kro.ts
- [x] Create `web/src/lib/kro.ts` with `LABEL_NODE_ID`, `LABEL_COLL_INDEX`, `LABEL_INSTANCE_NAME` exports
- [x] Update `CollectionBadge.tsx` to import from `@/lib/kro`
- [x] Update `CollectionPanel.tsx` to import from `@/lib/kro`

### Phase 2 — #230: dag.ts pending state for empty stateMap
- [x] In `dag.ts` `nodeStateForNode()`: change `return undefined` → `return 'pending'` when `states.length === 0` for the `instance` node type
- [x] Add/update unit test in `dag.test.ts` asserting `nodeStateForNode` returns `'pending'` for instance node with empty stateMap

### Phase 3 — #234: usePolling data reset on dep change
- [x] In `usePolling.ts` effect: add `setData(null); setError(null);` at the top before `fetch_()`
- [x] Add unit test (or extend existing) verifying data is cleared when deps change

### Phase 4 — #235: RGDCard remove redundant listInstances
- [x] Add `HealthSummary` interface to `web/src/lib/api.ts` (or inline in Home): `{ ready: number; total: number }`
- [x] In `Home.tsx` fan-out: compute `healthSummary` per RGD alongside `terminatingCount`; store in a state map
- [x] Add optional `healthSummary?: HealthSummary` prop to `RGDCard`
- [x] In `RGDCard.tsx`: when `healthSummary` is provided, skip the `listInstances` useEffect and use the prop directly for the health chip
- [x] Pass `healthSummary` from `Home.tsx` to each `<RGDCard>`

### Phase 5 — Verify
- [x] `bun run --cwd web tsc --noEmit`
- [x] `bun run --cwd web vitest run`

### Phase 6 — PR
- [ ] Commit and open PR
