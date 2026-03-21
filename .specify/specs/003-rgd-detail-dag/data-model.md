# Data Model: RGD Detail — DAG Visualization

**Feature**: `003-rgd-detail-dag` | **Date**: 2026-03-20

---

## Overview

This spec is entirely frontend. There are no database entities, no new API
endpoints, and no backend state changes. The data model describes the TypeScript
types used to transform a raw kro RGD API response into a renderable DAG graph.

The transformation flow is:

```
K8sObject (raw RGD from API)
  → buildDAGGraph(spec)
    → DAGGraph { nodes: DAGNode[], edges: DAGEdge[], width, height }
      → <DAGGraph /> (SVG renderer)
      → <NodeDetailPanel /> (selected node inspection)
```

---

## Core Types

### NodeType (string union)

Exactly the five upstream kro node types from `pkg/graph/node.go`.

```typescript
type NodeType =
  | 'instance'            // Root CR (spec.schema, id = 'schema')
  | 'resource'            // Managed resource (has template, no forEach)
  | 'collection'          // forEach fan-out (has template + forEach)
  | 'external'            // External ref by name (externalRef.metadata.name)
  | 'externalCollection'  // External ref by selector (externalRef.metadata.selector)
```

**Invariant**: No other values are valid. If a resource cannot be classified,
it falls back to `'resource'` with a warning flag (FR-012).

### DAGNode

Represents a single node in the dependency graph.

```typescript
interface DAGNode {
  // Identity
  id: string              // 'schema' for root; spec.resources[].id for others
  label: string           // Human-readable label (the id, possibly formatted)
  nodeType: NodeType      // One of the 5 upstream types
  kind: string            // K8s kind (schema.kind or template.kind or externalRef.kind)

  // Modifiers (not separate types)
  isConditional: boolean  // true if includeWhen is present and non-empty
  hasReadyWhen: boolean   // true if readyWhen is present and non-empty

  // CEL data (for NodeDetailPanel display)
  celExpressions: string[]             // All ${...} expressions found in template values
  includeWhen: string[]                // includeWhen expressions (empty if none)
  readyWhen: string[]                  // readyWhen expressions (empty if none)
  forEach?: string                     // forEach expression (collection nodes only)

  // Raw data (for advanced inspection)
  template?: Record<string, unknown>   // Raw template object (resource/collection)
  externalRef?: Record<string, unknown> // Raw externalRef object (external/externalCollection)
  schemaSpec?: Record<string, unknown> // Raw spec.schema.spec (root node only)
  schemaStatus?: Record<string, unknown> // Raw spec.schema.status (root node only)

  // Layout coordinates (assigned by layout algorithm)
  x: number               // Top-left X position in the SVG
  y: number               // Top-left Y position in the SVG
  width: number            // Node width in pixels
  height: number           // Node height in pixels
}
```

**Notes**:
- `celExpressions` contains every `${...}` expression found by recursively
  walking the node's template/externalRef values. Used for display in the
  detail panel.
- `readyWhen` is separate from `celExpressions` for distinct rendering in the
  panel.
- `schemaSpec` and `schemaStatus` are only populated on the root node
  (`nodeType: 'instance'`). They provide the SimpleSchema definitions and
  status CEL projections for the detail panel.

### DAGEdge

A directed edge from a dependency to a dependent.

```typescript
interface DAGEdge {
  from: string  // Source node ID (the dependency)
  to: string    // Target node ID (the dependent)
}
```

**Direction convention**: `from → to` means "to depends on from". Edges point
downward in the rendered graph (parent layer to child layer).

### DAGGraph

The complete graph structure, ready for rendering.

```typescript
interface DAGGraph {
  nodes: DAGNode[]  // All nodes with layout coordinates assigned
  edges: DAGEdge[]  // All dependency edges
  width: number     // Total SVG width in pixels
  height: number    // Total SVG height in pixels
}
```

---

## Layout Constants

```typescript
const NODE_WIDTH = 180      // Standard node width (px)
const NODE_HEIGHT = 48      // Standard node height (px)
const ROOT_WIDTH = 200      // Root node width (px)
const ROOT_HEIGHT = 52      // Root node height (px)
const H_GAP = 40            // Horizontal gap between sibling nodes (px)
const V_GAP = 80            // Vertical gap between layers (px)
const PADDING = 32          // Graph padding on all sides (px)
```

---

## Classification Rules

| # | Condition | NodeType |
|---|-----------|----------|
| 1 | Root node (synthesized from `spec.schema`, id = `'schema'`) | `instance` |
| 2 | Has `externalRef.metadata.selector` | `externalCollection` |
| 3 | Has `externalRef.metadata.name` (and no selector) | `external` |
| 4 | Has `template` + `forEach` | `collection` |
| 5 | Has `template` (no `forEach`) | `resource` |
| 6 | None of the above (unknown structure) | `resource` (fallback + warning) |

**`includeWhen` modifier**: Applied to any node type. Sets `isConditional: true`.
Does NOT change `nodeType`.

---

## Input Structure (RGD spec from API)

The raw RGD object is typed as `K8sObject` (`Record<string, unknown>`) in the
existing `api.ts`. The `buildDAGGraph` function accesses these paths:

```typescript
// Root node
spec.schema.kind          → string
spec.schema.apiVersion    → string
spec.schema.group         → string
spec.schema.spec          → Record<string, unknown> (SimpleSchema definitions)
spec.schema.status        → Record<string, unknown> (CEL status projections)

// Resource nodes
spec.resources[]          → array of resource objects
  .id                     → string (unique identifier, CEL variable name)
  .template               → Record<string, unknown> (K8s manifest template)
  .template.kind          → string
  .template.apiVersion    → string
  .forEach                → string (CEL expression, collection only)
  .externalRef            → Record<string, unknown>
  .externalRef.kind       → string
  .externalRef.apiVersion → string
  .externalRef.metadata.name     → string (NodeTypeExternal)
  .externalRef.metadata.selector → object (NodeTypeExternalCollection)
  .readyWhen              → string[] (CEL boolean expressions)
  .includeWhen            → string[] (CEL boolean expressions)
```

---

## State Relationships

The page component (`RGDDetail`) manages three pieces of state:

1. **RGD data** — `K8sObject | null`: Fetched from API on mount. Immutable after
   load (no polling in the DAG view; that's spec 005).

2. **Selected node** — `string | null`: The ID of the clicked DAG node. Controls
   whether `NodeDetailPanel` is visible. Set by `onNodeClick` callback from
   `DAGGraph`, cleared by `onClose` from `NodeDetailPanel`.

3. **Active tab** — `'graph' | 'instances' | 'yaml'`: Synced to/from URL
   `?tab=` query parameter. Default: `'graph'`.

```
RGD data ─── buildDAGGraph() ──→ DAGGraph { nodes, edges }
                                      │
                                      ├──→ <DAGGraph onNodeClick />
                                      │         │
                                      │    click │
                                      │         ▼
                                      └──→ selectedNodeId
                                                │
                                                ▼
                                    <NodeDetailPanel node={...} onClose />
```

No cross-component state management needed. All state lives in `RGDDetail.tsx`.
