# Fix: Carlos's bug batch — live DAG state, ExternalRef YAML, capabilities version, JSON→YAML, Secret masking

**Issue(s)**: #398, #399, #400, #401, #402, #403
**Branch**: fix/issue-398-403-carlos-bugs
**Labels**: bug (398–401, 403), enhancement (402)

## Root Causes

- **#403**: `InstanceDetail.tsx:333,359` looks up `nodeStateMap[kindKey]` where `kindKey` is lowercased kind — but the map is keyed by `kro.run/node-id`. Guard never fires; external ref YAML fetch always uses wrong name.
- **#398**: `deriveChildState` in `instanceNodeState.ts` — Deployments with `Progressing=True, reason=NewReplicaSetAvailable` (rollout complete) show amber because `Available=True` hasn't arrived yet in the brief post-rollout window. Also, `Ready=True` is not checked as an alive fast-path.
- **#400**: `detectFeatureGatesAndVersion` in `capabilities.go` only probes `kro-system` with 3 hardcoded names, no cluster-scoped fallback for EKS/custom installs.
- **#401**: `SpecPanel.tsx:23`, `LiveNodeDetailPanel.tsx:440`, `InstanceTable.tsx:68` all use `JSON.stringify` for object/array values instead of `toYaml`.
- **#402**: `LiveNodeDetailPanel` `YamlSection` renders Secret data in plain base64; needs masking with reveal-on-click.
- **#399**: ExternalRef nodes use `--color-pending` (violet) for border which looks amber on dark bg; `ExpandableNode.tsx` has duplicate `liveStateClass` function.

## Files to change

- `web/src/pages/InstanceDetail.tsx` — fix nodeStateMap key (#403)
- `web/src/lib/instanceNodeState.ts` — fix deriveChildState (#398)
- `internal/k8s/capabilities.go` — add cluster-scoped fallback (#400)
- `internal/k8s/capabilities_test.go` — add test for EKS scenario (#400)
- `web/src/components/SpecPanel.tsx` + `SpecPanel.css` — toYaml for objects (#401)
- `web/src/components/LiveNodeDetailPanel.tsx` — toYaml for selector + Secret masking (#401, #402)
- `web/src/components/InstanceTable.tsx` — toYaml for arrays in diff (#401)
- `web/src/tokens.css` — new `--node-external-border` token (#399)
- `web/src/components/ExpandableNode.tsx` — remove duplicate liveStateClass (#399)
- `web/src/lib/instanceNodeState.test.ts` — tests for #398 fix
- `web/src/pages/InstanceDetail.test.tsx` — tests for #403 fix

## Tasks

### Phase 1 — #403: Fix nodeStateMap wrong key in InstanceDetail
- [x] `InstanceDetail.tsx:332-334` — replace `kindKey` / `nodeStateMap[kindKey]` with `selectedNode.id`
- [x] `InstanceDetail.tsx:358-359` — same fix for selectedNodeLiveState lookup
- [x] `InstanceDetail.tsx:321-340` — add external ref short-circuit using `selectedNode.externalRef`

### Phase 2 — #398: Fix deriveChildState for Deployments
- [x] `instanceNodeState.ts:123` — add `Ready=True` as second alive fast-path after `Available=True`
- [x] `instanceNodeState.ts:135` — add `NewReplicaSetAvailable` reason check before generic `Progressing=True`

### Phase 3 — #400: Fix capabilities deployment probe
- [x] `capabilities.go:318` — add label-selector cluster-scoped fallback after name-based loop fails

### Phase 4 — #401: Replace JSON.stringify with toYaml
- [x] `SpecPanel.tsx:23` — use toYaml; add multiline CSS support in SpecPanel.css
- [x] `LiveNodeDetailPanel.tsx:440` — use toYaml + KroCodeBlock for selector
- [x] `InstanceTable.tsx:68` — use toYaml for arrays in flattenSpec

### Phase 5 — #402: Secret data masking
- [x] `LiveNodeDetailPanel.tsx` — detect kind===Secret in YamlSection, mask data values, reveal button

### Phase 6 — #399: ExternalRef visual identity + ExpandableNode dedup
- [x] `tokens.css` — add `--node-external-border` distinct from `--color-pending`
- [x] `ExpandableNode.tsx:68` — remove local liveStateClass, import from @/lib/dag

### Phase 7 — Tests
- [x] `instanceNodeState.test.ts` — test deriveChildState NewReplicaSetAvailable → alive
- [x] `instanceNodeState.test.ts` — test deriveChildState Ready=True → alive
- [x] SpecPanel test — object value renders as YAML not JSON
- [x] Run tsc + vitest
- [x] Run go vet + go test -race
