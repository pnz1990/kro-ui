# Tasks: RGD YAML Generator (026-rgd-yaml-generator)

**Input**: Design documents from `.specify/specs/026-rgd-yaml-generator/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/generate-tab.md ✓, quickstart.md ✓

**Tests**: Unit tests are included per spec requirement (FR-002, Testing Requirements section).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new files and module skeleton. No logic yet — just stubs
that typecheck.

- [x] T001 Create `web/src/lib/generator.ts` with exported function stubs: `kindToSlug`, `generateInstanceYAML`, `parseBatchRow`, `generateBatchYAML`, `generateRGDYAML` — stub bodies return `""` or `{}` typed correctly per `contracts/generate-tab.md`
- [x] T002 Create `web/src/lib/generator.test.ts` as empty test file (imports only, no test cases yet) in `web/src/lib/`
- [x] T003 [P] Create `web/src/components/YAMLPreview.tsx` and `YAMLPreview.css` as stub components (renders `<div data-testid="yaml-preview" />`)
- [x] T004 [P] Create `web/src/components/InstanceForm.tsx` and `InstanceForm.css` as stub component
- [x] T005 [P] Create `web/src/components/BatchForm.tsx` and `BatchForm.css` as stub component
- [x] T006 [P] Create `web/src/components/RGDAuthoringForm.tsx` and `RGDAuthoringForm.css` as stub component
- [x] T007 Create `web/src/components/GenerateTab.tsx` and `GenerateTab.css` as stub component
- [x] T008 Create `web/src/components/GenerateTab.test.tsx` as empty test file
- [x] T009 Run `bun run --cwd web tsc --noEmit` — confirm zero type errors before any logic is added

**Checkpoint**: All new files exist and typecheck. No logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the pure-function library (`generator.ts`) that ALL three
user story components depend on. Must be complete and tested before building any
React component.

**⚠️ CRITICAL**: No component work begins until this phase is complete.

- [x] T010 Implement `kindToSlug(kind: string): string` in `web/src/lib/generator.ts` — PascalCase → lowercase-hyphenated; replicates the slug logic from `web/src/components/ExampleYAML.tsx` (lines 68–74)
- [x] T011 Add unit tests for `kindToSlug` in `web/src/lib/generator.test.ts`: `"WebApplication"→"web-application"`, `"MyApp"→"my-app"`, `"ConfigMap"→"config-map"`, `""→""`
- [x] T012 Implement `parseBatchRow(line: string, index: number): BatchRow` in `web/src/lib/generator.ts` — space-split `key=value` tokens; first `=` is delimiter; skip tokens with `eqIdx <= 0`; set `error` on malformed input
- [x] T013 Add unit tests for `parseBatchRow` in `web/src/lib/generator.test.ts`: valid pairs, value-with-no-key (`=bad`), empty line, multiple valid tokens in one line
- [x] T014 Implement `generateInstanceYAML(schema: SchemaDoc, state: InstanceFormState): string` in `web/src/lib/generator.ts` — builds JS object from state, calls `toYaml()` from `web/src/lib/yaml.ts`; boolean string→bool; integer/number string→Number; array fields pass `string[]`; omits spec when empty
- [x] T015 Add unit tests for `generateInstanceYAML` in `web/src/lib/generator.test.ts`: required fields filled, optional fields with defaults, metadata.name from state, boolean field serialization, array field YAML list block, empty spec fields case
- [x] T016 Implement `generateBatchYAML(batchText: string, schema: SchemaDoc): { yaml: string; rows: BatchRow[] }` in `web/src/lib/generator.ts` — splits text on `\n`, calls `parseBatchRow` per line, merges with schema defaults, calls `generateInstanceYAML` per row, joins documents with `---\n`
- [x] T017 Add unit tests for `generateBatchYAML` in `web/src/lib/generator.test.ts`: 3 lines → 3 documents, empty text → `{ yaml: "", rows: [] }`, row with missing field uses schema default
- [x] T018 Implement `generateRGDYAML(state: RGDAuthoringState): string` in `web/src/lib/generator.ts` — string construction (not `toYaml`) to preserve CEL `${...}` placeholders; produces `kro.run/v1alpha1 ResourceGraphDefinition` YAML as specified in `data-model.md`
- [x] T019 Add unit tests for `generateRGDYAML` in `web/src/lib/generator.test.ts`: correct `apiVersion`, `kind: ResourceGraphDefinition`, `spec.schema.kind` from state, spec fields as SimpleSchema strings, resource template with `${schema.metadata.name}-<id>` placeholder
- [x] T020 Run `bun run --cwd web test web/src/lib/generator.test.ts` — all tests must pass; run `bun run --cwd web tsc --noEmit` — zero errors

**Checkpoint**: `generator.ts` is fully implemented and tested. Component work can begin.

---

## Phase 3: User Story 1 — Interactive Instance YAML Form (Priority: P1) 🎯 MVP

**Goal**: Add a "Generate" tab to the RGD detail page with an interactive
per-field form. Changing any field updates the YAML preview immediately.
Copy YAML and Copy kubectl-apply buttons work.

**Independent Test**: Open any RGD's Generate tab. Confirm all spec fields render
with appropriate input controls. Change a value — YAML preview updates
synchronously. Click "Copy YAML" — clipboard contains valid YAML.

### Implementation for User Story 1

- [x] T021 [US1] Implement `YAMLPreview` component in `web/src/components/YAMLPreview.tsx`:
- [x] T022 [US1] Add CSS for `YAMLPreview` in `web/src/components/YAMLPreview.css`
- [x] T023 [P] [US1] Implement `FieldValue` + `InstanceFormState` interfaces in `web/src/lib/generator.ts`
- [x] T024 [US1] Implement `InstanceForm` component in `web/src/components/InstanceForm.tsx`
- [x] T025 [US1] Add CSS for `InstanceForm` in `web/src/components/InstanceForm.css`
- [x] T026 [US1] Implement `GenerateTab` component in `web/src/components/GenerateTab.tsx`
- [x] T027 [US1] Add CSS for `GenerateTab` in `web/src/components/GenerateTab.css`
- [x] T028 [US1] Wire `GenerateTab` into `web/src/pages/RGDDetail.tsx`
- [x] T029 [US1] Add unit tests for `GenerateTab` (form mode) in `web/src/components/GenerateTab.test.tsx`
- [x] T030 [US1] Run `bun run --cwd web test` (all tests) and `bun run --cwd web tsc --noEmit`

**Checkpoint**: User Story 1 is fully functional. Any RGD's Generate tab shows the
interactive form with live YAML preview, Copy YAML, and Copy kubectl apply.

---

## Phase 4: User Story 2 — Batch Instance Generator (Priority: P2)

**Goal**: Add "Batch" mode to the Generate tab where each line of the textarea
produces one YAML document. The output preview shows all N documents separated
by `---`.

**Independent Test**: Switch to Batch mode. Type two lines of `key=value` pairs.
Confirm: exactly 2 YAML documents separated by `---` appear in the preview.

### Implementation for User Story 2

- [x] T031 [US2] Implement `BatchRow` interface and ensure `parseBatchRow` + `generateBatchYAML` exercised in `BatchForm`
- [x] T032 [US2] Implement `BatchForm` component in `web/src/components/BatchForm.tsx`
- [x] T033 [US2] Add CSS for `BatchForm` in `web/src/components/BatchForm.css`
- [x] T034 [US2] Wire `BatchForm` into `GenerateTab` in `web/src/components/GenerateTab.tsx`
- [x] T035 [US2] Add unit tests for `BatchForm` in `web/src/components/GenerateTab.test.tsx`
- [x] T036 [US2] Run `bun run --cwd web test` and `bun run --cwd web tsc --noEmit`

**Checkpoint**: User Stories 1 AND 2 are both independently functional.

---

## Phase 5: User Story 3 — RGD Authoring Assistant (Priority: P2)

**Goal**: Add "New RGD" mode to the Generate tab. Users define a kind name, spec
fields (with types and defaults), and resource templates. The output is a valid
`ResourceGraphDefinition` YAML scaffold.

**Independent Test**: Switch to "New RGD" mode. Verify: pre-populated starter state
(kind "MyApp", one Deployment resource) shows a valid RGD YAML preview. Add a
spec field `replicas: integer | default=2` — confirm the YAML shows the correct
SimpleSchema string.

### Implementation for User Story 3

- [x] T037 [US3] Define `AuthoringField`, `AuthoringResource`, `RGDAuthoringState` interfaces in `web/src/lib/generator.ts`
- [x] T038 [US3] Implement `RGDAuthoringForm` component in `web/src/components/RGDAuthoringForm.tsx`
- [x] T039 [US3] Add CSS for `RGDAuthoringForm` in `web/src/components/RGDAuthoringForm.css`
- [x] T040 [US3] Wire `RGDAuthoringForm` into `GenerateTab` in `web/src/components/GenerateTab.tsx`
- [x] T041 [US3] Add unit tests in `web/src/components/GenerateTab.test.tsx`
- [x] T042 [US3] Run `bun run --cwd web test` and `bun run --cwd web tsc --noEmit`

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, edge cases, UX polish, and CI validation.

- [x] T043 [P] Add `data-testid` attributes to all new components
- [x] T044 [P] Verify graceful degradation in `InstanceForm.tsx`
- [x] T045 [P] Verify graceful degradation in `GenerateTab.tsx`
- [x] T046 Audit all new `.css` files for any `rgba()`, hex color literals — none found
- [x] T047 [P] Add `aria-label` attributes to all icon-only buttons
- [x] T048 Run full test suite: 529/529 passed; tsc zero errors; go vet clean
- [x] T049 Manual quickstart validation per `.specify/specs/026-rgd-yaml-generator/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. T003–T008 are parallel.
- **Phase 2 (Foundational)**: Depends on Phase 1. T010–T019 can proceed in pairs (implement → test per function). T010/T012/T014/T016/T018 are parallel (different functions). Blocks all user story phases.
- **Phase 3 (US1)**: Depends on Phase 2. T021–T025 can run in parallel (different component files). T026, T027, T028 are sequential (GenerateTab depends on YAMLPreview + InstanceForm; RGDDetail wiring depends on GenerateTab).
- **Phase 4 (US2)**: Depends on Phase 2 (uses `generateBatchYAML`). Can start in parallel with Phase 3 if separate developer. T031–T033 are parallel; T034 depends on T031–T033.
- **Phase 5 (US3)**: Depends on Phase 2 (uses `generateRGDYAML`). Can start in parallel with Phase 3/4. T037–T039 are parallel; T040 depends on T037–T039.
- **Phase 6 (Polish)**: Depends on Phases 3–5. T043–T047 are parallel.

### User Story Dependencies

- **US1 (P1)**: Only requires Phase 2 complete. No dependency on US2 or US3.
- **US2 (P2)**: Only requires Phase 2 complete (`generateBatchYAML`). May run concurrently with US1.
- **US3 (P2)**: Only requires Phase 2 complete (`generateRGDYAML`). May run concurrently with US1/US2.

### Within Each User Story

- Pure functions (Phase 2) before components (Phases 3–5)
- Leaf components (`YAMLPreview`, `InstanceForm`, `BatchForm`, `RGDAuthoringForm`) before orchestrator (`GenerateTab`)
- `GenerateTab` before `RGDDetail` wiring

### Parallel Opportunities

```bash
# Phase 1 — run in parallel:
T003: Create YAMLPreview stubs
T004: Create InstanceForm stubs
T005: Create BatchForm stubs
T006: Create RGDAuthoringForm stubs

# Phase 2 — implement in parallel (different functions):
T010+T011: kindToSlug + tests
T012+T013: parseBatchRow + tests
T014+T015: generateInstanceYAML + tests
T016+T017: generateBatchYAML + tests
T018+T019: generateRGDYAML + tests

# Phases 3, 4, 5 — run in parallel (if staffed):
Developer A: Phase 3 (US1 Instance Form)
Developer B: Phase 4 (US2 Batch)
Developer C: Phase 5 (US3 RGD Authoring)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T009)
2. Complete Phase 2: Foundational (T010–T020) — generator functions
3. Complete Phase 3: User Story 1 (T021–T030)
4. **STOP and VALIDATE**: Open any RGD's `?tab=generate`, test the instance form
5. Ship / demo if ready — the tab is independently valuable

### Incremental Delivery

1. Phase 1 + Phase 2 → generator library complete
2. Phase 3 → Instance Form tab works (MVP)
3. Phase 4 → Batch mode works
4. Phase 5 → New RGD authoring works
5. Phase 6 → Polish and CI green

### Single Developer Sequential Order

```
T001 → T002 → T003–T008 (parallel) → T009
→ T010+T011 → T012+T013 → T014+T015 → T016+T017 → T018+T019 → T020
→ T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030
→ T031 → T032 → T033 → T034 → T035 → T036
→ T037 → T038 → T039 → T040 → T041 → T042
→ T043–T047 (parallel) → T048 → T049
```

---

## Notes

- `[P]` tasks operate on different files and have no incomplete task dependencies
- `[Story]` label maps to user stories from `spec.md` for traceability
- All CSS tokens must be from `web/src/tokens.css` — no inline hex/rgba anywhere
- Use `'default' in parsedType` (key-existence) NOT `parsedType.default !== undefined` for default detection (issue #61 guard)
- `generateRGDYAML` must use string construction, not `toYaml()`, to avoid quoting CEL `${...}` placeholders
- No new npm packages — zero additional dependencies
- Commit after each phase checkpoint at minimum
