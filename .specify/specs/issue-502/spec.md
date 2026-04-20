# spec: usePageTitle test + cache WriteHeader coverage

## Design reference

- **Design doc**: N/A — test coverage improvement with no user-visible behavior change
- **Implements**: close coverage gaps in `usePageTitle` hook and `cache.go WriteHeader`

---

## Zone 1 — Obligations

### O1 — usePageTitle.test.ts must exist and pass

A test file `web/src/hooks/usePageTitle.test.ts` MUST exist covering:
- `usePageTitle("RGDs")` → `document.title === "RGDs — kro-ui"`
- `usePageTitle("")` → `document.title === "kro-ui"`
- Unmount resets title to `"kro-ui"`

Violation: any of the above assertions fails or the file does not exist.

### O2 — cache.go WriteHeader coverage > 0%

A test in `internal/cache/cache_test.go` MUST exercise `responseRecorder.WriteHeader`
by simulating a handler that calls `w.WriteHeader(500)`.

Violation: `go tool cover` shows `WriteHeader` at 0% after tests run.

### O3 — All existing tests continue to pass

`go vet ./...` must be clean.
`bun run test` (or vitest) must pass for the frontend tests.

Violation: any pre-existing test fails.

---

## Zone 2 — Implementer's judgment

- Use `@testing-library/react`'s `renderHook` for the TS hook test (consistent with other hook tests)
- For WriteHeader, a simple httptest-based test is sufficient — no need for a full integration test

---

## Zone 3 — Scoped out

- No new features
- No changes to production code
- usePageTitle implementation not modified
