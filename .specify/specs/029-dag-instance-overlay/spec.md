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
- On success, `buildNodeStateMap(instance, children)` produces a `NodeStateMap`
  that is passed to `StaticChainDAG` as an optional `nodeStateMap` prop.
- On failure, show a non-blocking inline error. Revert to no-overlay state.

### FR-003 — Live state coloring

- `StaticChainDAG` accepts a new optional prop `nodeStateMap?: NodeStateMap`.
- When `nodeStateMap` is provided, each node's `<rect>` gains the appropriate
  live-state CSS class:
  - `dag-node-live--alive`
  - `dag-node-live--reconciling`
  - `dag-node-live--error`
  - `dag-node-live--notfound`
- The reconciling pulse animation (`reconciling-pulse`) is applied as in
  `LiveDAG.css`.
- Root CR node (nodeType `instance`) always reflects the instance-level
  conditions (Ready/Progressing), not child-resource presence.
- State nodes (`nodeType === 'state'`) are never overlaid (they produce no
  Kubernetes objects); their existing amber-dashed styling is preserved.
- External ref nodes are overlaid if a matching child is found; otherwise they
  keep their dashed-purple base style.
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
| AC-003 | Selecting an instance fetches its state and colors DAG nodes within 5 s. |
| AC-004 | `reconciling` nodes show the amber pulse animation. |
| AC-005 | `error` nodes show the rose fill. |
| AC-006 | `alive` nodes show the emerald fill. |
| AC-007 | Nodes not represented in children are gray dashed (`not-found`). |
| AC-008 | State nodes (`nodeType === 'state'`) are never overlaid. |
| AC-009 | The summary bar shows name/namespace, readiness badge, and "Open instance →" link. |
| AC-010 | The "Open instance →" link navigates to the correct `InstanceDetail` URL. |
| AC-011 | Clearing the overlay via picker or "✕ Clear" reverts all nodes to static styling. |
| AC-012 | If instances fail to load, an inline error + Retry is shown; the DAG is unaffected. |
| AC-013 | If overlay data fails, an inline error is shown; the DAG reverts to no-overlay. |
| AC-014 | If there are no instances, the picker area shows a "No instances" message. |
| AC-015 | The `NodeDetailPanel` slide-in and chain-expand affordances work unchanged with overlay. |
| AC-016 | No hardcoded hex colors — all live-state colors reference `tokens.css` via `var()`. |
| AC-017 | All node types (resource, collection, external, externalCollection) receive overlay colors. |
| AC-018 | Tooltip shows live state label when overlay is active. |

---

## Technical Approach

### Component changes

#### `web/src/components/StaticChainDAG.tsx`

- Add optional prop `nodeStateMap?: NodeStateMap` (imported from
  `@/lib/instanceNodeState`).
- In `NodeGroup` / node `<rect>` rendering: when `nodeStateMap` is provided,
  compute `liveStateClass(node, nodeStateMap)` (shared helper already in
  `@/lib/dag.ts`) and append it to the node's class list.
- The `reconciling-pulse` keyframe animation already exists in `LiveDAG.css`;
  import `LiveDAG.css` into `StaticChainDAG.css` (or duplicate the relevant
  keyframe — prefer importing to avoid divergence).
- The `DAGTooltip` already accepts `nodeState?: NodeLiveState` (check); if
  not, add it.

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
  `buildNodeStateMap`.
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

### No backend changes

All required API endpoints already exist:
- `GET /api/v1/rgds/{name}/instances` — populate picker
- `GET /api/v1/instances/{ns}/{name}?rgd={name}` — overlay instance
- `GET /api/v1/instances/{ns}/{name}/children?rgd={name}` — children

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

None — all data and design patterns are available from existing specs.
