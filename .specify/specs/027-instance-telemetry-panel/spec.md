# Feature Specification: Instance Telemetry Panel

**Feature Branch**: `027-instance-telemetry-panel`
**Created**: 2026-03-23
**Status**: Draft
**Depends on**: `005-instance-detail-live` (merged), `022-controller-metrics-panel` (merged)
**Constitution ref**: §II (Cluster Adaptability), §III (Read-Only), §V (Simplicity),
§IX (Theme), §XII (Graceful Degradation), §XIII (UX Standards)

---

## Context

The instance detail page (`InstanceDetail.tsx`) currently shows a live DAG, a spec
panel, a conditions table, and an events list. These panels answer *what is the state
of each node right now* but give no answer to *how is this instance doing as a whole*.

A developer operating an instance needs to quickly answer:

- How old is this instance? How long has it been in its current condition?
- How many of its managed resources are healthy vs. errored?
- Has there been unusual event activity (warnings, high frequency)?

All of this information is **already returned by existing API calls** (`getInstance`,
`getInstanceChildren`, `getInstanceEvents`). No new backend endpoints are required.

This spec adds a compact **Instance Telemetry Panel** — a `TelemetryPanel` component
rendered below the instance header and above the DAG on the instance detail page.
It reuses the already-polled data and derives numeric summary counters client-side.

---

## User Scenarios & Testing

### User Story 1 — Developer sees a health summary at a glance (Priority: P1)

The telemetry panel shows 4 metric cells: instance age, time in current state, child
health breakdown (alive / total), and warning event count from the last poll.

**Independent Test**: Open any live instance detail page. Verify that a telemetry
panel appears above the DAG showing all 4 counters. Navigate to an instance with a
`Ready=False` condition — verify the "Time in state" cell shows a duration, not "—".

**Acceptance Scenarios**:

1. **Given** an instance with `metadata.creationTimestamp: 2026-01-01T00:00:00Z`,
   **When** the telemetry panel renders, **Then** the "Age" cell shows the elapsed
   duration in kubectl format (e.g. `83d`), not a raw ISO timestamp

2. **Given** the instance has a `Ready=True` condition with
   `lastTransitionTime: T`, **When** the panel renders, **Then** the "Time in state"
   cell shows the elapsed time since `T` in the same kubectl format

3. **Given** an instance with 3 children (2 alive, 1 error), **When** the panel
   renders, **Then** the "Children" cell shows `2/3` with the fraction colored with
   `--color-error` when any child is in error state, `--color-alive` when all healthy

4. **Given** 5 events of which 2 are `type=Warning`, **When** the panel renders,
   **Then** the "Warnings" cell shows `2` with `--color-status-warning` color;
   `0` warnings shows `0` with `--color-text-muted`

---

### User Story 2 — Panel handles missing or absent data gracefully (Priority: P1)

No cell may render `undefined`, `null`, `?`, or an error state when data is absent.

**Acceptance Scenarios**:

1. **Given** the instance has no `metadata.creationTimestamp`, **When** the "Age"
   cell renders, **Then** it shows "Not reported" (never blank, never `undefined`)

2. **Given** no `Ready` condition exists in `status.conditions`, **When** the
   "Time in state" cell renders, **Then** it shows "Not reported"

3. **Given** children are still loading (empty array on mount), **When** the
   "Children" cell renders, **Then** it shows "—" (loading placeholder) until
   children resolve, then shows the fraction

4. **Given** events are an empty list, **When** the "Warnings" cell renders,
   **Then** it shows `0` not an error state

---

### User Story 3 — Panel updates on every poll cycle (Priority: P2)

The telemetry panel receives already-polled data as props and re-renders reactively.
No additional network requests are issued. The "Age" counter ticks every second via
a local interval.

**Independent Test**: Open an instance detail page. Observe in DevTools Network tab
that no additional API calls are made due to the telemetry panel. Wait 30 seconds
and observe the "Age" counter ticks up by 30.

**Acceptance Scenarios**:

1. **Given** the instance detail page is polling every 5s, **When** a new poll
   delivers updated conditions or events, **Then** "Time in state" and "Warnings"
   update reactively

2. **Given** the instance age is 58 seconds, **When** 2 more seconds elapse,
   **Then** the "Age" display changes from `58s` to `1m` without a page interaction

---

### Edge Cases

- Instance has no conditions array (`status` is absent or empty) → "Not reported"
  for all condition-derived cells; age still renders from `creationTimestamp`
- Children list is empty (`[]`) → "Children" cell shows `0/0`, colored neutral
- All children are in error state → fraction is `0/N`, colored `--color-error`
- `lastTransitionTime` is in the future (clock skew) → show `0s`, never negative
- Very large event lists (200+) → warning count computed over all items with no
  DOM proportional to list size (pure reduce, not rendered nodes)

---

## Requirements

### Functional Requirements

- **FR-001**: `TelemetryPanel` is a pure display component; it accepts
  `instance: K8sObject`, `nodeStateMap: NodeStateMap`, and `events: K8sList` as props
- **FR-002**: `TelemetryPanel` MUST NOT issue any API calls; it derives all
  metrics from the props it receives
- **FR-003**: "Age" cell: `metadata.creationTimestamp` → `formatAge()` from
  `@/lib/format`; shows "Not reported" if absent
- **FR-004**: "Time in state" cell: `lastTransitionTime` of the `Ready` condition
  → `formatAge()`; falls back to "Not reported" if the Ready condition is absent
- **FR-005**: "Children" cell: count `NodeStateMap` entries with `state === 'alive'`
  or `state === 'reconciling'` as the numerator (healthy); total
  `Object.keys(nodeStateMap).length` as the denominator; color with `--color-error`
  when any entry has `state === 'error'`, `--color-alive` when all healthy and
  denominator > 0, `--color-text-muted` when denominator is zero
- **FR-006**: "Warnings" cell: count events where `type === 'Warning'`; color with
  `--color-status-warning` when count > 0, `--color-text-muted` when 0
- **FR-007**: Age counter ticks every second via a `setInterval` in a local
  `useEffect`; the interval is cleared on unmount (inline pattern matching
  `RefreshIndicator` in `InstanceDetail.tsx`)
- **FR-008**: `TelemetryPanel` renders as the first element inside the
  `!isLoading && fastData &&` block in `InstanceDetail.tsx`, above the
  `instance-detail-content` div and below all banner elements
- **FR-009**: All metric derivation logic MUST live in a pure function module
  `web/src/lib/telemetry.ts` (no side effects, no React hooks); `TelemetryPanel`
  only calls these functions from its render

### Non-Functional Requirements

- **NFR-001**: No new backend endpoints; no new npm dependencies
- **NFR-002**: TypeScript strict mode passes with 0 errors (`bun run typecheck`)
- **NFR-003**: All CSS in `TelemetryPanel.css` uses `tokens.css` custom properties;
  no inline hex or `rgba()` literals
- **NFR-004**: `go vet ./...` and `go test -race ./...` continue to pass (backend
  untouched)
- **NFR-005**: Unit tests cover all branches of pure functions in `telemetry.ts`

### Key Components

- **`TelemetryPanel`** (`web/src/components/TelemetryPanel.tsx`): display component
  receiving `instance`, `nodeStateMap`, `events` props
- **`TelemetryPanel.css`** (`web/src/components/TelemetryPanel.css`): horizontal
  flex strip layout, 4 metric cells, token-only colors
- **`telemetry.ts`** (`web/src/lib/telemetry.ts`): pure functions —
  `extractInstanceAge`, `extractTimeInState`, `countHealthyChildren` (takes `NodeStateMap`),
  `countWarningEvents`
- **`telemetry.test.ts`** (`web/src/lib/telemetry.test.ts`): unit tests for all
  four functions with table-driven cases
- **`TelemetryPanel.test.tsx`** (`web/src/components/TelemetryPanel.test.tsx`):
  component render tests for all cells and edge cases

---

## Testing Requirements

### Unit Tests (required before merge)

```ts
// web/src/lib/telemetry.test.ts
describe('extractInstanceAge', () => {
  it('returns formatAge result when creationTimestamp present')
  it('returns "Not reported" when creationTimestamp absent')
  it('returns "Not reported" when metadata absent')
})

describe('extractTimeInState', () => {
  it('returns formatAge of Ready.lastTransitionTime when present')
  it('returns "Not reported" when Ready condition absent')
  it('returns "Not reported" when conditions array absent')
})

describe('countHealthyChildren', () => {
  it('returns { healthy: N, total: M, hasError: false } when all alive')
  it('returns { healthy: 0, total: 0, hasError: false } for empty map')
  it('counts reconciling children as healthy')
  it('counts error children in total but not healthy; hasError=true')
  it('returns hasError=false when no error entries')
})

describe('countWarningEvents', () => {
  it('returns count of events with type=Warning')
  it('returns 0 for empty items array')
  it('ignores events with type=Normal')
  it('handles missing items array gracefully')
})
```

### Component Tests (required before merge)

```ts
// web/src/components/TelemetryPanel.test.tsx
it('renders all 4 metric cells')
it('shows age from creationTimestamp')
it('shows "Not reported" when creationTimestamp missing')
it('shows "Not reported" when Ready condition missing')
it('shows healthy fraction with alive color when all healthy')
it('shows healthy fraction with error color when any child errored')
it('shows 0/0 when nodeStateMap is empty')
it('shows warning count with warning color when > 0')
it('shows 0 warnings with muted color when no warnings')
```

---

## Success Criteria

- **SC-001**: `TelemetryPanel` renders on the instance detail page with all 4 cells
- **SC-002**: Age cell shows elapsed time from `creationTimestamp` and ticks every second
- **SC-003**: Time in state cell shows elapsed time from `Ready.lastTransitionTime`
- **SC-004**: Children cell shows healthy/total fraction, color-coded by health
- **SC-005**: Warnings cell shows Warning event count, color-coded
- **SC-006**: All "Not reported" / "—" fallbacks render correctly for absent data
- **SC-007**: No additional API calls introduced by `TelemetryPanel`
- **SC-008**: `bun run typecheck` passes with 0 errors
- **SC-009**: All unit tests pass with `go test -race ./...` (backend unchanged)
- **SC-010**: No inline hex or `rgba()` in `TelemetryPanel.css`
