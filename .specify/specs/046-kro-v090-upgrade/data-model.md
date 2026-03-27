# Data Model: kro v0.9.0 Upgrade

**Date**: 2026-03-26
**Branch**: `046-kro-v090-upgrade`

---

## New Backend Entities

### GraphRevision (Kubernetes resource — read-only)

Upstream type: `internal.kro.run/v1alpha1/GraphRevision`

Accessed via dynamic client. kro-ui only reads and exposes a subset of fields.

```
GraphRevision
├── metadata
│   ├── name: string              — "${rgd-name}-${revision-number}" e.g. "my-app-1"
│   ├── creationTimestamp: string
│   └── labels
│       └── kro.run/graph-revision-hash: string
├── spec
│   ├── revision: int64           — monotonic revision number (≥1)
│   └── snapshot
│       ├── name: string          — source RGD name (selectable field)
│       ├── generation: int64     — RGD generation when snapshot was taken
│       └── spec
│           ├── schema: { ... }   — captured RGD spec.schema
│           └── resources: [...]  — captured RGD spec.resources
└── status
    ├── topologicalOrder: []string
    ├── conditions: Conditions
    └── resources: []ResourceInformation
```

kro-ui exposes this as-is (unstructured `K8sObject` / `K8sList`). No new typed
response struct needed — the existing `K8sObject` pattern is used everywhere.

**GVR**:
```go
var graphRevisionGVR = schema.GroupVersionResource{
    Group:    "internal.kro.run",
    Version:  "v1alpha1",
    Resource: "graphrevisions",
}
```

**Validation rules**: None in kro-ui (read-only). The cluster enforces CRD constraints.

**State transitions**: N/A — kro-ui is a read-only observer.

---

## Backend Capability Model Changes

### `SchemaCapabilities` (extended)

Located in `internal/k8s/capabilities.go`.

```go
// Before (v0.8.x)
type SchemaCapabilities struct {
    HasForEach             bool `json:"hasForEach"`
    HasExternalRef         bool `json:"hasExternalRef"`
    HasExternalRefSelector bool `json:"hasExternalRefSelector"`
    HasScope               bool `json:"hasScope"`
    HasTypes               bool `json:"hasTypes"`
}

// After (v0.9.0)
type SchemaCapabilities struct {
    HasForEach             bool `json:"hasForEach"`
    HasExternalRef         bool `json:"hasExternalRef"`
    HasExternalRefSelector bool `json:"hasExternalRefSelector"`
    HasScope               bool `json:"hasScope"`
    HasTypes               bool `json:"hasTypes"`
    HasGraphRevisions      bool `json:"hasGraphRevisions"`  // NEW
}
```

**Detection logic**: `HasGraphRevisions = true` when
`disc.ServerResourcesForGroupVersion("internal.kro.run/v1alpha1")` returns a
resource list containing a resource named `graphrevisions`.

**Baseline changes**:
```go
// Baseline() in capabilities.go
Schema: SchemaCapabilities{
    HasForEach:             true,
    HasExternalRef:         true,
    HasExternalRefSelector: true,   // changed: false → true (kro v0.9.0 default)
    HasScope:               false,  // still detected per cluster (CRD schema probe)
    HasTypes:               false,  // still detected per cluster (CRD schema probe)
    HasGraphRevisions:      false,  // new; only true on v0.9.0+ clusters
}
```

Note: `HasScope` and `HasTypes` remain `false` in the baseline because they are
detected by CRD schema introspection, not by version. A cluster could be on
v0.9.0 but have an older CRD installed.

---

## Frontend Type Changes

### `KroCapabilities.schema` (extended)

Located in `web/src/lib/api.ts`.

```typescript
// Before
schema: {
    hasForEach: boolean
    hasExternalRef: boolean
    hasExternalRefSelector: boolean
    hasScope: boolean
    hasTypes: boolean
}

// After
schema: {
    hasForEach: boolean
    hasExternalRef: boolean
    hasExternalRefSelector: boolean
    hasScope: boolean
    hasTypes: boolean
    hasGraphRevisions: boolean   // NEW
}
```

### BASELINE changes (web/src/lib/features.ts)

```typescript
// Before
schema: {
    hasForEach: true,
    hasExternalRef: true,
    hasExternalRefSelector: false,  // ← changing
    hasScope: false,
    hasTypes: false,
}

// After
schema: {
    hasForEach: true,
    hasExternalRef: true,
    hasExternalRefSelector: true,   // ← changed: v0.9.0 GA default
    hasScope: false,
    hasTypes: false,
    hasGraphRevisions: false,       // ← new field
}
```

---

## New API Endpoints

### `GET /api/v1/kro/graph-revisions`

Query params:
- `rgd` (required): name of the source RGD

Response:
```json
{
  "items": [
    {
      "apiVersion": "internal.kro.run/v1alpha1",
      "kind": "GraphRevision",
      "metadata": { "name": "my-app-3", ... },
      "spec": {
        "revision": 3,
        "snapshot": { "name": "my-app", "generation": 5, "spec": { ... } }
      },
      "status": { "conditions": [...], "topologicalOrder": [...] }
    }
  ]
}
```

- Sorted by `spec.revision` descending (highest revision first).
- On pre-v0.9.0 clusters (no `graphrevisions` CRD): returns `{"items": []}`.
- Error if `rgd` param is missing: 400 Bad Request.

### `GET /api/v1/kro/graph-revisions/{name}`

Response: single `GraphRevision` object (unstructured), or 404 if not found.

---

## Component State Changes

### RGDCard

No new state. Reads `spec?.schema?.scope` from the existing `K8sObject` prop.
Renders badge conditionally based on `=== 'Cluster'`.

### RGDDetailHeader (or wherever `lastIssuedRevision` is added)

No new state. Reads `status?.lastIssuedRevision` from the RGD `K8sObject`.
Renders "Rev #N" chip when value is a number > 0.

### DocsTab

No new state. Reads `spec?.schema?.types` and calls `parseSchema()` on it
(same function used for `spec?.schema?.spec`). Gated on `caps.schema.hasTypes`.

### RGDAuthoringForm

Existing `forEachIterators: ForEachIterator[]` state already supports multiple
iterators. New: "Add iterator" `<button>` dispatches an action that appends a new
empty `ForEachIterator` to the array. "Remove" button is shown when array length > 1.

---

## Token/CSS Changes

Two new tokens in `web/src/tokens.css`:

```css
/* Cluster-scope badge */
--badge-cluster-bg: var(--color-pending-dim);   /* reuse violet dim */
--badge-cluster-fg: var(--color-pending);        /* reuse violet */
```

Or define as explicit values (TBD in tasks — must reference existing color family,
not hardcode hex directly in component CSS).
