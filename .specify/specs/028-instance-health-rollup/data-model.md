# Data Model: 028-instance-health-rollup

**Generated**: 2026-03-23

---

## Entities

### `InstanceHealthState` (TypeScript type)

A 5-value union extending the existing `ReadyState` to cover all kro observable states.

```typescript
// web/src/lib/format.ts — new type
export type InstanceHealthState =
  | 'ready'         // Ready=True
  | 'reconciling'   // Progressing=True (checked before Ready)
  | 'error'         // Ready=False
  | 'pending'       // conditions present but all status=Unknown
  | 'unknown'       // conditions absent or empty array
```

**State priority order** (for sort: worst-first):
```
error=0  reconciling=1  pending=2  unknown=3  ready=4
```

**State derivation logic** (deterministic, left-to-right):
1. If `status.conditions` is absent or not an array → `unknown`
2. If any condition has `type === 'Progressing' && status === 'True'` → `reconciling`
3. If any condition has `type === 'Ready'`:
   - `status === 'True'` → `ready`
   - `status === 'False'` → `error`
   - `status === 'Unknown'` → continue to step 4
4. If all conditions have `status === 'Unknown'` → `pending`
5. Otherwise → `unknown`

---

### `InstanceHealth` (TypeScript interface)

Returned by the new `extractInstanceHealth()` function. Mirrors `ReadyStatus` shape.

```typescript
// web/src/lib/format.ts — new interface
export interface InstanceHealth {
  state: InstanceHealthState
  reason: string    // from the governing condition's reason field, or ''
  message: string   // from the governing condition's message field, or ''
}
```

**Validation rules**:
- `reason` and `message` must never be `undefined` or `null` — use `''` as fallback
- `state` must always be one of the 5 enum values — no `?`, no `null`

---

### `HealthSummary` (TypeScript interface)

Aggregated health across all instances of an RGD. Computed client-side from `listInstances` response.

```typescript
// web/src/components/RGDCard.tsx (internal, or promoted to format.ts)
export interface HealthSummary {
  total: number
  ready: number
  error: number
  reconciling: number
  pending: number
  unknown: number
}
```

**Derived display properties** (not stored, computed at render):
- `overallState: InstanceHealthState` — worst state across all instances:
  `error > reconciling > pending > unknown > ready`
- `label`: `"{ready} / {total} ready"` when `ready < total`; `"{total} ready"` when all ready;
  `"no instances"` when `total === 0`

**State transitions** (via poll):
- `HealthSummary` is recomputed on every successful `listInstances` fetch
- Previous value is preserved while a new fetch is in flight (no flicker)
- On fetch error: previous value is preserved; chip shows last-known state

---

### `HealthChip` (React component props)

```typescript
// web/src/components/HealthChip.tsx
interface HealthChipProps {
  summary: HealthSummary | null   // null = loading / fetch not yet complete
  loading?: boolean               // true = show skeleton
}
```

**Rendering rules**:
- `summary === null && loading === true` → skeleton placeholder (same width as a typical chip)
- `summary === null && loading === false` → render nothing (fetch failed silently)
- `summary.total === 0` → `"no instances"` in `--color-text-muted`
- `summary.ready === summary.total` → `"{total} ready"` in `--color-alive`
- `summary.error > 0` → `"{ready} / {total} ready"` in `--color-status-error`
- `summary.reconciling > 0` (no errors) → `"{ready} / {total} ready"` in `--color-status-warning`
- otherwise → `"{ready} / {total} ready"` in `--color-status-unknown`

---

### `HealthPill` (React component props)

```typescript
// web/src/components/HealthPill.tsx
interface HealthPillProps {
  health: InstanceHealth | null   // null = loading
}
```

**Label mapping**:
| `state` | Label | CSS class modifier |
|---------|-------|-------------------|
| `ready` | `Ready` | `health-pill--ready` |
| `reconciling` | `Reconciling` | `health-pill--reconciling` |
| `error` | `Error` | `health-pill--error` |
| `pending` | `Pending` | `health-pill--pending` |
| `unknown` | `Unknown` | `health-pill--unknown` |
| `null` (loading) | loading skeleton | `health-pill--loading` |

`data-testid="health-pill"` (required for E2E test step 4).

---

### `ReadinessBadge` (extended)

Current 3 states extended to 5 by accepting `InstanceHealth` (or the `state` field of it).

```typescript
// web/src/components/ReadinessBadge.tsx — updated prop type
interface ReadinessBadgeProps {
  status: ReadyStatus | InstanceHealth   // accepts both (same shape)
}
```

**New CSS modifier classes** to add:
| State | CSS class | Color tokens |
|-------|-----------|-------------|
| `reconciling` | `readiness-badge--reconciling` | `--color-status-reconciling`, `--node-reconciling-bg`, `--color-reconciling` |
| `pending` | `readiness-badge--pending` | `--color-status-pending`, `--node-pending-bg`, `--color-pending` |

**Label mapping additions**:
| state | Label |
|-------|-------|
| `reconciling` | `Reconciling` |
| `pending` | `Pending` |

---

### `ConditionsPanel` (updated behavior)

No new types. Behavior changes:
- **Empty state**: `conditions.length === 0` renders `"Not reported"` (not `"No conditions."`)
  with `data-testid="conditions-panel-empty"`
- **Summary line**: When `conditions.length > 0`, render a heading row:
  `"{trueCount} / {total} conditions healthy"` where `trueCount = conditions.filter(c => c.status === 'True').length`
- **Absent fields**: `reason` shown only when `c.reason !== undefined && c.reason !== ''`;
  `lastTransitionTime` shown only when `c.lastTransitionTime` is present

---

## New Token Additions to `tokens.css`

```css
/* ── Semantic: status badges (new for 028) ───────────────────────── */
--color-status-reconciling:  #f59e0b;   /* Reconciling badge (= --color-reconciling)  */
--color-status-pending:      #8b5cf6;   /* Pending badge (= --color-pending)          */
```

Both tokens must be added to both dark mode (default) and light mode (`[data-theme="light"]`)
blocks. Light mode values will mirror `--color-reconciling` and `--color-pending` light
equivalents (already defined in tokens.css).

---

## `api.ts` — `get()` helper extension

```typescript
// web/src/lib/api.ts — extend get() signature
function get<T>(path: string, options?: { signal?: AbortSignal }): Promise<T>
```

The underlying `fetch()` call inside `get()` must pass `signal: options?.signal` to the
`RequestInit`. This is the minimal change needed to support abort on card unmount.
