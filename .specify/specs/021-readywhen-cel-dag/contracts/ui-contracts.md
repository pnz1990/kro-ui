# UI Contracts: readyWhen CEL Expressions on DAG Nodes

**Branch**: `021-readywhen-cel-dag`
**Date**: 2026-03-22
**Phase**: 1 — Design

This document defines the component interface contracts for the new and modified
UI components introduced by this feature. "Interface" here means props, emitted
events, required CSS classes, and testable behavior guarantees — not internal
implementation details.

---

## `DAGTooltip` — New shared portal tooltip component

**File**: `web/src/components/DAGTooltip.tsx`
**Used by**: `DAGGraph`, `LiveDAG`, `DeepDAG`

### Props contract

```typescript
interface DAGTooltipProps {
  /** Node to display. Pass null to hide the tooltip. */
  node: DAGNode | null
  /** Viewport-relative X coordinate of the hovered node's left edge. */
  anchorX: number
  /** Viewport-relative Y coordinate of the hovered node's top edge. */
  anchorY: number
  /** Width of the hovered node rect, used for right-side anchor calculation. */
  nodeWidth: number
  /** Height of the hovered node rect, used for bottom-side anchor calculation. */
  nodeHeight: number
}
```

### Rendering contract

| Condition | Rendered output |
|-----------|----------------|
| `node === null` | Nothing (returns `null`) |
| `node.readyWhen.filter(s => s.trim() !== '').length === 0` | Nothing (returns `null`) — even if anchorX/Y are valid |
| `node` has valid readyWhen | Portal `<div>` appended to `document.body` |

### Required DOM structure (when visible)

```html
<div class="dag-tooltip [dag-tooltip--visible]" style="position: fixed; left: N; top: N; z-index: var(--z-tooltip)">
  <div class="dag-tooltip-header">
    <span class="dag-tooltip-node-id">{node.id}</span>
    <span class="dag-tooltip-node-kind">{node.kind}</span>         <!-- omitted if kind empty -->
    <span class="dag-tooltip-node-type">{nodeTypeLabel(node.nodeType)}</span>
  </div>
  <!-- includeWhen section — only if node.includeWhen.filter(…).length > 0 -->
  <div class="dag-tooltip-section">
    <div class="dag-tooltip-section-label">Include When</div>
    <KroCodeBlock code="includeWhen:\n  - {expr}" />
  </div>
  <!-- readyWhen section — only if non-empty expressions exist -->
  <div class="dag-tooltip-section">
    <div class="dag-tooltip-section-label">Ready When</div>
    <KroCodeBlock code="readyWhen:\n  - {expr}" />
  </div>
</div>
```

### Visibility / clamping contract

- On first render, the tooltip carries `opacity: 0` (hidden while measuring).
- After a `useEffect` call that measures via `getBoundingClientRect()`:
  - If right edge > `window.innerWidth - 8`: flip tooltip to left of anchor (subtract tooltip width).
  - If bottom edge > `window.innerHeight - 8`: flip tooltip above anchor (subtract tooltip height).
  - Add class `dag-tooltip--visible` → `opacity: 1`.
- The `8px` margin prevents pixel-perfect edge butting.

### Accessibility contract

- The tooltip `<div>` carries `role="tooltip"` and `id="dag-node-tooltip"`.
- The hovered `<g>` node in the SVG carries `aria-describedby="dag-node-tooltip"` while the tooltip is visible (to be removed on hide).

---

## `DAGGraph` — Modified hover behavior

**File**: `web/src/components/DAGGraph.tsx`

### Added behavior contract

The `NodeGroup` sub-component gains two new event handlers:

| Event | Handler behavior |
|-------|----------------|
| `onMouseEnter` | Compute node's viewport-relative bounding box from the parent SVG's `getBoundingClientRect()` plus `node.x / node.y`. Set `hoveredNode` state. |
| `onMouseLeave` | Clear `hoveredNode` state to `null`. |

`DAGGraph` renders exactly one `<DAGTooltip>` element after the `<svg>` element (sibling, inside `.dag-graph-container`), receiving the current `hoveredNode` state.

### `readyWhen` badge contract

Inside `NodeGroup`, when `node.hasReadyWhen === true`, render an additional SVG `<text>` element:

```
position: bottom-left of node rect
  x = node.x + 10
  y = node.y + node.height - 8
className: "dag-node-badge dag-node-badge--ready-when"
text: "⧖"  (or "rw" as fallback if the character renders poorly)
```

The badge must NOT appear when `node.hasReadyWhen === false`.

### `onNodeClick` contract — unchanged

`onNodeClick?: (nodeId: string) => void` — no change to existing click behavior.

---

## `LiveDAG` — Modified hover behavior

**File**: `web/src/components/LiveDAG.tsx`

Identical hover contract to `DAGGraph` above, with one difference:

- `onNodeClick` passes the full `DAGNode` object (not just the id): `onNodeClick?: (node: DAGNode) => void` — this is already the existing signature, no change.
- The `<DAGTooltip>` is rendered in exactly the same way as in `DAGGraph`.

### `readyWhen` badge contract

Identical to `DAGGraph`: add `dag-node-badge--ready-when` badge when `node.hasReadyWhen`.

---

## `DeepDAG` — Modified hover behavior

**File**: `web/src/components/DeepDAG.tsx`

Identical hover contract to `LiveDAG`. The standard-node render path (not the expandable-node path) gains `onMouseEnter`/`onMouseLeave` handlers. The expandable-node path (ExpandableNode component) also gains the handlers, forwarded down as props.

---

## `NodeDetailPanel` — Split CEL sections

**File**: `web/src/components/NodeDetailPanel.tsx`

### Section rendering contract (replaces merged `celCode` block)

The previous single `<Section label="CEL Expressions"><KroCodeBlock code={celCode} /></Section>` block is replaced with up to four independently conditional sections:

| Section label | Condition | Code passed to KroCodeBlock |
|--------------|-----------|----------------------------|
| `"Ready When"` | `node.readyWhen.filter(s => s.trim() !== '').length > 0` | `"readyWhen:\n  - {expr1}\n  - {expr2}"` |
| `"Include When"` | `node.includeWhen.filter(s => s.trim() !== '').length > 0` | `"includeWhen:\n  - {expr1}"` |
| `"forEach"` | `node.forEach !== undefined` | `"forEach: {expr}"` |
| `"Status Projections"` | `node.nodeType === 'instance' && entries.length > 0` | `"status:\n  key: val\n  …"` |

**Section order** (when multiple are present): Ready When → Include When → forEach → Status Projections.

**No section heading appears** when its condition is false (no empty section divs).

---

## `LiveNodeDetailPanel` — Split CEL sections

**File**: `web/src/components/LiveNodeDetailPanel.tsx`

Identical section contract to `NodeDetailPanel` above.

---

## Test contracts

### `DAGTooltip.test.tsx` (new)

| Test case | Assertion |
|-----------|-----------|
| `node = null` | Renders nothing, no portal in document.body |
| `node` with empty-only `readyWhen` | Renders nothing |
| `node` with valid `readyWhen` | Portal div in document.body; `.dag-tooltip-section-label` text is "Ready When" |
| `node` with `readyWhen` + `includeWhen` | Both section labels visible in correct order |
| Clamping: right overflow | `style.left` is adjusted leftward |
| Clamping: bottom overflow | `style.top` is adjusted upward |

### `NodeDetailPanel.test.tsx` (update)

| Test case | Assertion |
|-----------|-----------|
| Node with `readyWhen` only | Section with label "Ready When" visible; no "Include When" section |
| Node with `includeWhen` only | Section with label "Include When" visible; no "Ready When" section |
| Node with both | Both sections visible; "Ready When" appears before "Include When" |
| Node with neither | Neither section heading visible |

### `DAGGraph.test.tsx` (update)

| Test case | Assertion |
|-----------|-----------|
| Node with `hasReadyWhen = true` | `.dag-node-badge--ready-when` present in SVG |
| Node with `hasReadyWhen = false` | `.dag-node-badge--ready-when` absent |
| Mouse enter on `readyWhen` node | `#dag-node-tooltip` portal element appears in document.body |
| Mouse leave | Portal element removed or hidden |
