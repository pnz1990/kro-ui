# Feature Specification: API Response Cache

**Feature Branch**: `052-response-cache`
**Created**: 2026-03-28
**Status**: In Progress

---

## Context

kro-ui is a read-only dashboard that makes dozens of API calls to the Kubernetes
API server on every page navigation. On large clusters or slow connections:
- Navigating from the Overview to a catalog page re-fetches all RGDs
- Switching tabs on an RGD detail page re-fetches the same RGD spec repeatedly
- The fleet page fan-outs to multiple clusters simultaneously
- Each navigation triggers a full round-trip even when nothing has changed

A response cache in the Go backend allows these calls to be served from memory
when the data is fresh, dramatically reducing both latency and API server load.

---

## Cache Design

### What to cache and TTLs

| Endpoint | TTL | Rationale |
|----------|-----|-----------|
| `GET /api/v1/rgds` | 30s | RGD list changes infrequently; 30s is safe |
| `GET /api/v1/rgds/{name}` | 30s | RGD spec rarely changes mid-session |
| `GET /api/v1/rgds/{name}/instances` | 10s | Instance list: frequent changes expected |
| `GET /api/v1/kro/capabilities` | 5min | kro version/feature gates change on redeploy only |
| `GET /api/v1/contexts/fleet` (fleet summary) | 15s | Multi-cluster summary: moderate freshness needed |
| `GET /api/v1/version` | 5min | Binary version never changes at runtime |

### What NOT to cache (always fresh)

| Endpoint | Reason |
|----------|--------|
| `GET /api/v1/instances/{ns}/{name}` | Live 5s poll — must always be fresh |
| `GET /api/v1/instances/{ns}/{name}/children` | Live 5s poll |
| `GET /api/v1/events` | Realtime event stream |
| `GET /api/v1/contexts` | Context list (for switcher) — user-initiated |
| All POST endpoints (validate, etc.) | Mutations/stateful operations |

### Cache key

`<method>:<path>?<sorted_query>` normalized per context. Context-switch
invalidates all cache entries for that context.

### Implementation

- **Location**: Go middleware in `internal/server/server.go` — wraps individual
  routes with per-route TTL
- **Storage**: In-memory `sync.Map` with `(key, value, expiresAt)` entries
- **No external dependencies**: No Redis, no memcached — pure Go
- **Thread-safe**: `sync.RWMutex` for consistent reads
- **Cache-Control header**: Responses include `X-Cache: HIT` or `X-Cache: MISS`
  header so the frontend can observe cache behavior
- **Invalidation triggers**:
  1. TTL expiry (automatic)
  2. Context switch (clear all entries for that context prefix)
  3. `?refresh=true` query param (bypass cache for that request, then repopulate)

---

## Success Criteria

- `GET /api/v1/rgds` served from cache on repeated requests within TTL
- Cache hit rate > 70% during normal session navigation
- No stale data older than the declared TTL is ever returned
- Context switch clears the cache for the old context
- `X-Cache: HIT/MISS` header present on all cacheable responses
- Go tests cover: cache hit, cache miss, TTL expiry, context invalidation, concurrent access

---

## Assumptions

- The cache is per-process (in-memory only). Cache is lost on restart — this is
  acceptable since the binary restarts quickly and the cache warms up within seconds.
- The frontend does NOT implement its own cache layer — all caching is in Go.
  This keeps the frontend simple and avoids stale-closure issues in React.
- `?refresh=true` is only used by the manual refresh button, not automated polling.
