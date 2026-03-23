# Tasks: 030-error-patterns-tab

**Input**: Design documents from `.specify/specs/030-error-patterns-tab/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ui-contracts.md ✓, quickstart.md ✓

**Tests**: No test tasks — not requested in spec. TypeScript typecheck (`bun run typecheck`) is used as the verification gate after each phase.

**Organization**: This spec is frontend-only with a single clear dependency chain. Tasks are organized into: Setup → Foundational (shared utility extraction) → US1 (Errors tab core) → US2 (RGD detail page integration) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- All paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Verify the working environment and confirm no blockers before writing any code.

- [x] T001 Run `cd web && bun run typecheck` and confirm zero errors on the current codebase (baseline)
- [x] T002 Run `go vet ./...` to confirm backend is clean (no Go changes expected, but needed as a baseline)

**Checkpoint**: Both commands exit 0 — safe to begin implementation.

---

## Phase 2: Foundational — Extract `rewriteConditionMessage` to `@/lib/conditions`

**Purpose**: Move the shared pure function out of `ConditionItem.tsx` into `web/src/lib/conditions.ts` so both `ConditionItem` and the new `ErrorsTab` can import it without duplication. This MUST be complete before `ErrorsTab.tsx` is written.

**⚠️ CRITICAL**: `ErrorsTab.tsx` imports `rewriteConditionMessage` from `@/lib/conditions`. This file must exist before Phase 3.

- [x] T003 Create `web/src/lib/conditions.ts` — cut the full `rewriteConditionMessage` function body (lines 72–99) out of `web/src/components/ConditionItem.tsx` and paste it into the new file with the Apache 2.0 header comment block and `export` keyword; add JSDoc comment matching the contract in `contracts/ui-contracts.md`
- [x] T004 Update `web/src/components/ConditionItem.tsx` — replace the now-removed local `rewriteConditionMessage` definition with `import { rewriteConditionMessage } from '@/lib/conditions'`; verify no other lines in the file change
- [x] T005 Run `cd web && bun run typecheck` — must pass with zero errors before proceeding

**Checkpoint**: `ConditionItem.tsx` behaves identically to before; `@/lib/conditions` is now the single source of truth for `rewriteConditionMessage`.

---

## Phase 3: User Story 1 — `ErrorsTab` component (the tab itself) 🎯 MVP

**Goal**: A self-contained `ErrorsTab` component that fetches instances, groups failing conditions by `(conditionType, reason)`, and renders all states (loading, error+retry, empty, all-healthy, groups list).

**User Story**: As an operator, I want to see all instances of an RGD that are failing, grouped by error pattern, so I can quickly understand how widespread each problem is.

**Independent Test**:
1. Navigate to `/rgds/:name?tab=errors` on an RGD with failing instances → error groups appear sorted by count
2. Navigate on an RGD with all-healthy instances → "All instances are healthy" message
3. Navigate on an RGD with no instances → "No instances yet" message
4. Disconnect the API / break network → rose error banner + Retry button appear
5. Click a Retry button → fetch re-executes

- [x] T006 [US1] Create `web/src/components/ErrorsTab.css` — implement all CSS classes from `contracts/ui-contracts.md` CSS Class Contract table using only `var(--token)` references from `web/src/tokens.css`; no hardcoded hex or `rgba()` values; include dark-mode-compatible token references for `.errors-tab__api-error` (use `--node-error-bg`, `--node-error-border`, `--color-error`), `.errors-tab__all-healthy` (use `--color-alive`), `.error-group__count` badge (use `--node-error-bg` + `--color-error` border), and `.error-group__message--raw` (`<pre>` monospace using `--font-mono`)
- [x] T007 [US1] Create `web/src/components/ErrorsTab.tsx` with the following structure:
  - Import `listInstances` from `@/lib/api` and `rewriteConditionMessage` from `@/lib/conditions`
  - Import `Link` from `react-router-dom`
  - Define `K8sCondition`, `InstanceRef`, `ErrorGroup` interfaces per `data-model.md`
  - Implement `groupErrorPatterns(instances: K8sObject[]): ErrorGroup[]` pure function per the aggregation algorithm in `data-model.md`: iterate instances, skip absent metadata, iterate conditions, skip non-`"False"` status and absent `type`, group by `conditionType + "/" + reason`, track canonical message by most-recent `lastTransitionTime`, sort groups count-desc then type-asc then reason-asc, sort instances name-asc within each group
  - Implement `ErrorsTabProps` interface: `{ rgdName: string; namespace?: string }`
  - Implement `ErrorsTab` default export component with state: `instances: K8sObject[] | null`, `loading: boolean`, `error: string | null`, `expandedGroups: Set<string>`, `rawGroups: Set<string>`
  - `useEffect` on `[rgdName, namespace]`: call `listInstances(rgdName, namespace)`, set loading/error/instances states per the state-transition diagram in `data-model.md`
  - `useMemo` for `groups = groupErrorPatterns(instances ?? [])`
  - Render: loading state (`data-testid="errors-loading"`), API error banner (`data-testid="errors-api-error"`) with Retry button (`data-testid="errors-retry-btn"`), empty state when `instances.length === 0` (`data-testid="errors-empty"`), all-healthy state when `groups.length === 0 && instances.length > 0` (`data-testid="errors-all-healthy"`), groups list otherwise
  - Groups list: summary line showing pattern count + affected instance count, then one `data-testid="error-group"` div per group containing: header with type + reason + count badge, message area with rewrite/raw toggle (rewrite shown by default if `rewriteConditionMessage` returns non-null; "Show raw error" sets `rawGroups.add(key)`; "Show summary" calls `rawGroups.delete(key)`), instance `<ul>` capped at 10 with per-group expand toggle (`expandedGroups`), overflow prose when count > 10 (`data-testid="error-group-overflow"`)
  - Each instance item: `<Link to={/rgds/${rgdName}/instances/${ns}/${name}}` with `data-testid="error-instance-link"`
  - Import `ErrorsTab.css`
- [x] T008 [US1] Run `cd web && bun run typecheck` — must pass with zero errors

**Checkpoint**: `ErrorsTab` renders correctly in isolation. The component can be imported and rendered in a test harness. All 5 states function correctly.

---

## Phase 4: User Story 2 — Wire `ErrorsTab` into `RGDDetail` page 🔌

**Goal**: The Errors tab button appears in the RGD detail page tab bar between Validation and Access. Clicking it sets `?tab=errors` in the URL. The `ErrorsTab` component is rendered when active.

**User Story**: As an operator, I want to access the Errors view via a tab on the RGD detail page, with the tab persisting in the URL for bookmarking and sharing.

**Independent Test**:
1. Navigate to `/rgds/:name` → tab bar shows: Graph | Instances | YAML | Validation | **Errors** | Access | Docs | Generate
2. Click **Errors** → URL becomes `?tab=errors`, `ErrorsTab` renders
3. Refresh the page with `?tab=errors` → Errors tab is still active (URL-restored state)
4. Navigate to `?tab=invalid` → falls back to Graph tab (not broken)
5. `data-testid="tab-errors"` exists and has `aria-selected="true"` when active

- [x] T009 [US2] Update `web/src/pages/RGDDetail.tsx`:
  - Add `import ErrorsTab from "@/components/ErrorsTab"` at the top with other tab imports
  - Update `TabId` type: `"graph" | "instances" | "yaml" | "validation" | "errors" | "access" | "docs" | "generate"`
  - Update `isValidTab()` guard to include `t === "errors"` between `"validation"` and `"access"` checks
  - Update the JSDoc comment at the top of the component to reference this spec
  - Add tab button after the Validation tab button: `<button data-testid="tab-errors" className="rgd-tab-btn" role="tab" aria-selected={activeTab === "errors"} onClick={() => setTab("errors")} type="button">Errors</button>`
  - Add tab content dispatch block after the Validation block: `{activeTab === "errors" && (<div className="rgd-tab-panel"><ErrorsTab rgdName={String(rgdName)} namespace={namespaceParam || undefined} /></div>)}`
- [x] T010 [US2] Run `cd web && bun run typecheck` — must pass with zero errors
- [x] T011 [US2] Run `go vet ./...` — must still pass (no Go files changed, sanity check)

**Checkpoint**: Full end-to-end flow works in the browser. Tab appears, URL is updated, component fetches and renders data.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify constitution compliance, graceful degradation, accessibility, and integration quality.

- [x] T012 [P] Audit `web/src/components/ErrorsTab.css` — confirm every color value uses a `var(--token)` reference; grep for any `#`, `rgb(`, `rgba(`, or `hsl(` literals and remove them (constitution §IX)
- [x] T013 [P] Verify graceful degradation in `ErrorsTab.tsx` — code-review that instances with absent `metadata.name` or `metadata.namespace` are silently skipped; conditions with absent `type` are silently skipped; absent `status.conditions` array is treated as `[]`; absent `message` renders as `"(no message)"` (constitution §XII)
- [x] T014 [P] Verify accessibility in `ErrorsTab.tsx` — confirm: `.errors-tab__all-healthy` pairs the ✓ symbol with visible text (not color alone); instance links have descriptive text (`name (namespace)` format); `data-testid="errors-api-error"` uses `role="alert"` on its container; `data-testid="errors-all-healthy"` has `aria-label="All instances healthy"` on the icon (constitution §IX accessibility)
- [x] T015 Run final `cd web && bun run typecheck` — must pass with zero errors
- [x] T016 Run `go vet ./...` — must pass (no Go changes expected)
- [x] T017 Manually walk through the quickstart.md test scenarios (5 scenarios) and confirm each renders correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 passing typecheck
- **Phase 3 (US1 — ErrorsTab)**: Depends on Phase 2 complete (`@/lib/conditions.ts` must exist)
- **Phase 4 (US2 — RGDDetail wiring)**: Depends on Phase 3 complete (`ErrorsTab` export must exist)
- **Phase 5 (Polish)**: Depends on Phase 4 complete

### User Story Dependencies

- **US1 (ErrorsTab component)**: Depends only on Foundational extraction (T003–T004)
- **US2 (RGDDetail integration)**: Depends on US1 complete (imports `ErrorsTab`)

### Within Each Phase

- T006 (CSS) and T007 (TSX) within Phase 3 are sequential — CSS file should exist before the TSX file imports it, though both files are new and the import won't cause a typecheck error if written together
- T009 in Phase 4 must wait for T007 (the exported component) to exist

### Parallel Opportunities

- T012, T013, T014 in Phase 5 are all [P] — all touch different concerns (CSS audit, logic review, accessibility review) and can be done simultaneously as a code-review checklist

---

## Parallel Example: Phase 5 Polish

```text
# All three can be reviewed simultaneously:
T012: Audit ErrorsTab.css for hardcoded colors
T013: Verify graceful degradation logic in ErrorsTab.tsx
T014: Verify accessibility attributes in ErrorsTab.tsx
```

---

## Implementation Strategy

### MVP (Single increment — this spec is small enough to ship as one)

1. Complete Phase 1: Baseline verification (T001–T002)
2. Complete Phase 2: Extract `rewriteConditionMessage` (T003–T005)
3. Complete Phase 3: Build `ErrorsTab` (T006–T008)
4. Complete Phase 4: Wire into `RGDDetail` (T009–T011)
5. Complete Phase 5: Polish + final verification (T012–T017)
6. **VALIDATE**: Run through quickstart.md scenarios in the browser

Total: **17 tasks** — estimated 2–3 hours for a single developer.

### File Change Summary

| File | Change | Phase |
|------|--------|-------|
| `web/src/lib/conditions.ts` | CREATE — extracted `rewriteConditionMessage` | Phase 2 |
| `web/src/components/ConditionItem.tsx` | MODIFY — swap local def for import | Phase 2 |
| `web/src/components/ErrorsTab.css` | CREATE — all CSS for new component | Phase 3 |
| `web/src/components/ErrorsTab.tsx` | CREATE — full tab component | Phase 3 |
| `web/src/pages/RGDDetail.tsx` | MODIFY — add "errors" tab | Phase 4 |

---

## Notes

- [P] tasks touch different concerns and have no shared file conflicts
- All CSS must use `var(--token)` only — `tokens.css` is the sole color source
- `rewriteConditionMessage` extraction (Phase 2) is a refactor with zero behavior change — verify with typecheck, not E2E
- The `namespaceParam` already exists in `RGDDetail.tsx` (used by Instances tab); `ErrorsTab` reuses it without adding new URL state
- The Errors tab does NOT add its own namespace filter UI — namespace is inherited from the URL param set by the Instances tab
- If `rewriteConditionMessage` returns `null` for a group message, no toggle button is rendered — raw message is shown directly
