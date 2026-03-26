# 002 — Discovery Caching Strategy

**Status**: Accepted  
**Deciders**: @pnz1990  
**Date**: 2025-02  
**Refs**: `internal/k8s/discovery.go`, `AGENTS.md` §Performance budget

---

## Problem statement

`k8s.io/client-go`'s `discovery.ServerGroupsAndResources()` makes one HTTP
request per API group to the cluster. On large EKS clusters with 200+ API
groups (installed by many controllers), calling this per-request causes 75-second
response times. See issue #57.

Additionally, the `GetInstanceChildren` fan-out iterates over all API resource
types to find child objects. Without caching this turns O(1) into O(n_groups)
per request.

---

## Proposal / overview

Cache discovery results in `ClientFactory` with a minimum 30-second TTL.
`DiscoverPlural` (kind → plural resource name) is the primary consumer.
`GetInstanceChildren` limits its search to the known GVRs registered in the
RGD rather than scanning all API resource types.

---

## Design details

- `ClientFactory.discoveryCache` stores `[]*metav1.APIResourceList` with a
  `time.Time` expiry (30s default).
- A `sync.RWMutex` guards concurrent reads. Stale caches are refreshed lazily
  on the next read that finds them expired.
- `SwitchContext` invalidates the cache (forces a fresh discovery on the next
  request to the new context).
- `GetInstanceChildren` accepts the RGD's resource GVRs and scopes its label
  selector queries to those GVRs only — not all API resource types.
- Fleet fan-out uses `errgroup` with a 2-second per-cluster timeout to bound
  the worst-case response time regardless of cluster count.

---

## Alternatives considered

| Alternative | Reason rejected |
|---|---|
| No caching (always fresh) | 75s response times on large clusters (issue #57) |
| Client-side discovery (browser calls /api/v1) | Exposes raw cluster credentials to browser; not acceptable |
| Full CRD watcher (informer) | Too complex; the read-only dashboard doesn't need push updates at this layer |

---

## Testing strategy

- `TestDiscoverPlural_CacheHit` in `internal/k8s/discovery_test.go` verifies
  that a second call within the TTL window makes zero additional HTTP requests.
- E2E journey `001-server-health.spec.ts` asserts `/healthz` responds within 200ms
  even on clusters with many API groups (kind cluster approximation).
