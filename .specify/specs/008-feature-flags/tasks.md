# Tasks: Feature Flag System

**Input**: Design documents from `/specs/008-feature-flags/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/capabilities-api.md, quickstart.md

**Tests**: Included — spec.md defines acceptance scenarios and contracts/capabilities-api.md defines test requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Response types and shared infrastructure needed by all user stories

- [x] T001 Add CapabilitiesResponse type to internal/api/types/response.go with KroCapabilities and SchemaCapabilities structs matching data-model.md
- [x] T002 Register GET /api/v1/kro/capabilities route in internal/server/server.go inside the factory-guarded block
- [x] T003 Add getCapabilities() export to web/src/lib/api.ts following existing get<T> pattern

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core capability detection logic — MUST be complete before any user story handler or frontend work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create internal/k8s/capabilities.go with KroCapabilities, SchemaCapabilities types, DetectCapabilities() function, conservative Baseline() function, hasFieldInSchema() helper, parseFeatureGates() helper, and forbiddenCapabilities exclusion guard per research.md R1/R2/R6/R7
- [x] T005 Create internal/k8s/capabilities_test.go with table-driven tests: baseline when kro not installed, detect known resources, detect future resource (graphrevisions), schema detection (forEach present, scope absent), feature gate parsing (enabled, disabled, no flag, Deployment not found), fork guard (specPatch excluded, stateFields excluded) per contracts/capabilities-api.md test matrix

**Checkpoint**: `go test -race ./internal/k8s/...` passes. Detection pipeline is tested independently of HTTP layer.

---

## Phase 3: User Story 1 — Server reports capabilities of connected kro (Priority: P1)

**Goal**: `GET /api/v1/kro/capabilities` returns detected capabilities with 30s cache. Frontend `useCapabilities()` hook consumes the endpoint with stale-while-revalidate.

**Independent Test**: `curl http://localhost:40107/api/v1/kro/capabilities` returns 200 with valid JSON matching the contract. Frontend hook returns capabilities to any consuming component.

### Tests for User Story 1

- [x] T006 [P] [US1] Create internal/api/handlers/capabilities_test.go with table-driven tests: returns 200 with capabilities (stub factory), returns 200 with baseline on error, cache hit within TTL (two rapid requests return same data), cache miss after TTL (fresh detection triggered) per contracts/capabilities-api.md handler test matrix

### Implementation for User Story 1

- [x] T007 [US1] Create internal/api/handlers/capabilities.go with capabilitiesCache struct (sync.RWMutex + time.Time + 30s TTL), GetCapabilities handler that checks cache, calls DetectCapabilities() on miss, and responds with JSON per data-model.md entity 2
- [x] T008 [P] [US1] Create web/src/lib/features.ts with KroCapabilities interface, BASELINE constant, isExperimental() helper reading ?experimental=true from URL, module-level Cache struct, subscriber set, revalidate() with inflight dedup, and useCapabilities() hook per data-model.md entities 3-5 and research.md R4/R5
- [x] T009 [US1] Verify full backend pipeline by running go vet ./... and go test -race ./internal/...

**Checkpoint**: Backend endpoint returns capabilities. Frontend hook fetches and caches. `go test -race ./internal/...` passes. `useCapabilities()` returns data.

---

## Phase 4: User Story 2 — CEL highlighter respects omit() feature gate (Priority: P2)

**Goal**: When `CELOmitFunction=false`, `omit()` is plain text. When `CELOmitFunction=true`, it is highlighted as `--hl-kro-keyword`.

**Independent Test**: The KroCodeBlock component or highlighter function, given capabilities with `CELOmitFunction: true`, highlights `omit()` calls. With `false`, `omit()` is plain text.

**Note**: This story depends on spec 006-cel-highlighter (the highlighter itself). Since the highlighter is currently a stub (`web/src/components/KroCodeBlock.tsx` renders plain `<pre>`), this story adds the capability-gating hook point that the highlighter will consume. The actual highlighting logic is delivered by spec 006.

### Implementation for User Story 2

- [x] T010 [US2] Add useCapabilities() import and CELOmitFunction gate to web/src/components/KroCodeBlock.tsx — pass capabilities.featureGates.CELOmitFunction as a prop or context value so the highlighter (spec 006) can conditionally treat omit() as a kro keyword

**Checkpoint**: KroCodeBlock consumes capabilities. The omit() gating hook point is wired. Actual highlighting deferred to spec 006.

---

## Phase 5: User Story 3 — GraphRevision tab appears automatically when CRD exists (Priority: P3)

**Goal**: When `knownResources` includes `"graphrevisions"`, the RGD detail page shows a Revisions tab. When absent, no tab.

**Independent Test**: RGDDetail page, given capabilities with `knownResources: ["resourcegraphdefinitions", "graphrevisions"]`, renders a Revisions tab placeholder. Without `graphrevisions`, no tab appears.

### Implementation for User Story 3

- [x] T011 [US3] Add useCapabilities() import and knownResources gate to web/src/pages/RGDDetail.tsx — conditionally render a Revisions tab placeholder when capabilities.knownResources.includes('graphrevisions'), with an Experimental badge wrapper when isExperimental() is true per research.md R5

**Checkpoint**: RGDDetail conditionally shows Revisions tab based on capabilities. Experimental badge renders for opt-in users.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E test, TypeScript type checking, Go vet, final validation

- [x] T012 [P] Create test/e2e/journeys/008-feature-flags.spec.ts with E2E journey: Step 1 — GET /api/v1/kro/capabilities asserts 200, hasForEach=true, hasExternalRef=true, CELOmitFunction=false, knownResources contains resourcegraphdefinitions; Step 2 — navigate to /rgds/test-app and confirm no ExternalRef nodes (fixture has none) per spec.md E2E journey
- [x] T013 Run go vet ./... and verify zero warnings
- [x] T014 Run bun run typecheck (tsc --noEmit) in web/ and verify zero errors
- [x] T015 Run go test -race ./... and verify all tests pass including new capabilities tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (CapabilitiesResponse type) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (DetectCapabilities exists)
- **User Story 2 (Phase 4)**: Depends on T008 (useCapabilities hook exists)
- **User Story 3 (Phase 5)**: Depends on T008 (useCapabilities hook exists)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2). No other story dependencies. This is the MVP.
- **User Story 2 (P2)**: Depends on T008 (features.ts with useCapabilities). Can start after US1's T008 is done.
- **User Story 3 (P3)**: Depends on T008 (features.ts with useCapabilities). Can start after US1's T008 is done. Independent of US2.

### Within Each User Story

- Tests written before implementation (T006 before T007)
- Backend before frontend (T007 before T008)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (different files)
- T004, T005 are sequential (T005 tests T004's code)
- T006, T008 can run in parallel with each other (different languages/files)
- T010, T011 can run in parallel (different frontend files, both depend only on T008)
- T012-T015 in Polish phase: T012 can run parallel with T013/T014; T015 runs last

---

## Parallel Example: Phase 1

```bash
# All setup tasks in parallel (different files):
Task T001: "Add CapabilitiesResponse type to internal/api/types/response.go"
Task T002: "Register GET /api/v1/kro/capabilities route in internal/server/server.go"
Task T003: "Add getCapabilities() export to web/src/lib/api.ts"
```

## Parallel Example: User Story 1

```bash
# After T007 is complete, these can run in parallel:
Task T008: "Create web/src/lib/features.ts with useCapabilities hook"
Task T006: "Create internal/api/handlers/capabilities_test.go"  # (if not yet done)
```

## Parallel Example: User Stories 2 & 3

```bash
# After T008 is complete, both stories can run in parallel:
Task T010: "Add CELOmitFunction gate to KroCodeBlock.tsx"
Task T011: "Add knownResources gate to RGDDetail.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005)
3. Complete Phase 3: User Story 1 (T006-T009)
4. **STOP and VALIDATE**: `curl localhost:40107/api/v1/kro/capabilities` returns valid JSON
5. Deploy/demo if ready — capabilities endpoint is independently useful

### Incremental Delivery

1. Complete Setup + Foundational → Detection pipeline ready
2. Add User Story 1 → Backend + Frontend hook functional → Deploy (MVP!)
3. Add User Story 2 → CEL highlighter respects feature gates → Deploy
4. Add User Story 3 → GraphRevision tab auto-appears → Deploy
5. Polish → E2E tests, type checking, final validation

### Sequential Execution (single developer)

1. T001 → T002 → T003 (setup, quick)
2. T004 → T005 (foundational, core logic)
3. T006 → T007 → T008 → T009 (US1, the bulk of work)
4. T010 (US2, small)
5. T011 (US3, small)
6. T012 → T013 → T014 → T015 (polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All Go files must have Apache 2.0 copyright header (§VI)
- All Go tests use table-driven build/check pattern with testify assert/require (§VII)
- All Go code uses `GOPROXY=direct GONOSUMDB="*"` for module operations
- Frontend uses plain CSS with tokens.css custom properties only (§IX)
- Experimental badge uses `isExperimental()` from features.ts, not a backend flag
- Fork guard: `specPatch` and `stateFields` must NEVER appear in capabilities (FR-004)
