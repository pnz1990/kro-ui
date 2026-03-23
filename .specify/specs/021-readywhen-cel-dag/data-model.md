# Data Model: readyWhen CEL Expressions on DAG Nodes

**Branch**: `021-readywhen-cel-dag`
**Date**: 2026-03-22
**Phase**: 1 — Design

---

## Overview

This feature is purely a frontend concern. No new data entities are introduced.
The required data (`readyWhen: string[]`, `hasReadyWhen: boolean`) is already
present on the `DAGNode` interface in `web/src/lib/dag.ts`. This document
describes the existing data shape, the new UI state entities, and the CSS token
additions required.

---

## Existing Entities (no change required)

### `DAGNode` (`web/src/lib/dag.ts:23–51`)

The canonical data structure for a node in the dependency graph.
`readyWhen`-relevant fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique node identifier (e.g. `appNamespace`) |
| `label` | `string` | Display label — same as id for resource nodes |
| `nodeType` | `NodeType` | One of: `instance`, `resource`, `collection`, `external`, `externalCollection` |
| `kind` | `string` | Kubernetes Kind string (e.g. `Namespace`) |
| `hasReadyWhen` | `boolean` | True iff `readyWhen` is non-empty and has at least one non-empty string |
| `readyWhen` | `string[]` | CEL expressions that must evaluate to true for kro to consider the resource ready |
| `includeWhen` | `string[]` | CEL expressions controlling whether the resource is included (conditional modifier) |
| `isConditional` | `boolean` | True iff `includeWhen` is non-empty |
| `forEach` | `string \| undefined` | CEL expression for collection iteration |
| `celExpressions` | `string[]` | All CEL expressions extracted from the resource template body |

**Validation rules** (already enforced in `dag.ts`):
- `hasReadyWhen` is set to `readyWhen.length > 0` — exact mirror of the array.
- `asStringArray()` filters out non-string values before assignment.
- Empty strings in `readyWhen` are NOT currently filtered. This feature requires the tooltip and panel to also treat empty strings as absent (i.e. `node.readyWhen.filter(s => s.trim().length > 0)` before rendering).

---

## New UI State Entities

### `DAGTooltipState` (local component state — not exported)

Managed via `useState` inside each graph component (`DAGGraph`, `LiveDAG`, `DeepDAG`).

| Field | Type | Description |
|-------|------|-------------|
| `node` | `DAGNode \| null` | The currently hovered node; `null` = tooltip hidden |
| `anchorX` | `number` | Viewport-relative X coordinate of the hovered node's left edge |
| `anchorY` | `number` | Viewport-relative Y coordinate of the hovered node's top edge |
| `nodeWidth` | `number` | Width of the hovered node rect (for right-side anchoring) |
| `nodeHeight` | `number` | Height of the hovered node rect (for bottom-side anchoring) |

**State transitions**:
- `node = null` → tooltip hidden (default)
- `onMouseEnter` on a node with `hasReadyWhen` → set `node` + compute anchor from `getBoundingClientRect()` of the SVG element + node layout coordinates
- `onMouseLeave` on any node → set `node = null`
- Navigation away from the page → component unmounts, state discarded

**Filtering rule**: only set `node` if `node.readyWhen.filter(s => s.trim() !== '').length > 0`. Do not set `node` if only empty-string expressions exist.

---

### `DAGTooltip` component props (`web/src/components/DAGTooltip.tsx`)

| Prop | Type | Description |
|------|------|-------------|
| `node` | `DAGNode \| null` | Node to display; renders nothing if `null` |
| `anchorX` | `number` | Initial X position (viewport-relative, pixels) |
| `anchorY` | `number` | Initial Y position (viewport-relative, pixels) |
| `nodeWidth` | `number` | Used to compute right-side anchor offset |
| `nodeHeight` | `number` | Used to compute bottom-side anchor offset |

**Internal state** (managed inside `DAGTooltip`):
- `visible: boolean` — starts `false`, set `true` after clamping `useEffect` fires (prevents one-frame position-jump flash)
- `clampedLeft: number` — computed final left position after viewport clamping
- `clampedTop: number` — computed final top position after viewport clamping

**Rendering rule**: returns `null` if `node === null`. Rendered via `createPortal(…, document.body)`.

---

## CSS Token Additions (`web/src/tokens.css`)

New tokens to add in both `:root` (dark) and `[data-theme="light"]` (light) blocks:

| Token | Dark value | Light value | Usage |
|-------|-----------|------------|-------|
| `--shadow-tooltip` | `0 4px 16px rgba(0,0,0,0.45)` | `0 4px 12px rgba(0,0,0,0.15)` | `box-shadow` on `.dag-tooltip` |
| `--shadow-panel` | `-4px 0 16px rgba(0,0,0,0.3)` | `-4px 0 16px rgba(0,0,0,0.08)` | Replaces hardcoded `rgba` in `NodeDetailPanel.css:21` |
| `--color-ready-when` | `#f59e0b` | `#d97706` | Fill/border color for the `readyWhen` node badge |
| `--z-tooltip` | `200` | `200` | `z-index` for `.dag-tooltip` portal element |

Note: `--shadow-panel` also fixes the pre-existing anti-pattern violation in `NodeDetailPanel.css:21` (`box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3)` hardcoded).

---

## CSS Class Additions

### `.dag-tooltip` and children (`web/src/components/DAGTooltip.css`)

| Class | Role |
|-------|------|
| `.dag-tooltip` | Portal root — `position: fixed`, `z-index: var(--z-tooltip)`, `box-shadow: var(--shadow-tooltip)`, `opacity: 0` until clamping fires |
| `.dag-tooltip--visible` | Added by `useEffect` after clamping — sets `opacity: 1` |
| `.dag-tooltip-header` | Row showing node `id`, `kind`, and type badge |
| `.dag-tooltip-section` | A labeled content block within the tooltip (mirrors `.node-detail-section`) |
| `.dag-tooltip-section-label` | Small uppercase label (mirrors `.node-detail-section-label`) |

### `.dag-node-badge--ready-when` (`web/src/components/DAGGraph.css`, `LiveDAG.css`)

Small `readyWhen` indicator badge on the node shape. Styled with `fill: var(--color-ready-when)`.

---

## File Change Map

| File | Change type | Description |
|------|------------|-------------|
| `web/src/tokens.css` | Add tokens | `--shadow-tooltip`, `--shadow-panel`, `--color-ready-when`, `--z-tooltip` (both `:root` and light) |
| `web/src/components/DAGTooltip.tsx` | **New file** | Shared portal tooltip component |
| `web/src/components/DAGTooltip.css` | **New file** | Tooltip styles (tokens only) |
| `web/src/components/DAGGraph.tsx` | Modify | Add `onMouseEnter`/`onMouseLeave` to `NodeGroup`; render `<DAGTooltip>`; add `readyWhen` badge |
| `web/src/components/DAGGraph.css` | Modify | Add `.dag-node-badge--ready-when` style |
| `web/src/components/LiveDAG.tsx` | Modify | Same as DAGGraph: hover handlers, tooltip, badge |
| `web/src/components/LiveDAG.css` | Modify | Same badge style addition |
| `web/src/components/DeepDAG.tsx` | Modify | Same hover handlers and tooltip |
| `web/src/components/NodeDetailPanel.tsx` | Modify | Split merged `celCode` block into separate "Ready When", "Include When", "forEach", "Status" sections |
| `web/src/components/NodeDetailPanel.css` | Modify | Fix `rgba()` violation (line 21); use `var(--shadow-panel)` |
| `web/src/components/LiveNodeDetailPanel.tsx` | Modify | Same section split as `NodeDetailPanel` |
| `web/src/components/NodeDetailPanel.test.tsx` | Modify | Update assertions for split sections |

---

## State Transitions for the Tooltip

```
Initial: node = null → <DAGTooltip node={null}> → renders nothing

onMouseEnter (node with readyWhen):
  1. Compute anchor from svgRef.getBoundingClientRect() + node layout coords
  2. setState({ node, anchorX, anchorY, nodeWidth, nodeHeight })
  3. <DAGTooltip node={node} …> renders portal with opacity:0
  4. useEffect in DAGTooltip fires:
     a. Measures tooltip bounding box via getBoundingClientRect()
     b. Clamps left/top within viewport
     c. Sets visible=true → opacity:1 transition

onMouseLeave (any node):
  1. setState({ node: null })
  2. <DAGTooltip node={null}> → renders nothing
```
