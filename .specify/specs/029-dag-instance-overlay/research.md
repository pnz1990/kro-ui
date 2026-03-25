# Research: 029-dag-instance-overlay

## Decision log

---

### R-001 — Does `DAGTooltip` need a `nodeState` prop added?

**Decision**: Yes — extend `DAGTooltipProps` with an optional `nodeState?: NodeLiveState` prop.

**Rationale**: The live-state CSS classes (`.dag-tooltip__state--alive`, etc.) already exist in `LiveDAG.css` (lines 190–197) but are currently dead code — no component renders them. The spec calls for the tooltip to show "State: Alive" etc. when overlay is active. Adding an optional prop preserves backward compat — no state prop means no state line rendered.

**Alternatives considered**:
- Pass entire `nodeStateMap` to tooltip and look up internally — rejected (tooltip should receive resolved state, not raw map; keeps tooltip dumb).
- Use a separate `LiveDAGTooltip` component — rejected (constitution §IX: shared helpers must not be duplicated; tooltip is already the single implementation).

---

### R-002 — How to add live-state CSS to `StaticChainDAG.tsx`?

**Decision**: Add the live-state `rect` override rules directly to `StaticChainDAG.css` scoped to `.static-chain-dag-container`. Do **not** import `LiveDAG.css` into `StaticChainDAG.tsx`.

**Rationale**: `LiveDAG.css` has many rules scoped to `.live-dag-container` that are not needed in the static DAG. Importing it would include the pulse animation (which comes from `tokens.css` anyway) but also scope-leaking risks. The `reconciling-pulse` keyframe is defined globally in `tokens.css` so it is available everywhere without re-import.

**CSS rules to add** (4 blocks + no new keyframe needed):
```css
.static-chain-dag-container .dag-node-live--alive rect.dag-node-rect { ... }
.static-chain-dag-container .dag-node-live--reconciling rect.dag-node-rect { ... }
.static-chain-dag-container .dag-node-live--error rect.dag-node-rect { ... }
.static-chain-dag-container .dag-node-live--notfound rect.dag-node-rect { ... }
```

Values copied from `LiveDAG.css` lines 90–121, referencing the same tokens.

**Alternatives considered**:
- Shared `.css` partial imported by both — Vite doesn't support CSS `@import` of sibling files as cleanly as separate component imports; this avoids import order issues.
- `@import './LiveDAG.css'` — rejected because it would bring in `.live-dag-container` rules that interfere with `.static-chain-dag-container` scoping.

---

### R-003 — Where to extract the `nodeState()` lookup logic?

**Decision**: Extract the `nodeState()` helper into `web/src/lib/dag.ts` as a new exported function `nodeStateForNode(node: DAGNode, stateMap: NodeStateMap): NodeLiveState | undefined`. Remove the identical duplicate in `DeepDAG.tsx:71–81` and `LiveDAG.tsx:42–61`.

**Rationale**: The function is currently copy-pasted verbatim in `LiveDAG.tsx` (lines 42–61) and `DeepDAG.tsx` (lines 71–81). Constitution §IX prohibits copy-pasting shared graph helpers. `StaticChainDAG` will be the third consumer — extracting now prevents a third copy.

**Alternatives considered**:
- Keep duplicates and add a third copy in `StaticChainDAG` — rejected (constitution violation).
- Define only in `StaticChainDAG`, import into others — rejected (wrong ownership; `dag.ts` is the correct home for all kro DAG logic).

---

### R-004 — How to trigger instance list fetch on Graph tab?

**Decision**: In `RGDDetail.tsx`, add a `useEffect` that fires when `activeTab === 'graph'` (same lazy pattern already used for `activeTab === 'instances'` at line 91). Store results in separate `pickerItems` state. Fetch once; do not re-fetch on subsequent Graph tab visits within the same page mount.

**Rationale**: The instance list is only needed when the user is on the Graph tab with overlay intent. Fetching at mount would waste a round-trip if the user never visits the Graph tab or never uses the overlay. The `instances` tab already uses this exact lazy pattern.

**Alternatives considered**:
- Reuse `instanceList` state from the Instances tab — rejected (different lifecycle; Instances tab refetches on namespace filter change, which should not affect the overlay picker).
- Fetch in `InstanceOverlayBar` component — rejected (side effects in a child component that has no reason to own API calls; `RGDDetail` is the data owner for the page).

---

### R-005 — What is `nodeBaseClass()` in `StaticChainDAG.tsx` and how to extend it?

**Decision**: Extend `nodeBaseClass(node, isSelected)` (currently at `StaticChainDAG.tsx:83–89`) to accept an optional third parameter `liveState?: NodeLiveState` and append `liveStateClass(liveState)` when a non-`undefined` state is provided. Rename to `nodeBaseClass(node, isSelected, liveState?)` for clarity.

**Current signature**: `function nodeBaseClass(node: DAGNode, isSelected: boolean): string`

**Extended signature**: `function nodeBaseClass(node: DAGNode, isSelected: boolean, liveState?: NodeLiveState): string`

**Implementation addition** (one line):
```ts
if (liveState) parts.push(liveStateClass(liveState))
```

**Rationale**: Mirrors the pattern in `LiveDAG.tsx`'s `nodeClassName()` (line 82) and `DeepDAG.tsx`'s `standardNodeClassName()` (line 99) which both conditionally push `liveStateClass(state)` when state is truthy. Keeping the same pattern reduces cognitive load.

---

### R-006 — How should `StaticChainDAG` receive `nodeStateMap`?

**Decision**: Add `nodeStateMap?: NodeStateMap` as an optional prop to `StaticChainDAGProps`. When provided, call `nodeStateForNode(node, nodeStateMap)` for each node during rendering. When not provided (undefined), pass `undefined` to `nodeBaseClass` → no live-state class applied.

**Rationale**: Optional prop approach means zero change for all existing callers (there is only one: `RGDDetail.tsx`). `StaticChainDAG` is the top-level renderer; it has access to all nodes and the state map in the same render pass.

**Alternatives considered**:
- Pass a pre-computed `Map<nodeId, NodeLiveState>` instead of full `NodeStateMap` — rejected (would require mapping in `RGDDetail.tsx`; `nodeStateForNode()` already handles the kind-based lookup).
- A wrapper `LiveStaticChainDAG` component — rejected (over-engineering; a single optional prop is sufficient).

---

### R-007 — Does the `InstanceOverlayBar` need to be a separate component file?

**Decision**: Yes — create `web/src/components/InstanceOverlayBar.tsx` with its own `InstanceOverlayBar.css`.

**Rationale**: The picker + summary bar is a distinct UI unit with its own state (loading, error, selected value display). Inlining it in `RGDDetail.tsx` (already 404 lines) would push it toward 500+ lines. A small focused component is easier to test. Pattern matches `NamespaceFilter` (picker), `ValidationTab`, `AccessTab`, etc. — all are separate component files even for relatively small UI.

**Alternatives considered**:
- Inline in `RGDDetail.tsx` — rejected (readability; makes the page component longer without adding value).

---

### R-008 — CSS classes for the instance picker: reuse `NamespaceFilter` CSS or define new?

**Decision**: Define a new BEM class hierarchy for `InstanceOverlayBar` — do not reuse `NamespaceFilter.css`.

**Rationale**: The namespace filter is a single `<select>` with a label; the overlay bar has a picker row + summary row + error row + loading state. Different DOM structure → different class needs. Sharing CSS would create coupling.

**CSS class plan** (BEM):
```
.instance-overlay-bar              (root)
.instance-overlay-bar__row         (picker row)
.instance-overlay-bar__label       (text "Overlay:")
.instance-overlay-bar__select      (the <select>)
.instance-overlay-bar__loading     (spinner text while picker loads)
.instance-overlay-bar__error       (error + retry)
.instance-overlay-bar__empty       (no instances message)
.instance-overlay-bar__summary     (name/ns + badge + link)
.instance-overlay-bar__badge       (readiness dot + text)
.instance-overlay-bar__badge--ready
.instance-overlay-bar__badge--reconciling
.instance-overlay-bar__badge--error
.instance-overlay-bar__badge--unknown
.instance-overlay-bar__open-link   (→ Open instance link)
.instance-overlay-bar__overlay-status (loading/error row for overlay fetch)
```

---

### R-009 — Should the overlay fetch poll (auto-refresh)?

**Decision**: No polling on the Graph tab. Fetch once on instance selection.

**Rationale**: Spec explicitly states "No auto-polling on the Graph tab". Polling lives in `InstanceDetail`. The overlay is a quick-look; users who want live updates should navigate to the instance detail.

---

### R-010 — How to handle the root `instance` node state in the overlay?

**Decision**: Reuse the exact same aggregate logic as `nodeStateForNode()`:
- If any child is `reconciling` → root is `reconciling`
- Else if any child is `error` → root is `error`
- Else if any children exist → root is `alive`
- Else → `not-found` (no children at all)

**Rationale**: This is the same algorithm in `LiveDAG.tsx:42–61` and `DeepDAG.tsx:71–81`. Extracting it to `nodeStateForNode()` in `dag.ts` (R-003) ensures all three consumers use identical logic.

### R-011 — Root cause of GH #165: `nodeBaseClass` truthy guard

**Decision**: Change the live-state class guard in `nodeBaseClass()` from
`if (liveState)` to `if (nodeStateMap && node.nodeType !== 'state')`.

**Rationale**: `liveStateClass(undefined)` returns `'dag-node-live--notfound'`
by design (the function signature is `(state: NodeLiveState | undefined): string`).
But the call site in `nodeBaseClass` guards with `if (liveState)`, and
`undefined` is falsy — so absent nodes never receive the `notfound` class.
This is the immediate cause of GH #165: only the root CR node (which gets a
truthy state from its conditions) was colored; all child resource nodes that
happened to be absent from `children` got `undefined` from `nodeStateForNode`
and were silently unstyled.

The fix threads the same guard already used to compute `liveState` (line 332:
`nodeStateMap && node.nodeType !== 'state'`) into the class builder. When the
overlay is active, `liveStateClass` is called unconditionally for every
non-state node.

**Alternatives considered**:
- Change `nodeStateForNode` to return `'not-found'` instead of `undefined` for
  absent nodes — rejected because `undefined` is the correct sentinel for "no
  overlay active" vs `'not-found'` meaning "overlay active, resource absent".
  The same function is used in LiveDAG/DeepDAG where the map is comprehensive
  and `undefined` genuinely means no data.
- Always call `liveStateClass(liveState ?? 'not-found')` with `if (liveState !== undefined)` —
  functionally equivalent but less clear about the intent.

---

### R-012 — Root cause of GH #165: `buildNodeStateMap` only keys observed children

**Decision**: Add `rgdNodes: DAGNode[]` as a third parameter to
`buildNodeStateMap`. Pre-enumerate all non-state, non-instance nodes from
`rgdNodes` and emit explicit `'not-found'` entries for nodes absent from the
children presence map.

**Rationale**: The original `buildNodeStateMap(instance, children)` built the
state map by iterating over `children` — it only produced entries for kinds
that were actually present in the cluster. When `nodeStateForNode` looked up a
node whose kind had no child, it returned `undefined`. Combined with Bug 1
(truthy guard), this meant no live-state class was ever applied to absent nodes.

Even after fixing Bug 1, a `NodeStateMap` that omits absent kinds would still
produce `undefined` from `nodeStateForNode` — the map's `undefined` lookup
(`stateMap[kindKey]?.state`) and Bug 1's fix together would produce `notfound`
styling, so Bug 1 fix alone could be sufficient in practice. However, making
`buildNodeStateMap` explicitly enumerate all RGD nodes is cleaner:
- Makes the contract explicit: every non-state node has an entry.
- Enables unit testing of the mapping in isolation (AC-019).
- Consistent with the principle that absent data should produce a defined
  fallback, not an implicit chain of `undefined` lookups.

**Alternatives considered**:
- Fix only Bug 1 (truthy guard) and leave `buildNodeStateMap` unchanged — this
  would work because `liveStateClass(undefined)` → `notfound` fills the gap.
  Rejected as incomplete: the spec explicitly requires "nodes not represented
  in children are gray dashed" (AC-007), which implies the not-found state is
  intentional and should be explicitly produced, not accidentally correct.
- Derive `rgdNodes` inside `buildNodeStateMap` by some other means — rejected
  (no access to the graph data from inside `instanceNodeState.ts`; callers
  already have `dagGraph.nodes`).

---

| Unknown | Resolution |
|---------|-----------|
| Does `DAGTooltip` need a new prop? | Yes — optional `nodeState?: NodeLiveState` |
| How to add CSS to `StaticChainDAG`? | Add scoped rules in `StaticChainDAG.css`; `reconciling-pulse` already in `tokens.css` |
| Where is `liveStateClass()`? | `dag.ts:605–613` — shared, already exported |
| Where is `nodeState()` logic? | Duplicated in LiveDAG + DeepDAG; extract to `dag.ts` as `nodeStateForNode()` |
| `StaticChainDAG` container class? | `static-chain-dag-container` |
| `nodeBaseClass()` location and signature? | `StaticChainDAG.tsx:83–89` — extend with optional `liveState` param **AND overlay-active guard** (see R-011) |
| Picker component design? | New `InstanceOverlayBar` component, standard `<select>`, BEM CSS |
| Do live-state tooltip CSS classes exist? | Yes, in `LiveDAG.css:190–197` — currently dead code; activate via new prop |
| Is `reconciling-pulse` keyframe global? | Yes — defined in `tokens.css:269–272` |
| Why child nodes not colored? (GH #165) | Two bugs: (1) truthy guard in `nodeBaseClass`; (2) `buildNodeStateMap` only keyed by observed children. See R-011 and R-012. |
