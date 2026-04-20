# Tasks: issue-582 — Error state for unreachable cluster on initial load

## Phase 1 — Core
- [x] Write spec.md
- [ ] [AI] Add `isNetworkError(err: unknown): boolean` to `web/src/lib/errors.ts`
- [ ] [AI] Add unit tests for `isNetworkError` in `web/src/lib/errors.test.ts`
- [ ] [AI] Update `Layout.tsx`: detect network failure in `listContexts` + `getCapabilities` calls
- [ ] [AI] Add `ClusterUnreachableBanner` render in `Layout.tsx`
- [ ] [AI] Add CSS for cluster-unreachable banner in `Layout.css`

## Phase 2 — Design doc update
- [ ] [AI] Move 🔲 → ✅ in `docs/design/30-health-system.md`

## Phase 3 — Validation
- [ ] [CMD] `make build` — passes
- [ ] [CMD] `GOPROXY=direct GONOSUMDB="*" go test ./... -race -count=1` — passes
- [ ] [CMD] `go vet ./...` — passes
- [ ] [CMD] `bun --cwd web run typecheck` — passes

## Phase 4 — PR
- [ ] [AI] Commit with correct message
- [ ] [CMD] Push and open PR
