# Data Model: RBAC Service Account Auto-Detection

**Branch**: `032-rbac-sa-autodetect`
**Date**: 2026-03-23

---

## Entities

### 1. `AccessResult` (Go — `internal/k8s/rbac.go`)

No new fields; behavior change only.

| Field | Type | Change |
|-------|------|--------|
| `ServiceAccount` | `string` | Now `""` when not detected (was `"kro-system/kro"`) |
| `ServiceAccountFound` | `bool` | `false` when not detected (unchanged) |
| `ClusterRole` | `string` | `""` when not detected (unchanged) |
| `HasGaps` | `bool` | `false` when SA not found (no permissions to evaluate) |
| `Permissions` | `[]ResourcePermission` | Empty slice when SA not found |

**State transitions**:

```
ResolveKroServiceAccount result
  ├── found=true  → ComputeAccessResult runs full matrix
  └── found=false → ComputeAccessResult returns early:
                    { ServiceAccount: "", ServiceAccountFound: false,
                      HasGaps: false, Permissions: [] }
```

---

### 2. `AccessResponse` (Go — `internal/api/types/response.go`)

No structural changes. The `serviceAccount` field will now be `""` when not found
(previously was always `"kro-system/kro"` minimum). The frontend handles this
by checking `serviceAccount === ""`.

```go
type AccessResponse struct {
    ServiceAccount      string          `json:"serviceAccount"`       // "" when not found
    ServiceAccountFound bool            `json:"serviceAccountFound"`  // false when not found
    ClusterRole         string          `json:"clusterRole"`          // unchanged
    HasGaps             bool            `json:"hasGaps"`              // false when SA not found
    Permissions         []GVRPermission `json:"permissions"`          // [] when SA not found
}
```

---

### 3. Handler query parameters — `GET /api/v1/rgds/{name}/access`

New optional query parameters (not modeled as struct — read via `r.URL.Query()`):

| Param | Type | Description |
|-------|------|-------------|
| `saNamespace` | `string` | Override namespace for kro's SA (optional) |
| `saName` | `string` | Override name for kro's SA (optional) |

**Logic**:
- If both `saNamespace` and `saName` are non-empty after `strings.TrimSpace`:
  → Use override values directly, skip `ResolveKroServiceAccount`
  → Set `ServiceAccountFound = true` (user-provided, assumed to be correct)
- Otherwise: call `ResolveKroServiceAccount` as before

---

### 4. Frontend state — `AccessTab` component

New state fields added to the `AccessTab` component:

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `manualNS` | `string` | `""` | User-typed namespace in override form |
| `manualSAName` | `string` | `""` | User-typed SA name in override form |
| `overrideSource` | `"auto" \| "manual" \| null` | `null` | Detection source for display |

**State machine**:

```
fetch /api/v1/rgds/{name}/access
  → { serviceAccountFound: true }
       → Show permission matrix
       → overrideSource = "auto"
  → { serviceAccountFound: false, serviceAccount: "" }
       → Show manual input form
       → overrideSource = null
  → user submits manual form with ns + name
       → fetch /api/v1/rgds/{name}/access?saNamespace=ns&saName=name
       → overrideSource = "manual"
  → error (network, 503)
       → Show error state + Retry button (existing behavior)
```

---

### 5. Validation rules

**Backend** (`access.go`):
- `saNamespace` and `saName` query params: if one is provided without the other,
  treat as if neither was provided (fall back to auto-detect). This avoids partial
  state confusion.

**Frontend** (`AccessTab.tsx`):
- Submit button disabled unless both `manualNS` and `manualSAName` are non-empty
  after `trim()`.
- Input fields trim whitespace before sending query params.

---

## Summary of changes by file

| File | Type of change | What changes |
|------|---------------|-------------|
| `internal/k8s/rbac.go` | Behavior | `ResolveKroServiceAccount` returns `("","",false)` not `("kro-system","kro",false)` |
| `internal/k8s/rbac.go` | Logic | `ComputeAccessResult` early-returns when `saNS==""` |
| `internal/api/handlers/access.go` | Feature | Read `saNamespace`+`saName` query params; skip auto-detect when provided |
| `internal/api/types/response.go` | None | No changes needed |
| `web/src/components/AccessTab.tsx` | Feature + UX | Manual form when `serviceAccount==""`, labeled banner, detection source |
| `web/src/components/AccessTab.css` | Style | New tokens-only CSS for manual form |
| `internal/k8s/rbac_test.go` | Test | New case: no deployment found → `("","",false)` |
| `web/src/components/AccessTab.test.tsx` | Test | New cases: manual form, banner format, override flow |
