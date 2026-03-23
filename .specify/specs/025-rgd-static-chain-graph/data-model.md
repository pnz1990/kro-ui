# Data Model: RGD Static Chaining Graph

**Feature**: `025-rgd-static-chain-graph`
**Phase**: 1 — Design
**Date**: 2026-03-22

---

## Extended `DAGNode`

Existing type in `web/src/lib/dag.ts`. Two new optional fields are added:

```typescript
export interface DAGNode {
  // ... existing fields unchanged ...

  // ── NEW: Static chain fields ─────────────────────────────────────────────
  /** True when this node's kind matches another RGD's spec.schema.kind. */
  isChainable: boolean
  /**
   * Name of the chained RGD (i.e., the RGD whose spec.schema.kind == this
   * node's kind). Present when isChainable=true, absent otherwise.
   */
  chainedRgdName?: string
}
```

**Backward compatibility**: Both fields default to `false`/`undefined` when `buildDAGGraph()` is called without the `rgds` argument (all existing callers). No breaking change.

**Validation rules**:
- `isChainable` is `false` for the root node (`id === 'schema'`/`nodeType === 'instance'`). The root CR is never chainable — it is itself the chain origin.
- `chainedRgdName` MUST be present whenever `isChainable === true`; it MUST be absent when `isChainable === false`

---

## Updated `buildDAGGraph` signature

```typescript
/**
 * @param spec - The `spec` property of a kro RGD object
 * @param rgds - Optional: all known RGDs from the cluster.
 *               When provided, detects chainable nodes (sets isChainable/chainedRgdName).
 *               When absent, no chain detection; all nodes have isChainable=false.
 */
export function buildDAGGraph(
  spec: Record<string, unknown>,
  rgds?: K8sObject[],
): DAGGraph
```

---

## New helper functions in `dag.ts`

### `findChainedRgdName(kind, rgds): string | undefined`

Pure function. Returns the `metadata.name` of the first RGD whose `spec.schema.kind === kind`. Returns `undefined` if no match or if `kind` is empty.

```typescript
export function findChainedRgdName(
  kind: string,
  rgds: K8sObject[],
): string | undefined
```

**Replaces**: `detectKroInstance()` for callers that also need the RGD name. `detectKroInstance()` is kept for backward compat (used in `DeepDAG`).

---

### `buildChainSubgraph(rgdName, rgds): DAGGraph | null`

Pure function. Finds the RGD by name in `rgds`, extracts its `spec`, calls `buildDAGGraph(spec, rgds)` (passing `rgds` so nested chains are also detected). Returns `null` if the RGD is not found.

```typescript
export function buildChainSubgraph(
  rgdName: string,
  rgds: K8sObject[],
): DAGGraph | null
```

---

## New component: `StaticChainDAG`

**File**: `web/src/components/StaticChainDAG.tsx`

**Props**:

```typescript
export interface StaticChainDAGProps {
  /** The static DAG graph (built from RGD spec, with chain detection). */
  graph: DAGGraph
  /** All known RGDs — needed to build nested subgraphs on expand. */
  rgds: K8sObject[]
  /** Called when any node (top-level or nested) is clicked for inspection. */
  onNodeClick?: (node: DAGNode) => void
  /** ID of the currently selected/highlighted node. */
  selectedNodeId?: string
  /** RGD names already in the current expansion path — for cycle detection. */
  ancestorSet?: ReadonlySet<string>
  /**
   * Current recursion depth. 0 = top level.
   * Nodes at depth >= 4 show a "Max depth" indicator instead of expand toggle.
   */
  depth?: number
  /** Name of the RGD being displayed (used to seed ancestorSet at top level). */
  rgdName: string
}
```

**State**:

```typescript
// Map from nodeId → expanded:boolean
const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set())
```

**Rendering logic** (per node):
1. If `node.isChainable === false` → plain node (same as `DAGGraph`)
2. If `node.isChainable === true`:
   - Apply `.node-chainable` CSS class (the ring indicator)
   - Render `.static-chain-expand-toggle` icon (`▸`/`▾`) — distinct from `.deep-dag-expand-toggle`
   - Render "View RGD →" link via `<foreignObject>` or adjacent SVG text element
   - If expanded:
     - If `node.chainedRgdName` is in `ancestorSet` → render cycle indicator
     - If depth >= 4 → render max-depth indicator
     - Otherwise → render nested `StaticChainDAG` for `buildChainSubgraph(node.chainedRgdName, rgds)`

---

## CSS class taxonomy (augmented)

This table documents all CSS classes on DAG nodes after this spec, to prevent collision:

| Class | Source | Purpose |
|---|---|---|
| `dag-node` | Base (003) | Required on every node `<g>` |
| `dag-node--resource` etc. | Base (003) | Node type variant |
| `node-conditional` | Base (003) | `includeWhen` modifier (dashed border + `?`) |
| `dag-node--selected` | Base (003) | Currently selected |
| `dag-node-live--alive` etc. | Live (005) | Live state overlay |
| `deep-dag-expandable` | Deep (012) | Marks a live-expandable node |
| `deep-dag-expand-toggle` | Deep (012) | Live expand `▸`/`▾` icon |
| **`node-chainable`** | **Static (025)** | **Static chain ring indicator** |
| **`static-chain-expandable`** | **Static (025)** | **Marks a statically-expandable node** |
| **`static-chain-expand-toggle`** | **Static (025)** | **Static expand `▸`/`▾` icon** |
| **`static-chain-view-link`** | **Static (025)** | **"View RGD →" navigation affordance** |

---

## New design tokens

To be added to `web/src/tokens.css` in both `:root` (dark) and `[data-theme="light"]`:

### Dark mode values

```css
/* ── RGD static chaining tokens (spec 025) ──────────────────────────── */
--color-chain:              #0ea5e9;   /* Teal/sky — 5.9:1 on --color-bg */
--color-chain-hover:        #0284c7;   /* Darker teal for hover */
--color-chain-muted:        rgba(14, 165, 233, 0.12);  /* Low-opacity tint */
--color-chain-border:       rgba(14, 165, 233, 0.40);  /* Ring border */
--color-chain-text:         #7dd3fc;   /* Readable teal text on dark bg */

/* Static subgraph container */
--node-chain-subgraph-bg:   rgba(14, 165, 233, 0.04);  /* Very subtle tint */
--node-chain-subgraph-border: rgba(14, 165, 233, 0.25); /* Teal tint border */
```

### Light mode values

```css
/* ── RGD static chaining tokens (spec 025) ──────────────────────────── */
--color-chain:              #0284c7;   /* Darker teal for light bg */
--color-chain-hover:        #0369a1;
--color-chain-muted:        rgba(2, 132, 199, 0.08);
--color-chain-border:       rgba(2, 132, 199, 0.35);
--color-chain-text:         #0284c7;

/* Static subgraph container */
--node-chain-subgraph-bg:   rgba(2, 132, 199, 0.03);
--node-chain-subgraph-border: rgba(2, 132, 199, 0.20);
```

---

## State transitions for expand/collapse

```
ChainableNode state machine:
  collapsed ──[click ▸]──→ expanded
  expanded  ──[click ▾]──→ collapsed

  At depth >= 4:
  [any state] → renders MaxDepthIndicator (no toggle)

  If target RGD in ancestorSet:
  [any state] → renders CycleIndicator (no ▸, but "View RGD →" still shown)
```

---

## Breadcrumb state shape

Passed via React Router `location.state`:

```typescript
interface RGDDetailLocationState {
  /** Name of the RGD that the user navigated from (for breadcrumb). */
  from?: string
}
```

Consumed in `RGDDetail` on mount:
```typescript
const location = useLocation()
const fromRgd = (location.state as RGDDetailLocationState | null)?.from
```

Rendered only when `fromRgd` is a non-empty string.

---

## File change summary

| File | Change type | Notes |
|---|---|---|
| `web/src/tokens.css` | Extend | Add 7 new `--color-chain-*` / `--node-chain-*` tokens |
| `web/src/lib/dag.ts` | Extend | Add `isChainable`, `chainedRgdName` to `DAGNode`; add `findChainedRgdName()`, `buildChainSubgraph()`; extend `buildDAGGraph()` with optional `rgds` param |
| `web/src/lib/dag.test.ts` | Extend | New test cases for chain detection and subgraph building |
| `web/src/components/StaticChainDAG.tsx` | **New** | Static DAG renderer with expand/nav affordances |
| `web/src/components/StaticChainDAG.css` | **New** | `.node-chainable`, `.static-chain-*` styles, subgraph container styles |
| `web/src/components/StaticChainDAG.test.tsx` | **New** | Unit tests for chainable rendering, cycle detection, depth cap |
| `web/src/pages/RGDDetail.tsx` | Extend | Fetch `listRGDs()`, pass to `buildDAGGraph()`, swap `<DAGGraph>` for `<StaticChainDAG>` on graph tab; add breadcrumb from router state |
| `web/src/pages/RGDDetail.css` | Extend | Breadcrumb styles |
