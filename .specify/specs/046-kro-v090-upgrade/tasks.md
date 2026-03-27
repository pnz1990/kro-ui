# Tasks: kro v0.9.0 Upgrade — UI Compatibility & Feature Surfacing

**Input**: Design documents from `.specify/specs/046-kro-v090-upgrade/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Unit tests included per spec.md Testing Requirements.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline, locate exact insertion points, confirm no regressions.

- [X] T001 Verify Go build and TypeScript typecheck pass clean: `make go && cd web && bun run typecheck`
- [X] T002 [P] Verify Go tests pass clean: `GOPROXY=direct GONOSUMDB="*" go test -race ./...`
- [X] T003 [P] Verify frontend unit tests pass: `cd web && bun test`

**Checkpoint**: All existing tests green — safe to begin feature work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type-system and API surface changes that ALL user stories build on.
These changes must land before any component or handler work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add `HasGraphRevisions bool \`json:"hasGraphRevisions"\`` to `SchemaCapabilities` struct in `internal/k8s/capabilities.go`
- [X] T005 Add `const internalKroAPIVersion = "internal.kro.run/v1alpha1"` and `var graphRevisionGVR = schema.GroupVersionResource{Group: "internal.kro.run", Version: "v1alpha1", Resource: "graphrevisions"}` to `internal/k8s/client.go`
- [X] T006 Add `detectInternalKroCRDs(ctx context.Context, disc discovery.DiscoveryInterface) bool` to `internal/k8s/capabilities.go` — calls `disc.ServerResourcesForGroupVersion("internal.kro.run/v1alpha1")`, returns true when `graphrevisions` is in the resource list, false on any error
- [X] T007 Wire `detectInternalKroCRDs` into `DetectCapabilities` in `internal/k8s/capabilities.go` — run as third goroutine alongside the existing two; set `caps.Schema.HasGraphRevisions = result`
- [X] T008 Update `Baseline()` in `internal/k8s/capabilities.go`: change `HasExternalRefSelector: false` → `true`; add `HasGraphRevisions: false`
- [X] T009 [P] Add `hasGraphRevisions bool \`json:"hasGraphRevisions"\`` to the `schema` object in the `KroCapabilities` TypeScript interface in `web/src/lib/api.ts`
- [X] T010 [P] Update `BASELINE` in `web/src/lib/features.ts`: set `hasExternalRefSelector: true` (was `false`); add `hasGraphRevisions: false` to the `schema` block

**Checkpoint**: Foundation ready — Go capabilities type and TS type both have `hasGraphRevisions`; baseline updated.

---

## Phase 3: User Story 4 — GraphRevision API Endpoints (Priority: P1) 🎯 Unblocks spec 009

**Goal**: Expose `GET /api/v1/kro/graph-revisions?rgd=<name>` and `GET /api/v1/kro/graph-revisions/{name}` as read-only endpoints. Returns `{items:[]}` gracefully on pre-v0.9.0 clusters.

**Independent Test**: Call `GET /api/v1/kro/graph-revisions?rgd=upstream-cluster-scoped` against a live kro-ui instance. On v0.9.0 cluster: expect items array. On v0.8.x cluster or local dev: expect `{"items":[]}` with status 200.

### Implementation for User Story 4

- [X] T011 [US4] Create `internal/api/handlers/graph_revisions.go` with Apache 2.0 header; add `ListGraphRevisions(w http.ResponseWriter, r *http.Request)` handler — extracts `rgd` query param (400 if missing), uses `graphRevisionGVR` with field selector `spec.snapshot.name=<rgd>` on dynamic client scoped cluster-wide (no namespace), wraps entire operation in a 5-second context deadline, catches "no matches for kind" / "not found" errors and returns `{"items":[]}`, otherwise marshals and returns the list sorted by `spec.revision` descending
- [X] T012 [US4] Add `GetGraphRevision(w http.ResponseWriter, r *http.Request)` to `internal/api/handlers/graph_revisions.go` — extracts `{name}` from chi URL params, uses `graphRevisionGVR.Get()` cluster-wide, returns 404 with `{"error":"graph revision not found: <name>"}` when not found or CRD absent
- [X] T013 [US4] Register routes in `internal/server/server.go`: add `r.Get("/api/v1/kro/graph-revisions", h.ListGraphRevisions)` and `r.Get("/api/v1/kro/graph-revisions/{name}", h.GetGraphRevision)` alongside the existing `/api/v1/kro/capabilities` route
- [X] T014 [US4] Write `internal/api/handlers/graph_revisions_test.go` with Apache 2.0 header; add table-driven tests: `TestListGraphRevisions_MissingRGDParam` (400), `TestListGraphRevisions_NoCRD` (returns `{items:[]}` without error), `TestGetGraphRevision_NotFound` (404) — use handwritten stub implementing the client interface
- [X] T015 [US4] Add `listGraphRevisions(rgdName: string)` and `getGraphRevision(name: string)` to `web/src/lib/api.ts` — `listGraphRevisions` calls `GET /api/v1/kro/graph-revisions?rgd=<rgdName>`, `getGraphRevision` calls `GET /api/v1/kro/graph-revisions/<name>`, both return `K8sList` and `K8sObject` respectively

### Tests for User Story 4

- [X] T016 [US4] Add `TestDetectsGraphRevisions` to `internal/k8s/capabilities_test.go` — mock `ServerResourcesForGroupVersion("internal.kro.run/v1alpha1")` returning a list with `graphrevisions`; assert `caps.Schema.HasGraphRevisions == true`
- [X] T017 [US4] Add `TestBaselineHasExternalRefSelectorTrue` and `TestBaselineHasGraphRevisionsFalse` to `internal/k8s/capabilities_test.go` — assert `Baseline().Schema.HasExternalRefSelector == true` and `Baseline().Schema.HasGraphRevisions == false`
- [X] T018 [US4] Add to `web/src/lib/features.test.ts`: assert `BASELINE.schema.hasExternalRefSelector === true` and `BASELINE.schema.hasGraphRevisions === false`

**Checkpoint**: `GET /api/v1/kro/graph-revisions?rgd=foo` returns `{"items":[]}` on any cluster. Unit tests pass.

---

## Phase 4: User Story 1 — Scope Badge on RGD Cards and Detail (Priority: P1)

**Goal**: RGD cards and detail page header show a "Cluster" badge when `spec.schema.scope === 'Cluster'`. No badge for Namespaced (default).

**Independent Test**: Navigate to Overview or Catalog page. RGD cards for Namespaced RGDs have no scope badge. An RGD with `spec.schema.scope: Cluster` shows a violet "Cluster" chip on its card and on the RGD detail header.

### Implementation for User Story 1

- [X] T019 [US1] Add CSS tokens to `web/src/tokens.css`: `--badge-cluster-bg: color-mix(in srgb, var(--color-pending) 15%, transparent)` and `--badge-cluster-fg: var(--color-pending)` — in the badges/chips section; no hardcoded hex values
- [X] T020 [P] [US1] Add `.rgd-scope-badge` CSS class to `web/src/components/RGDCard.css`: `display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: var(--font-size-xs); font-weight: 600; background: var(--badge-cluster-bg); color: var(--badge-cluster-fg)` — use token vars only
- [X] T021 [US1] Add scope badge rendering to `web/src/components/RGDCard.tsx`: read `(rgd?.spec as any)?.schema?.scope` (or use an existing `nestedGet`/`asString` helper); when value is `'Cluster'`, render `<span className="rgd-scope-badge" aria-label="Cluster-scoped resource">Cluster</span>` inside the card header row, after the kind/name — no badge when scope is absent or `'Namespaced'`
- [X] T022 [US1] Add scope badge and `lastIssuedRevision` chip to the RGD detail header in `web/src/pages/RGDDetail.tsx`: after the `{rgdKind && <span ...>}` element, add `{scope === 'Cluster' && <span className="rgd-scope-badge" ...>Cluster</span>}`; read `status.lastIssuedRevision` from the rgd object; when it is a number > 0 render `<span className="rgd-revision-chip" data-testid="rgd-revision-chip">Rev #{n}</span>` — extract these values using the existing `asString`/numeric helpers from `@/lib/format` or inline guards

### Tests for User Story 1

- [X] T023 [P] [US1] Add `.rgd-revision-chip` CSS to `web/src/pages/RGDDetail.css` (or `RGDCard.css`): small neutral-toned chip, padding `1px 6px`, border-radius `10px`, `font-size: var(--font-size-xs)`, using `var(--color-secondary)` or `var(--fg-secondary)` — no hardcoded hex

**Checkpoint**: Scope badge visible on cluster-scoped RGD cards and detail header. lastIssuedRevision chip shown when present. No badge on Namespaced RGDs.

---

## Phase 5: User Story 2 — DocsTab Types Section (Priority: P1)

**Goal**: When an RGD has `spec.schema.types` (a non-empty object), the Docs tab renders a "Types" section listing each named type with its fields.

**Independent Test**: Apply `upstream-cartesian-foreach` fixture (it has `types: null`) and an RGD with a real `types` block. Verify Types section appears for the latter and not the former. Verify fields are listed correctly with the same format as Spec fields.

### Implementation for User Story 2

- [X] T024 [US2] Add `typeSections?: Array<{ name: string; fields: ParsedField[] }>` to the `SchemaDoc` interface in `web/src/lib/schema.ts`
- [X] T025 [US2] Populate `typeSections` in `buildSchemaDoc()` in `web/src/lib/schema.ts`: read raw `spec.schema.types` from the RGD object; if it is a non-null object with keys, iterate each `[typeName, typeValue]` entry and call `parseSpec(typeValue)` (or the existing specFields parser); assign to `schema.typeSections`; if types is absent/null/empty object, set `typeSections` to `[]`
- [X] T026 [US2] Add Types section rendering to `web/src/components/DocsTab.tsx`: import `useCapabilities` from `@/lib/features`; after the Status Fields section, add `{caps.schema.hasTypes && schema.typeSections && schema.typeSections.length > 0 && (<section ...><h3>Types</h3>{schema.typeSections.map(ts => (<div key={ts.name}><h4>{ts.name}</h4><FieldTable fields={ts.fields} variant="spec" /></div>))}</section>)}`

### Tests for User Story 2

- [X] T027 [P] [US2] Add tests to `web/src/components/DocsTab.test.tsx`: `renders Types section when spec.schema.types is non-empty and hasTypes capability is true`; `hides Types section when types is null`; `hides Types section when hasTypes capability is false` — mock `useCapabilities` returning appropriate values

**Checkpoint**: Docs tab shows Types section for RGDs with custom type definitions. Hidden when types absent or capability off.

---

## Phase 6: User Story 3 — CEL Comprehension Macros Regression Guard (Priority: P1)

**Goal**: Confirm that `transformMap`, `transformList`, `transformMapEntry` inside `${...}` CEL expressions are correctly tokenised as `celExpression` tokens. This is a regression guard — no code change to `highlighter.ts` is expected.

**Independent Test**: Open the YAML tab for the `upstream-cel-comprehensions` fixture. Confirm `.token-cel-expression` spans exist and contain the comprehension macro names.

### Implementation for User Story 3

- [X] T028 [US3] Add regression tests to `web/src/lib/highlighter.test.ts`: three parameterised cases asserting that `tokenize('    result: ${schema.spec.items.transformMap(k, v, {k: string(v)})}')` produces at least one token with `type === 'celExpression'` and that token's text contains `transformMap`; repeat for `transformList` and `transformMapEntry` — no code change to `highlighter.ts` expected; if tests fail, diagnose and fix the tokenizer

**Checkpoint**: Highlighter unit tests confirm comprehension macros are wrapped in `celExpression` tokens. No regression.

---

## Phase 7: User Story 6 — Capabilities Baseline for v0.9.0 (Priority: P2)

**Purpose**: Consolidate the v0.9.0 baseline changes and verify the full capabilities response shape. Already partially done in Phase 2 (T008–T010); this phase adds the verification layer.

**Independent Test**: Start kro-ui with no cluster. Call `GET /api/v1/kro/capabilities`. Confirm response has `schema.hasExternalRefSelector: true` and `schema.hasGraphRevisions: false`.

### Implementation for User Story 6

- [X] T029 [US6] Verify `GET /api/v1/kro/capabilities` response shape includes `hasGraphRevisions` — update the capabilities API contract response example in `internal/api/handlers/capabilities.go` if the response is typed; otherwise confirm the `SchemaCapabilities` JSON serialisation includes `hasGraphRevisions` by running `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/k8s/ -run TestBaseline`
- [X] T030 [P] [US6] Add to `web/src/lib/features.test.ts`: test `BASELINE.schema` has all 6 fields (`hasForEach`, `hasExternalRef`, `hasExternalRefSelector`, `hasScope`, `hasTypes`, `hasGraphRevisions`) with correct default values — prevents future regressions when new schema capabilities are added

**Checkpoint**: Capabilities baseline fully reflects kro v0.9.0 defaults. Unit tests document the expected shape.

---

## Phase 8: User Story 5 — lastIssuedRevision in RGD Detail (Priority: P2)

**Purpose**: Show `status.lastIssuedRevision` as "Rev #N" chip in the RGD detail header.

**Note**: The rendering code was added in T022 (Phase 4). This phase focuses on the CSS token and any missing test coverage.

**Independent Test**: Mock an RGD object with `status.lastIssuedRevision: 3`. Render the RGD detail page. Confirm `data-testid="rgd-revision-chip"` element shows "Rev #3". Confirm it is absent when `lastIssuedRevision` is 0 or absent.

### Implementation for User Story 5

- [X] T031 [US5] Verify T022 correctly handles all cases in `web/src/pages/RGDDetail.tsx`: `lastIssuedRevision = 0` → chip absent; `lastIssuedRevision = undefined` → chip absent; `lastIssuedRevision = 1` → shows "Rev #1"; non-numeric value → chip absent (graceful degradation per §XII)
- [X] T032 [P] [US5] Add unit test to `web/src/pages/RGDDetail.test.tsx`: `shows Rev #N chip when status.lastIssuedRevision is positive`; `does not show chip when lastIssuedRevision is 0 or absent` — use existing test pattern from RGDDetail.test.tsx

**Checkpoint**: lastIssuedRevision chip appears when > 0, absent otherwise. CSS uses token vars only.

---

## Phase 9: User Story 7 — Designer Cartesian forEach "Remove" Button Guard (Priority: P2)

**Goal**: The "Remove" button is hidden when a forEach resource has only 1 iterator (prevents removing the last required iterator). The "Add iterator" button already works.

**Independent Test**: Open the RGD Designer (`/author`). Add a forEach resource. Verify the "Remove" button (×) on the first iterator row is hidden. Click "+ Add iterator" to add a second row — now both rows show "Remove" buttons. Remove one — single row again, "Remove" hidden.

### Implementation for User Story 7

- [X] T033 [US7] In `web/src/components/RGDAuthoringForm.tsx`, in the forEach iterator rows map (around line 839–882), conditionally show the Remove button only when `(res.forEachIterators ?? []).length > 1`: change the `<button ... aria-label="Remove iterator">×</button>` to render only when `(res.forEachIterators?.length ?? 0) > 1`
- [X] T034 [P] [US7] Add unit/integration test to `web/src/components/RGDAuthoringForm.tsx`'s test file (or inline in a relevant test file): render a forEach resource with 1 iterator — assert Remove button absent; add iterator — assert 2 Remove buttons present; remove one — assert 1 iterator, Remove button absent again

**Checkpoint**: forEach Designer enforces minimum 1 iterator. Cartesian product with 2+ iterators works. YAML preview emits multiple `forEach:` array entries.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, build integrity, and E2E readiness.

- [X] T035 Run full Go test suite: `GOPROXY=direct GONOSUMDB="*" go test -race ./...` — all tests pass
- [X] T036 [P] Run TypeScript typecheck: `cd web && bun run typecheck` — zero errors
- [X] T037 [P] Run frontend unit tests: `cd web && bun test` — all pass
- [X] T038 [P] Run `go vet ./...` — no issues
- [X] T039 Run `make go` (binary build) — binary builds successfully
- [X] T040 [P] Run `make dump-fixtures` and verify `git diff test/e2e/fixtures/upstream-*.yaml` — no unexpected structural changes; if changes exist, review and commit
- [X] T041 Review all new CSS for hardcoded hex values or `rgba()` literals — every color MUST use `var(--token-name)` (constitution §IX); fix any violations
- [X] T042 [P] Review all new Go handler files for missing Apache 2.0 copyright headers (constitution §VI)
- [X] T043 Confirm `GET /api/v1/kro/graph-revisions?rgd=any-name` returns `{"items":[]}` (not 500) when running against a local cluster without kro v0.9.0 installed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — verify baseline immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phases 3–9 (User Stories)**: All depend on Phase 2 completion
  - Phase 3 (US4) and Phase 4 (US1) are independent of each other — can proceed in parallel
  - Phase 5 (US2) is independent — can proceed in parallel with Phase 3/4
  - Phase 6 (US3) is fully independent (regression guard only) — can proceed at any time after Phase 2
  - Phase 7 (US6) overlaps with Phase 2 (baseline changes already done in T008–T010); T029–T030 can proceed after Phase 2
  - Phase 8 (US5) depends on T022 from Phase 4 being done first
  - Phase 9 (US7) is fully independent of all other phases after Phase 2
- **Phase 10 (Polish)**: Depends on all desired phases being complete

### User Story Dependencies

- **US4 (GraphRevision API)**: Independent after Phase 2 ✅
- **US1 (Scope Badge)**: Independent after Phase 2 ✅
- **US2 (DocsTab Types)**: Independent after Phase 2 ✅
- **US3 (CEL Regression)**: Fully independent — only adds tests ✅
- **US6 (Capabilities Baseline)**: Partially done in Phase 2; T029–T030 independent ✅
- **US5 (lastIssuedRevision)**: Depends on T022 (US1 Phase 4) ⚠️
- **US7 (Designer forEach)**: Independent after Phase 2 ✅

### Within Each User Story

- Go handler → routes registration → TypeScript API client (sequential: T011→T012→T013→T015)
- Schema extension → buildSchemaDoc update → DocsTab rendering (sequential: T024→T025→T026)
- CSS tokens before component CSS classes (T019 before T020)
- Tests can be written in parallel with or before implementation tasks

### Parallel Opportunities

All [P]-marked tasks can run in parallel within their phase:

- T001, T002, T003 in parallel (Phase 1)
- T009, T010 in parallel with T004–T008 (if two developers; T009/T010 are pure TS, T004–T008 are Go)
- T019, T020 in parallel with T011–T013 (UI CSS tokens vs backend API)
- T024 + T027 can be written simultaneously (schema model + tests)
- T028 is a standalone test file — run in parallel with any Phase 7–9 work
- T029, T030 in parallel (verification tasks)
- T035–T040 in parallel (all are validation/build tasks)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Developer A — Go capabilities changes:
Task: "T004 Add HasGraphRevisions to SchemaCapabilities in internal/k8s/capabilities.go"
Task: "T005 Add graphRevisionGVR to internal/k8s/client.go"
Task: "T006 Add detectInternalKroCRDs to internal/k8s/capabilities.go"
Task: "T007 Wire detectInternalKroCRDs into DetectCapabilities"
Task: "T008 Update Baseline() in internal/k8s/capabilities.go"

# Developer B — TypeScript type changes (in parallel):
Task: "T009 Add hasGraphRevisions to KroCapabilities in web/src/lib/api.ts"
Task: "T010 Update BASELINE in web/src/lib/features.ts"
```

## Parallel Example: Phase 3 + Phase 4 (after Phase 2)

```bash
# Developer A — GraphRevision backend (Phase 3):
Task: "T011 Create internal/api/handlers/graph_revisions.go with ListGraphRevisions"
Task: "T012 Add GetGraphRevision to graph_revisions.go"
Task: "T013 Register routes in internal/server/server.go"

# Developer B — Scope Badge frontend (Phase 4, in parallel):
Task: "T019 Add CSS tokens to web/src/tokens.css"
Task: "T020 Add .rgd-scope-badge CSS to web/src/components/RGDCard.css"
Task: "T021 Add scope badge rendering to web/src/components/RGDCard.tsx"
```

---

## Implementation Strategy

### MVP First (P1 User Stories: US4 + US1 + US2 + US3)

1. Complete Phase 1: Baseline verification
2. Complete Phase 2: Foundational types (Go + TS) — CRITICAL
3. Complete Phase 3: GraphRevision API (US4) — unblocks spec 009
4. Complete Phase 4: Scope Badge (US1) — highest visibility change
5. Complete Phase 5: DocsTab Types (US2)
6. Complete Phase 6: CEL regression guard (US3)
7. **STOP and VALIDATE**: All P1 stories testable independently

### Incremental Delivery

1. Phase 1–2 → Foundation ready
2. Phase 3 (US4) → GraphRevision API live; spec 009-rgd-graph-diff can begin
3. Phase 4 (US1) → Scope badges visible on all cluster-scoped RGDs
4. Phase 5 (US2) → Types documentation available in Docs tab
5. Phase 6 (US3) → CEL comprehension regression guard documented
6. Phases 7–9 → P2 stories; can be done in any order
7. Phase 10 → Final build + E2E verification; open PR

### Note on US7 (Designer forEach)

US7 is a **very small change** — one conditional on the Remove button visibility in
`RGDAuthoringForm.tsx` (T033). The "Add iterator" button already works (confirmed in
code review). If time is short, T033 can be delivered standalone in < 15 minutes.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to spec.md user stories (US1–US7)
- Constitution §XII: any absent k8s field must render as omitted, never as error
- Constitution §IX: zero hardcoded hex in CSS — all colors via `var(--token-name)`
- Constitution §III: no mutating verbs in new handlers (GET only)
- Commit after each phase checkpoint with Conventional Commits format:
  `feat(api): add GraphRevision list/get endpoints (FR-010, FR-011)`
  `feat(web): add Cluster scope badge to RGD cards and detail header (FR-020, FR-021)`
  `feat(web): add Types section to DocsTab (FR-030, FR-031)`
