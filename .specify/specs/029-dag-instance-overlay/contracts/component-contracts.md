# Component Contracts: 029-dag-instance-overlay

This feature is purely frontend. The only external interfaces are React
component prop contracts and the shared `dag.ts` API.

---

## Contract 1 — `StaticChainDAG` prop `nodeStateMap`

**File**: `web/src/components/StaticChainDAG.tsx`

```typescript
interface StaticChainDAGProps {
  // ... all existing props unchanged ...

  /**
   * nodeStateMap — optional live instance overlay data.
   *
   * CONTRACT:
   *   - Type: NodeStateMap from @/lib/instanceNodeState
   *   - undefined (default): no overlay; nodes render with base static styles
   *   - Provided: nodes receive live-state CSS class via liveStateClass(state)
   *   - State nodes (nodeType 'state') are never overlaid regardless of this value
   *   - The overlay does not affect: node positions, sizes, edges, labels,
   *     badges, chain expand affordances, or NodeDetailPanel content
   *
   * CALLER:
   *   - RGDDetail.tsx passes overlayNodeStateMap when an instance is selected
   *   - Recursive nested renders (expanded chain nodes) do NOT receive this prop —
   *     the overlay only applies to the top-level RGD graph, not chained subgraphs
   */
  nodeStateMap?: NodeStateMap
}
```

---

## Contract 2 — `InstanceOverlayBar` component

**File**: `web/src/components/InstanceOverlayBar.tsx`

```typescript
interface InstanceOverlayBarProps {
  /**
   * rgdName — name of the current RGD.
   * CONTRACT: used to construct the "Open instance →" link URL:
   *   /rgds/{rgdName}/instances/{namespace}/{name}
   * Must be a non-empty string.
   */
  rgdName: string

  /**
   * items — instances available for overlay selection.
   * CONTRACT:
   *   - Empty array: component renders "No instances" message; picker is hidden
   *   - Each item.namespace may be empty string (cluster-scoped CR)
   *   - Each item.name must be non-empty
   *   - Display format: namespace ? "${ns}/${name}" : "${name}"
   *   - Value format (select option value): "${ns}/${name}" (ns may be "")
   */
  items: PickerItem[]

  /** True while the picker item list is being fetched. */
  pickerLoading: boolean

  /**
   * pickerError — non-null when picker fetch failed.
   * CONTRACT: shown as inline error with Retry button. Graph is unaffected.
   */
  pickerError: string | null

  /**
   * selected — the currently active overlay key or null.
   * CONTRACT: format "<namespace>/<name>" where namespace may be empty string
   * (yielding "/<name>"). null = "No overlay" option is selected.
   * Controlled value: component does not maintain internal selection state.
   */
  selected: string | null

  /**
   * overlayInstance — the raw K8sObject for the selected instance.
   * CONTRACT:
   *   - null when nothing is selected, still loading, or fetch failed
   *   - Used only for the summary bar readiness badge
   *   - Readiness derived from status.conditions:
   *     - Progressing=True → "Reconciling" (amber)
   *     - Ready=False → "Error" (red)
   *     - Ready=True → "Ready" (green)
   *     - absent/unknown → "Unknown" (gray)
   */
  overlayInstance: K8sObject | null

  /** True while the overlay instance + children fetch is in-flight. */
  overlayLoading: boolean

  /**
   * overlayError — non-null when overlay data fetch failed.
   * CONTRACT: shown as inline error with Retry. Picker remains active.
   * Overlay is cleared (nodeStateMap reverts to undefined) on error.
   */
  overlayError: string | null

  /**
   * onSelect — called when user changes picker selection.
   * CONTRACT:
   *   - null → user selected "No overlay"; clear overlay state
   *   - string → "<ns>/<name>"; trigger overlay fetch in RGDDetail
   */
  onSelect: (key: string | null) => void

  /** Called when user clicks Retry on picker fetch error. */
  onPickerRetry: () => void

  /** Called when user clicks Retry on overlay data fetch error. */
  onOverlayRetry: () => void
}
```

---

## Contract 3 — `DAGTooltip` extended prop `nodeState`

**File**: `web/src/components/DAGTooltip.tsx`

```typescript
interface DAGTooltipProps {
  node: DAGNode | null
  anchorX: number
  anchorY: number
  nodeWidth: number
  nodeHeight: number

  /**
   * nodeState — optional live state for the hovered node.
   * CONTRACT:
   *   - undefined (default): no state line is rendered in the tooltip
   *   - Provided: a "State: <label>" line appears below the kind/type header,
   *     styled with .dag-tooltip__state--{alive|reconciling|error|notfound}
   *   - The tooltip still only renders at all if node has readyWhen or includeWhen
   *     expressions, OR if nodeState is provided (relaxed gate when overlay active)
   *   - State labels: alive→"Alive", reconciling→"Reconciling",
   *     error→"Error", not-found→"Not found"
   */
  nodeState?: NodeLiveState
}
```

**Behavior change**: When `nodeState` is provided, the tooltip renders even if
`readyWhen` and `includeWhen` are both empty. This ensures every node gets a
hover summary when the overlay is active (showing at minimum: id, kind, type,
state).

---

## Contract 4 — `nodeStateForNode()` in `dag.ts`

**File**: `web/src/lib/dag.ts`

```typescript
/**
 * nodeStateForNode — derives the live state for a single DAG node.
 *
 * CONTRACT:
 *   - For nodeType === 'instance': returns aggregate state over all stateMap values
 *     (reconciling > error > alive > undefined)
 *   - For all other nodeTypes: returns stateMap[node.kind.toLowerCase()]?.state
 *     falling back to stateMap[node.label.toLowerCase()]?.state
 *   - Returns undefined when no matching entry exists (node not in children)
 *   - Callers interpret undefined as 'not-found' only when a nodeStateMap is
 *     actively provided; when no overlay is active, undefined means no class
 *
 * REPLACES: inline `nodeState()` in LiveDAG.tsx:42-61 and DeepDAG.tsx:71-81
 * CONSUMERS: StaticChainDAG.tsx, LiveDAG.tsx, DeepDAG.tsx
 */
export function nodeStateForNode(
  node: DAGNode,
  stateMap: NodeStateMap,
): NodeLiveState | undefined
```

---

## Contract 5 — Overlay render gate for `DAGTooltip`

The existing guard at `DAGTooltip.tsx:125`:
```typescript
if (readyWhenExprs.length === 0 && includeWhenExprs.length === 0) return null
```

Must be relaxed to:
```typescript
if (readyWhenExprs.length === 0 && includeWhenExprs.length === 0 && !nodeState) return null
```

This ensures the tooltip appears for all nodes when overlay is active, even
nodes with no CEL expressions. Callers that don't pass `nodeState` see no
change in behavior.
