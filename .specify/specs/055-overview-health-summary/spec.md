# Feature Specification: Overview Health Summary Bar

**Feature Branch**: `055-overview-health-summary`
**Created**: 2026-03-28
**Status**: Merged (PR #324)

---

## Context

The Overview page shows 27 RGD cards. With 73+ live instances across those RGDs,
understanding the fleet health requires scrolling through all cards or mentally
summing the individual HealthChip labels. There is no at-a-glance fleet health view.

Observation during PDCA sweep: on a busy cluster with `never-ready` (3 reconciling),
`crashloop-app` (2 ready), `multi-resource` (16 ready), etc., a user opening the
Overview has no immediate situational awareness. They must visually scan 27 cards
to understand that, e.g., "3 instances are stuck reconciling."

## Design

A compact `OverviewHealthBar` component placed between the page header/search bar
and the RGD card grid. It shows aggregate counts across all loaded RGD health
summaries in the form of colored pill chips:

```
[N ready] [M reconciling] [K degraded] [J error] [P no instances]  (Q of R loaded)
```

Rules:
- Only non-zero counts are shown (no "0 error" chip)
- Colors match the existing 6-state palette (--color-alive, --color-reconciling, etc.)
- "No instances" chip uses --color-text-faint / --color-border-subtle
- Data source: the already-fetched `healthSummaries` Map in Home.tsx (no new API calls)
- Progressive: "N of M loaded" indicator while background fetches are still in progress
- Absent when: loading, error state, or no summaries loaded yet

## Requirements

### FR-001: Aggregate summary from existing healthSummaries

The `OverviewHealthBar` MUST compute its values from the `healthSummaries` Map
that is already populated by the background `Promise.allSettled` fan-out in
`Home.tsx`. No new API calls are permitted.

### FR-002: Pill chips for each non-zero state

One chip per non-zero state. Chip colors must use existing CSS custom properties:
- ready: `--color-alive`
- reconciling: `--color-reconciling`
- degraded: `--color-status-degraded`
- error: `--color-status-error`
- pending: `--color-status-pending`
- no instances: `--color-text-faint` / `--color-border-subtle`

No hardcoded `rgba()` or hex colors. No new token needed.

### FR-003: Progressive loading indicator

While `summaries.size < totalRGDs`, show `"(N of M loaded)"` in muted text
to the right of the chips.

### FR-004: Hidden while loading or on error

`OverviewHealthBar` MUST NOT render if: data is still loading, an error occurred,
or no summaries have been fetched yet. `summaries.size === 0 → return null`.

---

## Acceptance Criteria

- [ ] OverviewHealthBar renders below the header, above the card grid
- [ ] Chips appear only for non-zero states
- [ ] Color tokens are used (no rgba/hex)
- [ ] "(N of M loaded)" shown while fetches are in progress
- [ ] No additional API calls made by this component
- [ ] Unit tests for `aggregateSummaries` helper
- [ ] E2E journey step: bar is present after Overview loads
- [ ] `tsc --noEmit` and `go vet` pass
