# Tasks: RGD Optimization Advisor

**Branch**: `023-rgd-optimization-advisor`
**Input**: `.specify/specs/023-rgd-optimization-advisor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ui-contracts.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1 / US2 / US3)
- Exact file paths are required in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new CSS tokens and extract the shared `classifyResource`
helper that both `buildDAGGraph` and `detectCollapseGroups` depend on. This
phase must be complete before any user story work begins.

- [x] T001 Add `--color-advisor-bg`, `--color-advisor-border`, `--color-advisor-icon` tokens to both `:root` and `[data-theme="light"]` blocks in `web/src/tokens.css`
- [x] T002 Extract a private `classifyResource(r: unknown): NodeType | null` helper inside `web/src/lib/dag.ts`, refactoring the existing inline classification chain in `buildDAGGraph` to call it; verify `tsc --noEmit` still passes after the refactor

**Checkpoint**: `tsc --noEmit` passes; tokens are visible in browser DevTools on either theme.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement and test the pure `detectCollapseGroups` function. This
is a hard prerequisite for all user story phases — the UI component can't be
built until the analysis function is reliable.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Export `CollapseGroup` interface from `web/src/lib/dag.ts` (add after existing type exports)
- [x] T004 Implement `detectCollapseGroups(spec: unknown): CollapseGroup[]` in `web/src/lib/dag.ts` — algorithm per `data-model.md`: extract `spec.resources`, classify each with `classifyResource`, group by `"${apiVersion}/${kind}"`, apply Jaccard ≥ 0.70 / group-size-≥-3 rule, return array of `CollapseGroup`
- [x] T005 [P] Add `detectCollapseGroups` unit tests to `web/src/lib/dag.test.ts`: empty resources, all unique kinds, 3 Deployments (unconditional), 2 ConfigMaps with ≥ 70% key overlap (qualifies), 2 ConfigMaps with < 70% key overlap (does not qualify), excludes `NodeTypeCollection`, excludes `NodeTypeExternal`, groups by `apiVersion+kind` not `kind` alone, missing template (no throw), missing `apiVersion` (uses empty string), multiple qualifying groups returned, resources with `forEach` already set excluded

**Checkpoint**: `bun test web/src/lib/dag.test.ts` passes all new test cases.

---

## Phase 3: User Story 1 — Collapse suggestion on DAG detail page (Priority: P1) 🎯 MVP

**Goal**: A dismissible suggestion banner appears below the DAG when qualifying
candidate groups are detected; dismissing it removes it for the session.

**Independent Test**: Load the RGD detail Graph tab for an RGD with 3 resources
of the same `apiVersion/kind`. A suggestion item appears showing the kind and
count. Dismiss it — it disappears. Load an RGD with all unique kinds — no
suggestion area renders.

### Implementation for User Story 1

- [x] T006 [US1] Create `web/src/components/OptimizationAdvisor.tsx` — component accepts `{ groups: CollapseGroup[] }` props; initialises `CollapseGroupSuggestion[]` state from props; renders `null` when all groups are dismissed; maps undismissed groups to suggestion item cards
- [x] T007 [P] [US1] Create `web/src/components/OptimizationAdvisor.css` — `.optimization-advisor` wrapper, `.advisor-item` card using `var(--color-advisor-bg)` background, `var(--color-advisor-border)` border, `.advisor-item__dismiss` button; no inline rgba literals; all colors via `var()` tokens
- [x] T008 [US1] Wire advisor into `web/src/pages/RGDDetail.tsx`: import `detectCollapseGroups` from `@/lib/dag`, import `OptimizationAdvisor` from `@/components/OptimizationAdvisor`, derive `collapseGroups` via `useMemo(() => rgd ? detectCollapseGroups(rgd.spec) : [], [rgd])`, render `<OptimizationAdvisor groups={collapseGroups} />` inside the `activeTab === "graph"` branch after the `rgd-graph-area` div and before the `NodeDetailPanel` conditional
- [x] T009 [US1] Add dismiss logic to `OptimizationAdvisor.tsx`: each suggestion item shows a `data-testid="advisor-item-${kind}-dismiss"` button (×); clicking sets that item's `dismissed: true` in state; dismissed items are filtered from the rendered list
- [x] T010 [P] [US1] Add `OptimizationAdvisor` unit tests to `web/src/components/OptimizationAdvisor.test.tsx`: renders nothing for empty groups, renders one item per group, dismiss button removes only the targeted item, other items remain after one dismissal

**Checkpoint**: With 3 same-kind resources the suggestion area renders with a card; dismiss removes it; no regression in `tsc --noEmit`.

---

## Phase 4: User Story 2 — Multiple candidate groups (Priority: P2)

**Goal**: When multiple distinct qualifying groups exist (e.g., 3 Deployments
AND 2 ConfigMaps), each group renders as a separate suggestion item. Dismissing
one leaves the others intact.

**Independent Test**: Load an RGD with both 3 `Deployment` and 2 `ConfigMap`
qualifying groups. Two distinct suggestion items appear. Dismiss one — only that
item disappears; the other remains.

### Implementation for User Story 2

- [x] T011 [US2] Verify `detectCollapseGroups` already returns one `CollapseGroup` per qualifying `apiVersion/kind` pair — this is handled by the Phase 2 implementation and the multi-group unit test (T005); confirm the UI renders one `advisor-item` per group via existing T006 logic (no new render logic needed unless T006 only renders one group)
- [x] T012 [P] [US2] Add multi-group test cases to `web/src/components/OptimizationAdvisor.test.tsx`: rendering two groups produces two `advisor-item` elements; each has its own dismiss button with the correct `data-testid`; dismissing index 0 leaves index 1 visible; dismissing index 1 leaves index 0 visible

**Checkpoint**: With two distinct qualifying groups visible, dismiss one — the other persists. `bun test` passes.

---

## Phase 5: User Story 3 — forEach explanation panel (Priority: P2)

**Goal**: Expanding a suggestion item shows a plain-language explanation of what
`forEach` does in kro, the `${each.*}` variable pattern, and a link to the kro
forEach docs that opens in a new tab.

**Independent Test**: Expand any suggestion item. Confirm the explanation text
and the "kro forEach docs" link appear. Click the link — it opens in a new tab.
Confirm no editable inputs or mutation controls are present.

### Implementation for User Story 3

- [x] T013 [US3] Add expand/collapse toggle to `OptimizationAdvisor.tsx`: each suggestion item card has a `data-testid="advisor-item-${kind}-expand"` toggle button; clicking flips `expanded` state; when `expanded`, renders a `data-testid="advisor-item-${kind}-explanation"` section inside the card
- [x] T014 [P] [US3] Add explanation content to the expanded section in `OptimizationAdvisor.tsx`: plain-language paragraph explaining kro `forEach`, a note that differing values become `${each.value}` CEL references, and an `<a>` element with `href={FOREACH_DOCS_URL}`, `target="_blank"`, `rel="noopener noreferrer"`, `data-testid="advisor-item-${kind}-docs-link"`, labeled "kro forEach docs"; define `const FOREACH_DOCS_URL = 'https://kro.run/docs/concepts/forEach'` as a module-level constant
- [x] T015 [P] [US3] Add expand CSS to `web/src/components/OptimizationAdvisor.css`: `.advisor-item__explanation` panel with appropriate padding; `.advisor-item__docs-link` styled with `var(--color-primary-text)` to match other in-app links; no inline colors
- [x] T016 [P] [US3] Add explanation unit tests to `web/src/components/OptimizationAdvisor.test.tsx`: expand toggle shows explanation section, docs link has correct `href`, `target="_blank"`, and `rel="noopener noreferrer"`, explanation contains no `<input>`, `<button>` elements other than the dismiss/toggle buttons themselves

**Checkpoint**: Suggestion item expands to show explanation + docs link; link has correct attributes; `tsc --noEmit` passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, graceful degradation, and CI gate validation.

- [x] T017 [P] Add `aria-label` to the dismiss (×) button in `OptimizationAdvisor.tsx` (e.g., `aria-label="Dismiss forEach suggestion for ${group.kind}"`) and `aria-expanded` attribute on the expand toggle for screen reader support
- [x] T018 [P] Verify graceful degradation: confirm `detectCollapseGroups` returns `[]` for `null`, `undefined`, `{}`, and `{ resources: [] }` inputs by running the edge-case subset of tests from T005
- [x] T019 Add spec comment to `RGDDetail.tsx` import block referencing this spec: `// spec: .specify/specs/023-rgd-optimization-advisor/` (matching the pattern used for other specs in the file header comment)
- [x] T020 Run `bun run typecheck` (or `tsc --noEmit`) from `web/` and fix any TypeScript errors introduced by this feature
- [x] T021 Run `bun test` from `web/` and confirm all existing tests still pass alongside the new test suite

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `classifyResource` helper from T002)
- **Phase 3 (US1)**: Depends on Phase 2 (`detectCollapseGroups` must exist and be tested)
- **Phase 4 (US2)**: Depends on Phase 3 (`OptimizationAdvisor` component must exist); mostly additive tests
- **Phase 5 (US3)**: Depends on Phase 3 (expand toggle builds on the suggestion item structure)
- **Phase 6 (Polish)**: Depends on Phases 3–5 all complete

### User Story Dependencies

- **US1 (P1)**: Only depends on Phase 2 foundational work. Independent of US2 and US3.
- **US2 (P2)**: Depends on US1 (reuses the same component; adds multi-group test coverage). Implementation is mostly test-only if T006 already handles multiple groups correctly.
- **US3 (P2)**: Depends on US1 (adds expand logic to the existing suggestion item). Independent of US2.

### Within Each Phase

- T001 and T002 are sequential within Phase 1 (T002 touches `dag.ts` which T001 does not)
- T003 → T004 → T005 are sequential within Phase 2 (interface must exist before function; function must exist before tests)
- T006, T007, T010 are parallelizable within Phase 3 (different files); T008 and T009 depend on T006

### Parallel Opportunities

```bash
# Phase 1 — sequential (T001 → T002)

# Phase 2 — sequential (T003 → T004 → T005)

# Phase 3 — two parallel tracks:
Track A: T006 → T008 → T009  (component + wiring + dismiss logic)
Track B: T007, T010           (CSS + tests, independent files)

# Phase 4 — parallelizable:
T011, T012 can run in parallel (review + test file)

# Phase 5 — two parallel tracks after T013:
T013 → (T014 || T015 || T016)  (T013 first, then its dependents in parallel)

# Phase 6 — T017, T018, T019 in parallel; T020 → T021 sequential
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: add tokens + extract `classifyResource`
2. Complete Phase 2: implement + test `detectCollapseGroups`
3. Complete Phase 3: build `OptimizationAdvisor` + wire into Graph tab
4. **STOP and VALIDATE**: open an RGD with 3 same-kind resources; confirm suggestion appears and dismisses correctly
5. Ship if review-ready

### Incremental Delivery

1. Phase 1 + 2 → analysis function ready
2. Phase 3 → suggestion banner visible → MVP demo-able
3. Phase 4 → multi-group rendering confirmed (mostly tests)
4. Phase 5 → explanation panel + forEach docs link
5. Phase 6 → accessibility + CI gate pass → PR-ready

---

## Notes

- All colors MUST use `var(--color-advisor-*)` tokens — no inline `rgba()` or hex in component CSS
- `detectCollapseGroups` is a pure function: same input → same output, no side effects
- Dismiss state is session-only (`useState`); no `localStorage`, no URL param
- The forEach docs URL is defined as `const FOREACH_DOCS_URL` — never inline the string
- `tsc --noEmit` and `bun test` must both pass before PR; run them explicitly in T020/T021
