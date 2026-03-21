# Research: Feature Flag System

**Spec**: `008-feature-flags` | **Date**: 2026-03-20

---

## R1: CRD Schema Introspection for Capability Detection

### Decision: Use dynamic client `Get` on the CRD object directly

### Rationale

The `client-go/discovery` package provides two OpenAPI introspection paths:
- `OpenAPISchema()` (v2) — returns the **entire cluster's** schema as a single
  giant document. Too slow and memory-intensive for the 2-second SLA.
- `OpenAPIV3()` — per-GroupVersion schema fetch, fast and targeted.

However, a **simpler approach** is available: fetch the CRD object directly via
the dynamic client and walk its `openAPIV3Schema` property tree. This is:
- Consistent with the project's "dynamic client everywhere" philosophy (§II)
- A single focused GET call (~10-50KB payload)
- Already permitted by the ClusterRole (`get` on `customresourcedefinitions`)
- No new dependencies needed

```go
crdGVR := schema.GroupVersionResource{
    Group:    "apiextensions.k8s.io",
    Version:  "v1",
    Resource: "customresourcedefinitions",
}
crd, err := dynamic.Resource(crdGVR).Get(ctx, "resourcegraphdefinitions.kro.run", ...)
```

Then navigate `spec.versions[0].schema.openAPIV3Schema.properties.spec.properties`
to check field existence.

### Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| OpenAPI v2 (`OpenAPISchema()`) | Returns entire cluster schema; too large and slow |
| OpenAPI v3 (`OpenAPIV3()` + `GVSpecAsMap`) | More complex code path with no benefit over direct CRD fetch |
| Typed CRD client (`apiextensions/v1`) | Would violate §II (dynamic client only) and add a dependency |

### Field detection paths

Within `spec.versions[0].schema.openAPIV3Schema`:

| Capability | Path (inside properties tree) | Detection |
|---|---|---|
| `hasForEach` | `spec → resources → items → forEach` | key exists in properties |
| `hasExternalRef` | `spec → resources → items → externalRef` | key exists in properties |
| `hasExternalRefSelector` | `spec → resources → items → externalRef → metadata → selector` | key exists in nested properties |
| `hasScope` | `spec → schema → scope` | key exists in properties |
| `hasTypes` | `spec → schema → types` | key exists in properties |

Navigation uses the same `map[string]any` walking pattern as the existing
`unstructuredString()` helper in `internal/api/handlers/discover.go:124`.

---

## R2: Feature Gate Detection from the Cluster

### Decision: Parse kro controller Deployment args (best-effort)

### Rationale

kro feature gates (`CELOmitFunction`, `InstanceConditionEvents`) are passed to
the controller binary as `--feature-gates=Key=true,Key=false` CLI arguments.
They are **not** persisted anywhere in the cluster beyond the Deployment's
pod template spec.

The spec proposed four detection mechanisms. Reality:

| Priority | Method | Feasibility |
|---|---|---|
| 1 | Leader-election ConfigMap/Lease annotations | **NOT possible** — kro does not write feature gate data to the Lease |
| 2 | CRD annotations for capability markers | **NOT possible** — kro CRD only has `controller-gen.kubebuilder.io/version` |
| 3 | CRD OpenAPI schema introspection | **WORKS** but only for schema-level capabilities, not runtime gates |
| 4 | Conservative baseline fallback | Always works |

The **only viable method** for runtime feature gate detection is reading the
kro controller Deployment:

```go
// Find kro controller Deployment
deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
deploy, _ := dynamic.Resource(deployGVR).Namespace("kro-system").
    Get(ctx, "kro-controller-manager", metav1.GetOptions{})

// Parse --feature-gates from container args
containers := deploy.spec.template.spec.containers[0].args
// Look for "--feature-gates=CELOmitFunction=true,InstanceConditionEvents=false"
```

This works for standard Helm installations where the Deployment is named
`kro-controller-manager` in `kro-system`. It fails gracefully to all-gates-false
for non-standard deployments.

### Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| kro controller status endpoint | Does not exist — kro has no introspection API |
| ConfigMap-based feature gate storage | kro does not persist gates to ConfigMaps |
| CRD annotation markers | kro does not annotate CRDs with gate state |
| Version string comparison | Explicitly prohibited by spec (FR-002) and fragile |

### Deployment discovery strategy

Rather than hardcoding the Deployment name, search by label:

1. List Deployments across namespaces with label `app.kubernetes.io/name=kro`
2. If not found, try `app=kro` or `app.kubernetes.io/component=controller`
3. If not found, try well-known name `kro-controller-manager` in `kro-system`
4. If still not found, fall back to all feature gates `false`

---

## R3: Known Resources Enumeration

### Decision: Use `ServerResourcesForGroupVersion("kro.run/v1alpha1")`

### Rationale

This is the existing pattern in the codebase (`discover.go:111`). It returns
all resources registered under the kro API group. Currently returns
`["resourcegraphdefinitions"]`; when kro adds `GraphRevision`, it will
automatically appear without code changes.

```go
resourceList, err := disc.ServerResourcesForGroupVersion("kro.run/v1alpha1")
var knownResources []string
for _, r := range resourceList.APIResources {
    if !strings.Contains(r.Name, "/") {  // skip subresources
        knownResources = append(knownResources, r.Name)
    }
}
```

If `kro.run/v1alpha1` is not found (kro not installed), the entire capabilities
response falls back to a conservative baseline.

### Multi-version consideration

If kro introduces `v1alpha2` or `v1beta1`, use `ServerGroups()` to discover
available versions and query the preferred version. Not needed for v1alpha1-only.

---

## R4: Cache Architecture

### Decision: 30-second `sync.RWMutex` + `time.Time` in-memory cache (backend);
module-level stale-while-revalidate cache (frontend)

### Rationale (backend)

The spec requires a 30-second cache (FR-001). `client-go`'s built-in caches
(`discovery/cached/memory`, `openapi/cached`) do not support TTL. A simple
custom cache matches the project's existing `sync.RWMutex` pattern from
`ClientFactory`:

```go
type capabilitiesCache struct {
    mu        sync.RWMutex
    result    *KroCapabilities
    fetchedAt time.Time
    ttl       time.Duration
}
```

Cache must be invalidated on context switch (different cluster may have
different kro version/gates).

### Rationale (frontend)

Module-level cache with subscriber pattern:
- All `useCapabilities()` consumers share a single `cache` object at module scope
- `revalidate()` deduplicates in-flight fetches via an `inflight` promise guard
- Returns stale data immediately, refreshes in background if >30s old
- `loading` is `true` only on first-ever fetch (before any data exists)
- No React Context provider needed — capabilities are a global singleton
- Invalidation on context switch: reset `cache.fetchedAt = 0`

### Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| `usePolling` with 30s interval | Wastes fetches when capabilities haven't changed; SWR is better for slow-changing data |
| React Context provider | Adds ceremony for no benefit — capabilities are global, not tree-scoped |
| `useSyncExternalStore` | More complex, requires stable snapshot identity — subscriber pattern is simpler |
| SWR / React Query library | Prohibited by §V (no state management libraries) |

---

## R5: Experimental Features System

### Decision: `?experimental=true` query parameter gating

### Rationale

Per spec, a `?experimental=true` query parameter (or dev-only toggle) enables
rendering of features not yet in upstream kro. Implementation:

- Frontend reads `window.location.search` for `experimental=true`
- Experimental sections are wrapped in `{isExperimental && ...}` guards
- Experimental UI elements show an "Experimental" badge styled with
  `tokens.css` custom properties
- No backend involvement — experimental mode is a pure frontend concern

### Current experimental features

| Feature | Expected upstream version |
|---|---|
| GraphRevision tab on RGD detail | kro v0.10+ (spec 009) |

When a feature lands in upstream kro, it transitions from experimental to
capabilities-gated (detected via `knownResources`).

---

## R6: Fork Feature Guard

### Decision: Hardcoded exclusion list with test assertion

### Rationale

Per spec (FR-004) and constitution (§II), `specPatch` and `stateFields` must
**never** appear as enabled capabilities. Implementation:

```go
var forbiddenCapabilities = []string{"specPatch", "stateFields"}
```

After building the capabilities response, assert that none of these appear.
Test coverage ensures this never regresses.

---

## R7: Detection Pipeline (consolidated)

### Three API calls, two parallelizable:

```
1. ServerResourcesForGroupVersion("kro.run/v1alpha1")
   → knownResources, apiVersion

2. Dynamic().Resource(crdGVR).Get("resourcegraphdefinitions.kro.run")  ─┐
   → schema capabilities (hasForEach, hasExternalRef, etc.)             │ parallel
                                                                        │
3. Dynamic().Resource(deployGVR).Get("kro-system/kro-controller-manager")┘
   → feature gates (CELOmitFunction, InstanceConditionEvents)
```

Calls 2 and 3 run concurrently. Total latency: ~200-500ms on a real cluster,
well within the 2-second SLA. First call must succeed for the others to proceed
(it confirms kro is installed).

### Error handling:

| Failure | Response |
|---|---|
| Call 1 fails (kro not installed) | Return conservative baseline immediately |
| Call 2 fails (CRD not accessible) | Use baseline schema capabilities |
| Call 3 fails (Deployment not found) | All feature gates = `false` |
| All calls fail | Return conservative baseline |

No error blocks the UI — the endpoint always returns valid JSON.
