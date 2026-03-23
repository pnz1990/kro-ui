# UI Contracts: 030-error-patterns-tab

**Date**: 2026-03-23  
**Branch**: `030-error-patterns-tab`

---

## New Components

### `ErrorsTab`

**File**: `web/src/components/ErrorsTab.tsx`

```typescript
interface ErrorsTabProps {
  /** RGD name from URL params — used to fetch instances. */
  rgdName: string
  /** Optional namespace filter from ?namespace= URL query param. */
  namespace?: string
}

export default function ErrorsTab(props: ErrorsTabProps): JSX.Element
```

**Rendered when**: `activeTab === "errors"` in `RGDDetail.tsx`  
**Data fetched**: `listInstances(rgdName, namespace)` — one call on mount / on prop change  
**CSS file**: `ErrorsTab.css` (imported internally, no external classname dependency)

#### DOM contract (for E2E tests)

| Selector / testid | Condition | Description |
|---|---|---|
| `[data-testid="errors-tab"]` | always | Root element |
| `[data-testid="errors-loading"]` | while fetching | Loading indicator |
| `[data-testid="errors-api-error"]` | on API failure | Error banner |
| `[data-testid="errors-retry-btn"]` | on API failure | Retry button |
| `[data-testid="errors-empty"]` | 0 instances | "No instances yet" message |
| `[data-testid="errors-all-healthy"]` | 0 failing groups | "All instances are healthy" message |
| `[data-testid="error-group"]` | per group | Repeating group container |
| `[data-testid="error-group-header"]` | per group | Group title (conditionType + reason) |
| `[data-testid="error-group-count"]` | per group | Count badge |
| `[data-testid="error-group-message"]` | per group | Error message area |
| `[data-testid="error-group-toggle-raw"]` | when rewrite exists | "Show raw error" toggle |
| `[data-testid="error-group-toggle-summary"]` | when rewrite exists + raw shown | "Show summary" toggle |
| `[data-testid="error-instance-link"]` | per instance link | Deep-link to instance detail |
| `[data-testid="error-group-overflow"]` | when count > 10 | "and N more" prose |

---

## Modified Components

### `RGDDetail.tsx` — Tab system

**Change**: `TabId` union extended with `"errors"`:

```typescript
// Before
type TabId = "graph" | "instances" | "yaml" | "validation" | "access" | "docs" | "generate"

// After
type TabId = "graph" | "instances" | "yaml" | "validation" | "errors" | "access" | "docs" | "generate"
```

**New tab button** (inserted after Validation tab button):
```html
<button
  data-testid="tab-errors"
  class="rgd-tab-btn"
  role="tab"
  aria-selected={activeTab === "errors"}
  onClick={() => setTab("errors")}
  type="button"
>
  Errors
</button>
```

**New tab content dispatch** (inserted after Validation block):
```tsx
{activeTab === "errors" && (
  <div className="rgd-tab-panel">
    <ErrorsTab
      rgdName={String(rgdName)}
      namespace={namespaceParam || undefined}
    />
  </div>
)}
```

**isValidTab guard update**:
```typescript
// After
function isValidTab(t: string | null): t is TabId {
  return (
    t === "graph" || t === "instances" || t === "yaml" ||
    t === "validation" || t === "errors" || t === "access" ||
    t === "docs" || t === "generate"
  )
}
```

---

## Extracted Shared Utility

### `@/lib/conditions`

**File**: `web/src/lib/conditions.ts` (new)

```typescript
/**
 * Rewrites known kro Go controller error strings to plain-English summaries.
 *
 * Returns a human-readable string on pattern match, or null if no known
 * pattern is matched (caller should fall back to displaying the raw message).
 *
 * Recognized patterns:
 *   1. 'cannot resolve group version kind' + 'schema not found'
 *      → "Referenced kind \"X\" is not yet registered…"
 *   2. 'references unknown identifiers'
 *      → "CEL expression references unknown identifier(s): [X, Y]…"
 *   3. 'unknown type: array' or ('field type' + 'array')
 *      → "Schema field uses 'type: array' which is not supported…"
 *
 * @param reason  - condition.reason (may be undefined)
 * @param message - condition.message (may be undefined)
 * @returns Rewritten plain-English string, or null
 */
export function rewriteConditionMessage(
  reason: string | undefined,
  message: string | undefined,
): string | null
```

**Consumers after this spec**:
1. `web/src/components/ConditionItem.tsx` (migrated from local definition)
2. `web/src/components/ErrorsTab.tsx` (new consumer)

---

## CSS Class Contract

All new CSS classes follow existing naming conventions (BEM-style with component prefix).

| Class | Element | Notes |
|---|---|---|
| `.errors-tab` | Root div | `data-testid="errors-tab"` |
| `.errors-tab__loading` | Loading state | |
| `.errors-tab__api-error` | API error banner | Uses `--node-error-bg`, `--color-error`, `--node-error-border` |
| `.errors-tab__retry-btn` | Retry button | Neutral; hover → `--color-primary` |
| `.errors-tab__empty` | No instances | Muted text (`--color-text-2`) |
| `.errors-tab__all-healthy` | All healthy | Uses `--color-alive`; paired with ✓ icon + text |
| `.errors-tab__summary` | "N patterns / M instances" summary | Rose text when groups > 0 |
| `.error-group` | One error group card | `border: 1px solid --color-border` |
| `.error-group__header` | Group title row | |
| `.error-group__type` | Condition type label | |
| `.error-group__reason` | Reason code | Muted; `--color-text-2` |
| `.error-group__count` | Count badge | Pill; `--node-error-bg` + `--color-error` border |
| `.error-group__message` | Message area | |
| `.error-group__message--rewritten` | Human-readable rewrite | Normal weight |
| `.error-group__message--raw` | Raw Go error string | `<pre>` monospace |
| `.error-group__toggle` | Show raw/summary toggle | Button, neutral style |
| `.error-group__instances` | Instance link list | `<ul>` |
| `.error-group__instance-link` | Per-instance `<Link>` | |
| `.error-group__overflow` | "and N more" prose | `--color-text-2` |
