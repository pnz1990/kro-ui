# Data Model: 031-deletion-debugger

This spec is entirely frontend-only. No new backend entities, no database changes. The "data model" here describes the TypeScript types, derived state, and component prop interfaces introduced by this feature.

---

## 1. New `web/src/lib/k8s.ts` — Kubernetes Metadata Types

```typescript
// Core metadata type (typed view of the unstructured metadata field)
export interface KubernetesMetadata {
  name?: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;         // RFC3339; set = object is Terminating
  deletionGracePeriodSeconds?: number;
  finalizers?: string[];              // may be absent; absent = []
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: OwnerReference[];
  generation?: number;
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}
```

### Accessor functions

```typescript
// Single safe extractor — the ONLY place that casts from unknown
function extractMetadata(obj: K8sObject): KubernetesMetadata

// Deletion state queries (built on extractMetadata)
function isTerminating(obj: K8sObject): boolean         // deletionTimestamp set
function getFinalizers(obj: K8sObject): string[]         // always returns array (never undefined)
function getDeletionTimestamp(obj: K8sObject): string | undefined
function getKroFinalizers(obj: K8sObject): string[]      // finalizers starting with 'kro.run/'
function getNonKroFinalizers(obj: K8sObject): string[]   // all other finalizers

// Event classification
const DELETION_REASONS: ReadonlySet<string>              // canonical set of deletion reason strings
function isDeletionEvent(event: K8sObject): boolean      // event.reason in DELETION_REASONS
```

---

## 2. Extended `ChildNodeState` (in `instanceNodeState.ts`)

The existing `ChildNodeState` / `NodeStateMap` types track per-node live state. Extend to add terminating information:

```typescript
// Existing shape (for reference):
// interface ChildNodeState {
//   state: 'alive' | 'reconciling' | 'error' | 'notfound'
//   name?: string
//   namespace?: string
//   ...
// }

// Extended:
interface ChildNodeState {
  state: 'alive' | 'reconciling' | 'error' | 'notfound'
  name?: string
  namespace?: string
  terminating?: boolean           // NEW: true if child has deletionTimestamp set
  finalizers?: string[]           // NEW: child's finalizer list (may be empty)
  deletionTimestamp?: string      // NEW: raw ISO string from metadata
}
```

The `terminating` field takes precedence over `state` for visual rendering in DeepDAG:
- If `terminating === true`, the node ring uses `--node-error-border` / error state CSS.
- The `⊗` badge is shown.
- Other state logic is unchanged.

---

## 3. `TerminatingBanner` Component Props

```typescript
interface TerminatingBannerProps {
  deletionTimestamp: string   // RFC3339 ISO timestamp
  tick: number                // from usePolling — triggers relative time recalculation
}
```

Renders a `<div role="status" aria-live="polite" className="terminating-banner">` with:
- `⊗` character
- "Terminating since {relativeTime}" text
- `title={deletionTimestamp}` for ISO timestamp on hover

---

## 4. `FinalizersPanel` Component Props

```typescript
interface FinalizersPanelProps {
  finalizers: string[]          // list of finalizer strings to display
  defaultExpanded?: boolean     // true = shown expanded initially (default: false)
}
```

Renders a collapsible `<details>`/`<summary>` (native HTML, no JS collapse state) or a React `useState` controlled section:
- Summary text: "Finalizers" when expanded; "Finalizers ({n})" when collapsed
- Body: each finalizer as a `<span className="finalizer-badge">` pill
- `kro.run/*` prefixed finalizers get an additional `.finalizer-badge--kro` modifier class (subtle colour distinction)
- No rendering when `finalizers.length === 0`

---

## 5. Modified `RGDCard` Props

```typescript
// Existing RGDCard props (from RGDCard.tsx):
interface RGDCardProps {
  name: string
  kind: string
  group: string
  conditions: unknown[]
  resourceCount: number
  age: string
  namespace?: string
}

// Extended (FR-007):
interface RGDCardProps {
  // ...existing fields...
  terminatingCount?: number    // NEW: number of Terminating instances, absent = don't show badge
}
```

---

## 6. Instances Table Filter State

The "Terminating only" toggle (FR-005) is local `useState` on the `InstanceTable` component (or its parent in `RGDDetail.tsx`). No URL param needed (transient UI state).

```typescript
// In RGDDetail.tsx / InstanceTable.tsx:
const [showTerminatingOnly, setShowTerminatingOnly] = useState(false)

// Applied during rendering:
const filtered = showTerminatingOnly
  ? instances.filter(inst => isTerminating(inst))
  : instances
```

The `isTerminating()` call here takes a `K8sObject` (the raw instance from the list response) — no new API call.

---

## 7. Deletion Event Tagging

Events displayed in `EventsPanel` are tagged by calling `isDeletionEvent(event)`. No new data fetching. The tag is purely presentational:

```typescript
// EventsPanel renders each event with:
const isDeletion = isDeletionEvent(event)
// → adds class 'event-row--deletion' on the row
// → renders a small ⊘ icon/label alongside .event-type pill
```

---

## State Transitions

```
Instance lifecycle visible to kro-ui:
  HEALTHY
    │ kubectl delete issued
    ↓
  TERMINATING        (deletionTimestamp set, finalizers non-empty)
    │ kro removes its finalizer (all children gone)
    ↓
  GONE               (API returns 404 → existing "instance-gone-banner")

Child resource lifecycle:
  ALIVE
    │ kro deletes child during instance deletion
    ↓
  CHILD_TERMINATING  (child.deletionTimestamp set)
    │ child's controller completes cleanup
    ↓
  CHILD_GONE         (disappears from /children response)
```

---

## Validation Rules

| Field | Rule |
|---|---|
| `deletionTimestamp` | Valid RFC3339 string or absent. If present but unparseable by `new Date()`, fall back to displaying raw string. |
| `finalizers` | Array of strings. Empty array = no finalizers. Each finalizer string shown as-is (no length truncation; long strings scroll in the panel). |
| `terminatingCount` prop | If `0` or absent, badge not rendered. Never show `⊗ 0`. |
| Deletion event tagging | `isDeletionEvent` returns false for events with absent/empty `reason`. No tagging of events without reasons. |
