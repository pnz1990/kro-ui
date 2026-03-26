# Fix: frontend polish — 10 UX/bug issues

**Issue(s)**: #236, #237, #238, #239, #240, #241, #242, #243, #244, #245
**Branch**: fix/issue-236-245-frontend-polish
**Labels**: bug (7), enhancement (3)

---

## Root Causes

- **#236**: `kroVersion` destructured but never rendered in `ClusterCard.tsx`
- **#237**: `needsTooltip` checked against raw `active.length` not `truncated.length`
- **#238**: `fetchedRef` guard fragile under React Strict Mode; no `AbortController`
- **#239**: `getBoundingClientRect()` called before browser layout — rect is 0×0
- **#240**: `visibleCount` not reset when `rgdFilter` changes in `Events.tsx`
- **#241**: `formatAge()` returns bare duration; template adds explicit ` ago`
- **#242**: Search toolbar hidden during loading — causes layout jump
- **#243**: `isReconciling` only checks `'Progressing'`, misses `'GraphProgressing'` (kro v0.8.x)
- **#244**: `String(v)` on nested objects in `schemaSpec` renders `[object Object]`
- **#245**: `labels[LABEL_COLL_INDEX] ?? '?'` renders `?` — violates constitution §XII

## Files to change

- `web/src/components/ClusterCard.tsx` — #236
- `web/src/components/ContextSwitcher.tsx` — #237
- `web/src/components/CollectionPanel.tsx` — #238, #245
- `web/src/components/DAGTooltip.tsx` — #239
- `web/src/pages/Events.tsx` — #240
- `web/src/components/MetricsStrip.tsx` — #241
- `web/src/pages/Home.tsx` — #242
- `web/src/pages/InstanceDetail.tsx` — #243
- `web/src/components/NodeDetailPanel.tsx` — #244

---

## Tasks

### Phase 1 — Fix

- [x] **#236** `ClusterCard.tsx`: destructure `kroVersion`; render `kro v{kroVersion}` when non-empty and health ≠ `kro-not-installed`
- [x] **#237** `ContextSwitcher.tsx` line 67: change `needsTooltip = active.length > MAX_DISPLAY_LENGTH` → `truncated.length > MAX_DISPLAY_LENGTH`; same fix at lines 239 and 259 for dropdown options
- [x] **#238** `CollectionPanel.tsx` `ItemYamlView`: replace `fetchedRef` guard with `AbortController`; abort on cleanup; discard stale responses
- [x] **#239** `DAGTooltip.tsx` lines 123–154: wrap `getBoundingClientRect()` in `requestAnimationFrame` inside the `useEffect`
- [x] **#240** `Events.tsx` line 104–110 reset `useEffect`: add `setVisibleCount(MAX_EVENTS)` alongside `setAllEvents([])`
- [x] **#241** `MetricsStrip.tsx` line 106: remove explicit ` ago` suffix; use `formatAge()` value directly (it returns bare duration already consistent with other callers)
- [x] **#242** `Home.tsx` lines 154–167: remove `!isLoading &&` guard from toolbar; add `disabled` + `aria-disabled` to SearchBar during loading
- [x] **#243** `InstanceDetail.tsx` line 106: extend `isReconciling` to also match `'GraphProgressing'`
- [x] **#244** `NodeDetailPanel.tsx` lines 206–208: replace `String(v)` with `typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v)`
- [x] **#245** `CollectionPanel.tsx` line 398: change `?? '?'` → `?? '—'` for `idx` fallback

### Phase 2 — Tests

- [ ] Run existing vitest suite — verify no regressions
- [ ] Run TypeScript typecheck — verify no type errors

### Phase 3 — Verify

- [ ] Run `bun run --cwd web tsc --noEmit`
- [ ] Run `bun run --cwd web vitest run`

### Phase 4 — PR

- [ ] Commit: `fix(web): frontend polish — closes #236 #237 #238 #239 #240 #241 #242 #243 #244 #245`
- [ ] Push branch
- [ ] Open PR
