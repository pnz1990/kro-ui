# Tasks: RBAC Service Account Auto-Detection

**Branch**: `032-rbac-sa-autodetect`
**Input**: Design documents from `.specify/specs/032-rbac-sa-autodetect/`
**Fixes**: GitHub issues #115 (hardcoded SA fallback) and #133 (opaque `kro/kro` display)

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Confirm the existing codebase state matches design doc assumptions before
any changes are made.

- [x] T001 Verify `ResolveKroServiceAccount` hardcoded fallback exists at `internal/k8s/rbac.go:103-104` and `ComputeAccessResult` does NOT yet early-return on empty SA
- [x] T002 Verify `GET /api/v1/rgds/{name}/access` handler at `internal/api/handlers/access.go` does NOT yet read `saNamespace`/`saName` query params
- [x] T003 [P] Verify `getRGDAccess` in `web/src/lib/api.ts` does NOT yet accept a second options argument
- [x] T004 [P] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/k8s/...` to confirm all existing tests pass before any changes

**Checkpoint**: Baseline confirmed — existing tests pass, scope of changes understood

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Refactor `ComputeAccessResult` to accept a pre-resolved SA instead of
calling `ResolveKroServiceAccount` internally. This decoupling is required by both
US1 (removing the fallback) and US2 (manual override bypass). MUST complete before
any user story work.

- [x] T005 Refactor `ComputeAccessResult` in `internal/k8s/rbac.go` to accept `saNS, saName string, saFound bool` as parameters instead of calling `ResolveKroServiceAccount` internally; add early-return when `saNS == ""` that returns `&AccessResult{ServiceAccount: "", ServiceAccountFound: false, HasGaps: false, Permissions: []ResourcePermission{}}` with `nil` error
- [x] T006 Update the call site in `internal/api/handlers/access.go` to call `ResolveKroServiceAccount` first, then pass results into `ComputeAccessResult` — preserving the existing auto-detect behavior (no behavioral change yet, just structural)
- [x] T007 Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...` to confirm refactoring does not break existing tests

**Checkpoint**: `ComputeAccessResult` is decoupled from SA detection — user stories can now proceed independently

---

## Phase 3: User Story 1 — SA Auto-Detection Returns Empty on Failure (Priority: P1)

**Goal**: When no kro Deployment is found in `kro-system` or `kro` namespaces,
`ResolveKroServiceAccount` returns `("", "", false)` with no hardcoded fallback.
The frontend receives `serviceAccount: ""` and `serviceAccountFound: false` with
an empty `permissions` array.

**Independent Test**:
1. Call `ResolveKroServiceAccount` with a dynamic client that has no Deployments → verify return is `("", "", false)`
2. Call `GET /api/v1/rgds/{name}/access` against a cluster where kro SA detection fails → response is `{"serviceAccount":"","serviceAccountFound":false,"hasGaps":false,"permissions":[]}`
3. Load AccessTab with this response → verify the manual override form is rendered (not the permission matrix)

### Implementation for User Story 1

- [x] T008 [US1] Remove hardcoded fallback from `ResolveKroServiceAccount` in `internal/k8s/rbac.go:103-104`: replace `return "kro-system", "kro", false` with `return "", "", false`; update the debug log message to `"could not detect kro service account; manual specification required"`
- [x] T009 [P] [US1] Add test case `"no matching deployment found returns empty strings and found=false"` to `TestResolveKroServiceAccount` in `internal/k8s/rbac_test.go`: setup an empty dynamic client (no deployments in `kro-system` or `kro`), assert `ns == ""`, `name == ""`, `found == false`
- [x] T010 [US1] Update `AccessTab.tsx` in `web/src/components/AccessTab.tsx` to show the manual override form when `data.serviceAccountFound === false && data.serviceAccount === ""`: add two controlled inputs (namespace and SA name) with a disabled-until-valid submit button; store form state in `manualNS: string` and `manualSAName: string`; keep all existing rendering paths for the `serviceAccountFound: true` case unchanged
- [x] T011 [US1] Add CSS for the manual override form to `web/src/components/AccessTab.css` using only `tokens.css` custom properties: classes `.access-tab-sa-override-form`, `.access-tab-sa-override-inputs`, `.access-tab-sa-override-label`, `.access-tab-sa-override-input`, `.access-tab-sa-override-btn`; no hardcoded colors or `rgba()`
- [x] T012 [P] [US1] Add frontend test cases to `web/src/components/AccessTab.test.tsx`: `"shows manual override form when serviceAccount is empty and serviceAccountFound is false"` (renders two inputs and a disabled submit button), `"submit button is disabled when inputs are empty"`, `"submit button is enabled when both inputs have values"`
- [x] T013 [US1] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/k8s/...` and `cd web && bun run test` to verify T008–T012 pass

**Checkpoint**: User Story 1 complete — hardcoded fallback removed; frontend shows override form on detection failure

---

## Phase 4: User Story 2 — Manual SA Override via Query Params (Priority: P1)

**Goal**: The user can type a namespace and SA name into the override form. On submit,
the frontend re-fetches `GET /api/v1/rgds/{name}/access?saNamespace=<ns>&saName=<name>`.
The backend uses the provided values directly (skipping auto-detection) and returns
the permission matrix for that SA.

**Independent Test**:
1. Call `GET /api/v1/rgds/{name}/access?saNamespace=kro-prod&saName=kro-operator` → verify the handler uses `kro-prod/kro-operator` (not auto-detect result)
2. In `AccessTab`, render with empty SA response → fill in both inputs → click submit → verify a second fetch is called with `?saNamespace=...&saName=...`
3. After successful override fetch, verify permission matrix is shown (not the override form)

### Implementation for User Story 2

- [x] T014 [US2] Update `internal/api/handlers/access.go` to read optional query params `saNamespace` and `saName` via `r.URL.Query().Get(...)` with `strings.TrimSpace`; when both are non-empty, pass them directly to `ComputeAccessResult` with `saFound=true` (skipping `ResolveKroServiceAccount`); when either is empty, call `ResolveKroServiceAccount` as before; add zerolog structured logging for override case: `.Str("saNamespace", saNamespace).Str("saName", saName).Msg("using manual SA override")`
- [x] T015 [US2] Update `getRGDAccess` in `web/src/lib/api.ts` to accept an optional second argument `opts?: { saNamespace?: string; saName?: string }` and append non-empty values as URL query params using `URLSearchParams`; existing callers with no second argument are unaffected
- [x] T016 [US2] Update `AccessTab.tsx` in `web/src/components/AccessTab.tsx` to implement `handleManualSubmit`: call `getRGDAccess(rgdName, { saNamespace: manualNS.trim(), saName: manualSAName.trim() })`, set a new state field `overrideSource: "auto" | "manual" | null` to `"manual"` on success, and replace the override form with the permission matrix on successful response
- [x] T017 [P] [US2] Add frontend test cases to `web/src/components/AccessTab.test.tsx`: `"re-fetches with saNamespace and saName query params on manual form submit"` (verify `getRGDAccess` is called with correct opts on button click), `"shows permission matrix after successful manual override"` (verify form is replaced), `"shows (manually specified) badge after manual override"` (verify source label)
- [x] T018 [US2] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/api/...` and `cd web && bun run test` to verify T014–T017 pass

**Checkpoint**: User Story 2 complete — manual SA override flow works end-to-end

---

## Phase 5: User Story 3 — Human-Readable SA Display (Priority: P2)

**Goal**: The SA banner shows `Namespace: kro-system · Service account: kro-controller`
with a detection source label `(auto-detected)` or `(manually specified)` — not the raw
`kro/kro` slash format. Closes issue #133.

**Independent Test**:
1. Render `AccessTab` with `serviceAccount: "kro-system/kro"` and `serviceAccountFound: true` → verify banner shows `Namespace:` and `Service account:` as separate labeled elements, not `kro/kro`
2. Verify `(auto-detected)` text appears when `overrideSource === "auto"`
3. After manual override, verify `(manually specified)` text appears
4. Hover the banner → full `namespace/name` value is accessible via `title` attribute

### Implementation for User Story 3

- [x] T019 [US3] Update the SA banner section in `web/src/components/AccessTab.tsx`: parse `serviceAccount` into `[saNamespace, saSAName]` using `split("/", 2)`; render as `<span>Namespace:</span> <code>{saNamespace}</code> <span aria-hidden="true">·</span> <span>Service account:</span> <code>{saSAName ?? serviceAccount}</code>`; add a `title` attribute on the banner container with the raw `serviceAccount` value for hover accessibility; show `(auto-detected)` when `overrideSource === "auto"` or `serviceAccountFound && !overrideSource`, `(manually specified)` when `overrideSource === "manual"`; add `data-testid="access-tab-sa-namespace"` and `data-testid="access-tab-sa-name"` on the respective `<code>` elements
- [x] T020 [US3] Update `web/src/components/AccessTab.css` to add `.access-tab-sa-source` class (muted color via `var(--color-text-muted)`, smaller font size) and `.access-tab-sa-sep` (horizontal margin, aria-hidden separator); no hardcoded colors
- [x] T021 [P] [US3] Add frontend test cases to `web/src/components/AccessTab.test.tsx`: `"shows labeled namespace and service account name not raw slash format"` (verify `Namespace:` and `Service account:` labels present; verify `kro/kro` raw string absent), `"shows (auto-detected) indicator when serviceAccountFound is true"`, `"banner has title attribute with full namespace/name for accessibility"`
- [x] T022 [US3] Run `cd web && bun run test` and `cd web && bun run typecheck` to verify T019–T021 pass

**Checkpoint**: User Story 3 complete — SA banner is human-readable and accessible

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, type safety, and ensuring existing tests are unbroken.

- [x] T023 [P] Run full Go test suite: `GOPROXY=direct GONOSUMDB="*" go test -race ./...` — all existing tests must pass, including `TestCheckPermissions`, `TestFetchEffectiveRules`, `TestComputeAccessResult` which use `kro-system/kro` fixture values (they test logic, not detection)
- [x] T024 [P] Run TypeScript typecheck: `cd web && bun run typecheck` — zero errors required (spec NFR-002)
- [x] T025 [P] Run all frontend tests: `cd web && bun run test` — all AccessTab tests (old and new) must pass
- [x] T026 Run `GOPROXY=direct GONOSUMDB="*" go vet ./...` and confirm no issues
- [x] T027 Review `internal/k8s/rbac.go` for any remaining hardcoded SA names, namespace strings used as defaults (not as search keys), or SA name guesses; confirm none exist (constitution §XIII compliance check)
- [x] T028 Verify `AccessTab.css` contains no hardcoded hex values, `rgba()`, or color literals — all colors must use `var(--token-name)` from `tokens.css`

**Checkpoint**: All tests pass; zero TypeScript errors; constitution §XIII verified; feature complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 confirmation — BLOCKS Phases 3–5
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 completion; integrates with Phase 3 changes (shares `AccessTab.tsx`)
- **Phase 5 (US3)**: Depends on Phase 3+4 (needs `overrideSource` state from US2); can be done after US2
- **Phase 6 (Polish)**: Depends on all prior phases complete

### User Story Dependencies

- **US1**: Independent after Phase 2 — removes fallback, adds override form shell
- **US2**: Depends on US1 (uses override form from US1 as the entry point); sequential with US1
- **US3**: Depends on US2 (reads `overrideSource` state introduced in US2); sequential with US2

### Within Each User Story

- Backend changes before frontend integration (handler query params before `api.ts` update)
- Tests added alongside implementation (each story includes its own test tasks)

### Parallel Opportunities

- T009 and T010–T011 can run in parallel within Phase 3 (different files: test vs component/css)
- T017 can run in parallel with T014–T016 (test file vs implementation files) — write tests first
- T021 can run in parallel with T019–T020 (test file vs component/css)
- T023, T024, T025 can all run in parallel in Phase 6 (independent verification commands)

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Backend test + frontend implementation can proceed in parallel:
Task: "Add test case for no-deployment found in internal/k8s/rbac_test.go"   # T009
Task: "Add manual override form CSS in web/src/components/AccessTab.css"      # T011

# But T008 (remove fallback) must happen before T009 can assert against it
```

---

## Implementation Strategy

### MVP Scope (Phase 1 + Phase 2 + Phase 3 = US1 only)

1. Complete Phase 1: Confirm baseline
2. Complete Phase 2: Decouple `ComputeAccessResult` from SA detection
3. Complete Phase 3 (US1): Remove fallback; show override form shell on detection failure
4. **STOP and VALIDATE**: `go test -race ./...` passes; AccessTab shows form on empty SA

This alone fixes the critical §XIII violation (issue #115).

### Full Delivery (add US2 + US3)

5. Complete Phase 4 (US2): Wire manual form submit to re-fetch with query params
6. Complete Phase 5 (US3): Update SA banner to labeled format
7. Complete Phase 6: Full verification
8. Issue #133 closed when US3 ships

### Notes

- All tasks touch at most 6 files — scope is tight
- The `rbac_test.go` fixture values (`kro-system/kro`) do not need changing; they test
  the RBAC logic, not the SA detection
- The `capabilities.go` `kroNamespace` constant is explicitly out of scope (see `research.md` Decision 6)
- No new npm packages or Go modules required
