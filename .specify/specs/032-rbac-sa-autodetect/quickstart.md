# Quickstart: Implementing 032-rbac-sa-autodetect

## What this feature does

Fixes two bugs in the RBAC Access tab:
1. Removes the hardcoded `("kro-system", "kro")` fallback in `ResolveKroServiceAccount`
2. Updates the Access tab to show a manual SA override form when auto-detection fails,
   and displays the SA in a human-readable labeled format

## File map

```
internal/k8s/rbac.go           — backend: SA detection, ComputeAccessResult
internal/api/handlers/access.go — backend: HTTP handler, query params
web/src/components/AccessTab.tsx — frontend: component
web/src/components/AccessTab.css — frontend: styles
internal/k8s/rbac_test.go      — backend tests
web/src/components/AccessTab.test.tsx — frontend tests
```

## Step 1 — Backend: Remove hardcoded fallback

**File**: `internal/k8s/rbac.go`

Change `ResolveKroServiceAccount` return path when no Deployment is found (line 103-104):

```go
// BEFORE
log.Debug().Msg("could not detect kro service account; falling back to kro-system/kro")
return "kro-system", "kro", false

// AFTER
log.Debug().Msg("could not detect kro service account; no fallback")
return "", "", false
```

Add early-return in `ComputeAccessResult` when `saNS == ""`:

```go
// After ResolveKroServiceAccount call:
if saNS == "" {
    return &AccessResult{
        ServiceAccount:      "",
        ServiceAccountFound: false,
        HasGaps:             false,
        Permissions:         []ResourcePermission{},
    }, nil
}
```

## Step 2 — Backend: Handler query params

**File**: `internal/api/handlers/access.go`

Add query param reading before the auto-detect call:

```go
saNamespace := strings.TrimSpace(r.URL.Query().Get("saNamespace"))
saName := strings.TrimSpace(r.URL.Query().Get("saName"))

var saNS, saNameStr string
var saFound bool
if saNamespace != "" && saName != "" {
    // Manual override — treat as found
    saNS, saNameStr, saFound = saNamespace, saName, true
} else {
    // Auto-detect from cluster
    saNS, saNameStr, saFound = k8sclient.ResolveKroServiceAccount(r.Context(), h.factory)
}
// Pass saNS, saNameStr to ComputeAccessResult (via new signature or inline)
```

Note: `ComputeAccessResult` needs to accept the pre-resolved SA to avoid calling
`ResolveKroServiceAccount` again internally. Refactor: accept `saNS, saName string, saFound bool`
as parameters (or split into a new `ComputeAccessResultForSA` helper).

## Step 3 — Frontend: Manual form

**File**: `web/src/components/AccessTab.tsx`

When `data.serviceAccountFound === false && data.serviceAccount === ""`:

```tsx
// Show manual override form
<div className="access-tab-sa-override-form">
  <p>Could not auto-detect kro's service account.</p>
  <label>
    Namespace
    <input value={manualNS} onChange={e => setManualNS(e.target.value)} />
  </label>
  <label>
    Service account name
    <input value={manualSAName} onChange={e => setManualSAName(e.target.value)} />
  </label>
  <button disabled={!manualNS.trim() || !manualSAName.trim()} onClick={handleManualSubmit}>
    Check permissions
  </button>
</div>
```

`handleManualSubmit` calls `getRGDAccess(rgdName, { saNamespace: manualNS.trim(), saName: manualSAName.trim() })`.

## Step 4 — Frontend: Labeled SA banner

**File**: `web/src/components/AccessTab.tsx`

Replace the raw slash format:

```tsx
// BEFORE
<span>Checking kro service account:</span> <code>{data.serviceAccount}</code>

// AFTER — parse namespace/name from serviceAccount string
const [saNamespace, saSAName] = data.serviceAccount.split("/", 2)
<span>Namespace:</span> <code>{saNamespace}</code>
<span className="access-tab-sa-sep">·</span>
<span>Service account:</span> <code>{saSAName ?? data.serviceAccount}</code>
<span className="access-tab-sa-source">
  {overrideSource === "manual" ? "(manually specified)" : "(auto-detected)"}
</span>
```

## Step 5 — Update `api.ts`

**File**: `web/src/lib/api.ts`

Update `getRGDAccess` signature:

```typescript
export async function getRGDAccess(
  name: string,
  opts?: { saNamespace?: string; saName?: string }
): Promise<AccessResponse> {
  const params = new URLSearchParams()
  if (opts?.saNamespace) params.set("saNamespace", opts.saNamespace)
  if (opts?.saName) params.set("saName", opts.saName)
  const query = params.toString() ? `?${params}` : ""
  const res = await fetch(`/api/v1/rgds/${name}/access${query}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

## Step 6 — Tests

**Backend** (`rbac_test.go`): Add test case in `TestResolveKroServiceAccount`:
- Name: `"no matching deployment found returns empty strings"`
- Setup: empty dynamic client (no deployments in `kro-system` or `kro`)
- Check: `ns == ""`, `name == ""`, `found == false`

**Frontend** (`AccessTab.test.tsx`):
- `"shows manual override form when serviceAccount is empty and not found"`
- `"re-fetches with saNamespace and saName on manual form submit"`
- `"shows (auto-detected) badge when serviceAccountFound is true"`
- `"shows (manually specified) badge after manual form submit"`
- `"shows labeled namespace and SA name, not raw slash"`

## Verification

```bash
# Backend
GOPROXY=direct GONOSUMDB="*" go test -race ./internal/k8s/... ./internal/api/...

# Frontend typecheck
cd web && bun run typecheck

# Frontend unit tests
cd web && bun run test
```
