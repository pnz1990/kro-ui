# Fix: DAG rendering, cluster-scoped children, Generate tab cleanup

**Issue(s)**: #202, #203, #204, #205, #183, #189
**Branch**: fix/issue-202-203-204-205-183-189
**Labels**: bug

## Root Causes

- **#202**: `ListChildResources` calls `.Namespace("").List()` for all GVRs including cluster-scoped ones. Client-go treats `.Namespace("")` as namespaced all-ns list which races with discovery cache for cluster-scoped types → intermittent absence of Namespace/ClusterRole children
- **#203**: Pure consequence of #202 — no separate fix needed
- **#205**: `GenerateTab.tsx` still has 'rgd' mode, `STARTER_RGD_STATE` import, `rgdState`, `rgdYaml` — should be removed since `/author` is the dedicated route
- **#204**: `ExpandableNode.tsx:132` `nestedX = node.x + node.width/2 - nestedWidth/2` can be negative for right-side nodes → SVG clips panel. `StaticChainDAG` `extraHeight` uses `Math.max` (biggest single expansion) not sum of all expansions
- **#183**: `StaticChainDAG` `fittedHeight` over-reports when `InstanceOverlayBar` is rendered — the bar is a DOM sibling of the SVG, but the `nodeStateMap` prop change triggers a React re-render that may briefly compute wrong bounding box. Root cause: `fittedHeight` uses Dagre-computed `node.y` values but the SVG `viewBox` height is being multiplied by the bar's existence in a flex-column container
- **#189**: DeepDAG (a) multiple expanded panels stagger/overlap — need accordion (one open at a time); (b) child instance lookup calls `listInstances(rgdName, namespace)` instead of finding the child by name from the `children` prop

## Files to change

- `internal/k8s/rgd.go:186-203` — carry `Namespaced` bool into GVR collection struct
- `internal/k8s/rgd.go:218-230` — branch `.List()` vs `.Namespace("").List()` on `Namespaced`
- `web/src/components/GenerateTab.tsx` — remove 'rgd' mode, button, state, imports
- `web/src/components/ExpandableNode.tsx:132` — clamp `nestedX` to `[0, svgWidth - nestedWidth]`; add `svgWidth` prop
- `web/src/components/StaticChainDAG.tsx:293` — change `Math.max` to sum of all expansions; pass `graph.width` to ExpandableNode
- `web/src/components/StaticChainDAG.tsx:78-81` — fix `fittedHeight` to not be affected by overlay bar
- `web/src/components/DeepDAG.tsx:125-176` — accordion toggle (one at a time); replace `listInstances` with children-prop lookup

## Tasks

### Phase 1 — #202 backend cluster-scoped children
- [x] `internal/k8s/rgd.go:186-202` — add `namespaced bool` to gvr collection struct
- [x] `internal/k8s/rgd.go:218-230` — branch List call on namespaced flag

### Phase 2 — #205 Remove 'New RGD' from GenerateTab
- [x] `GenerateTab.tsx` — remove `'rgd'` from type, remove button, remove state/memo, remove STARTER_RGD_STATE import, remove RGDAuthoringForm import

### Phase 3 — #204/#183 SVG layout fixes
- [x] `ExpandableNode.tsx` — add `svgWidth` prop; clamp `nestedX`
- [x] `StaticChainDAG.tsx` — pass `graph.width` as `svgWidth`; fix extraHeight sum; fix fittedHeight overlay offset

### Phase 4 — #189 DeepDAG accordion + child lookup
- [x] `DeepDAG.tsx` — accordion toggle; replace listInstances with children prop lookup

### Phase 5 — Tests & verify
- [x] `go vet ./...`
- [x] `go test -race ./internal/...`
- [x] `bun tsc --noEmit`
- [x] `bun vitest run`
