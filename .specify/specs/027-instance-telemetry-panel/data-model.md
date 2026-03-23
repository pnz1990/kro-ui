# Data Model: Instance Telemetry Panel (027)

**Phase 1 output** — entities, state, and data flows.

---

## Overview

This feature is entirely client-side. There are **no new backend entities, API
responses, or Kubernetes resource types**. All data is derived from existing API
responses already fetched by `InstanceDetail.tsx`.

---

## Derived Display Entities

### `InstanceTelemetry`

A transient computed object produced by `web/src/lib/telemetry.ts` functions.
Never persisted; recomputed on every render cycle.

| Field | Type | Source | Derivation |
|---|---|---|---|
| `age` | `string` | `instance.metadata.creationTimestamp` | `formatAge(ts)` or `'Not reported'` |
| `timeInState` | `string` | `instance.status.conditions[type=Ready].lastTransitionTime` | `formatAge(ts)` or `'Not reported'` |
| `childHealth` | `ChildHealthSummary` | `nodeStateMap` | Count by `.state` |
| `warningCount` | `number` | `events.items[type=Warning]` | `Array.filter().length` |

---

### `ChildHealthSummary`

Returned by `countHealthyChildren(nodeStateMap: NodeStateMap)`.

| Field | Type | Description |
|---|---|---|
| `healthy` | `number` | Entries with `state === 'alive' \| 'reconciling'` |
| `total` | `number` | `Object.keys(nodeStateMap).length` |
| `hasError` | `boolean` | Any entry with `state === 'error'` |

**Rendering rule**:
- `total === 0` → show `0/0`, color `--color-text-muted`
- `hasError` → show `healthy/total`, color `--color-error`
- otherwise → show `healthy/total`, color `--color-alive`

---

## Input Data Shapes (existing)

### `K8sObject` (from `@/lib/api`)

Used to extract `metadata.creationTimestamp` and `status.conditions`.

Relevant sub-structure:
```ts
{
  metadata?: {
    creationTimestamp?: string  // ISO 8601 e.g. "2026-01-01T00:00:00Z"
    name?: string
    namespace?: string
  }
  status?: {
    conditions?: Array<{
      type: string              // e.g. "Ready", "Progressing"
      status: string            // "True" | "False" | "Unknown"
      reason?: string
      message?: string
      lastTransitionTime?: string  // ISO 8601
    }>
  }
}
```

### `NodeStateMap` (from `@/lib/instanceNodeState`)

```ts
type NodeStateMap = Record<string, NodeStateEntry>

interface NodeStateEntry {
  state: 'alive' | 'reconciling' | 'error' | 'not-found'
  kind: string
  name: string
  namespace: string
  group: string
  version: string
}
```

Key is `kind.toLowerCase()`. `TelemetryPanel` only inspects `.state` values via
`Object.values(nodeStateMap)`.

### `K8sList` (from `@/lib/api`)

```ts
type K8sList = { items: K8sObject[]; metadata: Record<string, unknown> }
```

Each event item has `type: string` (`'Normal'` or `'Warning'`). Warnings are
counted by `items.filter(e => e.type === 'Warning').length`.

---

## Component Prop Interfaces

### `TelemetryPanelProps`

```ts
interface TelemetryPanelProps {
  /** The live CR instance — source of age and condition timing. */
  instance: K8sObject
  /** Pre-computed node state map — source of child health counts. */
  nodeStateMap: NodeStateMap
  /** Events for this instance — source of warning count. */
  events: K8sList
}
```

---

## Pure Function Signatures (`web/src/lib/telemetry.ts`)

```ts
import type { K8sObject, K8sList } from '@/lib/api'
import type { NodeStateMap } from '@/lib/instanceNodeState'
import { formatAge } from '@/lib/format'

/** Returns formatAge string or 'Not reported'. */
export function extractInstanceAge(instance: K8sObject): string

/** Returns formatAge of Ready.lastTransitionTime or 'Not reported'. */
export function extractTimeInState(instance: K8sObject): string

export interface ChildHealthSummary {
  healthy: number
  total: number
  hasError: boolean
}

/** Counts alive+reconciling vs total in nodeStateMap. */
export function countHealthyChildren(nodeStateMap: NodeStateMap): ChildHealthSummary

/** Counts events with type === 'Warning'. */
export function countWarningEvents(events: K8sList): number
```

---

## State Transitions

`TelemetryPanel` has **one piece of local state**: a tick counter that forces
re-renders every second so `formatAge` values stay current.

```
mount → setInterval(1s) → setTick(t+1) → re-render → formatAge() reads Date.now()
unmount → clearInterval
```

No other local state. All display values are derived synchronously from props on
each render.

---

## File Inventory

| File | Type | Status |
|---|---|---|
| `web/src/lib/telemetry.ts` | New | Pure derivation functions |
| `web/src/lib/telemetry.test.ts` | New | Unit tests |
| `web/src/components/TelemetryPanel.tsx` | New | React component |
| `web/src/components/TelemetryPanel.css` | New | Styles (token-only) |
| `web/src/components/TelemetryPanel.test.tsx` | New | Component tests |
| `web/src/pages/InstanceDetail.tsx` | Modified | Add `TelemetryPanel` render |
