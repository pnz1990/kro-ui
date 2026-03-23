# API Contract: GET /api/v1/rgds/{name}/access

**Feature**: `032-rbac-sa-autodetect`
**Endpoint**: `GET /api/v1/rgds/{name}/access`
**Status**: Updated (previously defined in spec `018-rbac-visualizer`)

---

## Changes from spec 018

- Added optional query parameters `saNamespace` and `saName`
- `serviceAccount` field in response can now be `""` (was always at least `"kro-system/kro"`)
- `serviceAccountFound: false` now always means SA is unknown (not just "fallback was used")

---

## Request

```
GET /api/v1/rgds/{name}/access[?saNamespace=<ns>&saName=<name>]
```

### Path parameters

| Param | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Name of the ResourceGraphDefinition |

### Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| `saNamespace` | No | Manual override: namespace of kro's service account |
| `saName` | No | Manual override: name of kro's service account |

**Override semantics**: Both `saNamespace` and `saName` must be non-empty for the override
to take effect. If only one is present (or both are empty), auto-detection is used.

---

## Response — 200 OK

```json
{
  "serviceAccount": "kro-system/kro-controller",
  "serviceAccountFound": true,
  "clusterRole": "kro-manager-role",
  "hasGaps": false,
  "permissions": [
    {
      "group": "apps",
      "version": "v1",
      "resource": "deployments",
      "kind": "Deployment",
      "required": ["get", "list", "watch", "create", "update", "patch", "delete"],
      "granted": {
        "get": true,
        "list": true,
        "watch": true,
        "create": true,
        "update": true,
        "patch": true,
        "delete": true
      }
    }
  ]
}
```

### Response when SA not found (no override provided)

```json
{
  "serviceAccount": "",
  "serviceAccountFound": false,
  "clusterRole": "",
  "hasGaps": false,
  "permissions": []
}
```

**Important**: HTTP status is still `200 OK`. The empty SA is a valid operational state,
not an error. The frontend differentiates this from a failure via `serviceAccount === ""`
combined with `serviceAccountFound === false`.

### Response when SA override provided

```json
{
  "serviceAccount": "kro-prod/kro-operator",
  "serviceAccountFound": true,
  "clusterRole": "kro-operator-role",
  "hasGaps": true,
  "permissions": [ ... ]
}
```

Note: `serviceAccountFound: true` for overrides — the user has explicitly provided the SA,
so the backend treats it as "found" (the user takes responsibility for correctness).

---

## Response — 404 Not Found

```json
{ "error": "resourcegraphdefinition \"my-app\" not found" }
```

---

## Response — 503 Service Unavailable

```json
{ "error": "cluster unreachable: <reason>" }
```

---

## Frontend usage

```typescript
// Auto-detect (existing behavior)
getRGDAccess(rgdName)

// Manual override (new)
getRGDAccess(rgdName, { saNamespace: "kro-prod", saName: "kro-operator" })
```

The `api.ts` `getRGDAccess` function is updated to accept an optional second argument
`options?: { saNamespace?: string; saName?: string }` and append them as query params.

---

## Invariants

1. `serviceAccount` is `""` if and only if `serviceAccountFound === false` AND no override was provided
2. When `serviceAccount === ""`, `permissions` is always `[]` and `hasGaps` is always `false`
3. The endpoint never returns a hardcoded SA name — all SA values come from the cluster or user input
4. The endpoint is read-only (GET only; no mutations)
