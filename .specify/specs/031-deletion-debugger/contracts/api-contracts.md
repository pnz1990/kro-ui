# API Contracts: 031-deletion-debugger

This spec introduces **no new API endpoints**. All deletion-related data is already present in existing response payloads as raw unstructured Kubernetes objects.

## Existing Endpoints Relied Upon

The following existing endpoints are used unchanged. Their responses already include the `metadata.deletionTimestamp` and `metadata.finalizers` fields needed for all features in this spec.

### `GET /api/v1/instances/{namespace}/{name}`

Returns the full raw Kubernetes object for the instance. Fields consumed by this feature:

```json
{
  "metadata": {
    "name": "my-webapp",
    "namespace": "default",
    "deletionTimestamp": "2026-03-23T10:00:00Z",   ← FR-001, FR-002
    "finalizers": ["kro.run/instance-cleanup"]       ← FR-002
  },
  "spec": { ... },
  "status": { ... }
}
```

### `GET /api/v1/instances/{namespace}/{name}/children`

Returns `{ "items": [...] }` where each item is a full raw Kubernetes object. Fields consumed:

```json
{
  "items": [
    {
      "apiVersion": "apps/v1",
      "kind": "Deployment",
      "metadata": {
        "name": "my-webapp-deploy",
        "namespace": "default",
        "deletionTimestamp": "2026-03-23T10:00:05Z",  ← FR-003, FR-006
        "finalizers": []                                ← FR-006
      },
      ...
    }
  ]
}
```

### `GET /api/v1/instances/{namespace}/{name}/events`

Returns `{ "items": [...] }` where each item is a `v1/Event`. Field consumed:

```json
{
  "items": [
    {
      "reason": "FailedDelete",   ← FR-004: isDeletionEvent() checks this field
      "type": "Warning",
      "message": "...",
      "lastTimestamp": "2026-03-23T10:00:10Z"
    }
  ]
}
```

### `GET /api/v1/rgds/{name}/instances`

Returns `{ "items": [...] }` where each item is a full raw CR instance. Fields consumed:

```json
{
  "items": [
    {
      "metadata": {
        "name": "my-webapp",
        "namespace": "default",
        "deletionTimestamp": "2026-03-23T10:00:00Z"   ← FR-005, FR-007
      }
    }
  ]
}
```

## Frontend-Only "Contracts" (Component Interfaces)

The following component boundaries are the functional contracts for this feature.

### `isTerminating(obj: K8sObject): boolean`
- **Input**: any `K8sObject` (instance, child resource, event)
- **Output**: `true` iff `obj.metadata.deletionTimestamp` is a non-empty string
- **Never throws**: returns `false` for any malformed/absent input

### `getFinalizers(obj: K8sObject): string[]`
- **Input**: any `K8sObject`
- **Output**: array of finalizer strings; empty array if absent
- **Never throws**: returns `[]` for any malformed/absent input

### `isDeletionEvent(event: K8sObject): boolean`
- **Input**: a `K8sObject` representing a Kubernetes event
- **Output**: `true` iff `event.reason` is in the canonical `DELETION_REASONS` set
- **DELETION_REASONS set**: `Killing, Deleted, FailedDelete, SuccessfulDelete, DeletionFailed, FailedKillPod, ResourceDeleted, FinalizerRemoved, DeletionBlocked, Terminating, PreStopHookFailed`
- **Never throws**: returns `false` if `reason` is absent or not a string
