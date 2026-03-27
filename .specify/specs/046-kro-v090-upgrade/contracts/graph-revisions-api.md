# API Contract: GraphRevision Endpoints

**Spec**: `046-kro-v090-upgrade` | **Date**: 2026-03-26

---

## Overview

These endpoints expose kro v0.9.0's `GraphRevision` resources (API group
`internal.kro.run/v1alpha1`). They are **read-only** and respect the
same 5-second response budget as all other kro-ui handlers (Constitution §XI).

On clusters not running kro v0.9.0+ (no `graphrevisions` CRD), both endpoints
degrade gracefully: the list returns `{"items": []}` and the get returns 404
with a structured error. Neither endpoint ever returns a 500 due to an absent CRD.

---

## `GET /api/v1/kro/graph-revisions`

Lists all `GraphRevision` objects for a given RGD, sorted descending by
`spec.revision` (highest/most recent first).

### Request

```
GET /api/v1/kro/graph-revisions?rgd=my-app HTTP/1.1
Accept: application/json
```

**Query parameters**:

| Name | Required | Description |
|------|----------|-------------|
| `rgd` | Yes | Name of the source RGD (`spec.snapshot.name` filter). |

If `rgd` is omitted: **400 Bad Request** with `{"error": "rgd parameter is required"}`.

### Response: 200 OK (items found)

```json
{
  "items": [
    {
      "apiVersion": "internal.kro.run/v1alpha1",
      "kind": "GraphRevision",
      "metadata": {
        "name": "my-app-3",
        "creationTimestamp": "2026-03-25T10:00:00Z",
        "labels": {
          "kro.run/graph-revision-hash": "a1b2c3d4"
        }
      },
      "spec": {
        "revision": 3,
        "snapshot": {
          "name": "my-app",
          "generation": 5,
          "spec": { "schema": { "kind": "MyApp", "apiVersion": "v1alpha1" }, "resources": [] }
        }
      },
      "status": {
        "topologicalOrder": ["configmap", "deployment"],
        "conditions": [
          {
            "type": "Ready",
            "status": "True",
            "lastTransitionTime": "2026-03-25T10:00:01Z"
          },
          {
            "type": "GraphVerified",
            "status": "True",
            "lastTransitionTime": "2026-03-25T10:00:01Z"
          }
        ],
        "resources": []
      }
    }
  ]
}
```

Items are sorted by `spec.revision` descending. If the RGD has no revisions
(rare — only possible if GC pruned all of them), returns `{"items": []}`.

### Response: 200 OK (no CRD / pre-v0.9.0 cluster)

```json
{
  "items": []
}
```

No error is returned when the `graphrevisions` CRD doesn't exist. The frontend
uses the `hasGraphRevisions` capability flag to decide whether to make this call.

### Response: 400 Bad Request

```json
{
  "error": "rgd parameter is required"
}
```

### Response: 500 Internal Server Error

Only if the dynamic client fails unexpectedly (network partition, etc.).

```json
{
  "error": "failed to list graph revisions: <detail>"
}
```

---

## `GET /api/v1/kro/graph-revisions/{name}`

Fetches a single `GraphRevision` by its Kubernetes resource name.

### Request

```
GET /api/v1/kro/graph-revisions/my-app-3 HTTP/1.1
Accept: application/json
```

**Path parameters**:

| Name | Description |
|------|-------------|
| `name` | Kubernetes name of the `GraphRevision` object (e.g. `my-app-3`). |

### Response: 200 OK

Single `GraphRevision` unstructured object (same shape as items in the list above).

### Response: 404 Not Found

When the `GraphRevision` does not exist, **or** when the CRD doesn't exist (graceful
degradation — kro-ui treats a missing CRD the same as a missing object).

```json
{
  "error": "graph revision not found: my-app-3"
}
```

### Response: 500 Internal Server Error

```json
{
  "error": "failed to get graph revision: <detail>"
}
```

---

## Updated Capabilities Response

The `GET /api/v1/kro/capabilities` response gains one new field:

```json
{
  "schema": {
    "hasForEach": true,
    "hasExternalRef": true,
    "hasExternalRefSelector": true,
    "hasScope": true,
    "hasTypes": true,
    "hasGraphRevisions": true
  }
}
```

| Field | Type | Always present | When `true` |
|-------|------|----------------|-------------|
| `schema.hasGraphRevisions` | `boolean` | Yes | `internal.kro.run/v1alpha1/graphrevisions` CRD exists in cluster |

**Baseline value**: `false` (requires kro v0.9.0+).

**Forward compatibility**: Clients that don't know about `hasGraphRevisions` should
ignore the field (additive change).

---

## Route Registration

```go
// internal/server/server.go
r.Get("/api/v1/kro/graph-revisions", h.ListGraphRevisions)
r.Get("/api/v1/kro/graph-revisions/{name}", h.GetGraphRevision)
```

These routes sit alongside the existing `/api/v1/kro/capabilities` route.

---

## Performance Contract

| Endpoint | Budget | Implementation |
|----------|--------|----------------|
| `GET /api/v1/kro/graph-revisions` | ≤5s | 5s context deadline; single List call with field selector |
| `GET /api/v1/kro/graph-revisions/{name}` | ≤5s | 5s context deadline; single Get call |

No discovery is called per-request. The GVR is constant (`graphRevisionGVR`).
