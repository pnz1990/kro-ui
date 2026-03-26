# Fix: RGDCard chipLoading initialised to true unconditionally

**Issue**: #262
**Branch**: fix/issue-262-rgdcard-chiploading-init
**Labels**: bug

## Root Cause

`chipLoading` was initialised to `true` unconditionally in `RGDCard.tsx` line 40.
When `name` is absent (empty string), the effect immediately sets it to `false`,
but this fires after the first render — so `HealthChip` briefly receives
`loading={true}` and shows a skeleton shimmer for one frame even when no fetch
will ever be made.

## Files to change

- `web/src/components/RGDCard.tsx` — already fixed: `useState(Boolean(name))`
- `web/src/components/RGDCard.test.tsx` — add regression tests for initial
  `chipLoading` value in both the empty-name and non-empty-name cases

## Tasks

### Phase 1 — Fix
- [x] `RGDCard.tsx:47` — initialise `chipLoading` to `Boolean(name)` (already landed in main)

### Phase 2 — Tests
- [ ] Add test: card with no name does NOT render HealthChip in loading state on first render
- [ ] Add test: card with name renders HealthChip in loading state on first render (before fetch resolves)
- [ ] Run `bun run --cwd web vitest run` — all tests pass

### Phase 3 — Verify
- [ ] Run `bun run --cwd web tsc --noEmit`
- [ ] Run `bun run --cwd web vitest run`

### Phase 4 — PR
- [ ] Commit: `fix(web): add regression test for chipLoading init — closes #262`
- [ ] Push branch: `git push -u origin fix/issue-262-rgdcard-chiploading-init`
- [ ] Open PR: `gh pr create --base main --head fix/issue-262-rgdcard-chiploading-init`
