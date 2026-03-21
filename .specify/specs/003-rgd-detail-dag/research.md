# Research: RGD Detail — DAG Visualization

**Feature**: `003-rgd-detail-dag` | **Date**: 2026-03-20

---

## Decision 1: DAG Layout Algorithm

**Decision**: BFS-layered (Sugiyama-style) layout with longest-path layer
assignment, barycenter crossing reduction, and centered horizontal positioning.

**Rationale**: The Sugiyama framework is the standard for layered DAG layout. kro
RGDs are small (3–30 nodes) with a guaranteed single root (`schema`), making the
full Sugiyama pipeline (4 phases) tractable without optimization. No external
library needed — the algorithm is ~120 lines of TypeScript.

**Alternatives considered**:
- Force-directed layout (D3): Prohibited by §V and FR-002. Non-deterministic.
- Tree layout: RGDs are DAGs (multi-parent), not trees. Would lose edge
  information for shared dependencies.
- dagre/elkjs: External graph libraries prohibited by §V.

### Algorithm phases

1. **Layer assignment** — Longest path from root via topological sort (Kahn's).
   A node's layer = `max(layer[parent] + 1)` for all parents. This guarantees
   all edges point strictly downward, even with multi-parent nodes.

2. **Crossing reduction** — Barycenter heuristic with 4 sweep passes (2 down,
   2 up). Ties broken by original index then alphabetical node ID for
   determinism. O(V² × sweeps), negligible for ≤30 nodes.

3. **Coordinate assignment** — Each layer centered horizontally within the graph.
   Fixed node dimensions. Nodes vertically centered within their layer row.

4. **Edge routing** — Cubic bezier curves from parent bottom-center to child
   top-center. Control points at 40% vertical offset for smooth S-curves.

### Layout constants

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Node width | 180px | Fits "externalCollection" label + badge at 14px font |
| Node height | 48px | Room for label (14px) + kind sub-label (12px) + padding |
| Root width | 200px | Slightly wider for visual hierarchy |
| Root height | 52px | Slightly taller for root distinction |
| H gap | 40px | Separates sibling nodes; 5-node layer fits in 1200px viewport |
| V gap | 80px | 1.67:1 ratio to node height; room for bezier curves |
| Padding | 32px | Matches page margin from design spec |
| Corner radius | 8px | Matches `--radius` from tokens.css |

### Determinism guarantee

Determinism is achieved by sorting at every decision point:
- Topological sort queue: alphabetical when multiple nodes have inDegree 0
- Initial layer ordering: alphabetical within each layer
- Barycenter ties: broken by original index, then by node ID

---

## Decision 2: CEL Reference Parsing

**Decision**: Bracket-counting scanner (not regex) for extracting `${...}`
expressions, then identifier matching against known resource IDs for edge
building.

**Rationale**: kro's upstream parser (`pkg/graph/parser/cel.go:59-116`) uses a
stateful bracket counter because CEL expressions can contain nested braces (e.g.,
map literals `${ {key: val} }`). A simple `\$\{([^}]+)\}/g` regex would fail on
these cases. For a dashboard that must handle arbitrary RGDs, correctness
matters more than simplicity.

**Alternatives considered**:
- Simple regex `\$\{([^}]+)\}`: Fails on nested braces. Rejected.
- Full CEL parser in browser: Massive overhead for just extracting variable
  references. Rejected per §V.
- Backend-side graph building: Would require a new API endpoint. The spec
  explicitly requires client-side DAG building (FR-001). Rejected.

### Expression extraction algorithm

```
function extractExpressions(str):
  scan for "${" substring
  count brackets: { increments, } decrements
  track string literals (double-quote) and escapes
  when bracket count reaches 0: emit match
  handle incomplete expressions: skip silently
```

### Resource ID extraction from expressions

For each extracted expression, find all identifier tokens that match known
resource IDs (including `schema`). The identifier pattern is
`\b[a-zA-Z_][a-zA-Z0-9_]*\b`. This is checked against the set of all resource
IDs from `spec.resources[].id` plus `"schema"`.

Special exclusions:
- **forEach iterator variables**: The keys in `forEach` dimension objects (e.g.,
  `region` in `{region: "${schema.spec.regions}"}`) are excluded from ID matching
  inside the resource's template to avoid false edges.
- **CEL built-in functions**: Not excluded explicitly — they won't match any
  resource ID since kro resource IDs are user-defined labels like `appNamespace`.

### Edge direction

Edges go FROM the dependency TO the dependent:
- If `appConfig` references `${appNamespace.metadata.name}`, the edge is
  `appNamespace → appConfig` (appNamespace must exist first).
- If a resource references `${schema.spec.foo}`, the edge is `schema → resource`.

### Deep template traversal

Templates are nested JSON objects. Walk recursively:
- `string` → extract expressions
- `object` → recurse into values
- `array` → recurse into items
- primitives (number, boolean, null) → skip

This matches kro's `parseSchemalessResource()` at
`pkg/graph/parser/schemaless.go:28-77`.

---

## Decision 3: Node Type Classification

**Decision**: 5-way classification per upstream kro `pkg/graph/node.go`, with
`includeWhen` as a visual modifier (not a separate type).

**Rationale**: Spec FR-003 mandates exactly these 5 types. The classification
is a simple decision tree on the presence/absence of `template`, `forEach`,
`externalRef.metadata.name`, and `externalRef.metadata.selector`.

### Decision tree

```
1. Root node (synthesized from spec.schema, id = 'schema')
   → NodeTypeInstance

2. Has externalRef?
   ├─ Has externalRef.metadata.selector → NodeTypeExternalCollection
   └─ Has externalRef.metadata.name → NodeTypeExternal

3. Has template?
   ├─ Has forEach → NodeTypeCollection
   └─ No forEach → NodeTypeResource

4. Neither template nor externalRef
   → NodeTypeResource (fallback, with warning per FR-012)
```

### RGD spec field paths (isolated to dag.ts)

| Field path | Type | Used for |
|------------|------|----------|
| `spec.schema` | object | Root node construction |
| `spec.schema.kind` | string | Root node kind label |
| `spec.schema.apiVersion` | string | Root node API version |
| `spec.schema.group` | string | Root node API group |
| `spec.schema.spec` | object | SimpleSchema definitions (display in panel) |
| `spec.schema.status` | object | CEL projections (display in panel) |
| `spec.resources` | array | Resource node construction |
| `spec.resources[].id` | string | Node ID and CEL variable name |
| `spec.resources[].template` | object | K8s manifest template |
| `spec.resources[].template.kind` | string | Node kind label |
| `spec.resources[].template.apiVersion` | string | Node API version |
| `spec.resources[].forEach` | string | Collection iteration expression |
| `spec.resources[].externalRef` | object | External reference definition |
| `spec.resources[].externalRef.metadata.name` | string | Specific resource name |
| `spec.resources[].externalRef.metadata.selector` | object | Label selector |
| `spec.resources[].readyWhen` | string[] | Readiness check expressions |
| `spec.resources[].includeWhen` | string[] | Conditional inclusion expressions |

---

## Decision 4: SVG Rendering Strategy

**Decision**: Inline SVG with `<rect>` for nodes, `<text>` for labels, `<path>`
with cubic bezier for edges, and SVG `<marker>` for arrowheads. All colors via
CSS custom properties on SVG elements.

**Rationale**: Inline SVG gives full CSS control (custom properties work on SVG
fill/stroke), keyboard accessibility (SVG elements can have `tabindex` and
`aria-label`), and no canvas API complexity. For ≤30 nodes, SVG performance is
not a concern (NFR-001 budget is 500ms).

**Alternatives considered**:
- Canvas: Better for 1000+ nodes, but loses CSS custom property integration and
  accessibility. Rejected.
- HTML+CSS (flexbox/grid with CSS lines): Cannot draw diagonal edges. Rejected.
- External SVG library: Prohibited by §V.

### Edge path formula

```
M {x1} {y1} C {x1} {y1 + dy}, {x2} {y2 - dy}, {x2} {y2}
```

Where:
- (x1, y1) = bottom-center of parent node
- (x2, y2) = top-center of child node
- dy = (y2 - y1) × 0.4

### Arrowhead marker

```svg
<marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5"
        markerWidth="8" markerHeight="8" orient="auto-start-reverse">
  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border)" />
</marker>
```

---

## Decision 5: Orphan/Disconnected Node Handling

**Decision**: Every non-root node that has no detected dependencies gets an
implicit edge from the root `schema` node.

**Rationale**: All resources in an RGD belong to the root CR by definition —
even if they don't reference any other resource via CEL expressions, they are
still part of the resource graph. An implicit edge from root ensures the graph
is always connected and every node is reachable from the root.

This also matches the spec edge case: "resource referencing a non-existent
dependency → render best-effort; show warning badge on orphaned node."

---

## Decision 6: Component Architecture

**Decision**: Three-layer separation — `dag.ts` (pure function, all kro
knowledge), `DAGGraph.tsx` (pure SVG renderer, zero kro knowledge),
`NodeDetailPanel.tsx` (concept explanations per node type).

**Rationale**: Spec NFR-004 mandates that `DAGGraph` is "purely data-driven:
accepts `{nodes, edges}` with `nodeType` — zero kro-specific logic inside the
renderer." This separation means:
- `dag.ts` is independently testable with mock RGD specs
- `DAGGraph.tsx` could render any DAG (not kro-specific)
- `NodeDetailPanel.tsx` maps node types to explanations (kro-specific but pure UI)

---

## Decision 7: Tab State Management

**Decision**: URL query parameter `?tab=graph|instances|yaml` via
`useSearchParams()`. Default tab is `graph` (changed from current stub's
`overview`).

**Rationale**: Spec FR-010 mandates URL-reflected tab state for bookmarkability.
React Router's `useSearchParams()` is already used in the current `RGDDetail.tsx`
stub. The default tab changes from `overview` to `graph` per the spec.

Invalid tab values fall back to `graph` (spec acceptance scenario 4).

---

## Open Questions (none)

All technical decisions are resolved. No NEEDS CLARIFICATION items remain.
