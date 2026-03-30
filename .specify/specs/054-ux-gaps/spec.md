# Feature Specification: UX Gaps — Round 3

**Feature Branch**: `054-ux-gaps`
**Created**: 2026-03-28
**Status**: Merged (PR #323)

---

## Context

After installing complex RGDs (multi-conditional, webapp-with-pdb, cross-namespace-config)
and stress-testing the UI, several UX gaps were found during a PDCA sweep:

1. **"Updated 0s"** — `formatAge()` returns "0s" for timestamps < 1 second old.
   In the MetricsStrip "Updated {age}" label, this reads as "Updated 0s" which
   is jarring. Should say "Updated just now" for < 5 second timestamps.

2. **"Not reported" in MetricsStrip** — when a counter metric is unavailable
   (e.g., ACTIVE WATCHES = "Not reported"), the text renders in the same large
   monospace bold class as numeric values. This is visually misleading — "Not
   reported" at the same size and weight as "17" implies a data value, not an
   absent state. Should render in a muted, smaller style distinct from numbers.

3. **Instance table has no name search** — the Instances tab on RGD detail has
   a "Terminating only" checkbox and sort controls, but no free-text search by
   instance name. With 23 test-app instances and 16 multi-resource instances,
   finding a specific instance requires scrolling through sorted rows. A name
   search input would make this practical.

4. **"0s" in formatAge for fresh objects** — any object < 1 second old returns
   "0s" from `formatAge()`. This appears in RGD cards ("0s") and other age
   displays immediately after creation. "just now" is more human-friendly.

---

## Requirements

### FR-001: formatAge "just now" for < 5s

`formatAge()` in `web/src/lib/format.ts` MUST return `"just now"` for elapsed
time < 5 seconds. For 5–59 seconds, continue returning `"{n}s"`. This fixes
both the "Updated 0s" MetricsStrip label and freshly created object cards.

Rationale: sub-5s granularity is meaningless to humans; "just now" is the
standard UX pattern (GitHub, Kubernetes dashboard, etc.).

Backward compatibility: `formatAge` is tested in `format.test.ts` — tests must
be updated to expect "just now" for timestamps within 5s.

### FR-002: MetricsStrip "Not reported" distinct style

`CounterCell` in `MetricsStrip.tsx` MUST render "Not reported" with a distinct
CSS modifier class (`metrics-strip__value--not-reported`) that applies:
- `font-size`: same as label text (13px), not the large counter size
- `color`: `var(--color-text-muted)`
- `font-style`: italic
- No font-weight bold

This makes "not available" data visually distinct from actual counter values.

A new token is NOT needed — use existing `--color-text-muted` and size tokens.

### FR-003: Instance table name search

The `InstanceTable` component MUST add a search input above the table that
filters rows by instance name (case-insensitive substring match).

- Input placeholder: `"Filter by name..."`
- Input `aria-label`: `"Filter instances by name"`
- Input `data-testid`: `"instance-name-filter"`
- Filtered count shown: `"Showing N of M"` when filter is active
- Search is client-side only (operates on the already-fetched `items` list)
- Empty state: "No instances match '{query}'" with a clear button
- Filter is combined with the existing "Terminating only" checkbox
- Filter is reset when navigating to a different RGD
- No URL param needed (in-memory state is sufficient for this use case)

### FR-004: "Updated just now" in MetricsStrip

Use FR-001's updated `formatAge()` so "Updated 0s" naturally becomes "Updated
just now" for fresh data.

---

## Acceptance Criteria

- [ ] `formatAge` returns "just now" for timestamps 0–4999ms ago
- [ ] `formatAge` returns "{n}s" for timestamps 5000–59999ms ago (unchanged)
- [ ] MetricsStrip "Not reported" counter renders in muted italic small style
- [ ] MetricsStrip numeric counters continue to render in the existing large style
- [ ] Instance table has a name filter input that filters rows in real time
- [ ] Filter shows count "Showing N of M" when active
- [ ] Empty filter state shows a message and clear button
- [ ] `go vet` and `tsc --noEmit` pass
- [ ] Unit tests updated for formatAge change
- [ ] No new npm or Go dependencies
- [ ] No `rgba()` or hex colors in new CSS
