# Tasks: Context Switcher

**Input**: spec.md from `/specs/007-context-switcher/`
**Prerequisites**: 002-rgd-list-home (merged) — TopBar context display exists

**Tests**: Go unit tests (table-driven, build/check, -race) and frontend unit tests required before merge. TDD approach.

**Organization**: Phase 1 is Go backend (SwitchContext + handler). Phase 2 is frontend dropdown. Phase 3 is wiring (TopBar integration, home page refetch). Phase 4 is E2E. Backend and frontend phases are independent — can be developed concurrently by separate sessions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Go files: `internal/`. Frontend: `web/src/`. Tests co-located. E2E: `test/e2e/journeys/`.

---

## Phase 1: Go Backend — ClientFactory.SwitchContext (US1)

**Purpose**: Add runtime context switching to the existing `ClientFactory`. Thread-safe, error-wrapped, no server restart.

### Tests (write FIRST)

- [x] T001 [P] Add table-driven tests to `internal/k8s/client_test.go` for `SwitchContext`: (1) "returns error for unknown context name" — build a `ClientFactory` with a kubeconfig containing only `ctx-a`, call `SwitchContext("nonexistent")`, assert error contains "unknown context" or similar, (2) "switches active context successfully" — build with `ctx-a` and `ctx-b`, switch to `ctx-b`, assert `ActiveContext()` returns `ctx-b` and `Dynamic()` returns a non-nil client, (3) "concurrent switch and read is race-free" — launch 10 goroutines alternating `SwitchContext` and `Dynamic()` reads, run with `-race`, assert no panics or races. Use `build`/`check` pattern per constitution §VII.
- [x] T002 [P] Add tests to `internal/api/handlers/contexts_test.go` for `SwitchContext` handler: (1) "returns 200 on valid switch" — POST `{"context":"ctx-b"}`, assert 200 + body `{"active":"ctx-b"}`, (2) "returns 400 on empty body" — POST empty, assert 400, (3) "returns 400 on unknown context" — POST `{"context":"nonexistent"}`, assert 400 with descriptive error, (4) "returns 400 on missing context field" — POST `{}`, assert 400

### Implementation

- [x] T003 Implement `ClientFactory.SwitchContext(name string) error` in `internal/k8s/client.go`: (1) validate context name exists in kubeconfig, return `fmt.Errorf("unknown context %q: %w", name, err)` if not, (2) build new `*rest.Config` for target context via `clientcmd.NewNonInteractiveDeferredLoadingClientConfig`, (3) build new `dynamic.Interface` and `discovery.DiscoveryInterface`, (4) acquire `sync.Mutex` lock, swap old clients atomically, release lock, (5) update stored active context name. Also add `ActiveContext() string` getter if not present.
- [x] T004 Implement `SwitchContext` HTTP handler in `internal/api/handlers/contexts.go`: (1) parse JSON body `{"context": "name"}`, (2) validate `context` field is non-empty → 400 if missing, (3) call `h.ctxMgr.SwitchContext(ctx, name)` → 400 with error message on failure, (4) return 200 with `{"active": "name"}` on success. Use `respond()` / `respondError()` helpers.
- [x] T005 Register route in `internal/server/server.go`: `r.Post("/contexts/switch", h.SwitchContext)`
- [x] T006 Verify: `make go` compiles, `go vet ./...` clean, `go test -race ./internal/k8s/... ./internal/api/handlers/...` all pass

**Checkpoint**: Backend context switching works. Thread-safe. Tested with race detector.

---

## Phase 2: Frontend — ContextSwitcher Dropdown (US1, US2)

**Purpose**: Replace the `ContextSwitcher` stub with a working dropdown in the TopBar.

### Tests (write FIRST)

- [x] T007 [P] Create `web/src/components/ContextSwitcher.test.tsx`: (1) "renders all context names from API" — mock `listContexts` to return 3 contexts, assert all 3 names appear, (2) "marks the active context" — assert the active context has `aria-selected="true"` or equivalent, (3) "shows loading state during switch" — mock `switchContext` with a delayed promise, click a context, assert loading indicator visible, (4) "shows error message on switch failure" — mock `switchContext` to reject, click a context, assert error text visible, (5) "calls onSwitch callback on success" — mock `switchContext` to resolve, click a context, assert `onSwitch` prop was called with new context name

### Implementation

- [x] T008 Add `switchContext` API function to `web/src/lib/api.ts`: `export const switchContext = (name: string) => post<{ active: string }>('/contexts/switch', { context: name })` — the `post` helper already exists in api.ts
- [x] T009 Create `web/src/components/ContextSwitcher.css` — dropdown positioned relative to trigger button, `background: var(--color-surface-2)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius)`, options list with hover highlight `var(--color-primary-muted)`, active context with checkmark, loading spinner (CSS-only animation), error message styling, `max-height: 300px` with scroll for many contexts
- [x] T010 Implement `ContextSwitcher` in `web/src/components/ContextSwitcher.tsx`: (1) accept props `{ contexts: KubeContext[]; active: string; onSwitch: (name: string) => void }`, (2) internal state: `isOpen`, `switching` (boolean), `error` (string | null), (3) trigger button `data-testid="context-switcher-btn"` showing current context name (truncated), (4) dropdown `data-testid="context-dropdown"` listing all contexts, active marked with checkmark and not clickable, (5) clicking a non-active context: set `switching=true`, call `switchContext(name)` API, on success call `onSwitch(name)` + close dropdown, on error show inline message, (6) close on click outside or Escape key, (7) keyboard: arrow keys navigate options, Enter selects
- [x] T011 Run `bun run typecheck` + `bun run test` — all pass

**Checkpoint**: Dropdown renders, switches context via API, handles errors. Accessible.

---

## Phase 3: Wiring — TopBar + Home Page Integration (US1)

**Purpose**: Wire `ContextSwitcher` into `Layout`/`TopBar` and trigger home page refetch on switch.

- [x] T012 Update `web/src/components/TopBar.tsx`: replace the static context display with `<ContextSwitcher>` component. Pass `contexts`, `active`, and `onSwitch` props. Keep the truncation logic (40 char limit) in the trigger button display.
- [x] T013 Update `web/src/components/Layout.tsx`: (1) fetch full context list (`listContexts()`) on mount (already fetches active), (2) store `contexts` array + `active` in state, (3) pass both to `TopBar` which passes to `ContextSwitcher`, (4) `onSwitch` callback: update `active` state, then trigger re-render of child pages. Use a `key` prop on `<Outlet>` keyed to active context to force child remount (simplest way to trigger refetch in Home page without a global event bus).
- [x] T014 Update `web/src/components/TopBar.test.tsx` and `web/src/components/Layout.test.tsx` — update existing tests to account for the new dropdown behavior. Add test: switching context updates the displayed name.
- [x] T015 Run `bun run typecheck` + `bun run test` — all pass

**Checkpoint**: Full flow works — open dropdown, select context, TopBar updates, Home page refetches.

---

## Phase 4: E2E & Final Verification

- [x] T016 Create `test/e2e/journeys/007-context-switcher.spec.ts` per spec E2E journey: Step 1 (verify initial context shown), Step 2 (open dropdown, both contexts listed, active marked), Step 3 (switch to alternate context, name updates), Step 4 (RGD list reloads), Step 5 (long context name truncated with title tooltip), Step 6 (switch back to primary)
- [x] T017 Run `go vet ./...` — zero warnings
- [x] T018 Run `go test -race ./...` — all pass, no races
- [x] T019 Run `bun run typecheck` — zero errors
- [x] T020 Run `bun run test` — all frontend tests pass

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1: Go Backend | T001–T006 | ClientFactory.SwitchContext + handler |
| 2: Frontend Dropdown | T007–T011 | ContextSwitcher component |
| 3: Wiring | T012–T015 | TopBar + Layout integration |
| 4: E2E | T016–T020 | Integration test + final checks |

**Total**: 20 tasks

**Parallelism**: Phase 1 (Go) and Phase 2 (frontend) can run concurrently — they touch completely different files. Phase 3 depends on both Phase 1 and Phase 2.
