# spec: handler coverage — GetMetrics ListContexts error + GetCapabilities gaps

## Design reference

- **Design doc**: N/A — test coverage improvement, no user-visible behavior change
- **Implements**: close remaining handler coverage gaps in GetMetrics and GetCapabilities

---

## Zone 1 — Obligations

### O1 — GetMetrics ListContexts-error path covered

A test must verify that when `?context=` is provided and `h.ctxMgr.ListContexts()`
returns an error, `GetMetrics` returns HTTP 500 with a JSON error body.

Violation: `TestGetMetrics_ContextListFails` is absent or does not assert 500.

### O2 — GetMetrics coverage ≥ 90%

After the new test, `GetMetrics` statement coverage must be ≥ 90%.

Violation: `go tool cover` shows < 90%.

### O3 — No regressions

`go vet ./...` clean. All pre-existing tests pass.

Violation: any pre-existing test fails.

---

## Zone 2 — Implementer's judgment

- Use `stubClientFactory{listErr: assert.AnError}` to simulate the failure
- One test function is sufficient; no table-driven test needed

---

## Zone 3 — Scoped out

- No production code changes
- GetCapabilities gap investigation only if easy; leave complex gaps for future items
