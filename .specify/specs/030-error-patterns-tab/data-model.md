# Data Model: 030-error-patterns-tab

**Date**: 2026-03-23  
**Branch**: `030-error-patterns-tab`

---

## Overview

This spec is frontend-only. There are no new database schemas, Kubernetes CRD
changes, or backend storage additions. The data model describes the TypeScript
types used by `ErrorsTab.tsx` to represent the aggregated error view, derived
from existing API responses.

---

## Source Types (from existing API)

### `K8sObject` (from `@/lib/api`)

```typescript
export type K8sObject = Record<string, unknown>
```

The raw unstructured instance returned by `listInstances()`. Conditions are
extracted from `(obj.status as Record<string, unknown>).conditions`.

### `K8sCondition` (inlined in `ErrorsTab.tsx`)

The shape of each element in `instance.status.conditions[]`. Mirrors the
locally-typed interface in `ConditionsPanel.tsx`.

```typescript
interface K8sCondition {
  type?: string             // Condition type, e.g. "Ready", "GraphVerified"
  status?: string           // "True" | "False" | "Unknown"
  reason?: string           // CamelCase reason code, e.g. "CELExpressionError"
  message?: string          // Human-readable raw message from kro controller
  lastTransitionTime?: string // ISO 8601 timestamp
}
```

**Validation rules**:
- If `type` is absent or empty: skip this condition entirely
- If `status !== "False"`: skip this condition (not an error)
- If `reason` is absent: treat as empty string; use `"(no reason)"` as display label

---

## Derived Types (new in `ErrorsTab.tsx`)

### `InstanceRef`

A lightweight reference to a specific instance — carries only what is needed
for display and navigation.

```typescript
interface InstanceRef {
  name: string              // Instance CR name (from metadata.name)
  namespace: string         // Instance namespace (from metadata.namespace)
  lastTransitionTime?: string // From the specific failing condition
}
```

**Validation rules**:
- Both `name` and `namespace` must be non-empty strings; if either is absent,
  the instance is skipped silently (constitution §XII)
- `lastTransitionTime` is optional; absent = not shown in the UI

### `ErrorGroup`

An aggregated view of all instances sharing the same `(conditionType, reason)`
failure pattern.

```typescript
interface ErrorGroup {
  conditionType: string    // Condition type, e.g. "Ready"
  reason: string           // Reason code, e.g. "CELExpressionError"; "" = absent
  message: string          // Canonical message (from the instance with the most
                           // recent lastTransitionTime; fallback to first seen)
  count: number            // Total affected instance count (= instances.length)
  instances: InstanceRef[] // Full list, sorted: name asc within a group
}
```

**Key invariants**:
- `count === instances.length` always
- Groups are deduplicated: each `(conditionType, reason)` key appears at most once
- `message` is never empty string: if source message is absent, use `"(no message)"`

---

## Group Key

```
groupKey = conditionType + "/" + reason
```

Examples:
- `"Ready/CELExpressionError"` → condition type `Ready`, reason `CELExpressionError`
- `"GraphVerified/"` → condition type `GraphVerified`, reason absent
- `"Ready/"` → condition type `Ready`, reason absent

The `/` separator is only for internal keying; the display label shows
`conditionType` and `reason` separately.

---

## Aggregation Algorithm

```
groupErrorPatterns(instances: K8sObject[]): ErrorGroup[]

1. acc = Map<string, ErrorGroup>()
2. for each instance in instances:
     name = instance.metadata.name  (skip if absent)
     ns   = instance.metadata.namespace  (skip if absent)
     conditions = instance.status.conditions ?? []
     for each c in conditions:
       if c.status !== "False" → skip
       if !c.type → skip
       key = c.type + "/" + (c.reason ?? "")
       ref = { name, namespace: ns, lastTransitionTime: c.lastTransitionTime }
       if key not in acc:
         acc[key] = { conditionType: c.type, reason: c.reason ?? "",
                      message: c.message ?? "(no message)",
                      count: 0, instances: [] }
       group = acc[key]
       group.count++
       group.instances.push(ref)
       // Update canonical message if this condition is more recent
       if c.lastTransitionTime > group.canonicalTime:
         group.message = c.message ?? "(no message)"
         group.canonicalTime = c.lastTransitionTime
3. Sort groups: count desc, then conditionType asc, then reason asc
4. Within each group, sort instances: name asc, namespace asc
5. Return groups (strip canonicalTime from final output)
```

---

## Extracted Shared Utility

### `rewriteConditionMessage` → `web/src/lib/conditions.ts`

Extracted from `ConditionItem.tsx` (no behavior change). This is the only
new `@/lib/` addition from this spec.

```typescript
// web/src/lib/conditions.ts

/**
 * Rewrites known kro Go error strings to plain-English summaries.
 * Returns null if no rewrite pattern matches (caller shows raw message).
 */
export function rewriteConditionMessage(
  reason: string | undefined,
  message: string | undefined,
): string | null
```

`ConditionItem.tsx` is updated to `import { rewriteConditionMessage } from '@/lib/conditions'`
instead of defining it locally. No behavioral changes to `ConditionItem`.

---

## State Variables in `ErrorsTab.tsx`

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `instances` | `K8sObject[] \| null` | `null` | Raw API response items |
| `loading` | `boolean` | `true` | Loading indicator control |
| `error` | `string \| null` | `null` | API error message |
| `expandedGroups` | `Set<string>` | `new Set()` | Per-group "show all instances" toggle |
| `rawGroups` | `Set<string>` | `new Set()` | Per-group "show raw error" toggle |

`groups` is derived via `useMemo(() => groupErrorPatterns(instances ?? []), [instances])`.

---

## State Transitions

```
INITIAL (loading=true, instances=null, error=null)
  │
  ├─→ API success → loading=false, instances=items, error=null
  │     ├─→ items.length === 0           → "No instances yet" empty state
  │     ├─→ groupErrorPatterns = []      → "All instances are healthy" state
  │     └─→ groupErrorPatterns.length>0  → Error groups list
  │
  └─→ API failure → loading=false, instances=null, error=message
        └─→ Error banner + Retry button
              └─→ Retry clicked → back to INITIAL
```
