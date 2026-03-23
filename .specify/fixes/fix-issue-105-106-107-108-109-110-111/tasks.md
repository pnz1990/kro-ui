# Fix: Audit follow-up — bugs, perf, docs, and tests

**Issue(s)**: #105, #106, #107, #108, #109, #110, #111
**Branch**: fix/issue-105-106-107-108-109-110-111
**Labels**: bug, enhancement, documentation

## Root Cause

Seven audit findings:
- #105/#107: `dagTooltip.ts` is dead (no imports) and duplicates `nodeTypeLabel`/`tokenClass` from `dag.ts`; `KroCodeBlock.tsx` also has its own `tokenClass` — divergence risk when new token types land.
- #106/#111: `ExampleYAML.tsx` uses `pt?.default !== undefined` (AGENTS.md anti-pattern #61) — falsy defaults (0, false, "") are misclassified as required. No test file exists to catch this.
- #108: `ListChildResources` calls `ServerGroupsAndResources()` per-request with no cache, then iterates all resources sequentially with no per-resource timeout — Constitution §XI violation.
- #109: `InstanceTable` renders all rows with an unbounded `.map()` — no virtual scroll or pagination; Constitution §XIII requires 500+ instances support.
- #110: `CONTRIBUTING.md` is absent — Constitution §X requires it.

## Files to change

**Frontend (TypeScript)**
- `web/src/lib/dagTooltip.ts` — delete (dead module, #105/#107)
- `web/src/lib/highlighter.ts` — export a shared `tokenClass` helper (#107)
- `web/src/components/KroCodeBlock.tsx` — import `tokenClass` from `@/lib/highlighter` instead of defining it inline (#107)
- `web/src/components/ExampleYAML.tsx` — fix `hasDefault` check (#106)
- `web/src/components/ExampleYAML.test.tsx` — NEW: unit tests for `generateExampleYAML` (#111)
- `web/src/components/InstanceTable.tsx` — add pagination (50 rows/page) (#109)
- `web/src/components/InstanceTable.css` — pagination control styles (#109)

**Backend (Go)**
- `internal/k8s/client.go` — add discovery cache (≥30s TTL) to `ClientFactory` (#108)
- `internal/k8s/rgd.go` — `ListChildResources`: use cached discovery + errgroup with 2s per-resource timeout (#108)
- `internal/k8s/rgd_test.go` — add `TestListChildResources` table-driven test (#108)

**Docs**
- `CONTRIBUTING.md` — NEW: contribution guide (#110)

## Tasks

### Phase 1 — #105/#107: Delete dagTooltip.ts, export tokenClass from highlighter.ts
- [ ] Delete `web/src/lib/dagTooltip.ts`
- [ ] Export `tokenClass` function from `web/src/lib/highlighter.ts`
- [ ] Update `web/src/components/KroCodeBlock.tsx` to import `tokenClass` from `@/lib/highlighter`

### Phase 2 — #106/#111: Fix ExampleYAML + add tests
- [ ] Fix `hasDefault` in `web/src/components/ExampleYAML.tsx:55` to use key-existence check
- [ ] Create `web/src/components/ExampleYAML.test.tsx` with table-driven tests

### Phase 3 — #108: ListChildResources — cache + errgroup
- [ ] Add discovery cache (`discoveryCache`, `discoveryCacheExpiry`, TTL=30s) to `ClientFactory` in `internal/k8s/client.go`
- [ ] Add `CachedServerGroupsAndResources()` method to `ClientFactory`
- [ ] Update `K8sClients` interface in `internal/k8s/rgd.go` to include the cached method
- [ ] Rewrite `ListChildResources` to use cached discovery + `errgroup` with 2s per-resource timeout
- [ ] Add `TestListChildResources` in `internal/k8s/rgd_test.go`

### Phase 4 — #109: InstanceTable pagination
- [ ] Add pagination state + controls to `web/src/components/InstanceTable.tsx` (50 rows/page)
- [ ] Add pagination styles to `web/src/components/InstanceTable.css`

### Phase 5 — #110: CONTRIBUTING.md
- [ ] Create `CONTRIBUTING.md` at repo root

### Phase 6 — Verify
- [ ] `GOPROXY=direct GONOSUMDB="*" go vet ./...`
- [ ] `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...`
- [ ] `bun run --cwd web tsc --noEmit`
- [ ] `bun run --cwd web vitest run`
