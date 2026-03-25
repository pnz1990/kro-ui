# UI Contracts: 041 — Error States UX Audit

This spec adds no new API endpoints. All contracts are frontend-only: the render
contract for error/empty states across components.

---

## Error state render contract

Every component that can display an error MUST satisfy this contract:

| Element | Requirement |
|---|---|
| Error container | `role="alert"` for errors the user must act on; `role="status"` for non-critical degraded states (e.g. `MetricsStrip`) |
| Error message | Translated via `translateApiError()` — never raw `error.message` from `api.ts` |
| Retry button | Present whenever re-fetching the same resource would resolve the error |
| Navigation link | Present when the user has no path forward without leaving the current view (e.g. "← Back to Overview" on full-page errors) |
| `data-testid` | Required on the outermost error container |

---

## Empty state render contract

Every empty state (no data, no items) MUST satisfy:

| Element | Requirement |
|---|---|
| Explanatory text | Explain *why* the data might be absent (TTL expiry, filter, not created yet) |
| Actionable link | Provide at least one next step (kubectl command, tab link, doc link) where applicable |
| `data-testid` | Optional but preferred for non-trivial empty states |

---

## `translateApiError` contract

**Module**: `web/src/lib/errors.ts`  
**Exported**: Yes — named export  
**Pure function**: Yes — no side effects, no React imports  
**Return type**: `string` — always returns a string (never `null` or `undefined`)

### Invariants

- If the input `message` is empty or whitespace-only, return it unchanged.
- If no pattern matches, return the original `message` unchanged (never substitute a generic
  "Unknown error" — the raw message may be meaningful to an advanced operator).
- Matching is case-insensitive for HTTP status references (`Forbidden`, `forbidden`,
  `403 Forbidden` all match pattern 3).
- Pattern 2 (kind extraction) extracts the first double-quoted word from the error string.
  If extraction fails, it falls back to "the requested kind".

### Test contract

`errors.test.ts` MUST cover:

| Test group | Cases |
|---|---|
| Pattern 1 | Exact phrase; phrase embedded in longer string |
| Pattern 2 | With kind extraction; without kind in string |
| Pattern 3 | HTTP 403 prefix; lowercase "forbidden" |
| Pattern 4 | HTTP 401 prefix; "Unauthorized" |
| Pattern 5 | "connection refused"; "dial tcp"; HTTP 503 |
| Pattern 6 | Exact "context deadline exceeded" |
| Pattern 7 | "x509: certificate" |
| No match | Unknown error string returns original unchanged |
| Edge cases | Empty string; whitespace-only string |
| Context | `rgdReady: false` strengthens CRD hint in pattern 1 |

---

## `conditionStatusLabel` contract

**Module**: `web/src/lib/conditions.ts` (extends existing module)  
**Pure function**: Yes  
**Return type**: `string`

### Invariants

- For normal-polarity conditions: `"True"` → `"Healthy"`, `"False"` → `"Failed"`,
  `"Unknown"` → `"Pending"`, anything else → return raw value.
- For `NEGATION_POLARITY_CONDITIONS`: `"True"` → `"Failed"`, `"False"` → `"Healthy"`,
  `"Unknown"` → `"Pending"`.
- Must be covered by tests in the existing `conditions.test.ts`.

---

## `EventsPanel` prop extension contract

```ts
// No breaking change — `namespace` is optional
interface EventsPanelProps {
  events: K8sList | null
  namespace?: string    // NEW — instance namespace for the "No events" kubectl hint
}
```

Existing callers with no `namespace` prop continue to work.  
When `namespace` is undefined, the empty-events hint omits the `-n [namespace]` clause.
