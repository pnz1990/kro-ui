# Data Model: 041 — Error States UX Audit

This spec introduces no new backend types or Kubernetes resources. All changes are
frontend-only display transformations. The "data model" describes the new shared
TypeScript types and helper functions.

---

## New module: `web/src/lib/errors.ts`

### `TranslateContext`

```ts
export interface TranslateContext {
  /**
   * When false (RGD not Ready), prefer "CRD may not be provisioned yet" wording
   * for resource-not-found / no-kind-registered errors.
   * Undefined is treated the same as true (no RGD-readiness info available).
   */
  rgdReady?: boolean

  /**
   * Hint for contextual "check the X tab" suggestions.
   * Values: "validation" | "access" | "yaml" | "generate" | "docs"
   * Determines which tab link is appended to the translated message.
   * Omit when no tab-level suggestion is appropriate.
   */
  tab?: string
}
```

### `translateApiError(message, context?): string`

```ts
/**
 * Translate a raw API error string into a user-readable message.
 *
 * Pattern matching order (first match wins):
 *  1. "the server could not find the requested resource"
 *     → CRD not provisioned wording (context.rgdReady === false strengthens hint)
 *  2. /no kind "([^"]+)" is registered/i
 *     → "The kind '[X]' is not registered — the RGD CRD hasn't been created yet."
 *  3. HTTP 403 / "forbidden"
 *     → "Permission denied — kro-ui's service account lacks access."
 *  4. HTTP 401 / "Unauthorized"
 *     → "Not authenticated — kubeconfig credentials may have expired."
 *  5. "connection refused" / "dial tcp" / HTTP 503
 *     → "Cannot reach the Kubernetes API server — check cluster connectivity."
 *  6. "context deadline exceeded"
 *     → "Request timed out — the cluster may be under load. Try again."
 *  7. "x509: certificate"
 *     → "TLS certificate error — kubeconfig certificate may be invalid or expired."
 *
 * Returns the original message unchanged when no pattern matches.
 */
export function translateApiError(message: string, context?: TranslateContext): string
```

---

## New helper in `web/src/lib/conditions.ts`

### `conditionStatusLabel(type, status): string`

```ts
/**
 * Translate a raw Kubernetes condition status string to a display label.
 *
 * For normal-polarity conditions:
 *   "True"    → "Healthy"
 *   "False"   → "Failed"
 *   "Unknown" → "Pending"
 *
 * For negation-polarity conditions (NEGATION_POLARITY_CONDITIONS):
 *   "True"    → "Failed"   (e.g. ReconciliationSuspended=True → reconciliation is off → bad)
 *   "False"   → "Healthy"  (e.g. ReconciliationSuspended=False → reconciliation running → good)
 *   "Unknown" → "Pending"
 *
 * Returns the raw status string when none of the above match (defensive fallback).
 */
export function conditionStatusLabel(type: string, status: string): string
```

---

## No new entity types, no new state shapes

The 32 findings in this spec are all localised to render functions:
- `string | null` error state is already in all components
- No new props added that change component interfaces
- Exception: `EventsPanel` gains a new optional `namespace?: string` prop for FR-014
  (the kubectl command in the empty-events hint needs the namespace)

### `EventsPanel` prop change

```ts
// Before
interface EventsPanelProps {
  events: K8sList | null
}

// After
interface EventsPanelProps {
  events: K8sList | null
  /** Instance namespace — used in the "No events" help text */
  namespace?: string
}
```

All existing callers pass no `namespace` → `undefined` → graceful degradation (omit the
kubectl command's `-n` flag in the hint text, or omit the whole command).
