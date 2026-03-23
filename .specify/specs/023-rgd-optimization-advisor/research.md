# Research: RGD Optimization Advisor (023)

## 1. Structural Similarity Metric

**Decision**: Jaccard similarity of top-level template key sets, with a ≥ 70% threshold. Groups of ≥ 3 nodes sharing the same `apiVersion/kind` always qualify regardless of similarity score.

**Rationale**: We only need a shallow heuristic — not semantic equivalence. Deep diff (e.g., recursive JSON diff) would be expensive and produce too many false positives (templates naturally differ in values). The top-level key set captures structure (spec fields, metadata, etc.) without value noise. Jaccard is simple to compute: `|A ∩ B| / |A ∪ B| ≥ 0.7`. For a group of N resources we compute pairwise minimum Jaccard across all pairs in the group.

**Alternatives considered**:
- Deep recursive diff: O(n × template_size) and sensitive to value differences; rejected as too noisy
- Edit distance on YAML string: too sensitive to serialization order; rejected
- Identical key set (100%): too strict; would miss obvious candidates that differ by one optional field; rejected
- No structural check at all (just `apiVersion/kind`): produces false positives for CRDs with wildly different uses; 70% + group-size-3 override is the right balance

---

## 2. Where `detectCollapseGroups` Lives

**Decision**: New export in `web/src/lib/dag.ts`.

**Rationale**: Constitution §IX (shared helpers rule) mandates that functions used across more than one component be defined once in `@/lib/dag.ts` for graph-related helpers. `detectCollapseGroups` directly consumes the same `spec.resources` input shape and the same node-type classification logic as `buildDAGGraph`. Co-location avoids duplication and ensures the classification rules stay in sync.

**Alternative considered**: a new `web/src/lib/advisor.ts` module. Rejected because this would require the file to import the node-type classification rules from `dag.ts` anyway, creating a coupling that is cleaner to avoid by keeping everything in `dag.ts`.

---

## 3. Node Type Classification Reuse

**Decision**: Extract the per-resource classification into a small private helper `classifyResource(r)` inside `dag.ts`, called by both `buildDAGGraph` and `detectCollapseGroups`.

**Rationale**: FR-011 prohibits duplicating classification rules. Currently the classification is inlined inside `buildDAGGraph` (a large `if/else if` chain). Extracting it costs nothing — it is a pure function with no side effects — and lets `detectCollapseGroups` call the same logic.

**Alternative considered**: Calling `buildDAGGraph` first and filtering the resulting `DAGNode[]` by `nodeType`. Rejected because it forces `detectCollapseGroups` to depend on a complete graph build (including layout computation) when it only needs raw resource data.

---

## 4. Component Placement in RGDDetail

**Decision**: Render `<OptimizationAdvisor>` inside the `activeTab === "graph"` branch, between the graph area div and the `NodeDetailPanel` conditional.

**Rationale**: The advisor is structural/graph insight — it belongs in the Graph tab only. Looking at `RGDDetail.tsx` lines 238–262, the Graph tab content is wrapped in a `<>` fragment. Placing the advisor after `rgd-graph-area` and before the `NodeDetailPanel` panel keeps it visible when the panel is closed, and the panel still slides in from the right over the top when a node is selected.

**Alternative considered**: A floating banner above the DAG. Rejected because it would obscure nodes and interact poorly with the `SVGViewBox` height fitting.

---

## 5. Dismiss State: Local Component State vs URL Param

**Decision**: Local `useState` inside `OptimizationAdvisor`. No `localStorage`, no URL param.

**Rationale**: Dismissal is a transient UI preference, not navigation state. URL params are reserved for tab and node selection (established pattern). `localStorage` is constitution §V (Simplicity) scope creep for a v1 hint. The Assumptions section in the spec explicitly documents this as session-only for v1.

---

## 6. New CSS Tokens Needed

**Decision**: Add to `tokens.css`:
- `--color-advisor-bg`: background for the suggestion card (amber-tinted, ~rgba(245,158,11,0.06))
- `--color-advisor-border`: border color for the suggestion card (amber at 25% opacity)
- `--color-advisor-icon`: the lightbulb/hint icon color (same amber as `--color-reconciling`)
- `--color-advisor-text`: label text color (same as `--color-text-primary`)
- `--shadow-advisor`: box-shadow for the card (inset left border style; token form required by constitution §IX)

The amber color family (`--color-reconciling: #f59e0b`) is already defined and semantically close to "advisory" — informational but worth attention. No new hue needed.

**Alternative considered**: Using `--color-primary-muted` (blue tint). Rejected because blue already means "selected/active" in the DAG. Amber is neutral advisory.

---

## 7. Docs URL Stability

**Decision**: Define `const FOREACH_DOCS_URL = 'https://kro.run/docs/concepts/forEach'` as a module-level constant in `OptimizationAdvisor.tsx`.

**Rationale**: FR-007 requires a link to the kro forEach docs. Centralizing it in one constant means a single-line change if the URL moves.

---

## 8. Test File Placement

**Decision**:
- `detectCollapseGroups` unit tests: extend `web/src/lib/dag.test.ts`
- `OptimizationAdvisor` component tests: new file `web/src/components/OptimizationAdvisor.test.tsx`

**Rationale**: Follows the established project pattern (co-located `*.test.*` files). `dag.test.ts` already tests `buildDAGGraph`; extending it keeps all pure DAG logic tests together.
