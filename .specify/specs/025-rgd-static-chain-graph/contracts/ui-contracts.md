# UI Component Contracts: RGD Static Chaining Graph

**Feature**: `025-rgd-static-chain-graph`
**Phase**: 1 — Design
**Date**: 2026-03-22

This file defines the public surface of new and modified components as the
contract between implementation and consumers. It also documents the test-id
conventions used in E2E journeys.

---

## `dag.ts` — Extended exports

### `findChainedRgdName(kind, rgds): string | undefined`

```typescript
/**
 * Returns the metadata.name of the RGD whose spec.schema.kind === kind.
 * Returns undefined if no match or kind is empty.
 *
 * Pure function — no side effects.
 */
export function findChainedRgdName(kind: string, rgds: K8sObject[]): string | undefined
```

**Contract**:
- Returns `undefined` for empty `kind`
- Returns `undefined` when `rgds` is empty
- Returns the RGD name (string) when exactly one RGD matches
- Returns the first match when multiple RGDs share the same schema kind (defensive)
- Never throws

---

### `buildChainSubgraph(rgdName, rgds): DAGGraph | null`

```typescript
/**
 * Builds a DAGGraph for a chained RGD by name.
 * Passes rgds back into buildDAGGraph so nested chains are also detected.
 * Returns null when the named RGD is not found in rgds.
 *
 * Pure function — no side effects.
 */
export function buildChainSubgraph(rgdName: string, rgds: K8sObject[]): DAGGraph | null
```

**Contract**:
- Returns `null` (not throws) when `rgdName` not found
- Returns a valid `DAGGraph` with `nodes[0].nodeType === 'instance'` when found
- Chain detection is applied recursively (chained nodes within the subgraph also have `isChainable=true`)

---

### `buildDAGGraph(spec, rgds?)` — extended signature

```typescript
export function buildDAGGraph(
  spec: Record<string, unknown>,
  rgds?: K8sObject[],
): DAGGraph
```

**Contract**:
- When `rgds` is omitted or empty: all `DAGNode.isChainable` are `false` (backward compat)
- When `rgds` is provided: the root node (`nodeType === 'instance'`) always has `isChainable=false`
- For each non-root node: `isChainable === true` iff `findChainedRgdName(node.kind, rgds)` returns a string

---

## `StaticChainDAG` component

**File**: `web/src/components/StaticChainDAG.tsx`

### Props

```typescript
export interface StaticChainDAGProps {
  graph: DAGGraph
  rgds: K8sObject[]
  onNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
  ancestorSet?: ReadonlySet<string>
  depth?: number
  rgdName: string
}
```

### Test IDs

| `data-testid` | Element | Present when |
|---|---|---|
| `dag-svg` | The SVG element | Always |
| `dag-node-{id}` | Each node group `<g>` | Always, one per node |
| `static-chain-toggle-{id}` | Expand/collapse toggle | Node is chainable AND depth < 4 |
| `static-chain-link-{id}` | "View RGD →" link | Node is chainable |
| `static-chain-nested-{id}` | Nested subgraph foreignObject | Node is expanded |
| `static-chain-cycle-{id}` | Cycle indicator | Cycle detected for this node |
| `static-chain-maxdepth-{id}` | Max depth indicator | Chainable node at depth >= 4 |

### Behavior contracts

1. **Chainable node identification**: A node with `isChainable=true` receives CSS class `node-chainable` in addition to its base class. Non-chainable nodes are NOT affected.
2. **Expand toggle**: The `▸`/`▾` toggle is rendered with `data-testid="static-chain-toggle-{id}"` and class `static-chain-expand-toggle`. It uses `--color-chain-text` fill, NOT `--color-text-muted` (used by spec 012's `.deep-dag-expand-toggle`).
3. **View RGD link**: Renders `data-testid="static-chain-link-{id}"` with text "View RGD →", navigates to `/rgds/{chainedRgdName}` with router state `{ from: rgdName }`.
4. **Nested subgraph**: Rendered inside a `foreignObject` with `.static-chain-nested-container` class, using `--node-chain-subgraph-bg` and `--node-chain-subgraph-border`.
5. **Cycle detection**: When `node.chainedRgdName` is in `ancestorSet`, render `data-testid="static-chain-cycle-{id}"` — no expand toggle, "View RGD →" is still present.
6. **Max depth**: When `depth >= 4`, render `data-testid="static-chain-maxdepth-{id}"` — no expand toggle, no "View RGD →".
7. **Node click**: Non-toggle clicks on the node body call `onNodeClick(node)` (same as `DAGGraph` and `DeepDAG`).

---

## `RGDDetail` page — updated contracts

### New state

```typescript
// RGDs list for chain detection (fetched once on graph tab mount)
const [rgds, setRgds] = useState<K8sObject[]>([])
```

### Breadcrumb rendering

```typescript
// If location.state.from is present, render breadcrumb
const fromRgd = (location.state as { from?: string } | null)?.from
// Rendered as: ← {fromRgd}  (link to /rgds/{fromRgd})
```

**Test IDs**:

| `data-testid` | Element | Present when |
|---|---|---|
| `rgd-breadcrumb` | Breadcrumb container | `location.state.from` is set |
| `rgd-breadcrumb-link` | Back link | Same |

---

## Visual distinction matrix

This matrix must be validated during PR review:

| Affordance | Component/Class | Fill token | Shape/text |
|---|---|---|---|
| Live expand (spec 012) | `.deep-dag-expand-toggle` | `--color-text-muted` | `▸`/`▾` |
| Static expand (this spec) | `.static-chain-expand-toggle` | `--color-chain-text` | `▸`/`▾` |
| Chain ring indicator | `.node-chainable` | `--color-chain-border` on border | Ring/glow |
| View RGD link | `.static-chain-view-link` | `--color-primary` | "View RGD →" text |
| Cycle indicator | `.static-chain-cycle-indicator` | `--color-status-warning` | "⊗ Cycle" text |
| Max depth indicator | `.static-chain-maxdepth` | `--color-text-faint` | "⋯ Max depth" text |
