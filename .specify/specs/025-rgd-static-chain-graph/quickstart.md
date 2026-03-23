# Quickstart: RGD Static Chaining Graph

**Feature**: `025-rgd-static-chain-graph`
**Worktree**: `~/Projects/kro-ui.025-rgd-static-chain-graph`
**Date**: 2026-03-22

---

## Prerequisites

1. Working kro-ui dev environment (frontend + backend)
2. A local kind cluster or real cluster with kro installed
3. Two chained RGDs applied: e.g., `platform` (contains a `Database` resource) + `database`

---

## Dev workflow

```bash
# From the worktree (NOT the main worktree)
cd ~/Projects/kro-ui.025-rgd-static-chain-graph

# Start the backend
make go args="run ./cmd/kro-ui -- serve"

# Start the frontend dev server (separate terminal)
cd web && bun run dev

# Open in browser
open http://localhost:5173
```

## Apply test fixtures

```bash
# Apply the test-app RGD
kubectl apply -f test/e2e/fixtures/test-app.yaml

# For manual chain testing, create a second RGD whose schema kind
# matches one of test-app's resource kinds:
kubectl apply -f - <<EOF
apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: webapp-backend
spec:
  schema:
    apiVersion: kro.run/v1alpha1
    kind: WebAppBackend
    spec:
      replicas: integer | default=1
  resources:
  - id: deployment
    template:
      apiVersion: apps/v1
      kind: Deployment
      ...
EOF
```

---

## Key files to edit

| File | Why |
|---|---|
| `web/src/tokens.css` | Add `--color-chain-*` tokens (7 new, dark + light) |
| `web/src/lib/dag.ts` | Extend `DAGNode`, add `findChainedRgdName()`, `buildChainSubgraph()`, extend `buildDAGGraph()` |
| `web/src/lib/dag.test.ts` | Add tests for new chain helpers |
| `web/src/components/StaticChainDAG.tsx` | **New** — static expansion component |
| `web/src/components/StaticChainDAG.css` | **New** — chain-specific styles |
| `web/src/components/StaticChainDAG.test.tsx` | **New** — unit tests |
| `web/src/pages/RGDDetail.tsx` | Fetch RGD list, swap in `StaticChainDAG`, add breadcrumb |
| `web/src/pages/RGDDetail.css` | Breadcrumb styles |

---

## Run checks before committing

```bash
# TypeScript typecheck (must pass 0 errors)
cd web && bun run typecheck

# Frontend unit tests
cd web && bun run test

# Go vet (no backend changes expected, but required by pre-commit hook)
make go args="vet ./..."
```

---

## Visual sanity check

Navigate to `/rgds/<name>` for an RGD that chains another. On the Graph tab:

1. Chainable nodes should show a teal ring (`.node-chainable`)
2. `▸` toggle should appear in **teal** (not grey — grey is spec 012 live toggle)
3. "View RGD →" should appear in **blue** (primary link color)
4. Clicking `▸` should expand a nested subgraph with the chained RGD's nodes
5. Nested nodes should NOT show live-state colors (green/red/amber)
6. "View RGD →" should navigate to `/rgds/<chained-rgd-name>` with a "← back" breadcrumb
7. At depth 4 (4 levels of nesting), nodes show "⋯ Max depth" — no `▸`
8. Cycle: if RGD A chains B which chains A, expanding A's chain shows a cycle indicator on the inner A node

---

## E2E test fixture requirement

The existing `test-app` RGD has `kind: WebApp` (root) with resources of kind `Namespace` and `ConfigMap` — neither matches another RGD. For E2E testing of this feature, a second fixture RGD is needed whose `spec.schema.kind` matches one of `test-app`'s resource kinds, OR a purpose-built chaining fixture:

```
test/e2e/fixtures/chain-parent.yaml  # RGD with resource of kind: ChainChild
test/e2e/fixtures/chain-child.yaml   # RGD with spec.schema.kind: ChainChild
```

These fixtures can be minimal (1-2 resources each) and are created as part of the implementation tasks.
