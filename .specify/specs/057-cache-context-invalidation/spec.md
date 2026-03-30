# Feature Specification: Cache Flush on Context Switch

**Feature Branch**: `057-cache-context-invalidation`
**Created**: 2026-03-28
**Status**: Merged (PR #326)

---

## Context

The response cache (spec 052) caches API responses with TTLs:
- RGD list/detail: 30s
- Instance list: 10s
- Capabilities: 5 minutes
- Graph revisions: 30s

When a user switches from cluster-A to cluster-B via the context switcher,
the `ClientFactory.SwitchContext()` reloads the dynamic/discovery clients.
However, the response cache was not flushed on context switch — meaning
the next request after switching could return a cached response from the
**previous cluster** for up to 5 minutes (capabilities TTL).

This is particularly problematic for:
- `/kro/capabilities` — cluster-A may have GraphRevisions, cluster-B may not
- `/rgds` — shows cluster-A's RGDs on cluster-B
- `/kro/graph-revisions` — completely wrong cluster

## Fix

Add a `Flush()` method to `ResponseCache` that atomically clears all entries
(regardless of expiry). Register it as a `ContextSwitchHook` in `server.go`
so it fires immediately after every successful context switch.

`ClientFactory.RegisterContextSwitchHook(rc.Flush)` — already has the hook
infrastructure for MetricsDiscoverer; reuse it for cache invalidation.

---

## Requirements

### FR-001: Flush() method on ResponseCache

`internal/cache/cache.go` MUST add a `Flush()` method that:
- Acquires the write lock
- Replaces the entries map with a new empty map (GC-friendly)
- Returns immediately (synchronous, O(1) amortized via map replacement)

### FR-002: Cache flushed on context switch

`internal/server/server.go` MUST call `factory.RegisterContextSwitchHook(rc.Flush)`
after creating the response cache singleton. This ensures every `POST
/api/v1/contexts/switch` that succeeds causes a full cache flush before the
200 response is returned.

### FR-003: Test coverage

- Unit test in `cache_test.go`: Flush() removes all entries including non-expired ones
- `go test -race ./internal/cache/...` must pass

---

## Acceptance Criteria

- [ ] `ResponseCache.Flush()` method added
- [ ] `factory.RegisterContextSwitchHook(rc.Flush)` called in server.go
- [ ] Unit test for Flush() including non-expired entries
- [ ] `go vet` and `go test -race` pass
- [ ] No frontend changes needed (flush happens server-side on switch)
