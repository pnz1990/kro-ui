# Data Model: Feature Flag System

**Spec**: `008-feature-flags` | **Date**: 2026-03-20

---

## Entities

### 1. `KroCapabilities` (Go: `internal/k8s/capabilities.go`)

The canonical response type returned by the capabilities detection pipeline.

```go
// KroCapabilities describes what the connected kro installation supports.
// Populated by introspecting the API server — never by version string parsing.
type KroCapabilities struct {
    Version        string            `json:"version"`
    APIVersion     string            `json:"apiVersion"`
    FeatureGates   map[string]bool   `json:"featureGates"`
    KnownResources []string          `json:"knownResources"`
    Schema         SchemaCapabilities `json:"schema"`
}

// SchemaCapabilities describes which optional fields exist in the RGD CRD schema.
type SchemaCapabilities struct {
    HasForEach              bool `json:"hasForEach"`
    HasExternalRef          bool `json:"hasExternalRef"`
    HasExternalRefSelector  bool `json:"hasExternalRefSelector"`
    HasScope                bool `json:"hasScope"`
    HasTypes                bool `json:"hasTypes"`
}
```

| Field | Type | Source | Default |
|---|---|---|---|
| `Version` | `string` | Deployment image tag or CRD labels | `"unknown"` |
| `APIVersion` | `string` | `ServerGroups()` preferred version | `"kro.run/v1alpha1"` |
| `FeatureGates` | `map[string]bool` | Deployment `--feature-gates` arg | `{"CELOmitFunction": false, "InstanceConditionEvents": false}` |
| `KnownResources` | `[]string` | `ServerResourcesForGroupVersion` | `["resourcegraphdefinitions"]` |
| `Schema.HasForEach` | `bool` | CRD OpenAPI schema introspection | `true` |
| `Schema.HasExternalRef` | `bool` | CRD OpenAPI schema introspection | `true` |
| `Schema.HasExternalRefSelector` | `bool` | CRD OpenAPI schema introspection | `false` |
| `Schema.HasScope` | `bool` | CRD OpenAPI schema introspection | `false` |
| `Schema.HasTypes` | `bool` | CRD OpenAPI schema introspection | `false` |

### 2. `capabilitiesCache` (Go: `internal/api/handlers/capabilities.go`)

In-memory TTL cache for the capabilities response. Lives in the handler layer
because it is HTTP-concern caching, not k8s detection logic.

```go
type capabilitiesCache struct {
    mu        sync.RWMutex
    result    *k8s.KroCapabilities
    fetchedAt time.Time
    ttl       time.Duration
}
```

| Field | Type | Description |
|---|---|---|
| `mu` | `sync.RWMutex` | Concurrent access guard |
| `result` | `*KroCapabilities` | Cached capabilities (nil if never fetched) |
| `fetchedAt` | `time.Time` | When the cache was last populated |
| `ttl` | `time.Duration` | Cache TTL (30 seconds per FR-001) |

**State transitions**:
- `nil` → populated: first request triggers detection pipeline
- populated + stale (>30s): next request triggers re-detection, serves stale during refresh
- populated → `nil`: context switch invalidates cache

### 3. `KroCapabilities` (TypeScript: `web/src/lib/features.ts`)

Frontend mirror of the Go type. Uses an index signature on `featureGates` for
forward compatibility (FR-003).

```typescript
interface KroCapabilities {
  version: string
  apiVersion: string
  featureGates: {
    CELOmitFunction: boolean
    InstanceConditionEvents: boolean
    [key: string]: boolean  // forward-compatible
  }
  knownResources: string[]
  schema: {
    hasForEach: boolean
    hasExternalRef: boolean
    hasExternalRefSelector: boolean
    hasScope: boolean
    hasTypes: boolean
  }
}
```

### 4. Module-level cache (TypeScript: `web/src/lib/features.ts`)

```typescript
interface Cache {
  data: KroCapabilities     // current capabilities (or baseline)
  fetchedAt: number         // Date.now() timestamp
  inflight: Promise<void> | null  // deduplication guard
}
```

### 5. Conservative baseline (TypeScript + Go)

Both frontend and backend define the same conservative baseline for when
detection fails. This is the minimum capability set shared across all kro
`v1alpha1` installations:

```typescript
const BASELINE: KroCapabilities = {
  version: 'unknown',
  apiVersion: 'kro.run/v1alpha1',
  featureGates: {
    CELOmitFunction: false,
    InstanceConditionEvents: false,
  },
  knownResources: ['resourcegraphdefinitions'],
  schema: {
    hasForEach: true,
    hasExternalRef: true,
    hasExternalRefSelector: false,
    hasScope: false,
    hasTypes: false,
  },
}
```

---

## Relationships

```
┌─────────────────────────┐
│   API Server (kro)      │
│                         │
│ ┌─────────────────────┐ │     discovery
│ │ CRD: resourcegraph  │◄├─────────────── ServerResourcesForGroupVersion
│ │ definitions.kro.run │ │                  → knownResources
│ └─────────────────────┘ │
│                         │     dynamic Get
│ ┌─────────────────────┐ │
│ │ CRD object          │◄├─────────────── crdGVR.Get(...)
│ │ (openAPIV3Schema)   │ │                  → schema capabilities
│ └─────────────────────┘ │
│                         │     dynamic Get
│ ┌─────────────────────┐ │
│ │ Deployment          │◄├─────────────── deployGVR.Get(...)
│ │ (kro-controller)    │ │                  → feature gates
│ └─────────────────────┘ │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  internal/k8s/          │
│  capabilities.go        │
│                         │
│  DetectCapabilities()   │──→ KroCapabilities struct
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  internal/api/handlers/ │
│  capabilities.go        │
│                         │
│  capabilitiesCache      │──→ 30s TTL in-memory cache
│  GetCapabilities()      │──→ HTTP handler (JSON response)
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  web/src/lib/           │
│  features.ts            │
│                         │
│  module-level cache     │──→ stale-while-revalidate (30s)
│  useCapabilities()      │──→ React hook (shared by all consumers)
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  Components             │
│                         │
│  DAGGraph, KroCodeBlock │──→ Gate rendering on capabilities
│  RGDDetail (tabs)       │──→ Show/hide tabs based on knownResources
│  Experimental badge     │──→ Show when ?experimental=true
└─────────────────────────┘
```

---

## Validation Rules

| Rule | Enforcement |
|---|---|
| `FeatureGates` MUST NOT contain `specPatch` or `stateFields` | Hardcoded exclusion in `DetectCapabilities()` + test assertion |
| `KnownResources` MUST only contain resources discovered via API server | Built from `ServerResourcesForGroupVersion` output; no hardcoded entries |
| `Schema` fields MUST be derived from CRD introspection | `hasFieldInSchema()` walks CRD properties tree; no version comparisons |
| Cache TTL MUST be 30 seconds | Constant `cacheTTL = 30 * time.Second` |
| Frontend MUST ignore unknown feature gates | Index signature `[key: string]: boolean` + components only check known gates |
| Endpoint MUST respond within 2 seconds | Cache serves stale data; detection pipeline parallelizes calls 2+3 |
