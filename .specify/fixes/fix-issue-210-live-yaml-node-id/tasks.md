# Fix: Live YAML always fails — resolveChildResourceInfo matches by node label instead of kro.run/node-id

**Issue(s)**: #210
**Branch**: fix/issue-210-live-yaml-node-id
**Labels**: bug

## Root Cause

`resolveChildResourceInfo` in `web/src/lib/resolveResourceName.ts` derives a `kindHint`
from the node label (resource ID, e.g. `"appNamespace"`) and matches it against
`child.kind.toLowerCase()` (e.g. `"namespace"`). Since resource IDs almost never equal
their kinds in real-world RGDs, no child ever matches and the fallback constructs a
wrong name/kind, producing a 404 from the GetResource endpoint.

kro ≥ 0.8.0 sets `kro.run/node-id: <resource-id>` on every managed resource — this is
the exact, authoritative key. Matching on this label first fixes all cases, including
two resources sharing the same kind (e.g. `appConfig` and `appStatus` both `ConfigMap`).

## Files to change

- `web/src/lib/resolveResourceName.ts` — add `kro.run/node-id` primary match in
  `resolveChildResourceInfo`; add `nodeKind` optional param for secondary kind fallback
- `web/src/pages/InstanceDetail.tsx` — pass `selectedNode.kind` as `nodeKind`
- `web/src/lib/resolveResourceName.test.ts` — tests for node-id match + same-kind
  disambiguation + nodeKind fallback

## Tasks

### Phase 1 — Fix
- [x] `resolveResourceName.ts:69` — add `nodeKind?: string` param to
  `resolveChildResourceInfo`; update header comment
- [x] `resolveResourceName.ts:76` — insert primary match loop: if child has
  `kro.run/node-id === nodeLabel` → return that child's info immediately
- [x] `resolveResourceName.ts:78` — add tertiary kind match using `nodeKind` (after
  existing kindHint match) for kro < 0.8.0 clusters where IDs equal kinds but label
  doesn't carry a CR suffix
- [x] `InstanceDetail.tsx:248` — pass `selectedNode.kind` as `nodeKind` argument

### Phase 2 — Tests
- [x] `resolveResourceName.test.ts` — add `resolveChildResourceInfo` describe block
- [x] Test: node-id match — label "appNamespace", child kind "Namespace" with
  `kro.run/node-id: appNamespace` → returns correct Namespace info
- [x] Test: two ConfigMaps with same kind, different node-ids — label "appConfig" returns
  the ConfigMap whose node-id matches, not the first kind-match
- [x] Test: nodeKind fallback — no node-id label, label "appDeployment", nodeKind
  "Deployment", child kind "Deployment" → returns correct info via kind match
- [x] Test: inference fallback — no node-id, no kind match → returns inferred info
- [x] Test: cluster-scoped resource (no namespace) → namespace="" returned correctly

### Phase 3 — Verify
- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`

### Phase 4 — PR
- [ ] Commit: `fix(web): resolve child resource by kro.run/node-id label — closes #210`
- [ ] Push branch
- [ ] Open PR
