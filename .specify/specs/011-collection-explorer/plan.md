# Implementation Plan: Collection Explorer

**Spec**: `011-collection-explorer`
**Branch**: `011-collection-explorer`
**Created**: 2026-03-21

---

## Tech Stack

- **Frontend**: React 19 + TypeScript (strict), Vite, plain CSS with CSS custom properties
- **Backend**: No new endpoints required — children list already provided by `GET /api/v1/instances/{ns}/{name}/children`
- **Testing**: Vitest + `@testing-library/react` (existing pattern)
- **Styles**: `web/src/tokens.css` CSS custom properties only — no hardcoded hex values

---

## Architecture Overview

### Key Insight

The existing `GetInstanceChildren` backend endpoint already fetches all child resources labeled `kro.run/instance-name=<name>`. These children include collection items, each labeled with:
- `kro.run/node-id` — which forEach node created this resource
- `kro.run/collection-index` — 0-based position in the expanded array
- `kro.run/collection-size` — expected total count of the collection

No new backend endpoint is required. The `CollectionPanel` filters this existing `children` array client-side.

### Data Flow

```
InstanceDetail (existing)
  ├── children: K8sObject[]  ← fetched every 5s via getInstanceChildren()
  ├── selectedNode: DAGNode  ← set on LiveDAG node click
  └── panelMode: 'node' | 'collection'  ← NEW: routes to correct panel

When panelMode === 'collection':
  CollectionPanel receives { node, children, namespace, instanceName, onClose }
  → filters children by kro.run/node-id === node.id
  → sorts by kro.run/collection-index
  → renders table OR yaml drill-down view

LiveDAG (extended):
  → collection nodes get CollectionBadge overlay showing ready/total counts
```

---

## File Structure

### New Files

```
web/src/components/CollectionPanel.tsx      — Main collection explorer panel
web/src/components/CollectionPanel.css      — Panel styles
web/src/components/CollectionPanel.test.tsx — Unit tests
web/src/components/CollectionBadge.tsx      — Health badge (ready/total)
web/src/components/CollectionBadge.css      — Badge styles
web/src/components/CollectionBadge.test.tsx — Unit tests
```

### Modified Files

```
web/src/components/LiveDAG.tsx              — Add CollectionBadge to collection nodes
web/src/pages/InstanceDetail.tsx            — Route collection clicks to CollectionPanel
```

---

## Component Design

### CollectionPanel

**Props:**
```typescript
interface CollectionPanelProps {
  node: DAGNode                // The forEach collection node
  children: K8sObject[]        // ALL children from getInstanceChildren (pre-fetched)
  namespace: string            // Instance namespace (for resource YAML fetch)
  instanceName: string         // Instance name
  onClose: () => void
}
```

**Internal state:**
- `selectedItem: K8sObject | null` — the row clicked for YAML drill-down

**Filtering logic:**
```typescript
const items = children
  .filter(child => {
    const labels = (child.metadata as any)?.labels ?? {}
    return labels['kro.run/node-id'] === node.id
  })
  .sort((a, b) => {
    const ia = parseInt((a.metadata as any)?.labels?.['kro.run/collection-index'] ?? '0')
    const ib = parseInt((b.metadata as any)?.labels?.['kro.run/collection-index'] ?? '0')
    return ia - ib
  })
```

**Expected count detection:**
```typescript
const expectedTotal = parseInt(
  (items[0]?.metadata as any)?.labels?.['kro.run/collection-size'] ?? String(items.length)
)
```

**Status derivation** (per item):
- Check `status.phase` string → map to NodeLiveState-compatible status
- Check `status.conditions[type=Ready]` → 'Ready' / 'Error' / unknown

**Table columns:** Index | Name | Kind | Status | Age

**Views:**
1. Table view (default)
2. YAML view (selected item) — reuses `getResource()` + `KroCodeBlock`, same pattern as `YamlSection` in `LiveNodeDetailPanel`

**Panel layout:** Same fixed-position overlay as `LiveNodeDetailPanel` — `position: fixed; top: 48px; right: 0; width: 400px` (or use the existing `.node-detail-panel` class).

### CollectionBadge

**Props:**
```typescript
interface CollectionBadgeProps {
  nodeId: string        // The forEach node ID
  children: K8sObject[] // ALL children from getInstanceChildren
  // Layout hint for SVG positioning:
  nodeX: number
  nodeY: number
  nodeWidth: number
  nodeHeight: number
}
```

**Badge computation:**
```typescript
const items = children.filter(c =>
  (c.metadata as any)?.labels?.['kro.run/node-id'] === nodeId
)
const total = parseInt(
  (items[0]?.metadata as any)?.labels?.['kro.run/collection-size'] ?? String(items.length)
)
const ready = items.filter(c => isItemReady(c)).length
```

**Color:**
- `ready === total && total > 0` → `--color-alive` (green)
- `ready > 0 && ready < total` → `--color-reconciling` (amber)
- `ready === 0` → `--color-error` (red)

**SVG rendering:** An inline SVG `<text>` element positioned below the node's main label. Position: `x = nodeX + nodeWidth / 2` (centered), `y = nodeY + nodeHeight - 6`.

---

## Status Derivation for Collection Items

A collection item is "ready" if:
1. `status.phase === 'Running'` or `status.phase === 'Active'` or `status.phase === 'Succeeded'`, OR
2. `status.conditions` contains `{ type: 'Ready', status: 'True' }` or `{ type: 'Available', status: 'True' }`

All other states (Pending, Failed, Terminating, Missing) are not-ready.

This logic is implemented as a pure function `isItemReady(item: K8sObject): boolean` exported from `CollectionPanel.tsx` for testability.

---

## CSS Design

All colors via `var(--token)` only. Uses existing tokens:
- `--color-alive` / `--color-reconciling` / `--color-error` for health badge
- `--node-collection-bg` / `--node-collection-border` for panel header accent
- `--color-surface` / `--color-surface-2` for panel background
- `--color-border` for table row borders
- `--color-status-ready` / `--color-status-error` / `--color-status-warning` for status cells

Panel layout mirrors `NodeDetailPanel.css` / `LiveNodeDetailPanel.css`:
- `position: fixed; top: 48px; right: 0; width: 400px; height: calc(100vh - 48px)`
- Scrollable body: `overflow-y: auto`
- Table: `width: 100%; border-collapse: collapse`

---

## Testing Strategy

### CollectionPanel tests (`CollectionPanel.test.tsx`)

Uses Vitest + `@testing-library/react`. Tests pure logic via exported helper functions and component rendering.

```typescript
describe("CollectionPanel", () => {
  it("renders one row per collection item", ...)
  it("sorts items by collection-index", ...)
  it("shows empty state for 0 items", ...)
  it("transitions to YAML view on row click", ...)
})
```

### CollectionBadge tests (`CollectionBadge.test.tsx`)

```typescript
describe("CollectionBadge", () => {
  it("shows green when all ready", ...)
  it("shows amber when partially ready", ...)
  it("shows red when none ready", ...)
})
```

Helper `makeItem(index, ready, total)` builds minimal `K8sObject` with correct kro labels.

---

## Integration Points

### InstanceDetail changes

1. Add `panelMode` state: `'node' | 'collection'`
2. In `handleNodeClick`: branch on `node.nodeType === 'collection'`
3. In panel render section: switch between `<CollectionPanel>` and `<LiveNodeDetailPanel>` based on `panelMode`
4. The `.instance-detail-content--with-panel` class continues to work the same way (both panels are `position: fixed`)

### LiveDAG changes

1. Accept `children?: K8sObject[]` prop (optional — only collection nodes need it)
2. In `NodeGroup`: for collection nodes, render `CollectionBadge` SVG text elements inside the `<g>` element, below the node label

---

## Constraints and Decisions

- **No new backend endpoint**: children array already has all required data; client-side filtering is sufficient for NFR-001 (500ms for 100 items)
- **No pagination**: spec explicitly says "scrollable within the panel; no pagination required for v1"
- **YAML drill-down**: reuse `getResource()` API — same code path as `LiveNodeDetailPanel`'s `YamlSection`
- **Race condition**: when `items.length < expectedTotal` (kro.run/collection-size), mark missing items as "Pending" rows (spec edge case)
- **Legacy fallback**: if `kro.run/node-id` labels missing, show "Legacy collection — labels unavailable" message (spec edge case)
- **CollectionBadge in SVG**: must use SVG-safe rendering (no foreign objects) — `<text>` elements only
