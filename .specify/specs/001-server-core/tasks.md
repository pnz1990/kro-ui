# Tasks: Server Core

**Input**: Design documents from `.specify/specs/001-server-core/`
**Prerequisites**: spec.md (required)
**Feature Branch**: `001-server-core`
**Constitution ref**: §IV (Single Binary), §VI (Go Code Standards), §VII (Testing), §VIII (Commit conventions)

**Tests**: Included — spec 001 explicitly requires unit tests before merge (Testing Requirements section).

**Organization**: Tasks are grouped by user story (US1=server starts, US2=frontend embed, US3=context switching). Setup/foundational phases fix existing compile bugs and add missing infrastructure before any story work begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Fix Compile Bugs & Infrastructure)

**Purpose**: Make the existing codebase compile. Currently 4 files have hard compile errors that block everything.

- [ ] T001 Create minimal stub `web/dist/index.html` with `<!doctype html><html><head><meta charset="UTF-8"><title>kro-ui</title></head><body><div id="root"></div></body></html>` so `go:embed` compiles in `internal/server/server.go`
- [ ] T002 [P] Fix `internal/server/server.go`: add `"io"` and `"time"` imports, declare `var zeroTime time.Time`
- [ ] T003 [P] Fix `internal/api/handlers/rgds.go`: add `"strings"` to import block
- [ ] T004 [P] Fix `internal/api/handlers/instances.go`: add `"strings"` to import block
- [ ] T005 [P] Fix `internal/api/handlers/helpers.go`: remove unused `var list` declaration on line 77
- [ ] T006 [P] Fix `internal/k8s/client.go`: remove dead `clientcmdapi` import and blank-identifier hack (`var _ = clientcmdapi.Config{}`)
- [ ] T007 Verify project compiles: run `GOPROXY=direct GONOSUMDB="*" go build ./cmd/kro-ui`

**Checkpoint**: `go build ./cmd/kro-ui` succeeds with zero errors.

---

## Phase 2: Foundational (Copyright Headers & File Renaming)

**Purpose**: Bring all existing files into compliance with constitution §VI before adding new code. Rename the prohibited `helpers.go`.

- [ ] T008 [P] Add Apache 2.0 copyright header to `cmd/kro-ui/main.go`
- [ ] T009 [P] Add Apache 2.0 copyright header to `internal/cmd/root.go`
- [ ] T010 [P] Add Apache 2.0 copyright header to `internal/server/server.go`
- [ ] T011 [P] Add Apache 2.0 copyright header to `internal/k8s/client.go`
- [ ] T012 [P] Add Apache 2.0 copyright header to `internal/api/handlers/handler.go`
- [ ] T013 [P] Add Apache 2.0 copyright header to `internal/api/handlers/contexts.go`
- [ ] T014 [P] Add Apache 2.0 copyright header to `internal/api/handlers/rgds.go`
- [ ] T015 [P] Add Apache 2.0 copyright header to `internal/api/handlers/instances.go`
- [ ] T016 [P] Add Apache 2.0 copyright header to `internal/api/handlers/helpers.go`
- [ ] T017 [P] Add Apache 2.0 copyright header to `internal/version/version.go`
- [ ] T018 Rename `internal/api/handlers/helpers.go` to `internal/api/handlers/discover.go` (contains `discoverPlural`, `resolveInstanceGVR`, `listChildResources`, `unstructuredString`, `isListable` — all discovery-related). Update copyright header in the renamed file.
- [ ] T019 Verify `go vet ./...` passes with zero findings after all header additions and rename

**Checkpoint**: All `.go` files have copyright headers, no prohibited filenames exist, `go vet` passes.

---

## Phase 3: User Story 1 — Developer Starts the Server (Priority: P1)

**Goal**: `./kro-ui serve` starts, connects to kubeconfig, and `/api/v1/healthz` returns 200.

**Independent Test**: `./bin/kro-ui serve &`, then `curl http://localhost:40107/api/v1/healthz` returns `200 ok`.

### Tests for User Story 1

> **NOTE**: Write these tests FIRST, ensure they FAIL or are pending before implementation changes.

- [ ] T020 [US1] Write table-driven unit tests in `internal/server/server_test.go` for the healthz handler: test that `GET /api/v1/healthz` returns 200 with body `ok` using `httptest.NewServer` against the chi router. Include Apache 2.0 header.
- [ ] T021 [US1] Write table-driven unit tests in `internal/cmd/root_test.go` for cobra command structure: test that `serveCmd` exists, has `--port`/`--kubeconfig`/`--context` flags, and `versionCmd` exists. Include Apache 2.0 header.

### Implementation for User Story 1

- [ ] T022 [US1] Review and harden `internal/cmd/root.go`: verify `--port` defaults to 40107, `--kubeconfig` defaults to `""` (uses default resolution), `--context` defaults to `""`, error messages use `fmt.Errorf("context: %w", err)` pattern. Ensure non-zero exit on kubeconfig errors before binding any port.
- [ ] T023 [US1] Review and harden `internal/server/server.go`: verify healthz handler returns `200` with body `ok` and no cluster I/O. Ensure zerolog logger is injected into context with structured fields (`"port"`, `"context"`). Verify graceful shutdown is wired.
- [ ] T024 [US1] Review and harden `internal/version/version.go`: verify `String()` outputs version, commit, and build date. Ensure ldflags variables are `var` (not `const`) so `-ldflags -X` works.
- [ ] T025 [US1] Run tests: `go test -race ./internal/server/... ./internal/cmd/...` — all must pass

**Checkpoint**: Server starts, healthz works, version command works, tests pass.

---

## Phase 4: User Story 2 — Frontend Embedded from Binary (Priority: P1)

**Goal**: `GET /` serves `index.html` from embedded `web/dist`. SPA fallback returns `index.html` for all unknown non-API routes.

**Independent Test**: Start server, `curl http://localhost:40107/` returns HTML with `<div id="root">`, `curl http://localhost:40107/rgds/any-path` also returns HTML (not 404).

### Tests for User Story 2

- [ ] T026 [US2] Write table-driven unit tests in `internal/server/embed_test.go` for SPA serving: test `GET /` returns 200 + HTML containing `<div id="root">`, test `GET /rgds/something` returns 200 + HTML (SPA fallback), test `GET /api/v1/healthz` still returns `ok` (not index.html). Include Apache 2.0 header.

### Implementation for User Story 2

- [ ] T027 [US2] Review and harden the SPA fallback logic in `internal/server/server.go`: verify the file server checks if the requested file exists in `web/dist` and falls back to `index.html` for non-existent paths. Verify `Content-Type` is set correctly for HTML and static assets. Ensure API routes (`/api/`) are never caught by the SPA fallback.
- [ ] T028 [US2] Run tests: `go test -race ./internal/server/...` — all must pass

**Checkpoint**: Embedded frontend serves correctly, SPA routing works, static assets serve with correct MIME types.

---

## Phase 5: User Story 3 — Operator Lists and Switches Kubeconfig Contexts (Priority: P1)

**Goal**: `GET /api/v1/contexts` returns all contexts + active. `POST /api/v1/contexts/switch` switches context atomically.

**Independent Test**: `curl http://localhost:40107/api/v1/contexts` returns JSON with `contexts` array and `active` string. `POST` with valid context returns 200.

### Tests for User Story 3

- [ ] T029 [US3] Create `internal/api/handlers/handler_test.go` with a `stubClientFactory` struct implementing the methods `ListContexts` and `SwitchContext` used by context handlers. Include Apache 2.0 header. Use the build/check table-driven test pattern from constitution §VII.
- [ ] T030 [US3] Write table-driven unit tests in `internal/api/handlers/contexts_test.go`: test `ListContexts` returns 200 with `contexts` and `active` fields; test `SwitchContext` returns 200 for valid context; test `SwitchContext` returns 400 for empty context; test `SwitchContext` returns 400 for unknown context. Include Apache 2.0 header.
- [ ] T031 [US3] Write table-driven unit tests in `internal/k8s/client_test.go`: test `SwitchContext` with `-race` flag; test `ListContexts` returns correct contexts; test `ActiveContext` returns the correct name after switch; test concurrent access is safe. Include Apache 2.0 header.

### Implementation for User Story 3

- [ ] T032 [US3] Review and harden `internal/k8s/client.go`: verify `SwitchContext` validates context name exists before attempting load, returns descriptive error for unknown context, uses `sync.RWMutex` correctly (write lock for switch, read lock for accessors). Verify `ListContexts` reads all contexts from kubeconfig.
- [ ] T033 [US3] Review and harden `internal/api/handlers/contexts.go`: verify `ListContexts` handler calls `factory.ListContexts()` and responds with `{"contexts": [...], "active": "..."}`. Verify `SwitchContext` decodes JSON body, validates non-empty context name, returns 400 with `{"error": "..."}` for invalid input.
- [ ] T034 [US3] Run tests: `go test -race ./internal/api/handlers/... ./internal/k8s/...` — all must pass

**Checkpoint**: Context API works, concurrent access is safe, all edge cases handled, tests pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and build verification.

- [ ] T035 [P] Create `internal/api/types/response.go` with shared API response types (`ContextsResponse`, `ErrorResponse`) used by handlers. Include Apache 2.0 header. Refactor handlers to use these types instead of anonymous structs.
- [ ] T036 Run full test suite: `go test -race -v ./...` — all tests must pass
- [ ] T037 Run `go vet ./...` — zero findings
- [ ] T038 Run full build: `GOPROXY=direct GONOSUMDB="*" go build -o bin/kro-ui ./cmd/kro-ui` — binary compiles successfully
- [ ] T039 Verify binary runs: `./bin/kro-ui version` prints version info, `./bin/kro-ui serve --help` shows flags

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. BLOCKS everything.
- **Foundational (Phase 2)**: Depends on Phase 1 (code must compile first). BLOCKS user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2. Can run in parallel with US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2. Can run in parallel with US1/US3.
- **User Story 3 (Phase 5)**: Depends on Phase 2. Can run in parallel with US1/US2.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (Server starts)**: Independent — no dependency on other stories.
- **US2 (Frontend embed)**: Independent — no dependency on other stories.
- **US3 (Context switching)**: Independent — no dependency on other stories.

### Within Each User Story

- Tests are written FIRST (build/check pattern)
- Review/harden implementation against spec requirements
- Run story-specific test suite
- Story complete before moving to next

### Parallel Opportunities

- T002-T006 (compile fixes) are all independent files — run in parallel
- T008-T017 (copyright headers) are all independent files — run in parallel
- T020/T021 (US1 tests) can run in parallel
- US1/US2/US3 phases can run in parallel after Phase 2

---

## Parallel Example: Phase 1

```bash
# All compile fixes target different files — launch together:
Task: "Fix internal/server/server.go: add io and time imports"
Task: "Fix internal/api/handlers/rgds.go: add strings import"
Task: "Fix internal/api/handlers/instances.go: add strings import"
Task: "Fix internal/api/handlers/helpers.go: remove unused var list"
Task: "Fix internal/k8s/client.go: remove dead clientcmdapi import"
```

## Parallel Example: Phase 2

```bash
# All copyright header tasks target different files — launch together:
Task: "Add Apache 2.0 header to cmd/kro-ui/main.go"
Task: "Add Apache 2.0 header to internal/cmd/root.go"
... (all 10 files)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + US1 Only)

1. Complete Phase 1: Fix compile bugs
2. Complete Phase 2: Copyright headers + rename
3. Complete Phase 3: Server starts, healthz works
4. **STOP and VALIDATE**: `./bin/kro-ui serve` + `curl healthz` works
5. Continue to US2 + US3

### Incremental Delivery

1. Phase 1 + Phase 2 → Code compiles, passes vet
2. Add US1 → Server starts, healthz works → Validate
3. Add US2 → Frontend embeds and serves → Validate
4. Add US3 → Context API works → Validate
5. Phase 6 → Polish, full test suite green, binary ships
