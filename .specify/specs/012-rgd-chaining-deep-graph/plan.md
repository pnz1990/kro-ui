# Implementation Plan: RGD Chaining — Deep Graph Visualization

**Spec**: `012-rgd-chaining-deep-graph`
**Branch**: `012-rgd-chaining-deep-graph`
**Depends on**: `005-instance-detail-live` (merged), `011-collection-explorer` (merged)

---

## Tech Stack

- **Frontend only** — pure TypeScript/React, no backend changes required
- React 19 + Vite + TypeScript (strict)
- Plain CSS using `tokens.css` custom properties
- Vitest for unit tests
- All existing patterns from `005-instance-detail-live` and `011-collection-explorer`

---

## Architecture

### Detection Flow

```
InstanceDetail
  └── fetches listRGDs() once at mount
  └── builds kindToRGDName Map via detectKroInstance lookup
  └── passes rgds[] + kindMap → DeepDAG
        └── for each node: detectKroInstance(node.kind, rgds)
              → true  → node renders with ▸ expand icon (ExpandableNode)
              → false → node renders normally
```

### Expansion Flow

```
DeepDAG
  └── expandedNodes: Map<nodeId, { childGraph, childStateMap, childChildren }>
        ↓ on toggle click
  └── fetchChildInstance(node) → getInstance + getInstanceChildren
        → builds DAGGraph from child RGD spec
        → builds NodeStateMap from child instance + children
        → stores in expandedNodes (survives poll — FR-007)
  └── renders LiveDAG normally for top-level
  └── for expanded nodes: renders ExpandableNode which contains nested LiveDAG
```

### Component Structure

```
DeepDAG.tsx          — top-level wrapper; holds expansion state; wraps LiveDAG
ExpandableNode.tsx   — SVG foreignObject container for a nested subgraph
DeepDAG.css          — expand toggle styles + nested container styles
```

### Key Design Decisions

1. **No new backend API** — reuses `getInstance` + `getInstanceChildren` + `getRGD` + `listRGDs`
2. **Expansion state in DeepDAG** — `useRef` map survives re-renders; `useState` triggers re-renders
3. **Expansion state persists across polls** — DeepDAG holds `expandedNodes` as state; poll refreshes
   only update the child's `nodeStateMap` if already expanded (not collapse it)
4. **DeepDAG renders an SVG overlay** — expanded nodes get a `foreignObject` containing a nested
   HTML+SVG subgraph; this avoids breaking the SVG coordinate system
5. **Max depth = 4** — passed as prop, decremented on each recursive DeepDAG render
6. **RGD list fetched once** — loaded at InstanceDetail mount alongside the RGD spec; passed down
7. **Detection**: pure function `detectKroInstance(kind, rgds)` added to `dag.ts`

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `web/src/components/DeepDAG.tsx` | Deep graph wrapper with recursive expansion |
| `web/src/components/ExpandableNode.tsx` | SVG node with expand toggle + nested subgraph |
| `web/src/components/DeepDAG.css` | Styles for deep graph container + expand toggle |
| `web/src/components/DeepDAG.test.tsx` | Vitest unit tests for DeepDAG |

### Modified Files

| File | Change |
|------|--------|
| `web/src/lib/dag.ts` | Add `detectKroInstance()` pure function |
| `web/src/lib/dag.test.ts` | Add `describe("detectKroInstance")` tests |
| `web/src/pages/InstanceDetail.tsx` | Swap `LiveDAG` → `DeepDAG`; fetch + pass `rgds` list |

---

## Component API

### `detectKroInstance(kind: string, rgds: K8sObject[]): boolean`

Pure function. Returns `true` when the given `kind` matches any RGD's `spec.schema.kind`.

```typescript
// In dag.ts:
export function detectKroInstance(kind: string, rgds: K8sObject[]): boolean
```

### `DeepDAG`

```typescript
interface DeepDAGProps {
  graph: DAGGraph
  nodeStateMap: NodeStateMap
  onNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
  children?: K8sObject[]        // instance children for CollectionBadge
  rgds: K8sObject[]             // all RGDs for chaining detection
  namespace: string             // instance namespace (for child fetches)
  depth?: number                // current recursion depth (default 0, max 4)
}
```

### `ExpandableNode`

```typescript
interface ExpandableNodeProps {
  node: DAGNode
  isExpanded: boolean
  onToggle: () => void
  // When expanded, the nested subgraph data:
  childGraph?: DAGGraph
  childStateMap?: NodeStateMap
  childChildren?: K8sObject[]
  childLoading?: boolean
  childError?: string
  // For recursive nesting:
  rgds: K8sObject[]
  namespace: string
  depth: number
  onChildNodeClick?: (node: DAGNode) => void
  selectedNodeId?: string
  // Base node rendering props:
  state?: NodeLiveState
  isSelected: boolean
  onNodeClick?: (node: DAGNode) => void
}
```

---

## Styling Approach

Expanded node container:
- SVG `foreignObject` sized to contain the nested subgraph
- `border-radius: 8px`, `background: var(--color-surface-2)`, `border: 1px solid var(--color-border)`
- Subtle tint via `--deep-dag-nested-bg` token added inline (no new token — use existing `--color-surface-2`)

Expand toggle icon:
- Small SVG text element `▸` / `▾` in the top-right corner of the node rect
- CSS class `deep-dag-expand-toggle`
- Color: `var(--color-text-muted)` → `var(--color-primary)` on hover

Max depth indicator:
- Special node rendered as a `<text>` element inside the nested container
- Text: "Max depth" in `var(--color-text-muted)`

---

## Testing Plan

### Unit Tests (`dag.test.ts` additions)

```
T012: detectKroInstance returns true for matching RGD schema kind
T013: detectKroInstance returns false for native k8s kinds
T014: detectKroInstance returns false when rgds is empty
T015: detectKroInstance is case-sensitive (kro kinds are PascalCase)
```

### Unit Tests (`DeepDAG.test.tsx`)

```
T001: renders expand icon on kro-managed CRD nodes
T002: does NOT render expand icon on non-kro nodes
T003: renders nested subgraph on expand click
T004: caps recursion at 4 levels (depth >= 4 → no expand icon)
T005: collapses subgraph on toggle click
T006: expansion survives a simulated re-render (nodeStateMap change)
```

---

## Acceptance Criteria Mapping

| Criterion | Implementation |
|-----------|---------------|
| FR-001: detect kro nodes | `detectKroInstance` in `dag.ts` |
| FR-002: expand/collapse toggle | `▸`/`▾` in `ExpandableNode` |
| FR-003: fetch child instance | `getInstance` + `getInstanceChildren` in `DeepDAG` |
| FR-004: inline nested subgraph | `foreignObject` in SVG with tinted container |
| FR-005: live state colors | pass `childStateMap` to nested `LiveDAG` |
| FR-006: max depth 4 | `depth` prop decremented, no expand icon at depth >= 4 |
| FR-007: expansion survives poll | `expandedNodes` state in `DeepDAG` |
| NFR-002: strict TypeScript | all files must pass `tsc --noEmit` |
| NFR-003: no layout shift | nested subgraph grows parent node height via foreignObject |
