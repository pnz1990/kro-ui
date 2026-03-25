# Fix: Tier-1 bug batch — 9 issues

**Issue(s)**: #194, #195, #186, #185, #190, #184, #188, #192, #197
**Branch**: fix/issue-194-195-186-185-190-184-188-192-197
**Labels**: bug, enhancement, test

## Root Causes
- #194: two hardcoded "Home" strings missed in spec 037 rename
- #195: `overflow-x: auto` on `.kro-code-block-pre` not overridden inside table cell
- #186: `<OptimizationAdvisor>` is a sibling of `.rgd-graph-area` in flex-row container
- #185: `Layout.handleSwitch` updates state but never calls `navigate('/')`
- #190: `KNOWN_CONDITION_TYPES` uses kro ≤v0.3 names; `kroDeploymentName` hardcoded wrong
- #184: cluster-scoped resources have no `metadata.namespace` → double-slash URL → 404
- #188: `pointer-events: none` + immediate `onMouseLeave` → tooltip unreachable
- #192: `DiscoverPlural` calls raw `ServerResourcesForGroupVersion` bypassing TTL cache
- #197: `access_test.go`, 4 lib test files, 3 E2E journeys, journey 013 renaming

## Files to change

### Frontend (TypeScript/CSS)
- `web/src/pages/InstanceDetail.tsx:292` — "Home" → "Overview"
- `web/src/pages/NotFound.tsx:22` — "Back to home" → "Back to Overview"
- `web/src/components/FieldTable.css:164-171` — add `overflow: hidden`
- `web/src/pages/RGDDetail.tsx:474` — move `<OptimizationAdvisor>` inside `.rgd-graph-area`
- `web/src/components/Layout.tsx:30` — add `navigate('/')` to `handleSwitch`
- `web/src/components/ValidationTab.tsx:16-20` — update `KNOWN_CONDITION_TYPES`
- `web/src/components/ConditionItem.tsx:87-91` — remove "kro v0.3.0+" hint
- `web/src/lib/api.ts:103` — add `namespace || '_'` sentinel
- `web/src/components/DAGTooltip.css:22` — remove `pointer-events: none`
- `web/src/components/DAGTooltip.tsx` — add `onMouseEnter`/`onMouseLeave` props
- `web/src/components/StaticChainDAG.tsx:395` — replace immediate hide with debounce
- `web/src/components/LiveDAG.tsx:117` — same debounce
- `web/src/components/DeepDAG.tsx:406` — same debounce

### Backend (Go)
- `internal/k8s/rgd.go:82-97` — rewrite `DiscoverPlural` to use `CachedServerGroupsAndResources`
- `internal/api/handlers/instances.go:115` — handle `namespace == "_"` for cluster-scoped GET
- `internal/api/handlers/fleet.go:120-153` — replace sequential DiscoverPlural loop with errgroup fan-out
- `internal/server/server.go:66` — add `middleware.Timeout(5*time.Second)` to `/api/v1` route group
- `internal/k8s/capabilities.go:97` — probe multiple deployment names for version detection

### Tests
- `internal/api/handlers/access_test.go` — new file, table-driven handler tests
- `web/src/lib/k8s.test.ts` — new file
- `web/src/lib/yaml.test.ts` — new file
- `web/src/lib/features.test.ts` — new file
- `test/e2e/journeys/013-multi-cluster-overview.spec.ts` — rename from 014
- `test/e2e/journeys/037-ia-home-catalog-merge.spec.ts` — new
- `test/e2e/journeys/038-live-dag-per-node-state.spec.ts` — new
- `test/e2e/journeys/040-per-context-controller-metrics.spec.ts` — new

## Tasks

### Phase 1 — XS frontend fixes (#194 #195 #186 #185)
- [ ] `InstanceDetail.tsx:292` — change `>Home<` to `>Overview<`
- [ ] `NotFound.tsx:22` — change `>Back to home<` to `>Back to Overview<`
- [ ] `FieldTable.css:171` — add `overflow: hidden` after `word-break: break-all`
- [ ] `RGDDetail.tsx:474` — move `<OptimizationAdvisor>` inside `.rgd-graph-area` div (before its closing tag)
- [ ] `Layout.tsx` — import `useNavigate`, call `navigate('/')` in `handleSwitch` after `setActiveContext(name)`

### Phase 2 — ValidationTab + kro condition types (#190)
- [ ] `ValidationTab.tsx:16-20` — replace `KNOWN_CONDITION_TYPES` with: `ResourceGraphAccepted/Graph Accepted`, `KindReady/Kind Ready`, `ControllerReady/Controller Ready`, `Ready/Ready`
- [ ] `ConditionItem.tsx:87-91` — replace "Not emitted by the connected kro version. This condition is available in kro v0.3.0+. Check your installed version with: kubectl..." with neutral: "Not reported — this condition was not found in the RGD's status.conditions. The RGD may still be reconciling, or this condition type may not be emitted by the kro version running in this cluster."
- [ ] `internal/k8s/capabilities.go:96-97` — change `kroDeploymentName` to probe `[]string{"kro", "kro-controller-manager", "kro-controller"}` in a loop, use first found

### Phase 3 — Cluster-scoped Live YAML fix (#184)
- [ ] `web/src/lib/api.ts:103` — change `namespace` to `namespace || '_'` in getResource URL
- [ ] `internal/api/handlers/instances.go:98` — add: `if namespace == "_" { namespace = "" }` after group sentinel decode
- [ ] `internal/api/handlers/instances.go:115` — change `.Namespace(namespace).Get(...)` to conditional: if `namespace == ""` use `h.factory.Dynamic().Resource(gvr).Get(...)` else use `.Namespace(namespace).Get(...)`

### Phase 4 — DAG tooltip (#188)
- [ ] `web/src/components/DAGTooltip.css:22` — remove `pointer-events: none` line
- [ ] `web/src/components/DAGTooltip.tsx` — add `onTooltipMouseEnter` / `onTooltipMouseLeave` optional props; wire them to the root `<div>`
- [ ] `web/src/components/StaticChainDAG.tsx` — replace `onMouseLeave={() => setHoveredTooltip(null)}` with a 150ms debounced hide using `useRef<ReturnType<typeof setTimeout>>`, cancel on `onMouseEnter` and on tooltip mouse-enter
- [ ] `web/src/components/LiveDAG.tsx` — same debounce pattern
- [ ] `web/src/components/DeepDAG.tsx` — same debounce pattern

### Phase 5 — Backend perf (#192)
- [ ] `internal/k8s/rgd.go:82-97` — rewrite `DiscoverPlural`: iterate `clients.CachedServerGroupsAndResources()` results looking for matching group/version/kind; keep naive `+s` fallback only when cache lookup fails
- [ ] `internal/api/handlers/fleet.go:120-153` — batch-resolve plurals before the loop (one call to `CachedServerGroupsAndResources` per cluster, scan once for all kinds); then fan-out instance lists with `errgroup` with 2s per-resource timeout
- [ ] `internal/server/server.go:66` — add `r.Use(middleware.Timeout(5 * time.Second))` as the first middleware in the `/api/v1` route group

### Phase 6 — Tests (#197)
- [ ] Create `internal/api/handlers/access_test.go` — table-driven tests for GetRGDAccess: RGD not found → 404, manual SA override, SA auto-detect, has gaps, no gaps
- [ ] Create `web/src/lib/k8s.test.ts` — test `isTerminating`, `getFinalizers`, `getDeletionTimestamp`, `formatRelativeTime`
- [ ] Create `web/src/lib/yaml.test.ts` — test `toYaml`, `fromYaml` round-trip
- [ ] Create `web/src/lib/features.test.ts` — test `useCapabilities` cache invalidation, `invalidateCapabilities`, `isExperimental`
- [ ] Rename `test/e2e/journeys/014-multi-cluster-overview.spec.ts` → `013-multi-cluster-overview.spec.ts`; update any CI references
- [ ] Create `test/e2e/journeys/037-ia-home-catalog-merge.spec.ts` — smoke: h1 reads "Overview", title is "Overview — kro-ui", nav link text is "Overview"
- [ ] Create `test/e2e/journeys/038-live-dag-per-node-state.spec.ts` — smoke: pending node has `dag-node-live--pending` class
- [ ] Create `test/e2e/journeys/040-per-context-controller-metrics.spec.ts` — smoke: `--metrics-url` absent from `kro-ui serve --help` output

### Phase 7 — Verify
- [ ] `go vet ./...` (from worktree root)
- [ ] `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...`
- [ ] `bun run --cwd web tsc --noEmit`
- [ ] `bun run --cwd web vitest run`

### Phase 8 — PR
- [ ] Commit: `fix(multi): breadcrumb rename, FieldTable scroll, advisor layout, context nav, validation conditions, cluster-scoped YAML, DAG tooltip, discovery cache, test coverage — closes #194 #195 #186 #185 #190 #184 #188 #192 #197`
- [ ] Push and open PR
