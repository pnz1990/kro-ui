# Implementation Plan: RBAC & Access Control Visualizer (018)

## Overview

Add an "Access" tab to the RGD detail page that shows a permission matrix
comparing what kro needs (derived from RGD resources) vs what it actually has
(from ClusterRole/RoleBinding reads). All reads are read-only (constitution §III).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25, `k8s.io/client-go/dynamic`, `k8s.io/client-go/discovery` |
| HTTP routing | `github.com/go-chi/chi/v5` |
| Logging | `github.com/rs/zerolog` |
| Frontend | React 19, TypeScript, plain CSS (tokens.css) |
| Testing (Go) | `testing` + `testify/assert` + `testify/require`, table-driven |
| Testing (TS) | Vitest + `@testing-library/react` |

---

## Architecture

### New Files

```
internal/k8s/rbac.go              # RBAC resolution logic (pure k8s reads)
internal/k8s/rbac_test.go         # Unit tests (table-driven)
internal/api/handlers/access.go   # GET /api/v1/rgds/{name}/access handler
web/src/components/AccessTab.tsx  # Permission matrix table
web/src/components/AccessTab.css
web/src/components/AccessTab.test.tsx
web/src/components/PermissionCell.tsx  # ✓/✗ cell
web/src/components/PermissionCell.css
web/src/components/RBACFixSuggestion.tsx  # kubectl fix command block
web/src/components/RBACFixSuggestion.css
```

### Modified Files

```
internal/api/types/response.go    # Add AccessResponse, GVRPermission types
internal/server/server.go         # Add GET /api/v1/rgds/{name}/access route
web/src/lib/api.ts                # Add getRGDAccess() + AccessResponse type
web/src/pages/RGDDetail.tsx       # Add "access" tab (4th tab)
web/src/pages/RGDDetail.css       # Access tab layout styles
```

---

## Backend Design

### `internal/k8s/rbac.go`

Core types:
```go
// ResourcePermission holds required vs granted verbs for a single GVR.
type ResourcePermission struct {
    Group    string
    Resource string
    Version  string
    Kind     string          // display only
    Required []string        // always: get,list,watch,create,update,patch,delete (or subset for externalRef)
    Granted  map[string]bool // verb → granted
}

// AccessResult is the full permission matrix for an RGD.
type AccessResult struct {
    ServiceAccount    string               // e.g. "kro-system/kro"
    ServiceAccountFound bool
    Permissions       []ResourcePermission
    HasGaps           bool
}
```

Key functions:
- `ResolveKroServiceAccount(ctx, clients)` — finds kro Deployment → reads `spec.template.spec.serviceAccountName`; falls back to `"kro"`
- `FetchEffectiveRules(ctx, clients, namespace, serviceAccountName)` — reads ClusterRoleBindings + RoleBindings; reads associated ClusterRoles/Roles; flattens all rules; resolves aggregated ClusterRoles
- `CheckPermissions(rules []rbacv1.PolicyRule, group, resource string, required []string) map[string]bool` — checks each verb; handles wildcards (`*`)
- `ComputeAccessResult(ctx, clients, rgd *unstructured.Unstructured) (*AccessResult, error)` — orchestrates the above; extracts GVRs from `spec.resources`

### RGD GVR extraction

From `spec.resources[].template.apiVersion` + `kind`:
- Parse `apiVersion` as `group/version` (core resources: version only)
- Discover plural via `DiscoverPlural`
- External refs need only `get, list, watch`; managed resources need all 7 verbs

### Wildcard handling

A rule with `apiGroups: ["*"]` grants access to all groups.
A rule with `resources: ["*"]` grants access to all resources.
A rule with `verbs: ["*"]` grants all verbs.

### Aggregated ClusterRoles

ClusterRoles with `aggregationRule.clusterRoleSelectors` aggregate rules from
other ClusterRoles with matching labels. Fetch these via the discovery client
and merge their rules.

### `internal/api/handlers/access.go`

```go
// GetRGDAccess — GET /api/v1/rgds/{name}/access
// Returns the permission matrix for kro's service account vs this RGD's resources.
func (h *Handler) GetRGDAccess(w http.ResponseWriter, r *http.Request)
```

### Response shape (JSON)

```json
{
  "serviceAccount": "kro/kro",
  "serviceAccountFound": true,
  "hasGaps": true,
  "permissions": [
    {
      "group": "apps",
      "version": "v1",
      "resource": "deployments",
      "kind": "Deployment",
      "required": ["get","list","watch","create","update","patch","delete"],
      "granted": {
        "get": true,
        "list": true,
        "watch": true,
        "create": true,
        "update": true,
        "patch": true,
        "delete": false
      }
    }
  ]
}
```

---

## Frontend Design

### `AccessTab` component

Fetches `GET /api/v1/rgds/{name}/access` on mount. Renders:
1. Loading state
2. Error state with retry
3. Service account info banner
4. If `serviceAccountFound === false`: alert + manual SA input field
5. If `hasGaps === false`: green "All permissions satisfied" banner
6. If `hasGaps === true`: warning banner + permission table + fix suggestions

### Permission matrix table

| Resource | get | list | watch | create | update | patch | delete |
|----------|-----|------|-------|--------|--------|-------|--------|
| apps/deployments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

Each cell is a `<PermissionCell granted={bool} />`.

### `PermissionCell`

- `granted=true`: green ✓ (`var(--color-alive)`)
- `granted=false`: red ✗ (`var(--color-error)`)
- Text label paired with color (WCAG AA)

### `RBACFixSuggestion`

For each resource with gaps, show a collapsible block containing:
1. The ClusterRole rule YAML to add
2. The `kubectl patch` command to apply it

Uses `<KroCodeBlock>` for syntax-highlighted display (already exists).

---

## Route Registration

In `internal/server/server.go`:
```go
r.Get("/rgds/{name}/access", h.GetRGDAccess)
```

---

## File Structure (final)

```
internal/
  k8s/
    rbac.go           # NEW: RBAC resolution
    rbac_test.go      # NEW: unit tests
  api/
    handlers/
      access.go       # NEW: HTTP handler
    types/
      response.go     # MODIFIED: add AccessResponse
  server/
    server.go         # MODIFIED: add route
web/src/
  lib/
    api.ts            # MODIFIED: add getRGDAccess
  components/
    AccessTab.tsx     # NEW
    AccessTab.css     # NEW
    AccessTab.test.tsx # NEW
    PermissionCell.tsx # NEW
    PermissionCell.css # NEW
    RBACFixSuggestion.tsx # NEW
    RBACFixSuggestion.css # NEW
  pages/
    RGDDetail.tsx     # MODIFIED: add Access tab
    RGDDetail.css     # MODIFIED: Access tab styles
```

---

## Testing Strategy

### Go unit tests (`rbac_test.go`)

Table-driven tests:
- ClusterRole exact match → verbs granted
- ClusterRole wildcard apiGroup (`*`) → grants for all groups
- ClusterRole wildcard verb (`*`) → all verbs granted
- ClusterRole wildcard resource (`*`) → resource matched
- No matching binding → no permissions
- Aggregated ClusterRole → aggregated rules included

Stubs: hand-written `fakeRBACClient` implementing `k8sClients` interface.

### Frontend tests (`AccessTab.test.tsx`)

- Shows green ✓ for granted permissions
- Shows red ✗ for missing permissions  
- Shows warning banner when gaps exist
- Shows success banner when all permissions satisfied
- Shows SA-not-found message when `serviceAccountFound=false`

---

## Constraints

- NO mutating calls (constitution §III) — only GET ClusterRoles, RoleBindings
- NO typed clients — use dynamic client for everything
- CSS tokens only — no hardcoded hex values
- TypeScript strict mode must pass
