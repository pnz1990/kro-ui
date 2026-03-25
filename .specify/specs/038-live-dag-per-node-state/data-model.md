# Data Model: 038-live-dag-per-node-state

## Overview

This is a frontend-only change. No new Kubernetes resource types, no new API
endpoints, no new Go types. The only data model change is extending the
TypeScript types in `web/src/lib/instanceNodeState.ts`.

---

## Entity: `NodeLiveState` (extended)

**File**: `web/src/lib/instanceNodeState.ts`

**Before**:
```typescript
type NodeLiveState = 'alive' | 'reconciling' | 'error' | 'not-found'
```

**After**:
```typescript
type NodeLiveState = 'alive' | 'reconciling' | 'error' | 'pending' | 'not-found'
```

| Value | Meaning | Visual |
|-------|---------|--------|
| `alive` | Child resource exists, no error conditions | Emerald fill + border |
| `reconciling` | Child resource exists, `Progressing=True` condition | Amber fill + border + pulse animation |
| `error` | Child resource has `Ready=False` or `Available=False`, or is terminating | Rose fill + border |
| `pending` | **NEW** — Node has `includeWhen` expression(s) and is absent from children (excluded by condition) | Violet fill + dashed border |
| `not-found` | Node is absent from children list, no `includeWhen` expressions (not yet created) | Gray surface + border |

---

## Entity: `NodeStateEntry` (unchanged)

**File**: `web/src/lib/instanceNodeState.ts`

No structural changes. The `state` field type widens automatically when
`NodeLiveState` is extended.

```typescript
interface NodeStateEntry {
  state: NodeLiveState      // now includes 'pending'
  kind: string
  name: string
  namespace: string
  group: string
  version: string
  terminating?: boolean
  finalizers?: string[]
  deletionTimestamp?: string
}
```

---

## Algorithm: `buildNodeStateMap()` (extended)

**File**: `web/src/lib/instanceNodeState.ts`

### Before (existing logic)

```
presentState = derive from CR status.conditions (one of: alive | reconciling | error)
for each child → state = presentState (unless terminating → error)
for each absent node → state = not-found
```

### After (per-node state)

```
globalState = derive from CR status.conditions (alive | reconciling | error)

for each child:
  if terminating → nodeState = 'error'
  else if globalState != 'alive' → nodeState = globalState  (CR-level wins)
  else:
    inspect child's own status.conditions:
      if Ready=False OR Available=False → nodeState = 'error'
      if Progressing=True              → nodeState = 'reconciling'
      else                             → nodeState = 'alive'

for each absent RGD node:
  if node.includeWhen.length > 0 → state = 'pending'    ← NEW
  else                           → state = 'not-found'
```

### Precedence table

| Signal | State assigned | Priority |
|--------|---------------|----------|
| `deletionTimestamp` set on child | `error` | Highest (overrides all) |
| CR has `Progressing=True` | `reconciling` (global) | 2nd |
| CR has `Ready=False` | `error` (global) | 3rd |
| Child has `Ready=False` or `Available=False` | `error` (per-node) | 4th |
| Child has `Progressing=True` | `reconciling` (per-node) | 5th |
| Child present, no error conditions | `alive` | 6th |
| Node absent, has `includeWhen` | `pending` | 7th |
| Node absent, no `includeWhen` | `not-found` | Lowest |

---

## CSS Model: `dag-node-live--pending` (new)

**File**: `web/src/components/LiveDAG.css`

```css
.live-dag-container .dag-node-live--pending rect.dag-node-rect {
  fill:             var(--node-pending-bg);
  stroke:           var(--node-pending-border);
  stroke-dasharray: 6 3;
}
```

Tokens `--node-pending-bg` and `--node-pending-border` already exist in
`tokens.css` for both dark and light modes — no token additions required.

The dashed stroke (`stroke-dasharray`) visually distinguishes `pending` (known
excluded) from `not-found` (also dashed) — same pattern as the existing
`--notfound` rule, but with violet color.

---

## CSS Model: `.dag-tooltip__state--pending` (new)

**File**: `web/src/components/DAGTooltip.css`

```css
.dag-tooltip__state--pending { color: var(--color-pending); }
```

---

## State Transitions

```
         ┌──────────────────────────────────┐
         │         RGD node in DAG           │
         └──────────────┬───────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │ present in children?       │
         YES                          NO
          │                            │
          ▼                            ├─ includeWhen expr? ──YES──▶ pending (violet/dashed)
  inspect conditions                  │
          │                            └─ no includeWhen   ──────▶ not-found (gray/dashed)
   ┌──────┼──────┐
  terminating  Progressing=True  Ready/Available=False  otherwise
   │             │                     │                  │
   ▼             ▼                     ▼                  ▼
 error      reconciling              error              alive
(rose)       (amber)                (rose)            (emerald)
```

Note: When CR-level `globalState` is `reconciling` or `error`, per-node
condition inspection is skipped and `globalState` applies to all present nodes.
