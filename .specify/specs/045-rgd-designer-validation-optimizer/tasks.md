# Tasks: RGD Designer — Validation & Optimizer

**Branch**: `045-rgd-designer-validation-optimizer`
**Input**: Design documents from `.specify/specs/045-rgd-designer-validation-optimizer/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Spec covers**: 7 user stories — US1–US3 are P1 (metadata validation, duplicate resource IDs, duplicate field names), US4–US6 are P2 (min≤max, forEach iterator check, summary badge), US7 is P3 (React.memo on YAMLPreview).

**Tests**: Required per spec NFR-002 (`validateRGDState` must have 100% branch coverage) and SC-004/SC-006.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the `--color-warning` CSS token that all downstream CSS and components depend on. Must be done before any form CSS or component work.

- [x] T001 Add `--color-warning: #f59e0b` to `:root` block and `--color-warning: #d97706` to `[data-theme="light"]` block in `web/src/tokens.css`

**Checkpoint**: Token exists — downstream CSS `var(--color-warning)` references will now resolve correctly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the `ValidationIssue`, `ValidationState` types and the `validateRGDState` pure function to `generator.ts`. All user story phases (form rendering, tests) depend on these exports.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every inline message and badge in the form pulls from `ValidationState`.

- [x] T002 Add `ValidationIssue` and `ValidationState` TypeScript interfaces to `web/src/lib/generator.ts` after the existing authoring type block (after `AuthoringExternalRef`), with JSDoc comments per data-model.md
- [x] T003 Implement `validateRGDState(state: RGDAuthoringState): ValidationState` pure function in `web/src/lib/generator.ts` following the full 8-step algorithm in data-model.md: (1) rgdName empty/DNS-subdomain check, (2) kind empty/PascalCase check, (3) duplicate resource ID frequency-map, (4) forEach-no-iterator check with duplicate-ID priority, (5) duplicate spec field name frequency-map, (6) min>max constraint check skipping fields with duplicate-name issue, (7) duplicate status field name frequency-map, (8) totalCount sum. Export it alongside `generateRGDYAML`.
- [x] T004 Run `bun run typecheck` (or `npx tsc --noEmit`) in `web/` to confirm 0 TypeScript errors after T002–T003

**Checkpoint**: `validateRGDState` is exported, type-checks cleanly, and returns `{ totalCount: 0, resourceIssues: {}, specFieldIssues: {}, statusFieldIssues: {} }` for `STARTER_RGD_STATE`.

---

## Phase 3: User Story 1 — Required Metadata Validation (Priority: P1) 🎯 MVP

**Goal**: Show "Kind is required" / "RGD name is required" inline errors and PascalCase / DNS subdomain format warnings beneath the Metadata section inputs. Advisory only — YAML generation not blocked.

**Independent Test**: Open `/author`, clear the `Kind` field → "Kind is required" appears. Type `webApp` → "Kind should be PascalCase" warning. Type `WebApp` → warning clears. Verify YAML preview still renders throughout.

### Tests for User Story 1

- [x] T005 [P] [US1] Add `validateRGDState` test suite in `web/src/lib/generator.test.ts`: describe block `'validateRGDState'` covering — (a) STARTER_RGD_STATE produces totalCount=0 and no issues, (b) empty `rgdName` → `rgdName.type === 'error'` + message `'RGD name is required'`, (c) `rgdName = 'My App'` (spaces) → `rgdName.type === 'warning'` + DNS subdomain message, (d) `rgdName = 'my-app'` → no rgdName issue, (e) empty `kind` → `kind.type === 'error'` + message `'Kind is required'`, (f) `kind = 'webApp'` → `kind.type === 'warning'` + PascalCase message, (g) `kind = 'WebApp'` → no kind issue, (h) `kind = 'MyApp2'` → no kind issue (numbers allowed), (i) `rgdName = 'my--app'` → warning (consecutive hyphens fail DNS regex)
- [x] T006 [P] [US1] Add rendering tests in `web/src/components/RGDAuthoringForm.test.tsx`: (a) when `kind = ''` the element with text "Kind is required" is in the document, (b) when `kind = 'webApp'` the element with text matching /PascalCase/ is in the document, (c) when `kind = 'WebApp'` no such element is in the document, (d) when `rgdName = ''` the element with text "RGD name is required" is in the document, (e) none of these messages block the YAML preview (verify `data-testid="yaml-preview"` or equivalent is still rendered)

### Implementation for User Story 1

- [x] T007 [US1] Add CSS classes to `web/src/components/RGDAuthoringForm.css`: `.rgd-authoring-form__field-msg` (block, min-height 1.25em, font-size 0.75rem, color `var(--color-error)`) and `.rgd-authoring-form__field-msg--warn` (color `var(--color-warning)`). Also add `.rgd-authoring-form__validation-summary` (inline-flex, amber colors via `var(--color-advisor-bg)` / `var(--color-advisor-border)` / `var(--color-warning)`) per data-model.md CSS spec
- [x] T008 [US1] In `web/src/components/RGDAuthoringForm.tsx`: import `validateRGDState` and `ValidationState` from `@/lib/generator`; add `const validation = validateRGDState(state)` call at the top of the render body (no useMemo)
- [x] T009 [US1] In `web/src/components/RGDAuthoringForm.tsx`: add inline `<span role="alert" aria-live="polite">` message elements beneath the `rgdName` input and the `kind` input — render error class when `type === 'error'`, warn class when `type === 'warning'`, empty span with min-height when no issue (to prevent layout shift per NFR-004)

**Checkpoint**: US1 fully functional. Clearing Kind shows error. Format violations show warnings. YAML remains copyable. `bun test` passes T005–T006.

---

## Phase 4: User Story 2 — Duplicate Resource ID Detection (Priority: P1)

**Goal**: When two resource rows share the same non-empty `id`, both show "Duplicate resource ID" inline warning adjacent to the ID input. Warning clears when one is renamed.

**Independent Test**: Add two resources both with `id = deployment` → both rows show "Duplicate resource ID". Rename one to `service` → both warnings disappear.

### Tests for User Story 2

- [x] T010 [P] [US2] Add cases to the `validateRGDState` test suite in `web/src/lib/generator.test.ts`: (a) two resources with same non-empty id → both `_key`s present in `resourceIssues` with `type === 'warning'` and message `'Duplicate resource ID'`, (b) same two resources after rename → `resourceIssues` empty, (c) resource with `id = ''` → NOT in `resourceIssues` (empty IDs ignored), (d) totalCount reflects 2 for two duplicate IDs
- [x] T011 [P] [US2] Add rendering tests in `web/src/components/RGDAuthoringForm.test.tsx`: given two resources with id `deployment`, both resource rows contain the text "Duplicate resource ID"; after renaming one the text is absent

### Implementation for User Story 2

- [x] T012 [US2] In `web/src/components/RGDAuthoringForm.tsx`: within the resource row render loop, add `<span role="alert" aria-live="polite">` message element beneath the resource `id` input that shows `validation.resourceIssues[res._key]?.message` when present, using the appropriate error/warn CSS class

**Checkpoint**: US2 fully functional. Duplicate resource IDs shown immediately. `bun test` passes T010–T011.

---

## Phase 5: User Story 3 — Duplicate Spec/Status Field Name Detection (Priority: P1)

**Goal**: When two spec field rows share the same non-empty `name`, both show "Duplicate spec field name" beneath their name input. Same for status fields with "Duplicate status field name".

**Independent Test**: Add two spec fields both named `replicas` → both rows show "Duplicate spec field name". Rename one → both warnings clear. Add two status fields named `endpoint` → both show "Duplicate status field name".

### Tests for User Story 3

- [x] T013 [P] [US3] Add cases to the `validateRGDState` test suite in `web/src/lib/generator.test.ts`: (a) two spec fields with same non-empty name → both `id`s in `specFieldIssues` with message `'Duplicate spec field name'`, (b) after rename → `specFieldIssues` empty, (c) spec field `name = ''` → NOT in `specFieldIssues`, (d) two status fields with same name → both `id`s in `statusFieldIssues` with message `'Duplicate status field name'`, (e) after rename → clear, (f) resource ID `replicas` + spec field name `replicas` → no cross-namespace conflict
- [x] T014 [P] [US3] Add rendering tests in `web/src/components/RGDAuthoringForm.test.tsx`: (a) two spec fields named `replicas` → both rows contain "Duplicate spec field name", (b) two status fields named `endpoint` → both rows contain "Duplicate status field name"

### Implementation for User Story 3

- [x] T015 [US3] In `web/src/components/RGDAuthoringForm.tsx`: within the spec field row render loop, add `<span role="alert" aria-live="polite">` message element beneath the field `name` input showing `validation.specFieldIssues[field.id]?.message` when present
- [x] T016 [US3] In `web/src/components/RGDAuthoringForm.tsx`: within the status field row render loop, add `<span role="alert" aria-live="polite">` message element beneath the status field `name` input showing `validation.statusFieldIssues[sf.id]?.message` when present

**Checkpoint**: US3 fully functional. All P1 user stories complete. `bun test` passes T013–T014.

---

## Phase 6: User Story 4 — Min ≤ Max Constraint Validation (Priority: P2)

**Goal**: When a spec field's constraint panel shows `minimum > maximum`, an inline warning "minimum must be ≤ maximum" appears in the expanded constraints section.

**Independent Test**: Add an integer spec field, expand constraints, set `min=10 max=5` → warning appears in the constraint panel. Fix to `min=1 max=100` → warning disappears. Set only `min=5` (no max) → no warning.

### Tests for User Story 4

- [x] T017 [P] [US4] Add cases to the `validateRGDState` test suite in `web/src/lib/generator.test.ts`: (a) field with `minimum='10'` and `maximum='5'` → `specFieldIssues[field.id]` has message `'minimum must be ≤ maximum'`, (b) `minimum='0'` and `maximum='0'` → no issue (equal is valid), (c) `minimum='1'` and `maximum='100'` → no issue, (d) only `minimum` set → no issue, (e) only `maximum` set → no issue, (f) field has BOTH duplicate-name AND min>max issues → only duplicate-name issue recorded (priority rule)
- [x] T018 [P] [US4] Add rendering test in `web/src/components/RGDAuthoringForm.test.tsx`: given a spec field with min=10 max=5, when constraints are expanded, the text "minimum must be ≤ maximum" is present in the document

### Implementation for User Story 4

- [x] T019 [US4] In `web/src/components/RGDAuthoringForm.tsx`: within the spec field constraints panel (the expandable section), add `<span role="alert" aria-live="polite">` message element showing `validation.specFieldIssues[field.id]?.message` when the issue message is `'minimum must be ≤ maximum'`; note this shares the same `specFieldIssues[field.id]` slot as duplicate-name — the message renders correctly for whichever issue is present

**Checkpoint**: US4 functional. Min>max constraint visible in expanded panel. `bun test` passes T017–T018.

---

## Phase 7: User Story 5 — forEach Iterator Completeness Check (Priority: P2)

**Goal**: A resource card in `forEach` mode with no valid iterator (variable + expression both non-empty) shows "forEach resources require at least one iterator" on the card header.

**Independent Test**: Switch a resource to "Collection (forEach)", leave iterator rows empty → warning badge on card header. Fill in variable + expression → warning disappears.

### Tests for User Story 5

- [x] T020 [P] [US5] Add cases to the `validateRGDState` test suite in `web/src/lib/generator.test.ts`: (a) `resourceType='forEach'` with `forEachIterators=[]` → resource `_key` in `resourceIssues` with message `'forEach resources require at least one iterator'`, (b) `resourceType='forEach'` with one iterator where variable is filled but expression is empty → still shows warning (incomplete pair), (c) `resourceType='forEach'` with one valid iterator (both non-empty) → no issue, (d) `resourceType='managed'` with no iterators → no issue, (e) `resourceType='forEach'` with duplicate ID AND no iterator → only duplicate-ID issue recorded (priority rule from data-model.md)
- [x] T021 [P] [US5] Add rendering test in `web/src/components/RGDAuthoringForm.test.tsx`: given a resource in forEach mode with no iterators, the text "forEach resources require at least one iterator" is visible in the resource card area

### Implementation for User Story 5

- [x] T022 [US5] In `web/src/components/RGDAuthoringForm.tsx`: within the resource card header row (where resourceType select and id input are), add `<span role="alert" aria-live="polite">` message element showing `validation.resourceIssues[res._key]?.message` for the forEach-no-iterator case; this is the same element as T012's duplicate-ID message — one span per resource row handles both resource-level issues

**Checkpoint**: US5 functional. forEach mode without iterators shows warning. `bun test` passes T020–T021.

---

## Phase 8: User Story 6 — Validation Summary Badge (Priority: P2)

**Goal**: A compact badge "N warning(s)" / "N error(s)" appears at the top of the form (above the Metadata section) when `validation.totalCount > 0`. Hidden when totalCount is 0.

**Independent Test**: Trigger 3 issues (empty kind + 2 duplicate resource IDs). Summary badge shows "3 warnings". Resolve all → badge disappears. Copy button remains functional throughout.

### Tests for User Story 6

- [x] T023 [P] [US6] Add rendering tests in `web/src/components/RGDAuthoringForm.test.tsx`: (a) STARTER_RGD_STATE → `data-testid="validation-summary"` is NOT in the document, (b) state with `kind=''` → `data-testid="validation-summary"` IS in the document and contains "1 warning" or "1 error", (c) state with 3 issues → badge text contains "3", (d) copy button (or whatever the YAML copy mechanism is at this level) is not disabled when badge is present
- [x] T024 [P] [US6] Add `totalCount` test cases to the `validateRGDState` suite in `web/src/lib/generator.test.ts`: state with rgdName error + kind error + 1 resource duplicate → totalCount === 3; confirm totalCount invariant holds

### Implementation for User Story 6

- [x] T025 [US6] In `web/src/components/RGDAuthoringForm.tsx`: at the top of the form body (before the first `<section>` / metadata section), add `{validation.totalCount > 0 && (<div data-testid="validation-summary" className="rgd-authoring-form__validation-summary">⚠ {validation.totalCount} {validation.totalCount === 1 ? 'warning' : 'warnings'}</div>)}`. Use the ⚠ symbol (not an emoji) or the existing badge pattern; use `var(--color-warning)` via the CSS class already defined in T007.

**Checkpoint**: US6 functional. All P2 user stories complete. Summary badge shows/hides correctly. `bun test` passes T023–T024.

---

## Phase 9: User Story 7 — YAMLPreview React.memo (Priority: P3)

**Goal**: Wrap `YAMLPreview` in `React.memo` so it skips reconciliation when the `yaml` prop hasn't changed. Verified by a render-count test.

**Independent Test**: Via React DevTools Profiler on `/author` — editing a template textarea that doesn't change another resource's YAML output should not re-render the YAMLPreview component. Alternatively: unit test with render spy.

### Tests for User Story 7

- [x] T026 [P] [US7] In `web/src/components/YAMLPreview.test.tsx` (create if absent): add a test that renders `YAMLPreview` inside a parent component with a render counter, changes a parent-only state that does NOT change the `yaml` prop, and asserts `YAMLPreview` re-render count stays at 1 (initial render only). Use `vi.fn()` or a ref-counter pattern. Name the test "does not re-render when yaml prop is unchanged".

### Implementation for User Story 7

- [x] T027 [US7] In `web/src/components/YAMLPreview.tsx`: convert the default export to a named inner function wrapped with `React.memo` — `const YAMLPreview = React.memo(function YAMLPreview({ yaml, title = 'Manifest' }: YAMLPreviewProps) { ... }); export default YAMLPreview`. Import `React` if not already imported (or use `memo` named import from 'react').

**Checkpoint**: US7 functional. `React.memo` applied, render-count test passes. `bun test` passes T026.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Fix the pre-existing CSS token violation, run full typecheck, verify test coverage, and confirm CI passes.

- [x] T028 [P] Fix pre-existing `--color-warning` fallback violation in `web/src/components/RGDAuthoringForm.css`: replace `var(--color-warning, var(--color-text-muted))` with `var(--color-warning)` in both `.rgd-authoring-form__badge--conditional` and `.rgd-authoring-form__warn-badge` (now that the token exists from T001)
- [x] T029 [P] Run `bun run typecheck` (or `npx tsc --noEmit`) in `web/` and confirm 0 TypeScript errors across all changed files
- [x] T030 [P] Run `bun test` and confirm all new test cases (T005–T006, T010–T011, T013–T014, T017–T018, T020–T021, T023–T024, T026) pass and existing tests remain green
- [x] T031 Run `make build` from repo root (go vet + go test -race + go build + bun typecheck) and confirm full CI build is green
- [x] T032 Manual smoke test per `quickstart.md` steps 1–9: open `/author`, clear Kind, verify error; type webApp, verify warning; type WebApp, verify clear; add duplicate resource IDs, verify both warned; rename one, verify clear; add integer field with min=10 max=5, verify constraint warning; forEach resource with no iterator, verify warning; verify YAML preview always renders; verify summary badge count is correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: No dependencies — start immediately. Blocks T007, T028 (CSS referencing `--color-warning`).
- **Foundational (Phase 2, T002–T004)**: Depends on Phase 1. Blocks ALL user story phases.
- **US1 (Phase 3, T005–T009)**: Depends on Phase 2. T005–T006 (tests) and T007 (CSS) can run in parallel after Phase 2; T008–T009 (component changes) depend on T007.
- **US2 (Phase 4, T010–T012)**: Depends on Phase 2. T010–T011 (tests) run in parallel; T012 (component) depends on T008 from US1 (same file, same import).
- **US3 (Phase 5, T013–T016)**: Depends on Phase 2. T013–T014 (tests) run in parallel; T015–T016 (component) depends on T008.
- **US4 (Phase 6, T017–T019)**: Depends on Phase 2. T017–T018 in parallel; T019 depends on T015 (same spec field row).
- **US5 (Phase 7, T020–T022)**: Depends on Phase 2. T020–T021 in parallel; T022 depends on T012 (same resource row span).
- **US6 (Phase 8, T023–T025)**: Depends on Phase 2 + T007 (CSS). T023–T024 in parallel.
- **US7 (Phase 9, T026–T027)**: Fully independent — different file (`YAMLPreview.tsx`). Can run any time after Phase 2.
- **Polish (Phase 10, T028–T032)**: Depends on all user story phases complete.

### User Story Dependencies

- **US1 (P1)**: First P1 — start after Foundational. Establishes the `validation` constant in `RGDAuthoringForm.tsx` and the field-msg CSS classes that US2–US6 also use.
- **US2 (P1)**: After Foundational. Shares the same `RGDAuthoringForm.tsx` file as US1 — implement after T008 (the `validation` import).
- **US3 (P1)**: After Foundational. Same file dependency as US2 — sequence after T008.
- **US4 (P2)**: After US3 complete (modifies the spec field row, which US3 also touches).
- **US5 (P2)**: After US2 complete (modifies the resource row, which US2 also touches).
- **US6 (P2)**: After US1 complete (adds summary badge to top of form; depends on T007 CSS).
- **US7 (P3)**: Fully independent — `YAMLPreview.tsx` is untouched by other stories.

### Parallel Opportunities Within Each Story

- Tests (`[P]` marked) and CSS work can start as soon as Phase 2 completes.
- `generator.test.ts` additions across US1–US6 can all be written in one pass (same file, same describe block) — this is the most efficient approach.
- `YAMLPreview.tsx` (T027) + its test (T026) can proceed independently at any time.

---

## Parallel Example: P1 Stories (US1, US2, US3)

```
# After Phase 2 complete:

Parallel batch 1 — tests + CSS (all different files or additive to same file):
  T005 [US1] validateRGDState tests — rgdName/kind checks
  T010 [US2] validateRGDState tests — duplicate resource ID checks
  T013 [US3] validateRGDState tests — duplicate field name checks
  T007 [US1] CSS: field-msg classes + validation-summary class

# After T007 complete — all component changes share RGDAuthoringForm.tsx:
Sequential (same file):
  T008 → T009 (US1: import + rgdName/kind spans)
  T012      (US2: resource row span)
  T015–T016 (US3: spec + status field spans)

# Parallel (different file):
  T026–T027 (US7: YAMLPreview.tsx + its test)
```

---

## Implementation Strategy

### MVP Scope (P1 stories: US1–US3 + US8)

1. Complete Phase 1 (T001 — token)
2. Complete Phase 2 (T002–T004 — types + function)
3. Complete Phase 3 (T005–T009 — metadata validation)
4. Complete Phase 4 (T010–T012 — duplicate resource IDs)
5. Complete Phase 5 (T013–T016 — duplicate field names)
6. Complete Phase 11 (T033–T044 — bidirectional YAML import)
7. **STOP and VALIDATE**: all P1 acceptance criteria met, `bun test` green

### Full Delivery (all 8 stories)

Continue sequentially through Phases 6–10 (P2/P3 validation stories), then Phase 12 (polish + CI).

### Single-Developer Order (recommended — original stories)

T001 → T002 → T003 → T004 → T005 → T007 → T008 → T009 → T006 → T010 → T012 → T011 → T013 → T015 → T016 → T014 → T017 → T019 → T018 → T020 → T022 → T021 → T023 → T025 → T024 → T026 → T027 → T028 → T029 → T030 → T031 → T032

### Single-Developer Order (US8 continuation)

T033 → T034 → T035 → T036 → T037 → T038 → T039 → T040 → T041 → T042 → T043 → T044 → T045 → T046 → T047 → T048 → T049 → T050 → T051

---

## Notes

- `[P]` tasks operate on different files or additive-only sections — safe to run in parallel
- `generator.test.ts` additions across all stories can be batched in a single pass (T005 + T010 + T013 + T017 + T020 + T024 = one focused test-writing session)
- `RGDAuthoringForm.tsx` changes must be sequential (T008 → T009 → T012 → T015 → T016 → T019 → T022 → T025) because it's a single file with shared `validation` constant
- All validation is advisory — never disable YAML generation or copy (FR-006)
- `STARTER_RGD_STATE` must always produce `totalCount: 0` — verify this in T005 before writing any other test
- CSS must use only `var(--token-name)` — never hardcode hex/rgba (verified in T029 typecheck pass + T030 test run)
- `parseRGDYAML` must NEVER throw — all error paths return `{ ok: false, error }` (FR-011)
- Import is always a full-replace of form state — never a merge (FR-015)

---

## Phase 11: User Story 8 — Bidirectional YAML Import (Priority: P1)

**Goal**: A `parseRGDYAML` pure function parses any `ResourceGraphDefinition` YAML
string back into `RGDAuthoringState`. A `YAMLImportPanel` collapsible UI component
exposes the import flow in `AuthorPage`. Pasting YAML and clicking "Apply" populates
all form fields and updates the live DAG + YAML preview immediately.

**Independent Test**: Copy the YAML from the output preview. Refresh to reset to
starter state. Open the Import panel, paste the YAML, click Apply. Observe the form
matches what was copied. The YAML preview reflects the same content.

### Foundational: `parseSimpleSchemaStr` helper (T033)

- [x] T033 Add `parseSimpleSchemaStr(raw: string)` internal helper to `web/src/lib/generator.ts` (not exported): strips surrounding quotes, splits on ` | `, maps first token to `type`, remaining tokens to `required`, `defaultValue`, `minimum`, `maximum`, `enum`, `pattern`. Returns a partial `AuthoringField`-compatible object with defaults for absent modifiers.

### Foundational: `ParseResult` type + `parseRGDYAML` function (T034–T035)

- [x] T034 Add `ParseResult` discriminated union type to `web/src/lib/generator.ts` after `ValidationState`: `export type ParseResult = { ok: true; state: RGDAuthoringState } | { ok: false; error: string }`
- [x] T035 Implement `parseRGDYAML(yaml: string): ParseResult` in `web/src/lib/generator.ts` following the data-model.md algorithm: (1) guard empty/non-RGD input → `{ ok: false }`; (2) extract `metadata.name`, `spec.schema.*`; (3) parse `spec.schema.spec.*` fields via `parseSimpleSchemaStr`; (4) parse `spec.schema.status.*` fields; (5) parse `spec.resources[]` — detect node type from key presence (`externalRef` key → externalRef type, `forEach` key → forEach type, else managed); (6) extract template body lines; (7) extract `includeWhen`/`readyWhen`; (8) assign fresh `id`/`_key` values; (9) wrap in try/catch → `{ ok: false, error: 'Parse failed: ...' }` on any exception. Export alongside `generateRGDYAML`.

### Tests for `parseRGDYAML` (T036–T042)

- [x] T036 [P] [US8] Add `parseSimpleSchemaStr` test cases in `web/src/lib/generator.test.ts`: (a) `"string"` → `{ type: 'string', required: false, defaultValue: '', ... }`, (b) `"integer | required"` → `required: true`, (c) `"integer | default=3 | minimum=1 | maximum=100"` → all fields populated, (d) `"string | enum=dev,prod | pattern=^[a-z]+"` → enum + pattern populated, (e) `'"boolean"'` (with quotes) → `type: 'boolean'` (quotes stripped), (f) unknown modifier `"string | foobar=x"` → ignored, other fields default
- [x] T037 [P] [US8] Add `parseRGDYAML` error-path tests in `web/src/lib/generator.test.ts`: (a) empty string → `{ ok: false }`, (b) `"hello world"` (no RGD kind) → `{ ok: false, error: 'Not a ResourceGraphDefinition' }`, (c) YAML with `kind: ResourceGraphDefinition` but no `spec.schema` → `{ ok: false, error: 'Missing spec.schema' }`
- [x] T038 [P] [US8] Add `parseRGDYAML` metadata + schema tests in `web/src/lib/generator.test.ts`: (a) parses `metadata.name`, `spec.schema.kind`, `spec.schema.apiVersion`, (b) non-default `spec.schema.group` is extracted, (c) `scope: Cluster` sets `scope: 'Cluster'`; absent scope → `'Namespaced'`, (d) `spec.schema.spec` fields map to `specFields[]` with correct type strings, (e) `spec.schema.status` fields map to `statusFields[]`
- [x] T039 [P] [US8] Add `parseRGDYAML` managed resource tests in `web/src/lib/generator.test.ts`: (a) managed resource with template body → `resourceType: 'managed'`, `apiVersion`, `kind`, `templateYaml` non-empty, (b) `includeWhen` array → `includeWhen` string (first entry), (c) `readyWhen` array → `readyWhen[]`, (d) missing template → `templateYaml: ''`
- [x] T040 [P] [US8] Add `parseRGDYAML` forEach resource tests in `web/src/lib/generator.test.ts`: (a) resource with `forEach:` key → `resourceType: 'forEach'`, iterator variable + expression extracted into `forEachIterators[]`, (b) multiple forEach entries → multiple iterators
- [x] T041 [P] [US8] Add `parseRGDYAML` externalRef resource tests in `web/src/lib/generator.test.ts`: (a) scalar externalRef (with `name:`) → `resourceType: 'externalRef'`, `externalRef.name` populated, (b) selector externalRef (with `selector.matchLabels`) → `externalRef.selectorLabels[]` populated, (c) `namespace:` → `externalRef.namespace`
- [x] T042 [P] [US8] Add round-trip test in `web/src/lib/generator.test.ts`: build a `RGDAuthoringState` with all 5 resource node types, call `generateRGDYAML`, pipe to `parseRGDYAML`, assert `ok: true` and that key fields (rgdName, kind, resource ids, node types, specField names/types, statusField expressions, forEach iterators, externalRef name) match the original state (modulo fresh keys)

### `YAMLImportPanel` component + CSS (T043–T044)

- [x] T043 [US8] Create `web/src/components/YAMLImportPanel.tsx`: collapsible panel with `data-testid="import-yaml-toggle"` (toggle button, `aria-expanded`, `aria-controls="import-yaml-body"`), `id="import-yaml-body"` on body, `data-testid="import-yaml-input"` textarea (`aria-label="Paste ResourceGraphDefinition YAML"`, rows=10, monospace), `data-testid="import-yaml-apply"` button. On Apply: calls `parseRGDYAML(value)` — on `{ ok: true }` calls `onImport(state)` + collapses + clears; on `{ ok: false }` shows `data-testid="import-parse-error"` span with `role="alert" aria-live="polite"`. Props: `{ onImport: (state: RGDAuthoringState) => void }`.
- [x] T044 [US8] Create `web/src/components/YAMLImportPanel.css`: `.yaml-import-panel` (border, border-radius using tokens), `.yaml-import-panel__header` (clickable row, hover state), `.yaml-import-panel__body` (flex-column gap), `.yaml-import-panel__textarea` (monospace, same tokens as template textarea), `.yaml-import-panel__apply-btn` (primary button style using `--color-primary`), `.yaml-import-panel__error` (`var(--color-error)`, `font-size: 0.75rem`). No hardcoded hex/rgba.

### Wire `YAMLImportPanel` into `AuthorPage` (T045)

- [x] T045 [US8] In `web/src/pages/AuthorPage.tsx`: import `YAMLImportPanel`; render `<YAMLImportPanel onImport={setRgdState} />` above `<RGDAuthoringForm>` in the left pane (before the form div). No other changes to `AuthorPage` — the import replaces `rgdState` which cascades to all downstream `useMemo` derivations automatically.

### Tests for `YAMLImportPanel` (T046–T048)

- [x] T046 [P] [US8] Create `web/src/components/YAMLImportPanel.test.tsx`: (a) panel is collapsed by default — body not visible, (b) clicking toggle expands panel — body visible, (c) clicking toggle again collapses — body hidden, (d) `aria-expanded` toggles correctly
- [x] T047 [P] [US8] In `web/src/components/YAMLImportPanel.test.tsx`: (a) pasting valid RGD YAML and clicking Apply calls `onImport` with parsed state, (b) after successful import the panel collapses and textarea is cleared, (c) `import-parse-error` is NOT shown on success
- [x] T048 [P] [US8] In `web/src/components/YAMLImportPanel.test.tsx`: (a) clicking Apply with invalid YAML (plain text) shows `data-testid="import-parse-error"` with error message, (b) `onImport` is NOT called, (c) panel stays open, (d) clicking Apply with empty textarea shows error

### Polish & CI (T049–T051)

- [x] T049 [P] Run `bun run typecheck` (`npx tsc --noEmit`) in `web/` — confirm 0 errors across all new files (`YAMLImportPanel.tsx`, `YAMLImportPanel.test.tsx`, `YAMLImportPanel.css`) and modified files (`generator.ts`, `generator.test.ts`, `AuthorPage.tsx`)
- [x] T050 [P] Run `bun test` — confirm all new tests (T036–T042, T046–T048) pass and existing 990 tests remain green
- [x] T051 Run `make build` from repo root — confirm go vet + go test -race + go build + bun typecheck + vite build all pass clean

**Checkpoint**: All 8 user stories complete. Form → YAML and YAML → Form both work. Round-trip fidelity verified by tests. CI green.

---

## Phase 11 Dependencies

- T033 (parseSimpleSchemaStr) must complete before T035 (parseRGDYAML uses it).
- T034 (ParseResult type) must complete before T035.
- T035 (parseRGDYAML) must complete before T036–T042 (tests) and T043 (component uses it).
- T043 + T044 can run in parallel (different files).
- T045 depends on T043 (imports it).
- T046–T048 depend on T043.
- T049–T051 depend on all prior phase tasks.

### Parallel opportunities within Phase 11

```
# After T033 + T034 complete (fast — just types and a small helper):

Parallel batch:
  T035  implement parseRGDYAML
  T044  create YAMLImportPanel.css (no dependency on parser)

# After T035 complete:

Parallel batch (all generator.test.ts additions, same describe file):
  T036  parseSimpleSchemaStr tests
  T037  parseRGDYAML error tests
  T038  parseRGDYAML metadata tests
  T039  parseRGDYAML managed resource tests
  T040  parseRGDYAML forEach tests
  T041  parseRGDYAML externalRef tests
  T042  round-trip test

# After T043 + T044:
  T045  wire into AuthorPage
  T046–T048  YAMLImportPanel tests (parallel, same file)
```

---

## Phase 12: User Story 9 — Dry-Run Cluster Validation (Priority: P2)

**Goal**: A `POST /api/v1/rgds/validate` backend endpoint performs a `dryRun=All`
apply via the existing dynamic client. A "Validate against cluster" button in
`YAMLPreview` calls it, shows a green/red result, and clears stale results whenever
the YAML changes.

**Independent Test**: Click "Validate against cluster" on a valid RGD → green "✓ Valid".
Introduce a broken CEL expression, click again → red "✗ Validation failed" with kro's
error. Edit any field → result clears. Confirm YAML copy button still works throughout.

### New Go response types for US9 (T052)

- [x] T052 Add `DryRunResult` struct to `internal/api/types/response.go`:
  `type DryRunResult struct { Valid bool \`json:"valid"\`; Error string \`json:"error,omitempty"\` }`

### Backend handler for US9 (T053–T054)

- [x] T053 Create `internal/api/handlers/validate.go` with `ValidateRGD` method on `*Handler`:
  (1) read body (limit 1 MiB); (2) decode YAML into `unstructured.Unstructured` via
  `k8s.io/apimachinery/pkg/util/yaml.NewYAMLToJSONDecoder`; (3) assert
  `kind == "ResourceGraphDefinition"` → 400 if not; (4) call
  `h.factory.Dynamic().Resource(rgdGVR).Apply(ctx, metadata.name, obj, metav1.ApplyOptions{DryRun: []string{"All"}, FieldManager: "kro-ui"})`; (5) success → `{ valid: true }`; (6) `k8s errors.StatusError` → `{ valid: false, error: .Status.Message }`; (7) other error → 503.
  Note: `rgdGVR` is defined in `rgds.go` — import it from the same package (or
  redeclare as a package-level var in `validate.go`).
- [x] T054 Register `r.Post("/rgds/validate", h.ValidateRGD)` in `internal/server/server.go`
  inside the `if factory != nil` block, grouped with other RGD routes

### Backend tests for US9 (T055)

- [x] T055 [P] Add `TestValidateRGD` in `internal/api/handlers/validate_test.go` (create file):
  (a) valid RGD YAML body → mock dynamic client returns nil error → HTTP 200 `{ valid: true }`;
  (b) kro rejects (mock returns `k8s errors.NewBadRequest("CEL error")`) → HTTP 200
  `{ valid: false, error: "CEL error" }`; (c) non-RGD YAML body → HTTP 400;
  (d) empty body → HTTP 400.
  Use the same `httptest.NewRecorder` pattern as existing handler tests.

### Frontend types + API call for US9 (T056)

- [x] T056 [P] Add `DryRunResult` TypeScript type and `validateRGD(yaml)` function to
  `web/src/lib/api.ts`: `export type DryRunResult = { valid: true } | { valid: false; error: string }`;
  `export async function validateRGD(yaml: string): Promise<DryRunResult>` — POST to
  `/api/v1/rgds/validate` with `Content-Type: text/plain` body; throws on non-OK HTTP.

### Frontend UI for US9 (T057–T059)

- [x] T057 [US9] Add optional `onValidate`, `validateResult`, `validateLoading` props to
  `YAMLPreview` in `web/src/components/YAMLPreview.tsx`: render `data-testid="dry-run-btn"`
  button when `onValidate` provided (text: "Validate against cluster" / "Validating…" when
  loading, `disabled` + `aria-busy="true"` during load); render `data-testid="dry-run-result"`
  div when `validateResult !== null` (green "✓ Valid" or red "✗ Validation failed: \<error\>").
  `React.memo` compatibility: existing `memo` wrap is unchanged.
- [x] T058 [US9] In `web/src/pages/AuthorPage.tsx`: add `dryRunResult`, `dryRunLoading` state;
  add `useEffect` watching `rgdYaml` that resets `dryRunResult` to `null` on any change;
  add `handleValidate` async function that calls `api.validateRGD(rgdYaml)` and sets result;
  pass `onValidate`, `validateResult`, `validateLoading` props to `<YAMLPreview>`.
- [x] T059 [P] [US9] Add `YAMLPreview` rendering tests in `web/src/components/YAMLPreview.test.tsx`:
  (a) `onValidate` present → "Validate against cluster" button visible;
  (b) `validateLoading=true` → button text is "Validating…" and is disabled;
  (c) `validateResult={ valid: true }` → element with text "Valid" visible;
  (d) `validateResult={ valid: false, error: "bad CEL" }` → "Validation failed" and
  "bad CEL" visible; (e) `validateResult=null` → `data-testid="dry-run-result"` absent.

### Polish for Phase 12 (T060)

- [x] T060 Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...` and
  `bun test` in `web/` — confirm T055 + T059 pass and all existing tests remain green.
  Run `bun run --cwd web tsc --noEmit` — 0 errors.

**Checkpoint**: US9 complete. Dry-run validate button works end-to-end.
`make build` green.

---

## Phase 13: User Story 10 — Offline kro-Library Deep Validation (Priority: P1)

**Goal**: A new `internal/validate/` Go package wraps `pkg/simpleschema`,
`pkg/cel`, and an ID format check. A `POST /api/v1/rgds/validate/static` endpoint
calls it and returns `StaticValidationResult`. The frontend auto-calls it (debounced
1s) and displays deep issues in `RGDAuthoringForm`. Upgrading kro is a single
`go get` + `make tidy`.

**Independent Test**: Set a spec field type to `"badtype"` → within ~1s "Deep
validation" section appears with the field name and kro's error. Fix type → section
disappears. Add `${x +++}` as template content → CEL error appears for that resource.
Name a resource `MyDB` (PascalCase) → ID format error appears. All work offline.

### New Go response types for US10 (T061)

- [x] T061 Add `StaticIssue` and `StaticValidationResult` structs to `internal/api/types/response.go`:
  `type StaticIssue struct { Field string \`json:"field"\`; Message string \`json:"message"\` }`;
  `type StaticValidationResult struct { Issues []StaticIssue \`json:"issues"\` }`

### `internal/validate/` package (T062–T063)

- [x] T062 Create `internal/validate/validate.go` with Apache 2.0 header, package `validate`,
  importing `krocel "github.com/kubernetes-sigs/kro/pkg/cel"` and
  `kroschema "github.com/kubernetes-sigs/kro/pkg/simpleschema"` and
  `apitypes "github.com/pnz1990/kro-ui/internal/api/types"`.
  Implement:
  - `type ResourceExpressions struct { ID string; Expressions []string }`
  - `ValidateSpecFields(fieldMap map[string]string) []apitypes.StaticIssue` — calls
    `kroschema.ParseField(strip_quotes(v))` for each field; on error appends issue;
    wrapped in `recover()`.
  - `ValidateCELExpressions(resources []ResourceExpressions) []apitypes.StaticIssue` —
    calls `krocel.DefaultEnvironment()` once via `sync.Once`; for each `${...}`
    expression strips wrappers and calls `env.Parse(text)`; on `*cel.Error` appends
    issue; wrapped in `recover()`.
  - `ValidateResourceIDs(ids []string) []apitypes.StaticIssue` — validates each
    non-empty ID against `/^[a-z][a-zA-Z0-9]*$/`; on mismatch appends issue.
- [x] T063 [P] Create `internal/validate/validate_test.go` with table-driven tests (no cluster needed):
  (a) `ValidateSpecFields`: valid types return `[]`; `"badtype"` returns 1 issue;
  `"integer | enum=a,b"` returns 1 issue (enum on numeric type); quoted `'"string"'`
  returns `[]` (quotes stripped correctly).
  (b) `ValidateCELExpressions`: valid `${schema.spec.replicas}` returns `[]`;
  `${x +++}` returns 1 issue with the resource ID in the field path; non-`${...}`
  strings are skipped.
  (c) `ValidateResourceIDs`: `"web"`, `"configMap"` return `[]`; `"MyDB"`,
  `"my-db"`, `"123"` each return 1 issue; empty string `""` returns `[]`.
  Run with `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/validate/...`.

### Backend handler for US10 (T064–T065)

- [x] T064 Add `ValidateRGDStatic` method to `internal/api/handlers/validate.go`:
  (1) read body (limit 1 MiB); (2) parse YAML into `unstructured.Unstructured`;
  (3) extract `spec.schema.spec` map → build `fieldMap map[string]string`;
  (4) extract `spec.resources[].template` → find all `${...}` substrings via regex
  `\$\{[^}]+\}`, collect into `[]validate.ResourceExpressions` keyed by resource `id`;
  (5) extract all resource `id` values into `[]string`;
  (6) call `validate.ValidateSpecFields`, `validate.ValidateCELExpressions`,
  `validate.ValidateResourceIDs`; (7) merge all issues; (8) return
  `StaticValidationResult{ Issues: merged }` as JSON 200.
  On extraction panic/error → log WARN + return `{ issues: [] }` 200.
- [x] T065 Register `r.Post("/rgds/validate/static", h.ValidateRGDStatic)` in
  `internal/server/server.go` inside the `if factory != nil` block.

### Frontend types + API call for US10 (T066)

- [x] T066 [P] Add `StaticIssue`, `StaticValidationResult` TypeScript types and
  `validateRGDStatic(yaml)` to `web/src/lib/api.ts`:
  `export interface StaticIssue { field: string; message: string }`;
  `export interface StaticValidationResult { issues: StaticIssue[] }`;
  `export async function validateRGDStatic(yaml: string): Promise<StaticValidationResult>` —
  POST to `/api/v1/rgds/validate/static`; on any error returns `{ issues: [] }`
  (never throws — best-effort).

### Frontend UI for US10 (T067–T069)

- [x] T067 [US10] Add `staticIssues?: StaticIssue[]` prop to `RGDAuthoringForm`
  in `web/src/components/RGDAuthoringForm.tsx`. Below the existing summary badge,
  render a `data-testid="static-validation-section"` div when `staticIssues.length > 0`,
  containing a title "Deep validation" and one row per issue showing
  `.rgd-authoring-form__deep-issue-field` (field path, monospace) and
  `.rgd-authoring-form__deep-issue-msg` (error text, error color).
- [x] T068 [US10] Add deep validation CSS classes to
  `web/src/components/RGDAuthoringForm.css`: `.rgd-authoring-form__deep-validation`,
  `.rgd-authoring-form__deep-validation-title`, `.rgd-authoring-form__deep-issue`,
  `.rgd-authoring-form__deep-issue-field`, `.rgd-authoring-form__deep-issue-msg`
  per data-model.md. All colors via `var(--token)` — no hardcoded hex/rgba.
- [x] T069 [US10] In `web/src/pages/AuthorPage.tsx`: add `staticIssues` state
  (`StaticIssue[]`); add `useEffect` watching `rgdYaml` with 1000ms debounce that
  calls `api.validateRGDStatic(rgdYaml)` and sets state; cleanup clears the timeout.
  Pass `staticIssues={staticIssues}` to `<RGDAuthoringForm>`.

### Tests for US10 frontend (T070)

- [x] T070 [P] [US10] Add tests in `web/src/components/RGDAuthoringForm.test.tsx`:
  (a) `staticIssues=[]` → `data-testid="static-validation-section"` absent;
  (b) `staticIssues=[{ field: "spec.schema.spec.replicas", message: "unknown type" }]`
  → section visible, field path text visible, message text visible;
  (c) multiple issues → multiple rows rendered.

### Polish for Phase 13 (T071–T073)

- [x] T071 [P] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...` —
  confirm T063 unit tests pass (no cluster needed). Confirm T064 handler compiles.
- [x] T072 [P] Run `bun run --cwd web tsc --noEmit` — 0 errors across all US10
  changed files (`api.ts`, `AuthorPage.tsx`, `RGDAuthoringForm.tsx`, test files).
- [x] T073 Run `make build` — full CI build green (go vet + go test -race +
  go build + bun typecheck + vite build).

**Checkpoint**: US10 complete. Offline deep validation works for SimpleSchema,
CEL, and ID format. `make build` green. No cluster required for tests.

---

## Phase 13 Dependencies

- T061 (response types) must complete before T064 (handler uses them) and T066 (TS types mirror them).
- T062 (`internal/validate/` package) must complete before T063 (tests) and T064 (handler calls it).
- T063 (Go unit tests) and T066 (TS types) can run in parallel with T064.
- T065 (route registration) depends on T064.
- T067 (RGDAuthoringForm) depends on T066 (StaticIssue type must be imported).
- T068 (CSS) can run in parallel with T067.
- T069 (AuthorPage debounce) depends on T066 and T067.
- T070 (tests) depends on T067.
- T071–T073 depend on all prior tasks.

### Parallel opportunities within Phase 13

```
# T061 first (shared types — 5 min):

Parallel batch A (Go):
  T062  internal/validate/validate.go
  T068  RGDAuthoringForm.css additions (frontend, different file)

Parallel batch B (after T062):
  T063  Go unit tests for internal/validate/
  T064  ValidateRGDStatic handler

Parallel batch C (after T061):
  T066  TypeScript StaticIssue types + api.ts function

# After T062 + T063 + T064 + T066 + T068:

Sequential:
  T065  route registration (server.go)
  T067  RGDAuthoringForm staticIssues prop
  T069  AuthorPage debounce
  T070  RGDAuthoringForm tests
  T071 → T072 → T073  verification
```

---

## Full delivery order (all 10 stories, recommended)

```
# Already done (T001–T032): US1–US7 ✅

# US8 (bidirectional import): T033–T051
# US10 (offline deep validation — P1, do before US9):
  T061 → T062 → T063 → T064 → T065 → T066 → T067 → T068 → T069 → T070 → T071–T073
# US9 (dry-run cluster check — P2, needs connectivity):
  T052 → T053 → T054 → T055 → T056 → T057 → T058 → T059 → T060
```

> US10 before US9 because US10 works offline (higher value for local-only users)
> and its `internal/validate/` package has zero runtime dependencies on the cluster.
