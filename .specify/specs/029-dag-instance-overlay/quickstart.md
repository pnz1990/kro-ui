# Quickstart: 029-dag-instance-overlay

## What this feature adds

An **instance overlay** on the RGD detail Graph tab. Select any live instance
of the RGD from a picker and the DAG nodes instantly colorize with health
states — the same green/amber/rose/gray scheme used in the live instance view.

---

## Prerequisites

- kro cluster running with at least one RGD and one deployed instance
- kro-ui binary running: `./kro-ui serve`
- Browser at `http://localhost:40107`

---

## Developer setup

```bash
# From the worktree root
make web        # install deps + build frontend
make go         # builds the binary (GOPROXY=direct GONOSUMDB="*")
./kro-ui serve  # starts on :40107

# Frontend dev server (hot reload)
cd web && bun run dev
```

---

## Files changed by this feature

### Modified
| File | Change |
|------|--------|
| `web/src/lib/dag.ts` | Add exported `nodeStateForNode()` helper |
| `web/src/components/DAGTooltip.tsx` | Add optional `nodeState?: NodeLiveState` prop; relax render gate |
| `web/src/components/StaticChainDAG.tsx` | Add `nodeStateMap?: NodeStateMap` prop; extend `nodeBaseClass()`; import + call `nodeStateForNode()` and `liveStateClass()` |
| `web/src/components/StaticChainDAG.css` | Add live-state rect override rules scoped to `.static-chain-dag-container` |
| `web/src/pages/RGDDetail.tsx` | Add overlay state; picker fetch effect; render `<InstanceOverlayBar>`; pass `nodeStateMap` to `StaticChainDAG` |
| `web/src/components/LiveDAG.tsx` | Replace inline `nodeState()` with `nodeStateForNode()` from `dag.ts` |
| `web/src/components/DeepDAG.tsx` | Replace inline `nodeState()` with `nodeStateForNode()` from `dag.ts` |

### New
| File | Description |
|------|-------------|
| `web/src/components/InstanceOverlayBar.tsx` | Instance picker + summary bar component |
| `web/src/components/InstanceOverlayBar.css` | BEM styles for the overlay bar |

### No backend changes
All required API endpoints exist. Zero Go changes needed.

---

## Usage walkthrough

1. Navigate to an RGD detail page: `http://localhost:40107/rgds/<name>`
2. The **Graph** tab is open by default.
3. At the top of the graph area, see **"Overlay: [No overlay ▾]"**.
4. Click the picker and select an instance, e.g. `default/my-webapp`.
5. The DAG nodes colorize:
   - **Green** = alive (resource reconciled and ready)
   - **Amber + pulse** = reconciling (kro actively working)
   - **Red** = error (Ready=False condition)
   - **Gray dashed** = not found (resource not in children list)
6. The summary bar shows: `● Ready  default/my-webapp  Open instance →`
7. Click **Open instance →** to navigate to the full live instance detail.
8. Select **No overlay** from the picker (or click ✕) to revert to static view.

---

## Key implementation notes

### Shared helper extraction (refactor)
`nodeStateForNode()` is being extracted from `LiveDAG.tsx` and `DeepDAG.tsx`
into `dag.ts`. The function logic is identical — this is a pure refactor. Run
`bun typecheck` to verify no regressions.

### CSS: `reconciling-pulse` is already global
The `@keyframes reconciling-pulse` is defined in `tokens.css:269–272`. No
new keyframe is needed in `StaticChainDAG.css` — just add `animation:
reconciling-pulse 1.5s ease-in-out infinite` to the reconciling rect rule.

### Overlay only on top-level graph
When `StaticChainDAG` renders a nested chained subgraph (chain expand
affordance), the nested `StaticChainDAG` does **not** receive `nodeStateMap`.
The overlay colors the top-level graph only.

### Tooltip render gate
`DAGTooltip` currently bails out if both `readyWhen` and `includeWhen` are
empty. When overlay is active, this gate is relaxed — any node shows a tooltip
so the user can see its live state on hover. Nodes with no CEL expressions show:
```
my-deployment
kind: Deployment
type: Managed resource
state: Alive
```

---

## Typecheck + build

```bash
cd web && bun run typecheck   # must pass with 0 errors
make go                       # verifies the binary still compiles (no Go changes)
```
