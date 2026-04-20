# spec: pickPod and pickPodFromClusterList 100% coverage

## Design reference

- **Design doc**: N/A — test coverage improvement, no user-visible behavior change
- **Implements**: close pickPod/pickPodFromClusterList coverage gaps

---

## Zone 1 — Obligations

### O1 — pickPod coverage = 100%

After changes, `pickPod` must be at 100% statement coverage.
The empty-list guard (`len(items)==0 → return false`) is the uncovered path
because `discoverKroPod` never passes an empty slice.

### O2 — pickPodFromClusterList coverage = 100%

The `if ns == ""` branches for both Running and fallback pod paths must be covered.
These are exercised by pods where `Object["metadata"]` has no `"namespace"` key
(so both `GetNamespace()` and `NestedString` return `""`).

### O3 — No regressions

`go vet ./...` clean. All pre-existing tests pass.

---

## Zone 2 — Implementer's judgment

- Direct calls to `pickPod` and `pickPodFromClusterList` with targeted inputs
- No production code changes

---

## Zone 3 — Scoped out

- No changes to discoverKroPod
- No changes to production code
