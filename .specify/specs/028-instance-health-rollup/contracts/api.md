# API Contracts: 028-instance-health-rollup

**Generated**: 2026-03-23  
**Note**: This spec makes NO backend changes. All contracts documented here are
**read-only consumers** of existing endpoints. No new API endpoints are added.

---

## Consumed API Endpoints (Existing)

### `GET /api/v1/rgds/{name}/instances`

**Used by**: `RGDCard` (async health chip fetch), `InstanceTable` (already used)

**Request parameters**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | path string | yes | RGD name, URL-encoded |
| `namespace` | query string | no | Filter by namespace; omit for all |

**Response shape**:
```json
{
  "items": [
    {
      "metadata": { "name": "...", "namespace": "...", "creationTimestamp": "..." },
      "spec": { ... },
      "status": {
        "conditions": [
          {
            "type": "Ready",
            "status": "True",
            "reason": "ResourcesReady",
            "message": "All resources are ready",
            "lastTransitionTime": "2026-03-01T12:00:00Z"
          },
          {
            "type": "Progressing",
            "status": "False",
            "reason": "ReconciliationComplete",
            "message": "",
            "lastTransitionTime": "2026-03-01T12:00:00Z"
          }
        ]
      }
    }
  ],
  "metadata": {}
}
```

**How health is derived** (client-side):
```typescript
// For each item in items:
const health = extractInstanceHealth(item)
// → InstanceHealthState: 'ready' | 'reconciling' | 'error' | 'pending' | 'unknown'

// Aggregate to HealthSummary:
const summary = aggregateHealth(items)
// → { total, ready, error, reconciling, pending, unknown }
```

**AbortSignal support**: The `get()` helper in `api.ts` is extended to accept
`options?: { signal?: AbortSignal }` so `RGDCard` can cancel the fetch on unmount.

---

### `GET /api/v1/instances/{namespace}/{name}?rgd={rgdName}`

**Used by**: `InstanceDetail` page (already polled every 5s) — the `HealthPill`
derives its state from the same `fastData.instance` polled object.

**No change to this contract.** The `HealthPill` simply reads
`fastData?.instance` (already available) and calls `extractInstanceHealth()`.

---

## Frontend Component Contracts (Internal)

### `HealthChip` component API

```typescript
// Consumers: RGDCard
interface HealthChipProps {
  summary: HealthSummary | null  // null = still loading or fetch failed
  loading?: boolean              // true = show skeleton, false = hide chip
}
```

**Invariants**:
- Never throws or crashes on `null` summary
- Never renders `?`, `undefined`, or an empty element when `summary` is present
- Always renders `data-testid="health-chip"` on the root element

---

### `HealthPill` component API

```typescript
// Consumers: InstanceDetail header
interface HealthPillProps {
  health: InstanceHealth | null  // null = data not yet loaded
}
```

**Invariants**:
- Renders `data-testid="health-pill"` on root element
- When `health === null`: renders a skeleton/loading state, not blank
- Label text is always one of: `Ready`, `Reconciling`, `Error`, `Pending`, `Unknown`
- `title` attribute contains `reason` when non-empty (for error/reconciling states)

---

### `extractInstanceHealth` function API

```typescript
// Consumers: RGDCard (via aggregateHealth), InstanceDetail (HealthPill), InstanceTable (ReadinessBadge)
export function extractInstanceHealth(obj: K8sObject): InstanceHealth
```

**Contracts**:
- Pure function (no side effects, deterministic)
- Never returns `undefined` or throws
- `state` is always one of the 5 `InstanceHealthState` values
- `reason` and `message` are always `string` (never `undefined`)
- Calling with an empty object `{}` returns `{ state: 'unknown', reason: '', message: '' }`
