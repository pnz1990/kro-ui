# Tasks: Collection Explorer (011)

## Phase 1 — Tests First

- [X] **T-001** Write `CollectionPanel.test.tsx` — unit tests for table rendering, sort, empty state, YAML drill-down transition
- [X] **T-002** Write `CollectionBadge.test.tsx` — unit tests for green/amber/red badge colors
- [X] **T-003** Write `isItemReady` pure-function tests inline in `CollectionPanel.test.tsx`

## Phase 2 — Core Components

- [X] **C-001** Create `web/src/components/CollectionPanel.tsx`
  - Export `isItemReady(item: K8sObject): boolean` pure helper
  - Filter and sort children by `kro.run/node-id` and `kro.run/collection-index`
  - Table view: Index | Name | Kind | Status | Age
  - Row click → YAML drill-down view with "Back to collection" button
  - Empty state for 0 items
  - Pending rows for missing items (race condition: items.length < expectedTotal)
  - Legacy fallback when `kro.run/node-id` labels absent
- [X] **C-002** Create `web/src/components/CollectionPanel.css`
  - Fixed panel layout matching `NodeDetailPanel.css` conventions
  - Table styles with token-based colors
  - Status cell colors: alive/reconciling/error/not-found
  - Scrollable table body
- [X] **C-003** Create `web/src/components/CollectionBadge.tsx`
  - SVG `<text>` element rendering ready/total count
  - Color: `--color-alive` (all), `--color-reconciling` (partial), `--color-error` (none)
  - Exported as standalone component (not SVG-embedded directly)
- [X] **C-004** Create `web/src/components/CollectionBadge.css`
  - Minimal CSS for the badge text in SVG context

## Phase 3 — Integration

- [X] **I-001** Extend `web/src/components/LiveDAG.tsx`
  - Accept `children?: K8sObject[]` prop
  - In `NodeGroup`: for collection nodes, render `CollectionBadge` as SVG text elements below the node label
- [X] **I-002** Extend `web/src/pages/InstanceDetail.tsx`
  - Add `panelMode: 'node' | 'collection'` state
  - Update `handleNodeClick`: set `panelMode = 'collection'` for `NodeTypeCollection` nodes
  - Replace `<LiveNodeDetailPanel>` with conditional render:
    - `panelMode === 'collection'` → `<CollectionPanel>`
    - `panelMode === 'node'` → `<LiveNodeDetailPanel>`
  - Pass `children` prop to `<LiveDAG>` for badge rendering

## Phase 4 — Validation

- [X] **V-001** Run `bun typecheck` (or `tsc --noEmit`) — 0 errors required (NFR-002)
- [X] **V-002** Run `bun test` — all tests pass (223/223)
- [ ] **V-003** Manual checklist:
  - [ ] Collection node click opens `CollectionPanel` (SC-001)
  - [ ] Items sorted by index, status colors correct (SC-002)
  - [ ] DAG collection badge shows accurate ready/total count (SC-003)
  - [ ] TypeScript strict mode passes with 0 errors (SC-004)
