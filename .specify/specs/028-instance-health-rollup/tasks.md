# Tasks: 028-instance-health-rollup

**Input**: Design documents from `.specify/specs/028-instance-health-rollup/`
**Branch**: `028-instance-health-rollup`
**Stack**: TypeScript 5.x + React 19 + Vite (frontend-only; no backend changes)
**Testing**: Unit tests required (spec.md §Testing Requirements explicitly requests them)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths in every task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new CSS tokens and extend the `api.ts` helper — both are prerequisites for all user stories.

- [x] T001 Add `--color-status-reconciling` and `--color-status-pending` tokens to both dark-mode and light-mode blocks in `web/src/tokens.css` (values: `#f59e0b` dark / amber-light for reconciling; `#8b5cf6` dark / violet-light for pending — mirror the existing `--color-reconciling` and `--color-pending` light-mode values already in the file)
- [x] T002 Extend `get<T>()` in `web/src/lib/api.ts` to accept an optional second argument `options?: { signal?: AbortSignal }` and pass `signal: options?.signal` to the internal `fetch()` `RequestInit`. Update `listInstances` to forward the signal so `RGDCard` can cancel on unmount.

**Checkpoint**: Tokens and AbortSignal-capable fetch in place — all subsequent phases can proceed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `extractInstanceHealth()` and `aggregateHealth()` are consumed by all four user stories. They must exist before any component work begins.

- [x] T003 Add `InstanceHealthState` type and `InstanceHealth` interface to `web/src/lib/format.ts`:
  ```ts
  export type InstanceHealthState = 'ready' | 'reconciling' | 'error' | 'pending' | 'unknown'
  export interface InstanceHealth { state: InstanceHealthState; reason: string; message: string }
  ```
- [x] T004 Implement `extractInstanceHealth(obj: K8sObject): InstanceHealth` in `web/src/lib/format.ts` using the 5-step derivation logic: (1) absent/non-array conditions → unknown; (2) Progressing=True → reconciling; (3) Ready=True/False → ready/error; (4) all conditions Unknown → pending; (5) otherwise → unknown. `reason` and `message` come from the governing condition; fall back to `''`.
- [x] T005 Implement `aggregateHealth(items: K8sObject[]): HealthSummary` in `web/src/lib/format.ts` — export `HealthSummary` interface `{ total, ready, error, reconciling, pending, unknown }`, iterate items calling `extractInstanceHealth`, increment the matching counter.
- [x] T006 Write unit tests for `extractInstanceHealth` in `web/src/lib/format.test.ts` (extend existing file):
  - `returns 'reconciling' when Progressing=True regardless of Ready value`
  - `returns 'error' when Ready=False and Progressing absent`
  - `returns 'ready' when Ready=True`
  - `returns 'unknown' when status.conditions is absent`
  - `returns 'unknown' when conditions array is empty`
  - `returns 'pending' when all conditions have status=Unknown`
  - `returns 'unknown' with empty reason/message when called with empty object {}`
  - `uses first Ready condition when multiple Ready conditions exist (malformed input)`
- [x] T007 Write unit tests for `aggregateHealth` in `web/src/lib/format.test.ts`:
  - `counts totals correctly across mixed states`
  - `returns { total: 0, ready: 0, ... } for empty items array`

**Checkpoint**: Run `bun run --cwd web test -- format` — all new tests pass. Foundation ready for all user stories.

---

## Phase 3: User Story 1 — RGD Home Card Health Chip (Priority: P1) 🎯 MVP

**Goal**: Each RGD card on the home page shows an async `HealthChip` reading `{ready}/{total} ready` (or `{total} ready` / `no instances`). The card renders immediately; the chip fills in when the instance list fetch resolves.

**Independent Test**: Open the home page. Confirm the RGD card renders instantly. Within ~2s, a `HealthChip` appears below the resource count. For a fully-ready RGD it shows `N ready` in green. For a partially-degraded RGD it shows `N / M ready` in amber or rose. For an RGD with no instances it shows `no instances` in muted text. Fetch failures leave the chip absent (no error state on the card).

### Tests for User Story 1

- [x] T008 [P] [US1] Write unit tests for `HealthChip` in `web/src/components/HealthChip.test.tsx` (create new file). Test cases:
  - `renders skeleton when summary is null and loading=true`
  - `renders nothing when summary is null and loading=false`
  - `renders "no instances" when total is 0`
  - `renders "{total} ready" when all instances ready, uses data-state="ready"`
  - `renders "{ready} / {total} ready" when error > 0, uses data-state="error"`
  - `renders "{ready} / {total} ready" when reconciling > 0 (no errors), uses data-state="reconciling"`
  - `renders "{ready} / {total} ready" when only unknown, uses data-state="unknown"`

### Implementation for User Story 1

- [x] T009 [US1] Create `web/src/components/HealthChip.tsx`: functional component accepting `{ summary: HealthSummary | null; loading?: boolean }`. When `loading && !summary` render a skeleton `<span>` with class `health-chip health-chip--skeleton`. When `summary` is present, compute `overallState` (worst of: error>reconciling>pending>unknown>ready), render `<span data-testid="health-chip" data-state={overallState} className={`health-chip health-chip--${overallState}`}>` with label text per spec FR-002. Use `var(--color-alive)` / `var(--color-status-error)` / `var(--color-status-warning)` / `var(--color-status-unknown)` for color via CSS class.
- [x] T010 [US1] Create `web/src/components/HealthChip.css`: define `.health-chip` base styles (small pill, padding, border-radius via `var(--radius-sm)`, font-size smaller than body text). Add `.health-chip--ready { color: var(--color-alive) }`, `.health-chip--error { color: var(--color-status-error) }`, `.health-chip--reconciling { color: var(--color-status-warning) }`, `.health-chip--pending { color: var(--color-status-pending) }`, `.health-chip--unknown { color: var(--color-status-unknown) }`, `.health-chip--skeleton { ... }` (subtle animated skeleton). No hardcoded hex/rgba.
- [x] T011 [US1] Extend `web/src/components/RGDCard.tsx`: add `import { useState, useEffect }` and `import { listInstances } from '@/lib/api'` and `import { aggregateHealth } from '@/lib/format'` and `import HealthChip from './HealthChip'`. Add state `const [chipState, setChipState] = useState<{ summary: HealthSummary | null; loading: boolean }>({ summary: null, loading: true })`. Add `useEffect` that fires an AbortController-guarded `listInstances(name, undefined, { signal: ac.signal })` fetch, calls `aggregateHealth(list.items)` on success, sets `loading: false` on completion, and silently swallows errors (chip stays absent). Return `() => ac.abort()` cleanup. Render `<HealthChip summary={chipState.summary} loading={chipState.loading} />` below the resource-count meta item. Import `HealthChip.css` is handled by importing the component.
- [x] T012 [US1] Run `bun run --cwd web typecheck` — 0 errors ✓

**Checkpoint**: Home page shows health chips. `bun run --cwd web test` passes.

---

## Phase 4: User Story 2 — 5-State ReadinessBadge in Instance Table (Priority: P1)

**Goal**: `InstanceTable` shows 5 distinct health states (`ready`, `reconciling`, `error`, `pending`, `unknown`). `ReadinessBadge` is extended from 3 states to 5. The sort order correctly places `error` → `reconciling` → `pending` → `unknown` → `ready` (worst-first).

**Independent Test**: Navigate to any RGD → Instances tab. For an instance with `Progressing=True`, the badge shows "Reconciling" in amber. For `Ready=False`, "Error" in rose. For no conditions, "Unknown" in gray. The table default-sorts error rows first.

### Implementation for User Story 2

- [x] T013 [P] [US2] Extend `web/src/components/ReadinessBadge.tsx`: change the `status` prop type to accept `ReadyStatus | InstanceHealth` (both have the same `{ state, reason, message }` shape). Add label mapping for `reconciling` → `"Reconciling"` and `pending` → `"Pending"`. The existing `ready`/`error`/`unknown` labels remain. Add `title={status.reason}` when `status.reason` is non-empty (already done for error, ensure it covers reconciling too).
- [x] T014 [P] [US2] Extend `web/src/components/ReadinessBadge.css`: add `.readiness-badge--reconciling { color: var(--color-status-reconciling); background: var(--node-reconciling-bg); border: 1px solid var(--color-reconciling); }` and `.readiness-badge--pending { color: var(--color-status-pending); background: var(--node-pending-bg); border: 1px solid var(--color-pending); }`. No hardcoded hex/rgba.
- [x] T015 [US2] Update `web/src/components/InstanceTable.tsx`: change `const readyStatus = extractReadyStatus(item)` (line ~152) to `const readyStatus = extractInstanceHealth(item)`. Update the import at the top of the file to include `extractInstanceHealth`. The `ReadinessBadge` already accepts the same shape; no other changes to the render path needed. Also update the sort comparator's `order` map to use the correct worst-first values for the now-reachable states: `{ error: 0, reconciling: 1, pending: 2, unknown: 3, ready: 4 }`.
- [x] T016 [US2] Run `bun run --cwd web typecheck` — 0 errors ✓

**Checkpoint**: Instance table shows 5-state badges with correct colors and worst-first sort.

---

## Phase 5: User Story 3 — HealthPill in Instance Detail Header (Priority: P2)

**Goal**: The instance detail page header shows a `HealthPill` component beside the instance name. It derives its state from the already-polled `fastData.instance` object and updates on every 5s poll cycle.

**Independent Test**: Navigate to any instance detail page. The header shows an `<h1>` name alongside a colored pill: green "Ready", amber "Reconciling", rose "Error", or gray "Unknown". After waiting 6s (one poll), the pill reflects the latest state. No layout shift occurs.

### Implementation for User Story 3

- [x] T017 [P] [US3] Create `web/src/components/HealthPill.tsx`: functional component accepting `{ health: InstanceHealth | null }`. When `health === null`, render a skeleton pill with `data-testid="health-pill"` and class `health-pill health-pill--loading`. When present, render `<span data-testid="health-pill" className={`health-pill health-pill--${health.state}`} title={health.reason || undefined}>` with label text (Ready/Reconciling/Error/Pending/Unknown). Import its CSS file.
- [x] T018 [P] [US3] Create `web/src/components/HealthPill.css`: define `.health-pill` base pill styles (slightly larger than `ReadinessBadge` — use `var(--radius-md)` or similar, padding `var(--space-1) var(--space-2)`, font-weight 500). Add per-state modifier classes: `--ready` (`var(--color-status-ready)`), `--reconciling` (`var(--color-status-reconciling)`), `--error` (`var(--color-status-error)`), `--pending` (`var(--color-status-pending)`), `--unknown` (`var(--color-status-unknown)`), `--loading` (subtle skeleton). No hardcoded hex/rgba.
- [x] T019 [US3] Update `web/src/pages/InstanceDetail.tsx`: import `HealthPill` from `@/components/HealthPill` and `extractInstanceHealth` from `@/lib/format`. In the render, compute `const instanceHealth = fastData ? extractInstanceHealth(fastData.instance) : null`. Insert `<HealthPill health={instanceHealth} />` inside the `instance-detail-header` div, immediately after the `<h1>` name element (line ~299). The existing reconciling banner below is NOT removed.
- [x] T020 [US3] Run `bun run --cwd web typecheck` — 0 errors ✓

**Checkpoint**: Instance detail header shows a live-updating `HealthPill` with `data-testid="health-pill"`.

---

## Phase 6: User Story 4 — ConditionsPanel Improvements (Priority: P2)

**Goal**: `ConditionsPanel` shows a summary header (`{trueCount} / {total} conditions healthy`), uses "Not reported" as the empty state (replacing "No conditions."), and omits absent optional fields (`reason`, `lastTransitionTime`, `message`).

**Independent Test**: Open any instance detail page. In the Conditions panel: if conditions exist, a summary line shows at the top (e.g. "1 / 2 conditions healthy"). If no conditions, the panel shows "Not reported". Inspect the DOM — no `undefined`, `null`, or empty string cells for absent `reason`/`lastTransitionTime`.

### Implementation for User Story 4

- [x] T021 [US4] Update `web/src/components/ConditionsPanel.tsx`
  1. Change the empty state from `<div className="panel-empty">No conditions.</div>` to `<div data-testid="conditions-panel-empty" className="panel-empty">Not reported</div>`.
  2. Add a summary line above the conditions list (only when `conditions.length > 0`): `const trueCount = conditions.filter(c => c.status === 'True').length` → render `<div className="conditions-summary">{trueCount} / {conditions.length} conditions healthy</div>`.
  3. In each condition row, make `reason` conditional: only render the `<span className="condition-reason">` when `c.reason !== undefined && c.reason !== ''`.
  4. Make `lastTransitionTime` conditional: only render the `<div className="condition-time">` when `c.lastTransitionTime` is truthy.
  5. Make `message` conditional: only render the `<div className="condition-message">` when `c.message !== undefined && c.message !== ''`.
- [x] T022 [US4] Update `web/src/components/ConditionsPanel.css`: add `.conditions-summary` styles (small text, muted color via `var(--color-text-muted)`, bottom border or margin separating it from the conditions list). No hardcoded hex/rgba.
- [x] T023 [US4] Run `bun run --cwd web typecheck` — 0 errors ✓

**Checkpoint**: ConditionsPanel empty state shows "Not reported"; summary line present; absent fields omitted.

---

## Phase 7: E2E Journey

**Purpose**: Add the E2E Playwright journey covering the full health rollup user path.

- [x] T024 Create `test/e2e/journeys/028-instance-health-rollup.spec.ts` implementing the 5-step journey from spec.md §E2E User Journey: (1) home page with `[data-testid="health-chip"]` visible after load; (2) chip text matches `/\d+ ready/` or `/no instances/`; (3) instance table has `[data-testid="readiness-badge"]`; (4) instance detail shows `[data-testid="health-pill"]` with text matching `/Ready|Reconciling|Error|Unknown/`; (5) if `[data-testid="conditions-panel-empty"]` exists, text is "Not reported".
- [x] T036 [US5] Update `test/e2e/journeys/028-instance-health-rollup.spec.ts`: add Step 6 asserting that `[data-testid="condition-item-ReconciliationSuspended"]` (if present) has class `condition-item--true` and does NOT have class `condition-item--false`. Assert `[data-testid="conditions-summary"]` (if present) shows equal healthy/total counts (e.g. `5 / 5 conditions healthy`).

---

## Phase 7b: User Story 5 — Negation-Polarity Conditions (Issue #171)

**Branch**: `spec/028-negation-polarity`

**Purpose**: `ReconciliationSuspended=False` (and other inverted-polarity condition types)
must render as healthy, be counted as healthy in the summary, not appear in ErrorsTab,
and carry a `title` tooltip explaining the inversion to operators.

**Context**:
- `web/src/lib/conditions.ts` exists but only contains `rewriteConditionMessage` — it does NOT yet have `NEGATION_POLARITY_CONDITIONS` or `isHealthyCondition`. Both must be added.
- `ConditionItem.tsx` uses raw `status === 'True'` comparison — does not call `isHealthyCondition`.
- `ConditionsPanel.tsx` computes `trueCount` as `conditions.filter(c => c.status === 'True').length` — must change to `isHealthyCondition`.
- `ErrorsTab.tsx` aggregates all `status === 'False'` conditions as errors — must gate with `!isHealthyCondition`.
- No prior `HEALTHY_WHEN_FALSE` constant exists on this branch. Create `NEGATION_POLARITY_CONDITIONS` directly (canonical name per spec FR-011).

### Tests for User Story 5

- [x] T029 [P] [US5] Write unit tests in `web/src/lib/conditions.test.ts` (create new file):
  - `isHealthyCondition: returns true for normal condition with status=True`
  - `isHealthyCondition: returns false for normal condition with status=False`
  - `isHealthyCondition: returns true for ReconciliationSuspended with status=False`
  - `isHealthyCondition: returns false for ReconciliationSuspended with status=True`
  - `isHealthyCondition: returns false for normal condition with status=Unknown`
  - `NEGATION_POLARITY_CONDITIONS: contains ReconciliationSuspended`

### Implementation for User Story 5

- [x] T030 [P] [US5] Add `NEGATION_POLARITY_CONDITIONS` constant and `isHealthyCondition`
  function to `web/src/lib/conditions.ts` (append after `rewriteConditionMessage`):
  ```ts
  export const NEGATION_POLARITY_CONDITIONS = new Set<string>([
    'ReconciliationSuspended',
  ])
  export function isHealthyCondition(type: string, status: string): boolean {
    if (NEGATION_POLARITY_CONDITIONS.has(type)) return status === 'False'
    return status === 'True'
  }
  ```
- [x] T031 [US5] Update `web/src/components/ConditionItem.tsx` to use `isHealthyCondition`:
  1. Import `{ isHealthyCondition, NEGATION_POLARITY_CONDITIONS }` from `@/lib/conditions`.
  2. Replace the `if (status === 'True') ... else if (status === 'False')` block
     (lines 110–122) with: `const isHealthy = isHealthyCondition(condition.type, status)`.
     Set `statusClass = isHealthy ? 'condition-item--true' : (status === 'Unknown' ? 'condition-item--pending' : 'condition-item--false')`.
     Set `statusIcon = isHealthy ? '✓' : (status === 'Unknown' ? '○' : '✗')`.
     Set `statusLabel = isHealthy ? 'Passed' : (status === 'Unknown' ? 'Pending' : 'Failed')`.
  3. When `NEGATION_POLARITY_CONDITIONS.has(condition.type) && status === 'False'`, add
     `title="False is the healthy value for this condition — reconciliation is running normally"`
     on the `<span className="condition-item__status-label">` element.
- [x] T032 [US5] Write unit tests for `ConditionItem` negation-polarity rendering in
  `web/src/components/ConditionItem.test.tsx` (create new file):
  - `renders condition-item--true when ReconciliationSuspended=False`
  - `renders title tooltip on status label when ReconciliationSuspended=False`
  - `renders condition-item--false when ReconciliationSuspended=True`
  - `renders condition-item--true when normal condition status=True`
  - `renders condition-item--false when normal condition status=False`
- [x] T033 [US5] Update `web/src/components/ConditionsPanel.tsx`: change the `trueCount`
  computation at line 79 from `conditions.filter((c) => c.status === 'True').length` to
  `conditions.filter((c) => isHealthyCondition(c.type, c.status)).length`. Add import
  `import { isHealthyCondition } from '@/lib/conditions'` at the top.
- [x] T034 [US5] Update `web/src/components/ErrorsTab.tsx` `groupErrorPatterns` function:
  gate condition entries at line 73 — change `if (c.status !== 'False') continue` to
  `if (isHealthyCondition(c.type ?? '', c.status ?? '')) continue`. Also change
  `if (c.status !== 'False') continue` guard to check `!isHealthyCondition`.
  Add import `import { isHealthyCondition } from '@/lib/conditions'` at the top.
- [x] T035 [US5] Run `bun run --cwd web typecheck` — 0 TypeScript errors ✓

**Checkpoint**: `ReconciliationSuspended: False` renders as healthy (✓ Passed, green),
counts toward healthy total, and does not appear in ErrorsTab.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, style consistency, and cleanup.

- [x] T025 [P] Run `bun run --cwd web test` — 55 tests pass ✓
- [x] T026 [P] Run `bun run --cwd web typecheck` — 0 TypeScript errors ✓
- [x] T027 [P] Audit all new CSS files — zero hardcoded hex/rgba values ✓
- [x] T028 Run `make build` — binary builds successfully ✓

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (T001–T002) — no deps; start immediately
    ↓
Phase 2 (T003–T007) — depends on Phase 1 (tokens + AbortSignal must exist)
    ↓
Phases 3–6 can start in parallel once Phase 2 is complete
Phase 3 (US1): T008–T012
Phase 4 (US2): T013–T016
Phase 5 (US3): T017–T020
Phase 6 (US4): T021–T023
    ↓
Phase 7 (T024) — depends on all story phases
Phase 7b (T029–T036, US5) — can run in parallel with Phase 7; depends only on conditions.ts existing
    ↓
Phase 8 (T025–T028) — final validation; run after Phases 7 and 7b
```

### User Story Dependencies

- **US1 (P1)** — depends on Phase 2 (`extractInstanceHealth`, `aggregateHealth`, AbortSignal `get()`). No dependency on US2/US3/US4.
- **US2 (P1)** — depends on Phase 2 (`extractInstanceHealth`). No dependency on US1/US3/US4.
- **US3 (P2)** — depends on Phase 2 (`extractInstanceHealth`). No dependency on US1/US2/US4.
- **US4 (P2)** — depends only on Phase 1 (CSS tokens for summary styles). No type or function dependencies on other stories.

### Parallelism Within Phases

- **Phase 2**: T003 → T004 → T005 in order (T004 depends on T003's type; T005 depends on T004's function). T006 and T007 can run in parallel with T005 (tests can be written alongside the implementation; they just need T003's type exports).
- **Phase 3**: T008 (tests) can be written in parallel with T009–T011 (implementation). T009 and T010 are independent files. T011 depends on T009 (needs HealthChip to exist).
- **Phase 4**: T013 and T014 are independent (tsx vs css). T015 depends on T013.
- **Phase 5**: T017 and T018 are independent (tsx vs css). T019 depends on T017.
- **Phase 6**: T021 and T022 are independent.

---

## Parallel Execution Examples

### Phase 3 (US1) — Launch together after Phase 2

```
Task A: T008 — HealthChip unit tests in web/src/components/HealthChip.test.tsx
Task B: T009 — HealthChip component in web/src/components/HealthChip.tsx
Task C: T010 — HealthChip styles in web/src/components/HealthChip.css
```
Then sequentially: T011 (RGDCard integration) → T012 (typecheck)

### Phase 4 (US2) — Launch together after Phase 2

```
Task A: T013 — ReadinessBadge.tsx extension (5 states)
Task B: T014 — ReadinessBadge.css extension (2 new state classes)
```
Then: T015 (InstanceTable switch to extractInstanceHealth) → T016 (typecheck)

### Phase 5 (US3) — Launch together after Phase 2

```
Task A: T017 — HealthPill.tsx
Task B: T018 — HealthPill.css
```
Then: T019 (InstanceDetail header integration) → T020 (typecheck)

---

## Implementation Strategy

### MVP First (US1 + US2, both P1)

1. Complete Phase 1: T001, T002
2. Complete Phase 2: T003 → T004 → T005 (+ T006/T007 in parallel)
3. Complete Phase 3 (US1): T008–T012 → home card health chip ✓
4. Complete Phase 4 (US2): T013–T016 → 5-state instance table ✓
5. **STOP and VALIDATE**: Both P1 stories independently functional — home page chips work, instance table shows 5 states.
6. Proceed to US3/US4 (P2) and E2E journey.

### Incremental Delivery

- After Phase 3: Home page health chips deliver immediate dashboard value.
- After Phase 4: Instance table richer health states (no more reconciling=unknown confusion).
- After Phase 5: Instance detail header health pill (operator orientation on detail page).
- After Phase 6: ConditionsPanel §XII compliance fix (correctness, not new UX).
- After Phase 7+8: Full test coverage and E2E verified.

---

## Notes

- `extractReadyStatus` is **not changed** — it continues serving RGD-level `StatusDot` and `RGDCard` own-readiness display. Only `extractInstanceHealth` is new.
- `HealthSummary` is defined in `format.ts` (not inside `RGDCard.tsx`) so it can be reused if future specs need it.
- The `get()` helper extension (T002) is a non-breaking additive change — all existing callers continue working since `options` is optional.
- All E2E journey assertions use `data-testid` attributes added in the component tasks (T009 adds `data-testid="health-chip"`, T017 adds `data-testid="health-pill"`, T021 adds `data-testid="conditions-panel-empty"`).
- Verify `bun run --cwd web typecheck` is clean after each phase before starting the next.
