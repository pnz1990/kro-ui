# Quickstart: Instance Telemetry Panel (027)

## What this feature adds

A compact **Instance Telemetry Panel** — a horizontal strip of 4 metric cells
rendered above the DAG on the instance detail page. All metrics are derived
client-side from already-polled data. No new backend endpoints.

## Prerequisites

- kro-ui running with a connected cluster (`./kro-ui serve`)
- At least one RGD with a deployed instance (use the E2E test-app RGD if needed)

## Verify the feature works

1. Navigate to any instance detail page:
   `http://localhost:40107/rgds/<rgd-name>/instances/<namespace>/<instance-name>`

2. A telemetry strip appears **above** the DAG with 4 cells:
   - **Age** — elapsed time since `metadata.creationTimestamp` (e.g. `2d`)
   - **Time in state** — elapsed time since the `Ready` condition last changed
   - **Children** — `healthy/total` (e.g. `3/3` in green, `1/3` in red if error)
   - **Warnings** — warning event count (orange if > 0, muted if 0)

3. Watch the **Age** counter tick every second.

4. Navigate away and back — verify no memory leaks (interval cleared on unmount).

## Development

```bash
# Frontend dev server
bun run dev

# Type check
bun run typecheck

# Run frontend unit tests
bun run test web/src/lib/telemetry.test.ts
bun run test web/src/components/TelemetryPanel.test.tsx

# Full build check
go build ./... && bun run typecheck
```

## File locations

| What | Where |
|---|---|
| Pure derivation logic | `web/src/lib/telemetry.ts` |
| Logic unit tests | `web/src/lib/telemetry.test.ts` |
| React component | `web/src/components/TelemetryPanel.tsx` |
| Component styles | `web/src/components/TelemetryPanel.css` |
| Component tests | `web/src/components/TelemetryPanel.test.tsx` |
| Integration point | `web/src/pages/InstanceDetail.tsx` (inside `!isLoading && fastData &&` block) |

## Design notes

- **No new API calls** — `TelemetryPanel` receives all data via props
- **Ticker pattern** — uses inline `setInterval` (1s) to keep age values current;
  same pattern as `RefreshIndicator` in `InstanceDetail.tsx`
- **`NodeStateMap` prop** — uses the already-computed map to count healthy children;
  does not re-derive from raw children array
- **Color semantics** — `--color-alive` for all-healthy children, `--color-error`
  for any errored, `--color-status-warning` for non-zero warnings, `--color-text-muted`
  for zero/empty states
- **Graceful degradation** — absent `creationTimestamp` or missing `Ready` condition
  renders "Not reported", never `undefined` or an error state
