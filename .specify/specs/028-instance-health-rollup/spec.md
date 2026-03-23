# Feature Specification: Instance Health Rollup

**Feature Branch**: `028-instance-health-rollup`
**Created**: 2026-03-23
**Status**: In Progress
**Depends on**: `005-instance-detail-live` (merged), `004-instance-list` (merged), `002-rgd-list-home` (merged)
**Constitution ref**: §II (dynamic client), §IX (semantic colors, WCAG AA), §XII (graceful
degradation), §XIII (data table standards, worst-first, fully clickable cards)

---

## Problem Statement

Instance health is currently displayed in a fragmented, incomplete way across the UI:

1. **RGD home cards** show zero instance health information — only the RGD's own
   `Ready` condition, not a summary of its instances (e.g. "3/5 ready").
2. **InstanceTable** uses a 3-state `ReadinessBadge` (`ready` / `not ready` / `unknown`)
   that collapses the `Progressing=True` (reconciling) and empty-conditions
   (pending) states both to `unknown` — operators lose signal.
3. **Instance detail header** shows a plain-text reconciling banner but has no
   prominent health badge; the `ConditionsPanel` below the DAG shows raw conditions
   with no summary.
4. **ConditionsPanel empty state** reads "No conditions." — violates constitution §XII
   which requires "Not reported" for absent expected conditions.

The result: an operator who opens the home page cannot assess overall instance
health without clicking into each RGD. An operator reviewing the instance table
cannot distinguish a reconciling instance from a truly unknown one.

---

## User Scenarios & Testing

### User Story 1 — Operator assesses instance health from the RGD home card (Priority: P1)

On the home page, each RGD card shows an instance health summary: how many
instances are ready vs. the total. A degraded or reconciling cluster state is
visible at a glance without opening the instance list.

**Why this priority**: The home page is the entry point. Without health rollup,
operators must click into every RGD to check instance health — the opposite of
a dashboard.

**Independent Test**: On the home page with an RGD that has 5 instances (3 ready,
1 error, 1 reconciling), the card shows a health chip reading `3/5 ready` with an
amber/rose indicator. A fully-healthy RGD (5/5 ready) shows `5 ready` in green.

**Acceptance Scenarios**:

1. **Given** an RGD with 5 instances where 3 are ready, **When** the home page
   loads, **Then** the card shows a health summary chip: `3 / 5 ready` using
   `--color-status-warning` styling
2. **Given** all instances are ready, **When** rendered, **Then** the chip shows
   `5 ready` using `--color-alive` styling (no denominator needed when all ready)
3. **Given** 0 instances exist, **When** rendered, **Then** the chip shows
   `no instances` in muted text — never blank, never a number badge of 0
4. **Given** the instance list fetch fails or takes >3s, **When** rendered, **Then**
   the card renders without a health chip (graceful degradation) — the RGD name,
   resource count, and age are never blocked
5. **Given** an RGD with any degraded instance (Ready=False), **When** rendered,
   **Then** the chip uses `--color-status-error` styling and shows the count
   `N / M ready`
6. **Given** an RGD with a reconciling instance (Progressing=True, Ready not yet True),
   **When** rendered, **Then** the chip uses `--color-status-warning` styling

---

### User Story 2 — Operator reads richer health states in the instance table (Priority: P1)

The instance table shows 5 distinct health states — matching the semantic colors
defined in the design system — not just 3. Operators can distinguish a reconciling
instance from a truly unknown or pending one.

**Why this priority**: Collapsing `reconciling` to `unknown` hides active kro
activity. A `Progressing=True` instance is normal; an `unknown` instance may
indicate a reporting gap. These are different signals.

**Independent Test**: In the instance table, an instance with `Progressing=True`
condition shows an amber "Reconciling" badge. An instance with `Ready=False` shows
a rose "Error" badge. An instance with no conditions shows a gray "Unknown" badge
(distinct label from "Reconciling").

**Acceptance Scenarios**:

1. **Given** an instance with `Progressing=True`, **When** rendered in the table,
   **Then** the badge shows "Reconciling" using `--color-reconciling` (amber)
2. **Given** an instance with `Ready=True`, **When** rendered, **Then** the badge
   shows "Ready" using `--color-status-ready` (green)
3. **Given** an instance with `Ready=False`, **When** rendered, **Then** the badge
   shows "Error" using `--color-status-error` (rose), with `reason` in a
   `title` tooltip
4. **Given** an instance with no `status.conditions` (cluster has not emitted any),
   **When** rendered, **Then** the badge shows "Unknown" using
   `--color-status-unknown` (gray)
5. **Given** a table with a mix of states, **When** default sort is applied,
   **Then** error rows sort first, then reconciling, then unknown, then ready
   (worst-first per constitution §XIII)
6. **Given** the table has 1+ reconciling instances, **When** viewed, **Then** the
   summary row above the table (or in the tab label) shows a count badge

---

### User Story 3 — Operator reads health summary in the instance detail header (Priority: P2)

The instance detail page shows a health status pill in the header — a compact,
prominent badge showing the instance's overall health state. The existing
reconciling banner is retained but complemented by the header pill.

**Why this priority**: The detail header is the first thing an operator sees.
A health pill gives instant orientation before reading the DAG or conditions.

**Independent Test**: For a degraded instance (Ready=False), the header shows a
rose "Error" pill alongside the instance name. For a reconciling instance, an
amber "Reconciling" pill. For a ready instance, a green "Ready" pill.

**Acceptance Scenarios**:

1. **Given** an instance with `Ready=True`, **When** the detail page loads,
   **Then** a green "Ready" pill appears in the header beside the instance name
2. **Given** an instance with `Ready=False`, **When** rendered, **Then** a rose
   "Error" pill with the `reason` in a `title` tooltip
3. **Given** `Progressing=True` (regardless of Ready), **When** rendered, **Then**
   an amber "Reconciling" pill — the reconciling state takes visual precedence
4. **Given** no conditions, **When** rendered, **Then** a gray "Unknown" pill —
   never blank
5. **Given** the poll fires and health changes (e.g. reconciling → ready),
   **When** the new data arrives, **Then** the header pill updates without
   a page reload or layout shift

---

### User Story 4 — ConditionsPanel improvements (Priority: P2)

The `ConditionsPanel` component is improved to show a health summary header and
to correctly handle absent conditions per constitution §XII.

**Why this priority**: The "No conditions." empty state violates §XII. The panel
needs a summary line ("1 of 3 conditions healthy") to match the information
density operators expect from a Kubernetes tool.

**Acceptance Scenarios**:

1. **Given** an instance with 3 conditions where 2 are True, **When** rendered,
   **Then** the panel header shows "2 / 3 conditions healthy"
2. **Given** an instance with no conditions, **When** rendered, **Then** the panel
   empty state shows "Not reported" — NOT "No conditions." (constitution §XII)
3. **Given** a condition with an absent `reason` field, **When** rendered, **Then**
   the reason cell is omitted entirely — never rendered as `undefined`, `null`,
   or blank (constitution §XII)
4. **Given** a condition with an absent `lastTransitionTime`, **When** rendered,
   **Then** that field is omitted — not shown as empty (constitution §XII)

---

### Edge Cases

- **Very large instance count** (500+): health chip on RGD card must show counts
  correctly; no rendering hang; the chip computation is done client-side per instance
  list fetch result
- **Stale instance data on home page**: if instance list fetch is in flight when
  the 5-second home page poll fires, the health chip shows the last-known value or
  a loading state — never a stale incorrect count alongside a fresh RGD list
- **Condition type collision**: if an instance has multiple `Ready` conditions
  (malformed), take the first one — don't crash or show NaN
- **Transition from reconciling to ready**: the amber pill must update to green
  within one poll cycle (5s) on the detail page

---

## Requirements

### Functional Requirements

- **FR-001**: `RGDCard` MUST show an instance health chip below the resource count.
  The chip is computed from the instance list fetched asynchronously via
  `GET /api/v1/rgds/{name}/instances`. The chip MUST NOT block the RGD card render.
- **FR-002**: The instance health chip MUST show `{ready} / {total} ready` when
  not all instances are ready, or `{total} ready` when all are ready, or
  `no instances` when total is 0.
- **FR-003**: Health chip color MUST follow semantic colors: all-ready → `--color-alive`,
  any-error → `--color-status-error`, any-reconciling (no error) → `--color-status-warning`,
  all-unknown → `--color-status-unknown`.
- **FR-004**: The instance health chip fetch MUST be non-blocking — card renders
  immediately with a skeleton/loading state for the chip, then updates when data
  arrives. A fetch error MUST be silently swallowed (chip simply absent).
- **FR-005**: `extractReadyStatus` in `format.ts` MUST be extended (or a new
  `extractInstanceHealth` function added) to return a 5-state health value:
  `ready` | `error` | `reconciling` | `pending` | `unknown`. The mapping:
  - `Progressing=True` → `reconciling` (checked before `Ready`)
  - `Ready=False` → `error`
  - `Ready=True` → `ready`
  - Conditions array absent or empty → `unknown`
  - All conditions are `status=Unknown` → `pending`
- **FR-006**: `ReadinessBadge` MUST be extended to support the 5 states from
  FR-005, with correct label and color for each.
- **FR-007**: `InstanceTable` MUST use the extended `ReadinessBadge` (5 states).
  Default sort order MUST be worst-first: `error` → `reconciling` → `pending` →
  `unknown` → `ready`.
- **FR-008**: The instance detail page header MUST show a `HealthPill` component
  (new) beside the instance name. The pill state is derived from the polled
  instance data using the same 5-state mapping as FR-005.
- **FR-009**: `ConditionsPanel` MUST show a summary line at the top:
  `{trueCount} / {total} conditions healthy`. If total is 0, show "Not reported"
  as the empty state (replacing "No conditions.").
- **FR-010**: `ConditionsPanel` MUST omit absent optional fields (`reason`,
  `lastTransitionTime`, `message`) rather than rendering placeholder text.

### Non-Functional Requirements

- **NFR-001**: The home page render time MUST NOT regress — instance health chip
  fetches are fire-and-forget per card; they MUST NOT be awaited in the page's
  critical path.
- **NFR-002**: Each per-card instance list fetch MUST respect the 5-second handler
  response budget (already enforced by the backend). The frontend fetch MUST have
  a 5-second timeout; on timeout, the chip is simply absent.
- **NFR-003**: TypeScript strict mode MUST pass with 0 errors after changes.
- **NFR-004**: All new pure functions MUST have unit tests.

### Key Components

- **`RGDCard`** (`web/src/components/RGDCard.tsx`): extended with async instance
  health chip. New internal state: `healthSummary` (loaded asynchronously).
- **`HealthChip`** (`web/src/components/HealthChip.tsx`): new component. Compact
  pill showing `{ready}/{total} ready` or `{total} ready` with semantic color.
  Used by `RGDCard`.
- **`HealthPill`** (`web/src/components/HealthPill.tsx`): new component. Larger
  status pill for the instance detail header. Supports 5 states + loading.
- **`ReadinessBadge`** (`web/src/components/ReadinessBadge.tsx`): extended from
  3 states to 5 states.
- **`ConditionsPanel`** (`web/src/components/ConditionsPanel.tsx`): adds summary
  header + fixes empty state + fixes absent-field rendering.
- **`format.ts`** (`web/src/lib/format.ts`): extend `extractReadyStatus` or add
  `extractInstanceHealth(obj: K8sObject): InstanceHealthState`.

---

## Testing Requirements

### Unit Tests (required before merge)

```typescript
// web/src/lib/format.test.ts (extend existing or new file)
describe("extractInstanceHealth", () => {
  it("returns 'reconciling' when Progressing=True regardless of Ready", () => { ... })
  it("returns 'error' when Ready=False and Progressing absent", () => { ... })
  it("returns 'ready' when Ready=True", () => { ... })
  it("returns 'unknown' when conditions array is absent", () => { ... })
  it("returns 'unknown' when conditions array is empty", () => { ... })
  it("returns 'pending' when all conditions have status=Unknown", () => { ... })
  it("takes first Ready condition if multiple exist (malformed input)", () => { ... })
})

// web/src/components/HealthChip.test.tsx
describe("HealthChip", () => {
  it("renders '5 ready' when all instances ready", () => { ... })
  it("renders '3 / 5 ready' when some degraded", () => { ... })
  it("renders 'no instances' when total is 0", () => { ... })
  it("uses --color-alive when all ready", () => { ... })
  it("uses --color-status-error when any error", () => { ... })
})
```

---

## Success Criteria

- **SC-001**: RGD home card shows instance health chip computed from async instance
  list fetch. Card renders without the chip first, chip appears when data arrives.
- **SC-002**: `Progressing=True` instance shows amber "Reconciling" badge in
  `InstanceTable` — not "Unknown". Verified by unit test.
- **SC-003**: Instance detail header shows `HealthPill` with correct state on load
  and after every 5s poll. Verified manually.
- **SC-004**: `ConditionsPanel` empty state shows "Not reported" (not "No conditions.").
  Absent `reason` / `lastTransitionTime` fields are omitted. Verified by unit test.
- **SC-005**: TypeScript strict mode passes with 0 errors.
- **SC-006**: All unit tests pass with `vitest run`.
- **SC-007**: No CSS framework, no hardcoded hex/rgba in new component CSS — all
  colors via `tokens.css` custom properties.

---

## E2E User Journey

**File**: `test/e2e/journeys/028-instance-health-rollup.spec.ts`
**Cluster pre-conditions**: kind cluster running, kro installed, `test-app` RGD
applied, `test-instance` CR applied in namespace `kro-ui-e2e`, instance is
reconciled (child resources exist)

### Journey: Health rollup visible on home page and instance table

```
Step 1: Navigate to home page
  - Navigate to http://localhost:40107/
  - Assert: [data-testid="rgd-card"] is visible
  - Assert: [data-testid="health-chip"] exists on at least one card
    (may show loading skeleton initially)

Step 2: Health chip resolves
  - Wait up to 6000ms for [data-testid="health-chip"] to have non-skeleton text
  - Assert: chip text matches pattern /\d+ ready/ or /no instances/

Step 3: Navigate to instance list
  - Click the RGD card for test-app
  - Click the Instances tab
  - Assert: [data-testid="instance-table"] is visible
  - Assert: at least one [data-testid="readiness-badge"] is visible

Step 4: Navigate to instance detail — header pill
  - Click the test-instance row
  - Assert: [data-testid="instance-detail-page"] is visible
  - Assert: [data-testid="health-pill"] is visible
  - Assert: [data-testid="health-pill"] has text matching /Ready|Reconciling|Error|Unknown/

Step 5: Conditions panel — Not reported empty state (if no conditions)
  - If [data-testid="conditions-panel-empty"] exists:
    - Assert: text content is "Not reported"
    - Assert: text does NOT contain "No conditions."
```
