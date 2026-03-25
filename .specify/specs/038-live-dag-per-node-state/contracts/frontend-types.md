# Frontend Type Contracts: 038-live-dag-per-node-state

This document defines the updated TypeScript contracts for the live per-node
state feature. These types are the interface boundary between the state
derivation layer (`instanceNodeState.ts`) and the rendering layer
(`LiveDAG.tsx`, `DeepDAG.tsx`, `DAGTooltip.tsx`).

---

## `NodeLiveState` (extended)

**File**: `web/src/lib/instanceNodeState.ts`
**Exported**: yes (used by `dag.ts`, `LiveDAG.tsx`, `DeepDAG.tsx`, `DAGTooltip.tsx`)

```typescript
/**
 * Live state for a single DAG node.
 *
 * | State       | Condition                                              |
 * |-------------|--------------------------------------------------------|
 * | alive       | Child resource present, no error conditions            |
 * | reconciling | Child/CR has Progressing=True condition                |
 * | error       | Child/CR has Ready=False/Available=False, or terminating |
 * | pending     | Node has includeWhen expr(s) and is absent (excluded)  |
 * | not-found   | Node absent from children, no includeWhen expressions  |
 */
export type NodeLiveState =
  | 'alive'
  | 'reconciling'
  | 'error'
  | 'pending'       // NEW in 038
  | 'not-found'
```

---

## `NodeStateEntry` (unchanged shape)

**File**: `web/src/lib/instanceNodeState.ts`
**Exported**: yes

```typescript
export interface NodeStateEntry {
  /** Derived live state. 'pending' is new in spec 038. */
  state: NodeLiveState
  kind: string
  name: string
  namespace: string
  group: string
  version: string
  terminating?: boolean
  finalizers?: string[]
  deletionTimestamp?: string
}
```

---

## `buildNodeStateMap()` (signature unchanged)

**File**: `web/src/lib/instanceNodeState.ts`
**Exported**: yes

```typescript
/**
 * Derives a NodeStateMap from live instance data.
 *
 * Per-node state is computed individually for each child when the global
 * state is 'alive'. When the CR itself is 'reconciling' or 'error', the
 * global state applies uniformly to all present children.
 *
 * Absent nodes receive 'pending' if they have includeWhen expressions,
 * 'not-found' otherwise.
 */
export function buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
  rgdNodes: DAGNode[],
): NodeStateMap
```

Signature is **unchanged** — callers (`InstanceDetail.tsx`) require no updates.

---

## `liveStateClass()` (extended)

**File**: `web/src/lib/dag.ts`
**Exported**: yes

```typescript
/**
 * Maps a live node state to its CSS modifier class string.
 * Returns 'dag-node-live--notfound' for undefined (node not yet matched).
 */
export function liveStateClass(state: NodeLiveState | undefined): string
// 'pending' → 'dag-node-live--pending'  (new in 038)
```

---

## `DAGTooltipProps` (nodeState wired at call sites)

**File**: `web/src/components/DAGTooltip.tsx`
**Already exported**: yes

The `nodeState?: NodeLiveState` prop already exists. The only contract change
is at the call sites:

### `LiveDAG.tsx` — before
```tsx
<DAGTooltip
  node={hoveredTooltip?.node ?? null}
  anchorX={hoveredTooltip?.anchorX ?? 0}
  anchorY={hoveredTooltip?.anchorY ?? 0}
  nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
  nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
/>
```

### `LiveDAG.tsx` — after (038)
```tsx
<DAGTooltip
  node={hoveredTooltip?.node ?? null}
  anchorX={hoveredTooltip?.anchorX ?? 0}
  anchorY={hoveredTooltip?.anchorY ?? 0}
  nodeWidth={hoveredTooltip?.nodeWidth ?? 0}
  nodeHeight={hoveredTooltip?.nodeHeight ?? 0}
  nodeState={
    hoveredTooltip?.node
      ? nodeStateForNode(hoveredTooltip.node, nodeStateMap)
      : undefined
  }
/>
```

Same fix applies to `DeepDAG.tsx`.

---

## CSS Class Contract

| `NodeLiveState` value | CSS class applied | CSS rule file |
|-----------------------|--------------------|---------------|
| `'alive'` | `dag-node-live--alive` | `LiveDAG.css` (existing) |
| `'reconciling'` | `dag-node-live--reconciling` | `LiveDAG.css` (existing) |
| `'error'` | `dag-node-live--error` | `LiveDAG.css` (existing) |
| `'pending'` | `dag-node-live--pending` | `LiveDAG.css` (**NEW**) |
| `'not-found'` | `dag-node-live--notfound` | `LiveDAG.css` (existing) |
| `undefined` | `dag-node-live--notfound` | `LiveDAG.css` (existing fallback) |

---

## Tooltip State Label Contract

| `NodeLiveState` value | Tooltip label | CSS class |
|-----------------------|---------------|-----------|
| `'alive'` | `Alive` | `dag-tooltip__state--alive` (existing) |
| `'reconciling'` | `Reconciling` | `dag-tooltip__state--reconciling` (existing) |
| `'error'` | `Error` | `dag-tooltip__state--error` (existing) |
| `'pending'` | `Pending` | `dag-tooltip__state--pending` (**NEW**) |
| `'not-found'` | `Not found` | `dag-tooltip__state--notfound` (existing) |
