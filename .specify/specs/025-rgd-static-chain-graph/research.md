# Research: RGD Static Chaining Graph

**Feature**: `025-rgd-static-chain-graph`
**Phase**: 0 — Research
**Date**: 2026-03-22

---

## 1. RGD list availability in RGDDetail context

**Decision**: Use `listRGDs()` (already available via `GET /api/v1/rgds`) — fetch once on mount and pass the result down as a prop to the new `StaticChainDAG` component.

**Rationale**: The RGD list is already loaded on the Home page and the Catalog page. `RGDDetail` currently only fetches its own RGD via `getRGD(name)`. For chain detection we need the full RGD list. A single additional `listRGDs()` call on the Graph tab mount is minimal cost; the result is memoized as a `useMemo`-derived `kindToRgdName` map. No caching infrastructure is needed — the data changes slowly and a stale-on-remount strategy is fine.

**Alternatives considered**:
- Context/provider with shared RGD list: correct long-term but out of scope; would require restructuring the app
- Fetching individual RGDs on demand per node kind: N+1 requests, rejected

---

## 2. Where chain detection logic lives

**Decision**: `detectKroInstance()` already exists in `web/src/lib/dag.ts` (line 349). Extend `dag.ts` with a new `findChainedRgdName()` helper that returns the RGD name (not just a boolean). Add `buildStaticChainSubgraph()` as the entry point for the static expansion logic.

**Rationale**: Constitution §IX ("Shared rendering helpers MUST be defined once in `@/lib/dag.ts`"). The existing `detectKroInstance` already performs the kind → RGD mapping; `findChainedRgdName` is a straightforward extension. No component should duplicate this logic.

**Alternatives considered**:
- New file `web/src/lib/chain.ts`: over-engineering for 2 functions; `dag.ts` is already the designated place for all graph helpers

---

## 3. Static subgraph component architecture

**Decision**: Create `StaticChainDAG` (new component, `web/src/components/StaticChainDAG.tsx`) that mirrors `DeepDAG`'s structural pattern but is entirely static: no live state colors, no API fetches on expand (data comes from pre-loaded RGD specs), no polling awareness.

**Key differences from `DeepDAG`/`ExpandableNode`**:

| Concern | `DeepDAG` (spec 012) | `StaticChainDAG` (this spec) |
|---|---|---|
| Data source | Live instance fetch on expand | Already-loaded RGD spec list |
| Node colors | Live state (`--node-alive-*`, etc.) | Static type styles (`--node-default-*`, etc.) |
| Expand icon styling | `.deep-dag-expand-toggle` (`--color-text-muted`) | `.static-chain-expand-toggle` (`--color-chain-expand-*`) |
| Navigation affordance | None | "View RGD →" link (styled `--color-primary`) |
| Chainable ring indicator | None | `.node-chainable` CSS class with `--color-chain-*` tokens |
| Async loading | Yes — fetch on first expand | No — synchronous (RGD spec already in memory) |

**Rationale**: Reusing `DeepDAG` directly would tangle live-instance semantics with static-spec semantics. The two components have the same expansion pattern but serve different data models and must be visually distinguishable.

**Alternatives considered**:
- Extend `DeepDAG` with a `static` mode prop: rejected — prop drilling and mode-switch branching would complicate both code paths and blur the visual distinction

---

## 4. Cycle detection algorithm

**Decision**: Pass an `ancestorSet: Set<string>` (set of RGD names in the current expand path) down through recursive renders. Before rendering a `StaticChainDAG` for a chained node, check if the target RGD name is already in `ancestorSet`. If yes, render a cycle indicator node instead.

**Rationale**: Simple, O(depth) per check, requires no global state. The depth is capped at 4 so performance is not a concern.

**Implementation pattern**:
```
renderSubgraph(rgdName, ancestorSet, depth):
  if depth >= 4 → render MaxDepthNode
  if rgdName in ancestorSet → render CycleNode
  rgdSpec = allRgds.find(spec.schema.kind == targetKind)
  newAncestors = ancestorSet + rgdName
  render StaticChainDAG(spec, newAncestors, depth + 1)
```

**Alternatives considered**:
- Global visited set in context: correct but overkill for pure render-time cycle detection where there's no shared mutable state requirement

---

## 5. "View RGD →" breadcrumb mechanism

**Decision**: Pass breadcrumb state via React Router v7's `navigate(path, { state: { from: originRgdName } })` (router state). In `RGDDetail`, detect `location.state?.from` to render the breadcrumb. This keeps the URL clean (no extra params) and the state is ephemeral.

**Rationale**: Constitution §XIII ("Pages deeper than 2 levels MUST have a breadcrumb"). Router state is the idiomatic React Router v7 approach for transient navigation context that should not be bookmarkable or shared via URL.

**Alternatives considered**:
- URL query param `?from=platform`: rejected per spec FR-012 which explicitly states "MUST NOT be stored in the URL path or query params"
- sessionStorage: over-engineering; router state is simpler and auto-clears on hard navigate

---

## 6. New CSS tokens required

**Decision**: Add the following tokens to `web/src/tokens.css` (both `:root` dark mode and `[data-theme="light"]`):

```css
/* RGD static chaining tokens */
--color-chain-indicator:       /* teal/cyan hue — distinct from blue/green/violet/rose/amber */
--color-chain-indicator-bg:    /* low-opacity tint for node ring */
--color-chain-indicator-border:/* ring border for chainable nodes */
--color-chain-expand-bg:       /* expand toggle icon background hit area */
--color-chain-expand-text:     /* expand toggle icon fill — teal, NOT --color-text-muted (spec 012) */
--node-chain-subgraph-bg:      /* static subgraph container background */
--node-chain-subgraph-border:  /* static subgraph container border */
```

**Color choice rationale**: Teal/cyan (`#0ea5e9` dark, `#0284c7` light) is:
- Not in use by any existing token (blue=primary, green=alive, amber=reconciling, violet=pending, rose=error, gray=notfound)
- Visually distinct at a glance from all DAG state colors
- Semantically appropriate for "linked/chained" (chain connotes connection, teal is association)
- Passes WCAG AA on both `--color-bg` and `--color-surface`

**Contrast check (dark mode)**:
- `#0ea5e9` on `#1b1b1d` → 5.9:1 ✓ AA
- `#0ea5e9` on `#242526` → 5.2:1 ✓ AA

---

## 7. DAGNode type extension — `isChainable` flag

**Decision**: Add `isChainable: boolean` and `chainedRgdName?: string` fields to the `DAGNode` interface in `dag.ts`. `buildDAGGraph()` gains an optional `rgds?: K8sObject[]` parameter; when provided, it detects chainable nodes during graph construction and populates these fields.

**Rationale**: 
- Keeps chainability as part of the immutable node data model (not computed at render time)
- `DAGGraph` component remains purely data-driven (no kro knowledge needed there)
- `StaticChainDAG` can pass `rgds` to `buildDAGGraph()` internally when expanding
- Backward compatible: parameter is optional, existing callers unaffected

**Alternatives considered**:
- Compute `isChainable` inside `StaticChainDAG` at render time: scattered logic, duplicates `dag.ts` concerns, violates constitution §IX

---

## 8. Expansion state management

**Decision**: Hold expansion state as `Map<nodeId, boolean>` in `useState` inside `StaticChainDAG`. No data needs to be fetched, so there's no loading/error state — the map only needs to track expanded/collapsed.

**Rationale**: Simpler than `DeepDAG`'s `NodeExpansionState` (which needs loading/error/data). The subgraph is rendered synchronously from in-memory RGD spec data.

---

## 9. `RGDDetail` integration strategy

**Decision**: In `RGDDetail.tsx`, add a second `listRGDs()` fetch alongside the existing `getRGD(name)` fetch. Pass `rgds` to `buildDAGGraph()` for chain detection and to the new `StaticChainDAG` for expansion. The static DAG replaces the plain `<DAGGraph>` on the graph tab when any chainable nodes are detected (or always — `StaticChainDAG` degrades gracefully to plain DAG behavior when no chains exist).

**Alternative considered**: Keep `DAGGraph` for non-chaining RGDs and swap to `StaticChainDAG` only when chains detected — adds conditional complexity for minimal benefit; always using `StaticChainDAG` is simpler.

---

## Resolved unknowns

| Unknown | Resolution |
|---|---|
| Where to fetch RGD list for chain detection | `listRGDs()` in `RGDDetail`, passed as prop |
| How to distinguish static expand `▸` from spec 012 live expand `▸` | Separate CSS class (`static-chain-expand-toggle`), separate token (`--color-chain-expand-text`) |
| Where cycle detection state lives | `ancestorSet` prop threaded through recursive component |
| How breadcrumb is passed | React Router `navigate(url, { state: { from: name } })` |
| What new tokens are needed | 7 new `--color-chain-*` / `--node-chain-*` tokens in teal/cyan hue |
