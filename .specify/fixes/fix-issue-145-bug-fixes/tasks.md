# Fix: Multi-issue bug-fix batch

**Issue(s)**: #145, #146, #147, #148, #149, #150, #151, #152, #153, #154, #156
**Branch**: fix/issue-145-bug-fixes
**Labels**: bug

## Root Causes

- **#145/#148**: `ListInstances` backend already returns raw K8s list; frontend reads `metadata.name` correctly. Investigation shows the real issue is that `list.items` can be `null` from some kro versions (UnstructuredList with null items array); add a null-guard in the frontend.
- **#146**: `ListChildResources` searches only the given namespace — when kro creates resources in per-instance namespaces (e.g. instance `carrlos` creates resources in namespace `carrlos`), the child search in `default` namespace returns nothing. Fix: search all namespaces (empty string namespace = cluster-wide).
- **#147**: `LiveDAG.tsx` renders `node.kind` unconditionally; for state nodes `kind === id`, producing duplicate text. Fix: add the same `node.kind !== node.id` guard present in `DAGGraph.tsx`.
- **#149**: `buildDAGGraph` returns `graph.width` from layout arithmetic but doesn't account for actual max node right-edge coordinate. Add `fittedWidth()` analogous to `fittedHeight()`.
- **#150**: `buildRelevantUIDs` passes the user-supplied `namespace` param to instance list calls. When `namespace==""` it should list cluster-wide; the real issue is the events API itself lists events only in the specified namespace too — fix to always list events cluster-wide and then filter by UID.
- **#151**: RGD catalog/home cards have no `min-height` so cards with fewer content rows appear shorter. Fix with CSS `min-height`.
- **#152**: `InstanceTable` directly mutates `document.title` instead of delegating to the parent page via the `usePageTitle` hook.
- **#153**: `buildRelevantUIDs` iterates RGDs serially; parallelize using goroutines + per-RGD 2s timeout (same pattern as `ListChildResources`).
- **#154**: Helm ClusterRole wildcard rule missing `watch` verb — inconsistent with kro resources rule.
- **#156**: `metrics_test.go` uses `assert.NoError` in a goroutine-result loop; add clarifying comment.

## Files to change

### Backend (Go)
- `internal/k8s/rgd.go` — `ListChildResources`: remove namespace restriction, search all namespaces
- `internal/api/handlers/events.go` — `buildRelevantUIDs`: parallelize RGD loop
- `helm/kro-ui/templates/clusterrole.yaml` — add `watch` to wildcard rule
- `internal/k8s/metrics_test.go` — add comment to `assert.NoError` call

### Frontend (TypeScript)
- `web/src/lib/dag.ts` — add `fittedWidth()` helper
- `web/src/components/DAGGraph.tsx` — use `fittedWidth()` for SVG width
- `web/src/components/LiveDAG.tsx` — add `kind !== id` guard + use `fittedWidth()`
- `web/src/components/InstanceTable.tsx` — remove `document.title` mutation
- `web/src/components/RGDCard.css` / `CatalogCard.css` — add `min-height`

## Tasks

### Phase 1 — Backend fixes

- [x] **#146** `internal/k8s/rgd.go:ListChildResources` — change namespace arg to `""` (all-ns label search)
      The function already passes `namespace` to each List call. Fix: pass `""` as namespace to search all namespaces. The caller passes the instance's own namespace which is too narrow.
- [x] **#153** `internal/api/handlers/events.go:buildRelevantUIDs` — parallelize RGD instance listing
      Adopt sync.WaitGroup + per-RGD 2s timeout (same pattern as ListChildResources).
- [x] **#154** `helm/kro-ui/templates/clusterrole.yaml` — add `watch` to wildcard rule
- [x] **#156** `internal/k8s/metrics_test.go` — add comment explaining assert accumulation

### Phase 2 — Frontend fixes

- [x] **#147** `web/src/components/LiveDAG.tsx:136` — add `node.kind !== node.id` guard
- [x] **#149** `web/src/lib/dag.ts` — add `fittedWidth(graph)` export
      `web/src/components/DAGGraph.tsx` — use `fittedWidth` for SVG width
      `web/src/components/LiveDAG.tsx` — use `fittedWidth` for SVG width
- [x] **#152** `web/src/components/InstanceTable.tsx` — remove document.title useEffect
- [x] **#151** RGD cards CSS — add `min-height` to equalize card visual rhythm
- [x] **#145/#148** Null-guard: ensure `list.items ?? []` in catalog + home instance fetch

### Phase 3 — Tests

- [x] Unit test for `fittedWidth` in `dag.test.ts` (if file exists) or inline
- [x] Update `internal/api/handlers/events_test.go` — add test for parallel UID collection
- [x] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...`
- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`

### Phase 4 — PR

- [ ] Commit with `fix(multi): closes #145–#154, #156`
- [ ] Push and open PR
