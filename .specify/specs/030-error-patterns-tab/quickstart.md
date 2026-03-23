# Quickstart: 030-error-patterns-tab

**Date**: 2026-03-23  
**Branch**: `030-error-patterns-tab`

---

## What This Spec Delivers

A new **Errors** tab on the RGD detail page (`/rgds/:name`) that aggregates
`status.conditions` failures from all instances of the RGD, groups them by
error pattern, and provides navigable links to affected instances.

---

## Prerequisites

- Node.js 18+ / bun installed
- Go 1.25 (for build verification only — no Go changes in this spec)
- A running kro cluster with at least one RGD that has instances with
  `status.conditions[].status=False` (for realistic testing)
- Or: the mock API server from the E2E fixtures

---

## Local Development Setup

```bash
# 1. Start the Go backend (serves the frontend via go:embed on port 40107)
make go

# 2. In a separate terminal, start the Vite dev server (hot reload)
cd web && bun dev

# 3. Open http://localhost:5173
```

The Vite dev server proxies `/api/*` to the Go backend at port 40107.

---

## Files to Create / Modify

### New files

```
web/src/lib/conditions.ts         # Extract rewriteConditionMessage from ConditionItem
web/src/components/ErrorsTab.tsx  # New tab component
web/src/components/ErrorsTab.css  # Styles (tokens.css vars only)
```

### Modified files

```
web/src/components/ConditionItem.tsx  # Change import to @/lib/conditions
web/src/pages/RGDDetail.tsx           # Add "errors" tab
```

---

## Implementation Order

Follow this order to avoid import resolution errors:

1. **Create `web/src/lib/conditions.ts`** — extract `rewriteConditionMessage`
2. **Update `web/src/components/ConditionItem.tsx`** — change local definition
   to `import { rewriteConditionMessage } from '@/lib/conditions'`
3. **Run typecheck** — `bun run typecheck` from `web/` — should pass with no changes
4. **Create `web/src/components/ErrorsTab.css`** — all classes from UI contracts
5. **Create `web/src/components/ErrorsTab.tsx`** — full component
6. **Update `web/src/pages/RGDDetail.tsx`** — add `"errors"` to `TabId`, tab
   button, dispatch block, and `isValidTab` guard
7. **Run typecheck again** — must pass
8. **Run `go vet ./...`** — must pass (no Go changes, so this is a sanity check)

---

## Testing the Errors Tab

### Manual test (happy path)

1. Navigate to an RGD that has instances with failing conditions
2. Click the **Errors** tab (should appear between Validation and Access)
3. Verify: failing conditions are grouped with count badges
4. Verify: instance names are links that navigate to the instance detail page
5. If a known error pattern is present, verify the human-readable rewrite appears
   with a "Show raw error" toggle

### Manual test (healthy)

1. Navigate to an RGD where all instances are `Ready=True`
2. Click the **Errors** tab
3. Verify: green checkmark + "All instances are healthy" message

### Manual test (no instances)

1. Navigate to an RGD that has zero instances
2. Click the **Errors** tab
3. Verify: "No instances yet" message

### TypeScript typecheck

```bash
cd web && bun run typecheck
```

### E2E tests

The spec adds no new E2E journey file. The existing journey `002-rgd-detail`
covers tab bar rendering; the `tab-errors` button will be visible and
`aria-selected` behavior is exercised by the existing tab click pattern.

A new journey step will be added in tasks.md if the feature flag for E2E
fixtures makes it possible to test error conditions. Use:

```bash
SKIP_KIND_DELETE=true make test-e2e
```

---

## Debugging Tips

### "All instances are healthy" but I expect errors

Check that your instances actually have `status.conditions[].status=False`.
The Errors tab only groups conditions where `status === "False"` exactly.
Run:
```bash
kubectl get <kind> -n <namespace> -o json | jq '.items[].status.conditions'
```

### Groups not showing expected rewrite

The three known patterns in `rewriteConditionMessage` are:
1. `'cannot resolve group version kind'` + `'schema not found'`
2. `'references unknown identifiers'`
3. `'unknown type: array'`

If the message doesn't match any pattern, the raw message is shown directly
(no toggle button). Check the `reason` and `message` fields via:
```bash
kubectl get <kind> -n <namespace> <name> -o jsonpath='{.status.conditions}'
```

### URL tab persistence

Switching to the Errors tab sets `?tab=errors` in the URL. If the URL param
is manually set to an unknown value (e.g. `?tab=errors-old`), `isValidTab`
falls back to `"graph"`. Verify the `isValidTab` guard includes `"errors"`.
