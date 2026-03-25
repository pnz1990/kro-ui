# Spec 029 — DAG Instance Overlay

**Status**: Draft  
**GH Issue**: TBD  
**Branch**: `029-dag-instance-overlay`

---

## Overview

The RGD detail **Graph tab** currently shows only the static resource
dependency graph — node types, edges, CEL expressions, and chaining
affordances. It has no awareness of live instances.

To see node health states (alive / reconciling / error / not-found) the user
must navigate to a specific instance via the Instances tab. This creates a
two-step flow that is cumbersome when the intent is simply to understand the
health of an RGD across its live deployments.

This spec adds an **instance overlay** to the Graph tab: a compact instance
picker (dropdown) that, when an instance is selected, overlays the static DAG
nodes with live state colors — the same color scheme used in `LiveDAG` /
`DeepDAG`. The static graph structure (topology, edge layout, node labels) is
unchanged; only the node fill/border colors and an optional status chip on
each node are affected.

---

## Goals

1. Allow the user to select any live instance of the RGD directly on the Graph
   tab without leaving the page.
2. Overlay the selected instance's node states onto the static DAG using the
   existing live-state color tokens (`--node-alive-*`, `--node-reconciling-*`,
   etc.).
3. Show a summary bar with instance name, namespace, and overall readiness
   badge next to the picker.
4. Allow the user to clear the overlay (return to static view) and navigate to
   the full instance detail page with one click.
5. Gracefully degrade when: no instances exist, the overlay fetch fails, or the
   instance has no status conditions.

---

## Non-Goals

- No auto-polling on the Graph tab (polling lives in `InstanceDetail`).
- No child-resource expansion (that is `DeepDAG`'s job).
- No replacement of `InstanceDetail` — the overlay is a preview/quick-look
  only.
- No persistence of the selected instance across page navigations.

---

## Functional Requirements

### FR-001 — Instance picker

- The Graph tab toolbar gains an **instance picker** — an inline `<select>`
  (or button-triggered dropdown consistent with existing UI patterns) populated
  with all instances of the current RGD across all namespaces.
- Instance options are formatted as `<namespace>/<name>`.
- The picker has a leading "No overlay" option (default; no overlay applied).
- Instances are fetched once when the Graph tab becomes active (lazy, not at
  page load). A loading indicator replaces the picker while fetching.
- If the fetch fails, show a non-blocking inline error ("Could not load
  instances") with a Retry button. The graph continues to render normally.
- If there are no instances, the picker is replaced by a muted label
  "No instances — create one with `kubectl apply`."

### FR-002 — Overlay activation

- When the user selects an instance, the UI calls:
  - `getInstance(namespace, name, rgdName)` — for conditions
  - `getInstanceChildren(namespace, name, rgdName)` — for child resource list
- A loading state is shown on the DAG area (spinner or semi-transparent
  overlay) while both calls are in-flight.
- On success, `buildNodeStateMap(instance, children, rgdNodes)` produces a
  `NodeStateMap` that is passed to `StaticChainDAG` as an optional
  `nodeStateMap` prop.
- On failure, show a non-blocking inline error. Revert to no-overlay state.

### FR-002a — Child-to-node mapping algorithm

`buildNodeStateMap` MUST produce an entry for **every** non-state RGD node,
not just the root CR and whatever Kubernetes objects happen to be present.

**Inputs:**
- `instance: K8sObject` — the root CR (for overall conditions)
- `children: K8sObject[]` — the result of `getInstanceChildren`
- `rgdNodes: DAGNode[]` — all nodes from the parsed DAG graph

**Algorithm:**

1. **Root CR entry** (`nodeType === 'instance'`):
   - Read `instance.status.conditions` (treat absent as `[]`).
   - If `Progressing=True` → `reconciling`.
   - Else if `Ready=False` → `error`.
   - Else if `Ready=True` → `alive`.
   - Else → `alive` (conditions absent, instance exists).
   - Emit entry keyed by `"schema"` (the canonical node ID for the root CR).

2. **Build a presence map from children:**
   - For each child `c` in `children`:
     - Extract `kind` from `c.kind` (the GVK field set by the API server on
       list items). If absent, fall back to `c.metadata?.labels?.["kro.run/resource-id"]`.
     - If kind is still absent, skip the item.
     - Key: `kind.toLowerCase()`.
     - Value: `alive` (present) or `reconciling` (if `c.metadata.deletionTimestamp` is set).
   - Children that are **not** found in this map default to `'not-found'`.

3. **Enumerate every RGD resource node:**
   - For each `node` in `rgdNodes` where `node.nodeType !== 'instance'` and
     `node.nodeType !== 'state'`:
     - `kindKey = (node.kind || node.label).toLowerCase()`
     - Look up `kindKey` in the presence map.
     - If found → emit entry with the child's derived state.
     - If not found → emit entry with state `'not-found'`.
   - This guarantees every resource node has an entry; no node is silently
     absent from the map.

4. **Result:** `NodeStateMap` where every non-state, non-root DAG node has an
   explicit entry — either the live state from the matching child resource, or
   `'not-found'` for resources that do not yet exist in the cluster.

**Why this matters:** The previous signature `buildNodeStateMap(instance, children)`
only keyed by what children were present. Nodes with no matching child returned
`undefined` from `nodeStateForNode()`, which caused `nodeBaseClass()` to silently
skip the `not-found` CSS class. By pre-enumerating all RGD nodes and emitting
explicit `not-found` entries, every non-state node receives a live-state class
when the overlay is active.

**Signature change:** The call site in `RGDDetail.tsx` must pass the DAG graph's
node list as the third argument:

```typescript
buildNodeStateMap(instance, children, dagGraph.nodes)
```

### FR-003 — Live state coloring

- `StaticChainDAG` accepts a new optional prop `nodeStateMap?: NodeStateMap`.
- When `nodeStateMap` is provided, **every** non-state node's `<g>` element
  receives the appropriate live-state CSS class — including nodes that have
  no matching child resource (which receive `dag-node-live--notfound`):
  - `dag-node-live--alive`
  - `dag-node-live--reconciling`
  - `dag-node-live--error`
  - `dag-node-live--notfound`
- **Critical:** `nodeBaseClass()` MUST push `liveStateClass(liveState)` for
  ALL non-state nodes when `nodeStateMap` is provided — including when
  `liveState` resolves to `undefined`. Because `liveStateClass(undefined)`
  returns `'dag-node-live--notfound'`, the guard condition MUST be:

  ```typescript
  // WRONG — skips absent nodes, no notfound class applied:
  if (liveState) parts.push(liveStateClass(liveState))

  // CORRECT — all active-overlay, non-state nodes get a class:
  if (nodeStateMap && node.nodeType !== 'state') {
    parts.push(liveStateClass(liveState))
  }
  ```

- The reconciling pulse animation (`reconciling-pulse`) is applied as in
  `LiveDAG.css`.
- Root CR node (nodeType `instance`) always reflects the instance-level
  conditions (Ready/Progressing), not child-resource presence.
- State nodes (`nodeType === 'state'`) are never overlaid (they produce no
  Kubernetes objects); their existing amber-dashed styling is preserved.
- External ref nodes are overlaid if a matching child is found; otherwise they
  show `not-found` (gray dashed) — their dashed-purple base style is replaced
  by the `dag-node-live--notfound` rule while the overlay is active.
- The overlay does not change node positions, sizes, edges, labels, badges, or
  the `NodeDetailPanel` content.
- The `DAGTooltip` shows the live state line when overlay is active (reuses the
  `.dag-tooltip__state--*` classes already defined in `LiveDAG.css`).

### FR-004 — Instance summary bar

- Below the picker, a one-line summary shows:
  - Instance name + namespace (copyable with click)
  - Overall readiness badge: "Ready" (green) / "Reconciling" (amber) /
    "Error" (red) / "Unknown" (gray) derived from instance conditions
  - A "Open instance →" link that navigates to
    `/rgds/:rgdName/instances/:namespace/:name`
- The summary bar is hidden when no overlay is active.

### FR-005 — Clear overlay

- A "✕ Clear" button (or selecting "No overlay" in the picker) removes the
  overlay and reverts all node colors to their base static styles.
- Clearing resets `nodeStateMap` to `undefined` in `StaticChainDAG`.

### FR-006 — Graceful degradation

- Absent `status.conditions` on the instance → treat all present children as
  `alive` (no error, no reconciling indicator).
- Absent children → all nodes show `not-found` state.
- Instance not found (404 from API) → show inline error, revert to no-overlay.
- The static graph MUST remain fully functional (node click, panel, chain
  expand) regardless of overlay state.

---

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-001 | Graph tab renders the instance picker when the tab becomes active and instances exist. |
| AC-002 | Selecting "No overlay" shows the static DAG with no state coloring. |
| AC-003 | Selecting an instance fetches its state and colors **all non-state DAG nodes** within 5 s — including child resource nodes, not just the root CR. An RGD with N managed resource nodes must show N nodes with a live-state class, not just 1. |
| AC-004 | `reconciling` nodes show the amber pulse animation. |
| AC-005 | `error` nodes show the rose fill. |
| AC-006 | `alive` nodes show the emerald fill. |
| AC-007 | Nodes not represented in children receive the gray dashed `dag-node-live--notfound` class (not simply unstyled). |
| AC-008 | State nodes (`nodeType === 'state'`) are never overlaid. |
| AC-009 | The summary bar shows name/namespace, readiness badge, and "Open instance →" link. |
| AC-010 | The "Open instance →" link navigates to the correct `InstanceDetail` URL. |
| AC-011 | Clearing the overlay via picker or "✕ Clear" reverts all nodes to static styling. |
| AC-012 | If instances fail to load, an inline error + Retry is shown; the DAG is unaffected. |
| AC-013 | If overlay data fails, an inline error is shown; the DAG reverts to no-overlay. |
| AC-014 | If there are no instances, the picker area shows a "No instances" message. |
| AC-015 | The `NodeDetailPanel` slide-in and chain-expand affordances work unchanged with overlay. |
| AC-016 | No hardcoded hex colors — all live-state colors reference `tokens.css` via `var()`. |
| AC-017 | All non-state node types (resource, collection, external, externalCollection, and the root instance node) receive a live-state CSS class when the overlay is active. |
| AC-018 | Tooltip shows live state label when overlay is active. |
| AC-019 | `buildNodeStateMap` called with an RGD that has 6 managed resource nodes produces a `NodeStateMap` with entries for all 6 nodes — entries for nodes absent from children have `state: 'not-found'`. |

---

## Technical Approach

### Bug fixes required (GH #165)

The initial implementation has two compounding bugs that prevent child nodes
from being colored. Both must be fixed.

#### Bug 1 — `nodeBaseClass()` truthy guard skips `not-found` nodes

**File**: `web/src/components/StaticChainDAG.tsx`

The current code:
```typescript
if (liveState) parts.push(liveStateClass(liveState))
```
skips `liveStateClass(undefined)` because `undefined` is falsy. But
`liveStateClass(undefined)` is defined to return `'dag-node-live--notfound'`.
Absent nodes never receive any live-state class.

**Fix:**
```typescript
// Replace the truthy guard with an overlay-active guard:
if (nodeStateMap && node.nodeType !== 'state') {
  parts.push(liveStateClass(liveState))
}
```

This ensures every non-state node receives a live-state class when an overlay
is active — `notfound` for absent nodes, the real state for present ones.

#### Bug 2 — `buildNodeStateMap` only keys by observed children

**File**: `web/src/lib/instanceNodeState.ts`

The current signature `buildNodeStateMap(instance, children)` iterates only
over the children that are present, keys by `child.kind.toLowerCase()`. Nodes
whose kind has no matching child get `undefined` from `nodeStateForNode()`.
Combined with Bug 1, these nodes are completely unstyled.

**Fix:** Add `rgdNodes: DAGNode[]` as a third parameter. Pre-enumerate every
non-state RGD node and emit an explicit `'not-found'` entry for each node that
has no matching child in the presence map. See FR-002a for the full algorithm.

**Signature change:**
```typescript
// Before:
buildNodeStateMap(instance: K8sObject, children: K8sObject[]): NodeStateMap

// After:
buildNodeStateMap(
  instance: K8sObject,
  children: K8sObject[],
  rgdNodes: DAGNode[],
): NodeStateMap
```

**Call site** in `RGDDetail.tsx` must be updated to pass `dagGraph.nodes`.

### Component changes

#### `web/src/components/StaticChainDAG.tsx`

- Add optional prop `nodeStateMap?: NodeStateMap` (imported from
  `@/lib/instanceNodeState`).
- In `NodeGroup` / node `<g>` rendering: when `nodeStateMap` is provided,
  compute `nodeStateForNode(node, nodeStateMap)` and call `liveStateClass()`
  unconditionally for non-state nodes (Bug 1 fix above).
- The `reconciling-pulse` keyframe animation is defined globally in `tokens.css`;
  no import of `LiveDAG.css` needed.
- The `DAGTooltip` already accepts `nodeState?: NodeLiveState`; if not, add it.

#### `web/src/lib/instanceNodeState.ts`

- Add `rgdNodes: DAGNode[]` as a third argument to `buildNodeStateMap` (Bug 2
  fix above).
- Pre-enumerate all non-state, non-instance nodes from `rgdNodes` and emit
  explicit `'not-found'` entries for nodes absent from the children presence map.
- The `NodeStateMap` type does not change — it remains `Record<string, { state: NodeLiveState }>`.

#### `web/src/pages/RGDDetail.tsx`

- Add state for the instance overlay:
  - `overlayInstance: string | null` — `"<namespace>/<name>"` or `null`
  - `overlayNodeStateMap: NodeStateMap | null`
  - `overlayLoading: boolean`
  - `overlayError: string | null`
  - `instancePickerItems: { ns: string; name: string }[]`
  - `pickerLoading: boolean`
  - `pickerError: string | null`
- Fetch picker items when `activeTab === 'graph'` (same lazy pattern as
  `activeTab === 'instances'`).
- When `overlayInstance` changes, fetch instance + children and call
  `buildNodeStateMap(instance, children, dagGraph.nodes)`.
- Pass `nodeStateMap={overlayNodeStateMap ?? undefined}` to `StaticChainDAG`.

#### New component: `web/src/components/InstanceOverlayBar.tsx`

- Self-contained component that renders the picker + summary bar.
- Props:
  - `rgdName: string`
  - `items: { ns: string; name: string }[]`
  - `loading: boolean`
  - `error: string | null`
  - `selected: string | null` — `"<ns>/<name>"` or `null`
  - `instance: K8sObject | null` — for summary bar readiness badge
  - `overlayLoading: boolean`
  - `overlayError: string | null`
  - `onSelect: (value: string | null) => void`
  - `onRetry: () => void`

### CSS changes

#### `web/src/components/StaticChainDAG.css`

- Add live-state rule blocks mirroring `LiveDAG.css` (or `@import`):
  - `.static-chain-dag .dag-node-live--alive rect.dag-node-rect { ... }`
  - `.static-chain-dag .dag-node-live--reconciling rect.dag-node-rect { ... }`
  - `.static-chain-dag .dag-node-live--error rect.dag-node-rect { ... }`
  - `.static-chain-dag .dag-node-live--notfound rect.dag-node-rect { ... }`
  - `@keyframes reconciling-pulse` (copy from `LiveDAG.css` to avoid import
    order issues with Vite CSS modules).

#### New file: `web/src/components/InstanceOverlayBar.css`

- Toolbar row layout, picker select, summary bar, readiness badge.
- All colors via `tokens.css` `var()`.

### Test scenario: multi-resource RGD overlay (AC-019)

**Given**: an RGD with 6 managed resource nodes (e.g. `dungeon-graph` or the
`test-app` fixture with extra resources) and one live instance where only 2 of
the 6 resource Kubernetes objects exist in the cluster.

**When**: the user selects that instance in the overlay picker.

**Then**:
- 2 nodes show `dag-node-live--alive` (the present resources).
- 4 nodes show `dag-node-live--notfound` (the absent resources).
- 0 non-state nodes have no live-state class at all.
- The root CR node shows `dag-node-live--alive` (instance exists and is Ready).
- State nodes (if any) remain unstyled.

**Unit test** (`instanceNodeState.test.ts`): `buildNodeStateMap` with 6
`rgdNodes` (kinds: Deployment, Service, ConfigMap, Secret, Ingress, HPA) and
2 children (Deployment + Service) → output map has entries for all 6 kinds,
4 with `state: 'not-found'`, 2 with `state: 'alive'`.

### No backend changes

All required API endpoints already exist:
- `GET /api/v1/rgds/{name}/instances` — populate picker
- `GET /api/v1/instances/{ns}/{name}?rgd={name}` — overlay instance
- `GET /api/v1/instances/{ns}/{name}/children?rgd={name}` — children

### E2E test update (AC-003 hardening)

`test/e2e/journeys/029-dag-instance-overlay.spec.ts` Step 3 currently uses a
soft assertion (graceful skip if live-state classes don't appear). Once the
bugs are fixed, Step 3 MUST be changed to a hard assertion:

```typescript
// Before (soft — broken feature hidden):
const count = await page.evaluate(() =>
  document.querySelectorAll('[class*="dag-node-live--"]').length
)
// passes even if count === 0 or count === 1

// After (hard — catches regression):
await expect(page.locator('[class*="dag-node-live--"]')).toHaveCount(
  greaterThan(1),  // at minimum: root + at least one child node
  { timeout: 15_000 },
)
```

---

## UX Details

### Placement

The `InstanceOverlayBar` sits between the tab bar and the DAG SVG, at the top
of the `rgd-graph-area` `<div>`. It is only visible on the Graph tab.

### Picker appearance

```
[ Instance overlay: ▾ No overlay              ] [✕]?
[ default/my-webapp-instance ]
[ production/my-webapp-prod  ]
```

A standard `<select>` element styled consistently with the existing
`<NamespaceFilter>` select. No custom dropdown library.

### Summary bar

```
  ● Ready   default/my-webapp-instance   Open instance →
```

The readiness badge (dot + text) uses `--color-alive`, `--color-reconciling`,
`--color-error`, or `--color-text-faint`. All tokens, no inline colors.

### Node tooltip

When overlay is active, `DAGTooltip` gains a `State: Alive` line using the
existing `.dag-tooltip__state--alive` class.

---

## Design Token Requirements

No new tokens required — all live-state colors are already in `tokens.css`:
- `--node-alive-bg / --node-alive-border`
- `--node-reconciling-bg / --node-reconciling-border`
- `--node-error-bg / --node-error-border`
- `--node-notfound-bg / --node-notfound-border`
- `--color-alive`, `--color-reconciling`, `--color-error`, `--color-text-faint`

---

## Open Questions

None — all questions resolved. See research.md for full decision log.

---

## Amendment Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-24 | Added FR-002a (child-to-node mapping algorithm), updated FR-003 with `nodeBaseClass` guard fix, added AC-019, updated AC-003/AC-007/AC-017, added Technical Approach bug-fix section and multi-resource test scenario | GH #165: only root CR node was colored; all child nodes stayed unstyled. Two root causes identified: (1) `nodeBaseClass` truthy guard skipped `not-found` nodes; (2) `buildNodeStateMap` only keyed by observed children, leaving all absent nodes with `undefined` state. |
