# Spec: 29.4 — Per-node reconciliation duration badge

## Design reference
- **Design doc**: `docs/design/29-instance-management.md` §Future item 29.4
- **Issue**: #773
- **Closes**: #773

## What
Each live DAG node's detail panel (LiveNodeDetailPanel) shows how long it has been
in its current state next to the live state badge.

Example: `Ready · 4m in state`

## Why
The most frequent operator triage question is "has this node always been stuck or
did it just transition to error?". Without this, operators must open the YAML tab,
find the Ready condition, and mentally compute the elapsed time. The badge surfaces
this directly in the node detail panel.

## Data source
`conditions[type=Ready].lastTransitionTime` on the child resource, stored as
`NodeStateEntry.stateEnteredAt` in the state map. Rendered via `formatAge()`.

## Acceptance criteria

### Zone 1 — Must
- [x] `NodeStateEntry.stateEnteredAt?: string` field added to `instanceNodeState.ts`
- [x] `buildNodeStateMap()` populates `stateEnteredAt` from `conditions[type=Ready].lastTransitionTime`
- [x] Falls back to first condition's `lastTransitionTime` when Ready is absent
- [x] `LiveNodeDetailPanelProps.stateEnteredAt?: string` added
- [x] `LiveNodeDetailPanel` renders `{formatAge(stateEnteredAt)} in state` next to StateBadge
- [x] Absent gracefully (no render) when `stateEnteredAt` is undefined
- [x] `InstanceDetail.tsx` derives and passes `selectedNodeStateEnteredAt`
- [x] `docs/design/29-instance-management.md` 29.4 promoted 🔲→✅
- [x] 5 unit tests for `stateEnteredAt` in `instanceNodeState.test.ts`

## Out of scope
- DAG node SVG changes (too risky to node geometry; panel is cleaner surface)
- Tooltip wiring (can be added in a follow-up)
