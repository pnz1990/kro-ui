# Data Model: 029-dag-instance-overlay

## Overview

This feature is purely frontend — no new backend entities. The data model
describes the React state shape for the overlay, the new prop contracts for
modified components, and the new component's own props.

---

## 1. `RGDDetail` state additions

New state variables added to `web/src/pages/RGDDetail.tsx`:

```typescript
// ── Instance overlay picker state ─────────────────────────────────────────

/** Items for the overlay picker (fetched once when Graph tab activates). */
const [pickerItems, setPickerItems] = useState<PickerItem[]>([])

/** True while initial picker item fetch is in-flight. */
const [pickerLoading, setPickerLoading] = useState(false)

/** Non-null when the picker item fetch failed. Non-blocking — graph still shows. */
const [pickerError, setPickerError] = useState<string | null>(null)

// ── Instance overlay data state ───────────────────────────────────────────

/**
 * The currently selected overlay instance, encoded as "<namespace>/<name>".
 * null = no overlay selected ("No overlay" option).
 */
const [overlayKey, setOverlayKey] = useState<string | null>(null)

/** The raw instance K8sObject fetched for the selected overlay key. */
const [overlayInstance, setOverlayInstance] = useState<K8sObject | null>(null)

/** NodeStateMap produced by buildNodeStateMap for the selected overlay. */
const [overlayNodeStateMap, setOverlayNodeStateMap] = useState<NodeStateMap | null>(null)

/** True while overlay instance + children fetch is in-flight. */
const [overlayLoading, setOverlayLoading] = useState(false)

/** Non-null when the overlay data fetch failed. Non-blocking. */
const [overlayError, setOverlayError] = useState<string | null>(null)
```

### `PickerItem` type

Defined locally in `RGDDetail.tsx` (or in `InstanceOverlayBar.tsx` and
re-exported):

```typescript
export interface PickerItem {
  namespace: string
  name: string
}
```

Derived from `K8sList.items` in the picker fetch:
```typescript
items.map((item) => {
  const meta = item.metadata as Record<string, unknown> | undefined
  return {
    namespace: typeof meta?.namespace === 'string' ? meta.namespace : '',
    name: typeof meta?.name === 'string' ? meta.name : '',
  }
})
```

---

## 2. `StaticChainDAGProps` additions

```typescript
// web/src/components/StaticChainDAG.tsx

export interface StaticChainDAGProps {
  // ... existing props unchanged ...

  /**
   * Optional live instance overlay.
   * When provided, nodes receive live-state CSS classes
   * (dag-node-live--alive, dag-node-live--reconciling, etc.).
   * When undefined, nodes render with their base static styles.
   */
  nodeStateMap?: NodeStateMap
}
```

---

## 3. `nodeBaseClass()` extended signature

```typescript
// web/src/components/StaticChainDAG.tsx:83–89 (modified)

function nodeBaseClass(
  node: DAGNode,
  isSelected: boolean,
  liveState?: NodeLiveState,   // ← new optional param
  nodeStateMap?: NodeStateMap, // ← needed for the overlay-active guard
): string {
  const parts = [`dag-node dag-node--${node.nodeType}`]
  if (node.isConditional) parts.push('node-conditional')
  if (node.isChainable) parts.push('node-chainable')
  // ⚠️ MUST use overlay-active guard, NOT a liveState truthy guard.
  // liveStateClass(undefined) → 'dag-node-live--notfound', which is correct
  // for nodes absent from children. The truthy guard `if (liveState)` silently
  // drops not-found nodes (GH #165 Bug 1).
  if (nodeStateMap && node.nodeType !== 'state') {
    parts.push(liveStateClass(liveState))
  }
  if (isSelected) parts.push('dag-node--selected')
  return parts.join(' ')
}
```

**Note**: An alternative (and cleaner) approach is to resolve the liveState
upstream and pass the computed class string rather than threading `nodeStateMap`
into `nodeBaseClass`. The critical invariant is: when `nodeStateMap` is provided
and `node.nodeType !== 'state'`, `liveStateClass(liveState)` MUST always be
called — even when `liveState` is `undefined`.

---

## 4. `InstanceOverlayBar` props

```typescript
// web/src/components/InstanceOverlayBar.tsx

export interface InstanceOverlayBarProps {
  /** The name of the current RGD — used to build the "Open instance →" link. */
  rgdName: string

  /** Available instances to select. Empty array = show "no instances" message. */
  items: PickerItem[]

  /** True while the picker item list is loading. */
  pickerLoading: boolean

  /** Non-null when picker item fetch failed. */
  pickerError: string | null

  /** Currently selected overlay key "<namespace>/<name>", or null for "No overlay". */
  selected: string | null

  /** Raw instance K8sObject for the selected overlay — used for the summary bar. */
  overlayInstance: K8sObject | null

  /** True while overlay data (instance + children) is being fetched. */
  overlayLoading: boolean

  /** Non-null when overlay data fetch failed. */
  overlayError: string | null

  /**
   * Called when the user changes the picker selection.
   * null means "No overlay" was selected.
   */
  onSelect: (key: string | null) => void

  /** Called when the user clicks "Retry" on a picker fetch error. */
  onPickerRetry: () => void

  /** Called when the user clicks "Retry" on an overlay data fetch error. */
  onOverlayRetry: () => void
}
```

---

## 5. `DAGTooltipProps` extension

```typescript
// web/src/components/DAGTooltip.tsx

export interface DAGTooltipProps {
  node: DAGNode | null
  anchorX: number
  anchorY: number
  nodeWidth: number
  nodeHeight: number
  /** Optional live state — when provided, tooltip shows a State line. */
  nodeState?: NodeLiveState    // ← new optional prop
}
```

---

## 6. New shared helper in `dag.ts`

```typescript
// web/src/lib/dag.ts — new export

/**
 * nodeStateForNode — derives the live state for a single DAG node
 * from a NodeStateMap.
 *
 * Rules:
 *  - Root CR (nodeType 'instance'): aggregate over all entries in stateMap.
 *    reconciling > error > alive > undefined.
 *  - All other nodes: lookup by lowercase kind (node.kind || node.label).
 *
 * Extracted from LiveDAG.tsx and DeepDAG.tsx to prevent divergence.
 * See constitution §IX: shared graph helpers must live in @/lib/dag.ts.
 */
export function nodeStateForNode(
  node: DAGNode,
  stateMap: NodeStateMap,
): NodeLiveState | undefined {
  if (node.nodeType === 'instance') {
    const states = Object.values(stateMap).map((e) => e.state)
    if (states.includes('reconciling')) return 'reconciling'
    if (states.includes('error')) return 'error'
    if (states.length > 0) return 'alive'
    return undefined
  }
  const kindKey = (node.kind || node.label).toLowerCase()
  return stateMap[kindKey]?.state
}
```

---

## 7. Overlay state transitions

```
                    ┌─────────────────────────────────────┐
                    │         Graph tab active             │
                    │                                      │
                    ▼                                      │
               [pickerLoading]                             │
                    │                                      │
         ┌──────────┴──────────┐                          │
         ▼                     ▼                          │
    [pickerError]       [pickerItems ready]               │
         │                     │                          │
    [Retry] ──────────►  [No overlay selected]            │
                               │                          │
                   user picks instance                    │
                               │                          │
                               ▼                          │
                        [overlayLoading]                  │
                               │                          │
                  ┌────────────┴──────────┐               │
                  ▼                       ▼               │
           [overlayError]     [nodeStateMap ready]        │
                  │                       │               │
             [Retry] ──────► [DAG with live colors]       │
                                          │               │
                               user selects "No overlay"  │
                                          │               │
                                          └───────────────┘
```

---

## 8. Validation rules

| Rule | Enforcement |
|------|-------------|
| `PickerItem.namespace` may be empty string for cluster-scoped resources | Render as just `<name>` in picker option, not `/<name>` |
| `overlayKey` format is always `<ns>/<name>` | Parse by first `/` split to extract namespace/name for API calls |
| `nodeStateMap` for `'state'` nodeType — state nodes are never overlaid | `nodeStateForNode` skips them; `nodeBaseClass` guard: `nodeStateMap && node.nodeType !== 'state'` |
| When overlay active, ALL non-state nodes must receive a live-state CSS class | `nodeBaseClass` MUST call `liveStateClass(liveState)` unconditionally (not guarded by `if (liveState)`); `liveStateClass(undefined)` → `'dag-node-live--notfound'` |
| `buildNodeStateMap` must cover all RGD nodes, not just observed children | Pass `rgdNodes: DAGNode[]` as third arg; pre-enumerate and emit `'not-found'` for absent kinds |

---

## 9. `buildNodeStateMap` updated signature

```typescript
// web/src/lib/instanceNodeState.ts

/**
 * Builds a NodeStateMap for the overlay from a live instance and its children.
 *
 * CHANGED (GH #165): added `rgdNodes` third parameter.
 * Pre-enumerates all non-state RGD nodes and emits explicit 'not-found' entries
 * for nodes absent from the children list. This guarantees every non-state node
 * receives a live-state CSS class when the overlay is active.
 */
export function buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
  rgdNodes: DAGNode[],  // ← NEW — all nodes from the parsed DAG graph
): NodeStateMap {
  const result: NodeStateMap = {}

  // 1. Root CR entry
  const conditions = (instance.status?.conditions ?? []) as Array<{
    type: string; status: string
  }>
  const progressing = conditions.find((c) => c.type === 'Progressing')
  const ready = conditions.find((c) => c.type === 'Ready')
  let rootState: NodeLiveState = 'alive'
  if (progressing?.status === 'True') rootState = 'reconciling'
  else if (ready?.status === 'False') rootState = 'error'
  result['schema'] = { state: rootState }

  // 2. Build presence map from children
  const presenceMap = new Map<string, NodeLiveState>()
  for (const child of children) {
    const kind = child.kind
      ?? (child.metadata?.labels?.['kro.run/resource-id'])
    if (!kind) continue
    const key = kind.toLowerCase()
    const state: NodeLiveState =
      child.metadata?.deletionTimestamp ? 'reconciling' : 'alive'
    if (!presenceMap.has(key)) presenceMap.set(key, state)
  }

  // 3. Enumerate every non-state, non-instance RGD node
  for (const node of rgdNodes) {
    if (node.nodeType === 'instance' || node.nodeType === 'state') continue
    const kindKey = (node.kind || node.label).toLowerCase()
    result[kindKey] = { state: presenceMap.get(kindKey) ?? 'not-found' }
  }

  return result
}
```

**Call site** (in `RGDDetail.tsx`) must be updated:
```typescript
// Before:
setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? []))

// After:
setOverlayNodeStateMap(buildNodeStateMap(instance, childrenRes.items ?? [], dagGraph?.nodes ?? []))
```
