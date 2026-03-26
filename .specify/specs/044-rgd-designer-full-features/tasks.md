# Tasks: RGD Designer — Full kro Feature Coverage

**Input**: Design documents from `/specs/044-rgd-designer-full-features/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contracts.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend TypeScript types to unblock all user stories. This is a single always-buildable step that adds new fields with backwards-compatible defaults so existing functionality is preserved throughout implementation.

- [X] T001 Add `AuthoringStatusField`, `ForEachIterator`, `AuthoringExternalRef` interfaces to `web/src/lib/generator.ts`
- [X] T002 Extend `AuthoringField` with optional constraint fields (`enum?`, `minimum?`, `maximum?`, `pattern?`) in `web/src/lib/generator.ts`
- [X] T003 Extend `AuthoringResource` with new fields (`resourceType`, `templateYaml`, `includeWhen`, `readyWhen`, `forEachIterators`, `externalRef`) in `web/src/lib/generator.ts`
- [X] T004 Extend `RGDAuthoringState` with `scope` and `statusFields` fields in `web/src/lib/generator.ts`
- [X] T005 Update `STARTER_RGD_STATE` with new default values (`scope: 'Namespaced'`, `statusFields: []`, extended resource defaults) in `web/src/lib/generator.ts`
- [X] T006 Run `cd web && bunx tsc --noEmit` and `bunx vitest run` — all existing tests must pass before proceeding

**Checkpoint**: TypeScript types extended; codebase still compiles; no existing tests broken

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the two core pure functions (`generateRGDYAML` and `rgdAuthoringStateToSpec`) and `buildSimpleSchemaStr`. These functions are the shared backbone consumed by every user story — all YAML output and live DAG rendering depend on them. Must complete before any form UI work.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [X] T007 Extend `buildSimpleSchemaStr` in `web/src/lib/generator.ts` to append constraint modifiers (`enum=`, `minimum=`, `maximum=`, `pattern=`) after base type and required/default portions
- [X] T008 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to emit `scope: Cluster` after `kind:` line when `state.scope === 'Cluster'`
- [X] T009 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to emit `status:` block under `spec.schema` from `state.statusFields` (skip rows with empty name or expression)
- [X] T010 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to emit `includeWhen` and `readyWhen` arrays before `template:` on managed resources (skip when empty)
- [X] T011 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to inject `templateYaml` body (indented 8 spaces) under `template:`, prepending default `metadata:` lines when `templateYaml` does not contain `metadata:`, falling back to `spec: {}` when empty
- [X] T012 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to emit `forEach` array before `template:` for `resourceType === 'forEach'` resources (one entry per iterator pair)
- [X] T013 Extend `generateRGDYAML` in `web/src/lib/generator.ts` to emit `externalRef` block instead of `template:` for `resourceType === 'externalRef'` resources, using `metadata.name` or `metadata.selector.matchLabels` based on which is populated
- [X] T014 Extend `rgdAuthoringStateToSpec` in `web/src/lib/generator.ts` to pass `forEach` iterators for forEach-mode resources as `{ id, forEach: [{variable: expression}], template: { apiVersion, kind, metadata: {name:''}, _raw: templateYaml } }`
- [X] T015 Extend `rgdAuthoringStateToSpec` in `web/src/lib/generator.ts` to pass externalRef-mode resources as `{ id, externalRef: { apiVersion, kind, metadata: { name?, namespace?, selector? } } }` (no template)
- [X] T016 Extend `rgdAuthoringStateToSpec` in `web/src/lib/generator.ts` to add `includeWhen: [expr]` and `readyWhen: [...]` to any resource when non-empty, and add `template._raw: templateYaml` for managed resources
- [X] T017 Run `cd web && bunx tsc --noEmit` and `bunx vitest run` — all existing tests must still pass

**Checkpoint**: Foundation ready — all YAML generation and DAG spec mapping logic is complete; user story UI implementation can now begin in parallel

---

## Phase 3: User Story 1 — Template body editing (Priority: P1) 🎯 MVP

**Goal**: Each resource row gets an expandable "Edit template" section with a `<textarea>` for the template YAML body. Edits are reflected in the YAML preview, DAG edges update from CEL references, and invalid YAML degrades gracefully without crashing.

**Independent Test**: Open `/author`, add a Deployment resource, click "Edit template", type `spec:\n  replicas: ${schema.spec.replicas}`, observe YAML preview updates within 300ms. Confirm generated YAML contains the typed content indented under `template:`. Confirm no crash on invalid partial YAML.

### Implementation for User Story 1

- [X] T018 [US1] Add `expandedTemplates: Set<string>` local UI state to `RGDAuthoringForm` in `web/src/components/RGDAuthoringForm.tsx` for tracking which resource `_key`s have the template editor open
- [X] T019 [US1] Add "Edit template" toggle button (`data-testid="template-expand-{_key}"`) to each resource row in `web/src/components/RGDAuthoringForm.tsx`, toggling the `_key` in `expandedTemplates`
- [X] T020 [US1] Render `<textarea>` (`data-testid="template-body-{_key}"`, `font-family: var(--font-mono)`) when resource `_key` is in `expandedTemplates`; wire value to `resource.templateYaml` and `onChange` in `web/src/components/RGDAuthoringForm.tsx`
- [X] T021 [US1] Add inline warning indicator on the resource row header when `templateYaml` is non-empty but contains no valid key-value pairs (cannot be used for DAG edge inference) in `web/src/components/RGDAuthoringForm.tsx`
- [X] T022 [P] [US1] Add CSS for template editor section (min-height, resize handle, monospace styling) using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 1 fully functional — template editing works, YAML updates, graceful degradation confirmed

---

## Phase 4: User Story 2 — Status Fields section (Priority: P1)

**Goal**: A "Status Fields" section below "Spec Fields" lets users add `(name, CEL expression)` rows serialized as `spec.schema.status:` in generated YAML. The live DAG schema root node reflects status dependencies.

**Independent Test**: Open `/author`, click "+ Add Status Field", enter name `endpoint` and expression `${service.spec.clusterIP}`, verify YAML preview shows `status:\n  endpoint: ${service.spec.clusterIP}` under `spec.schema`. Remove the row; verify it disappears from YAML.

### Implementation for User Story 2

- [X] T023 [US2] Add "Status Fields" section container (`data-testid="status-fields-section"`) with "+ Add Status Field" button (`data-testid="add-status-field-btn"`) to `web/src/components/RGDAuthoringForm.tsx`, positioned between Spec Fields and Resources sections
- [X] T024 [US2] Render each `statusField` as a row with name input (`data-testid="status-field-name-{id}"`, `font-family: var(--font-mono)` CEL badge), expression input (`data-testid="status-field-expr-{id}"`), and remove button (`data-testid="status-field-remove-{id}"`) in `web/src/components/RGDAuthoringForm.tsx`
- [X] T025 [P] [US2] Add CSS for status fields section (row layout, CEL badge styling, spacing) using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 2 fully functional — status fields can be added, edited, removed; YAML output correct

---

## Phase 5: User Story 3 — `includeWhen` conditional (Priority: P1)

**Goal**: Each resource row has an "Advanced options" disclosure revealing an `includeWhen` CEL expression input. When set, the YAML contains `includeWhen: [expr]` and the live DAG node shows the `?` conditional indicator.

**Independent Test**: Add a resource, click "Advanced options", enter `includeWhen` value `${schema.spec.monitoring}`, verify YAML contains `includeWhen:\n  - ${schema.spec.monitoring}` under the resource and the live DAG node shows a dashed border or `?` indicator.

### Implementation for User Story 3

- [X] T026 [US3] Add `expandedAdvanced: Set<string>` local UI state to `RGDAuthoringForm` in `web/src/components/RGDAuthoringForm.tsx` for tracking which resource `_key`s have advanced options open
- [X] T027 [US3] Add "Advanced options ▾" toggle button (`data-testid="advanced-expand-{_key}"`) to each resource row, toggling `_key` in `expandedAdvanced`; add badge showing "conditional" when `includeWhen` is non-empty in `web/src/components/RGDAuthoringForm.tsx`
- [X] T028 [US3] Render `includeWhen` CEL input (`data-testid="resource-include-when-{_key}"`, monospace font, CEL badge) when resource `_key` is in `expandedAdvanced`; wire to `resource.includeWhen` in `web/src/components/RGDAuthoringForm.tsx`
- [X] T029 [P] [US3] Add CSS for advanced options section (collapse/expand transition, CEL badge) using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 3 fully functional — includeWhen input present, YAML correct, DAG node shows conditional indicator

---

## Phase 6: User Story 4 — `readyWhen` gate (Priority: P1)

**Goal**: The "Advanced options" section also exposes repeatable `readyWhen` CEL expression rows. When set, generated YAML contains `readyWhen: [expr1, expr2, ...]` and the resource row header shows a "ready-gated" badge.

**Independent Test**: Expand advanced options on a resource, click "+ Add readyWhen", enter `${db.status.endpoint != ""}`, verify YAML shows `readyWhen:\n  - ${db.status.endpoint != ""}`. Add a second row, verify both appear as separate array entries.

### Implementation for User Story 4

- [X] T030 [US4] Add `readyWhen` repeatable rows to the advanced options section: "+ Add readyWhen" button (`data-testid="readywhen-add-{_key}"`), expression inputs (`data-testid="readywhen-expr-{_key}-{i}"`), remove buttons (`data-testid="readywhen-remove-{_key}-{i}"`); add "ready-gated" badge to resource row header when any entry is non-empty in `web/src/components/RGDAuthoringForm.tsx`

**Checkpoint**: User Story 4 fully functional — readyWhen rows can be added/removed; YAML correct

---

## Phase 7: User Story 5 — `forEach` collection (Priority: P1)

**Goal**: A resource type toggle ("Managed" / "Collection (forEach)" / "External ref") is added to each resource row. In "Collection (forEach)" mode, repeatable `(variable, expression)` iterator rows are shown. The live DAG node renders with `NodeTypeCollection` styling (triangle/forEach badge).

**Independent Test**: Set resource type to "Collection (forEach)", enter variable `region` and expression `${schema.spec.regions}`, verify generated YAML has `forEach:\n  - region: ${schema.spec.regions}` and live DAG shows the forEach (triangle) node style. Toggle back to "Managed"; verify `forEach` is absent from YAML.

### Implementation for User Story 5

- [X] T031 [US5] Add resource type `<select>` (`data-testid="resource-type-{_key}"`, options: "Managed"/"Collection (forEach)"/"External ref") to each resource row in `web/src/components/RGDAuthoringForm.tsx`; on mode change, reset mode-specific fields and preserve `id`, `apiVersion`, `kind`, `templateYaml`
- [X] T032 [US5] Render forEach iterator rows when `resource.resourceType === 'forEach'`: variable input (`data-testid="foreach-var-{_key}-{i}"`), expression input (`data-testid="foreach-expr-{_key}-{i}"`), remove button (`data-testid="foreach-remove-{_key}-{i}"`), and "+ Add iterator" button (`data-testid="foreach-add-{_key}"`) in `web/src/components/RGDAuthoringForm.tsx`
- [X] T033 [P] [US5] Add CSS for resource type toggle and forEach iterator rows using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 5 fully functional — forEach mode works, iterator rows add/remove, YAML correct, DAG shows collection node

---

## Phase 8: User Story 6 — `externalRef` node (Priority: P1)

**Goal**: In "External ref" mode, the resource row shows `apiVersion`, `kind`, `namespace`, and a "By name" / "By selector" radio. "By name" shows a name input; "By selector" shows repeatable `(label key, label value)` rows. The live DAG renders `NodeTypeExternal` (name) or `NodeTypeExternalCollection` (selector).

**Independent Test**: Set resource to "External ref", set apiVersion `v1`, kind `ConfigMap`, select "By name", enter name `platform-config` and namespace `platform-system`. Verify YAML shows `externalRef:\n  apiVersion: v1\n  kind: ConfigMap\n  metadata:\n    name: platform-config\n    namespace: platform-system`. Verify DAG shows a circle (external node). Switch to "By selector", add label `role=team-config`; verify YAML uses `selector.matchLabels` and DAG shows externalCollection style.

### Implementation for User Story 6

- [X] T034 [US6] Render externalRef fields when `resource.resourceType === 'externalRef'`: apiVersion input (`data-testid="extref-apiver-{_key}"`), kind input (`data-testid="extref-kind-{_key}"`), namespace input (`data-testid="extref-ns-{_key}"`), and "By name" / "By selector" radio group (`data-testid="extref-byname-{_key}"`, `data-testid="extref-byselector-{_key}"`) in `web/src/components/RGDAuthoringForm.tsx`
- [X] T035 [US6] Render name input (`data-testid="extref-name-{_key}"`) when "By name" is selected, and selector label rows (`data-testid="extref-label-key-{_key}-{i}"`, `data-testid="extref-label-val-{_key}-{i}"`, `data-testid="extref-label-remove-{_key}-{i}"`) with add button (`data-testid="extref-label-add-{_key}"`) when "By selector" is selected in `web/src/components/RGDAuthoringForm.tsx`
- [X] T036 [P] [US6] Add CSS for externalRef mode fields and selector label rows using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 6 fully functional — externalRef name and selector modes work; YAML correct; DAG shows correct external node types

---

## Phase 9: User Story 7 — `scope: Cluster` toggle (Priority: P2)

**Goal**: A "Scope" radio (Namespaced / Cluster) in the Metadata section. Selecting "Cluster" adds `scope: Cluster` to the generated YAML under `spec.schema`. Namespaced (default) omits the key entirely.

**Independent Test**: Open `/author`, select "Cluster" scope radio, verify YAML contains `scope: Cluster` after `kind:` in the schema block. Switch back to "Namespaced", verify `scope` key is absent.

### Implementation for User Story 7

- [X] T037 [US7] Add Scope radio group (`data-testid="scope-namespaced"`, `data-testid="scope-cluster"`) to the Metadata section in `web/src/components/RGDAuthoringForm.tsx`; wire to `state.scope` via `onChange`
- [X] T038 [P] [US7] Add CSS for scope radio group using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 7 fully functional — scope toggle updates YAML correctly

---

## Phase 10: User Story 8 — Spec field validation constraints (Priority: P2)

**Goal**: Each spec field row has an expand toggle revealing `enum`, `minimum`, `maximum`, and `pattern` constraint inputs. Non-empty values are appended to the SimpleSchema string in the generated YAML.

**Independent Test**: Add a spec field of type `integer`, expand its constraint row, enter `minimum=1` and `maximum=100`, verify YAML contains `integer | default=... minimum=1 maximum=100`. Add a `string` field, enter `enum=dev,staging,prod`, verify YAML contains `string | enum=dev,staging,prod`.

### Implementation for User Story 8

- [X] T039 [US8] Add `expandedFields: Set<string>` local UI state to `RGDAuthoringForm` in `web/src/components/RGDAuthoringForm.tsx` for tracking which spec field `id`s have constraints expanded
- [X] T040 [US8] Add field expand toggle button (`data-testid="field-expand-{id}"`) to each spec field row in `web/src/components/RGDAuthoringForm.tsx`; render constraint inputs when expanded: `enum` (`data-testid="field-enum-{id}"`), `minimum` (`data-testid="field-min-{id}"`), `maximum` (`data-testid="field-max-{id}"`), `pattern` (`data-testid="field-pattern-{id}"`)
- [X] T041 [P] [US8] Add CSS for spec field constraint expansion area using only `tokens.css` custom properties in `web/src/components/RGDAuthoringForm.css`

**Checkpoint**: User Story 8 fully functional — constraint inputs present, SimpleSchema string updated correctly

---

## Phase 11: Unit Tests

**Purpose**: Extend existing test files to cover all new generator functions and form interactions per the quickstart test strategy.

- [X] T042 [P] Extend `web/src/lib/generator.test.ts` with `generateRGDYAML` cases: scope Cluster, statusFields serialization, includeWhen/readyWhen YAML, forEach single and cartesian-product (2 iterators), externalRef scalar and collection, templateYaml body injection (with and without metadata), empty-field omission
- [X] T043 [P] Extend `web/src/lib/generator.test.ts` with `buildSimpleSchemaStr` constraint cases: `enum=`, `minimum=`, `maximum=`, `pattern=`, combined constraints, empty constraint omission
- [X] T044 [P] Extend `web/src/lib/generator.test.ts` with `rgdAuthoringStateToSpec` cases: forEach resource produces correct DAG shape with `_raw`, externalRef scalar produces correct DAG shape, externalRef collection produces `selector.matchLabels`, includeWhen/readyWhen forwarded correctly
- [X] T045 [P] Extend `web/src/components/RGDAuthoringForm.test.tsx` with form interaction tests: status field add/remove/update, resource type toggle (managed→forEach→externalRef and back), template editor open/close, forEach iterator add/remove, advanced options toggle, includeWhen/readyWhen inputs, scope radio, field constraint expand/collapse

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility audit, and acceptance checklist from quickstart.md.

- [X] T046 Run full typecheck `cd web && bunx tsc --noEmit` — must pass with 0 errors
- [X] T047 Run full test suite `cd web && bunx vitest run` — all tests must pass
- [X] T048 Run Go build `make go` — confirm no regressions (no backend changes expected)
- [ ] T049 Manual acceptance: open `/author`, author a Deployment with `spec.replicas: ${schema.spec.replicas}`, a forEach ConfigMap resource, and an externalRef ConfigMap; verify generated YAML is valid kro YAML covering all 5 node types
- [ ] T050 Manual acceptance: verify live DAG shows all three node styles in a single designer session: resource rectangle, forEach triangle, external circle
- [ ] T051 Keyboard accessibility audit: Tab through all new form inputs (scope radio, status field rows, field constraint expand, resource type select, template textarea, forEach iterators, externalRef fields, advanced options); confirm no focus traps, Enter/Escape work for toggles
- [X] T052 CSS audit: confirm no hardcoded hex/rgba in `web/src/components/RGDAuthoringForm.css` — all values via `var(--...)` tokens
- [X] T053 Dependency audit: confirm no new entries in `web/package.json` or `go.mod`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; extends types with backwards-compatible defaults
- **Phase 2 (Foundational)**: Depends on Phase 1 — must complete before any form UI work
- **Phase 3–10 (User Stories)**: All depend on Phase 2 completion; Phase 3–8 (P1 stories) can proceed in parallel; Phase 9–10 (P2 stories) can proceed after Phase 2 independently
- **Phase 11 (Tests)**: All test tasks [P] can run in parallel once the feature they cover is complete
- **Phase 12 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (template body)**: After Phase 2 — no dependency on other stories
- **US2 (status fields)**: After Phase 2 — no dependency on other stories
- **US3 (includeWhen)**: After Phase 2 — no dependency on other stories; shares `expandedAdvanced` UI state with US4
- **US4 (readyWhen)**: After US3 (shares advanced options disclosure) — add to same expanded section
- **US5 (forEach)**: After Phase 2 — no dependency on other stories
- **US6 (externalRef)**: After US5 (shares resource type toggle) — builds on same `<select>` mode toggle
- **US7 (scope)**: After Phase 2 — no dependency on other stories; minimal form addition
- **US8 (spec constraints)**: After Phase 2 — no dependency on other stories

### Within Each User Story

- CSS tasks marked [P] can run in parallel with implementation tasks that touch different files
- Form state and rendering tasks are sequential within a story (state before render)

### Parallel Opportunities

- T007–T016 (Foundational): T007, T008, T009 can run in parallel; T010–T013 can run in parallel after T003–T005; T014–T016 can run in parallel
- T018–T022 (US1): T022 [P] can run in parallel with T018–T021
- T023–T025 (US2): T025 [P] can run in parallel with T023–T024
- T026–T029 (US3): T029 [P] can run in parallel with T026–T028
- T031–T033 (US5): T033 [P] can run in parallel with T031–T032
- T034–T036 (US6): T036 [P] can run in parallel with T034–T035
- T037–T038 (US7): T038 [P] can run in parallel with T037
- T039–T041 (US8): T041 [P] can run in parallel with T039–T040
- T042–T045 (Tests): All four [P] can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# These generator extensions are independent and touch the same file
# but logically separate functions — implement in sequence for safety:
Task T007: buildSimpleSchemaStr constraint modifiers
Task T008+T009: generateRGDYAML scope + status (same function, different sections)
Task T010+T011: generateRGDYAML includeWhen/readyWhen + template body
Task T012+T013: generateRGDYAML forEach + externalRef
Task T014+T015+T016: rgdAuthoringStateToSpec forEach + externalRef + includeWhen/readyWhen
```

## Parallel Example: P1 User Stories (after Phase 2)

```bash
# Once Foundational is complete, these form sections are independent:
Task T018–T022: US1 — template editor (RGDAuthoringForm.tsx)
Task T023–T025: US2 — status fields section (RGDAuthoringForm.tsx)
Task T026–T029: US3+US4 — advanced options: includeWhen + readyWhen
Task T031–T033: US5 — forEach mode + iterators
Task T034–T036: US6 — externalRef mode + selector
```

---

## Implementation Strategy

### MVP First (User Stories 1–6, all P1)

1. Complete Phase 1: Type extensions (T001–T006)
2. Complete Phase 2: Generator function extensions (T007–T017)
3. Complete Phase 3 (US1): Template editor
4. **STOP and VALIDATE**: Template editing works end-to-end
5. Complete Phase 4 (US2): Status fields
6. Complete Phase 5+6 (US3+US4): includeWhen + readyWhen (share advanced options section)
7. Complete Phase 7 (US5): forEach mode
8. Complete Phase 8 (US6): externalRef mode
9. **VALIDATE**: Open `/author`, produce YAML covering all 5 node types

### Incremental Delivery

1. Phase 1+2 → always-buildable generator layer
2. + Phase 3 (US1) → template body editing works
3. + Phase 4 (US2) → status fields work
4. + Phase 5+6 (US3+US4) → conditionals work
5. + Phase 7 (US5) → forEach/collection node works
6. + Phase 8 (US6) → externalRef node works
7. + Phase 9 (US7) → scope toggle works (P2)
8. + Phase 10 (US8) → field constraints work (P2)
9. + Phase 11 (Tests) → full coverage
10. + Phase 12 (Polish) → PR-ready

---

## Notes

- [P] tasks = different files or logically independent sections, no shared dependencies
- [Story] label maps task to specific user story for traceability
- All generator changes (Phase 1+2) must keep `bunx vitest run` green throughout
- Always run `bunx tsc --noEmit` after every file change to catch type errors early
- No new npm or Go dependencies — any `package.json` or `go.mod` change is a violation
- No hardcoded hex/rgba in any CSS — all via `var(--...)` from `tokens.css`
- US3 and US4 share the `expandedAdvanced` UI state and the "Advanced options" section — implement sequentially
- US5 and US6 share the resource type `<select>` toggle — US5 adds the select, US6 adds the third option and mode UI
