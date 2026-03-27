# Quickstart: kro v0.9.0 Upgrade Development Guide

**Branch**: `046-kro-v090-upgrade`

---

## Setup

This branch is already in a worktree at `../kro-ui.046-kro-v090-upgrade/`.
kro v0.9.0 is already pinned in `go.mod`.

```bash
# Verify kro module version
go list -m github.com/kubernetes-sigs/kro
# → github.com/kubernetes-sigs/kro v0.9.0

# Build
make go

# TypeScript typecheck
cd web && bun run typecheck

# Run Go tests
make test   # or: GOPROXY=direct GONOSUMDB="*" go test -race ./...
```

---

## Key Files to Modify

### Backend

| File | What to change |
|------|---------------|
| `internal/k8s/capabilities.go` | Add `HasGraphRevisions` to `SchemaCapabilities`; add `internal.kro.run/v1alpha1` probe in `DetectCapabilities`; update `Baseline()` |
| `internal/k8s/capabilities_test.go` | Add `TestDetectsGraphRevisions`, `TestBaselineHasExternalRefSelectorTrue`, `TestBaselineHasGraphRevisionsFalse` |
| `internal/k8s/client.go` | Add `graphRevisionGVR` constant |
| `internal/api/handlers/graph_revisions.go` | **NEW** — `ListGraphRevisions` and `GetGraphRevision` handlers |
| `internal/api/handlers/graph_revisions_test.go` | **NEW** — unit tests |
| `internal/server/server.go` | Register 2 new routes |

### Frontend

| File | What to change |
|------|---------------|
| `web/src/lib/api.ts` | Add `hasGraphRevisions` to `KroCapabilities.schema`; add `listGraphRevisions`, `getGraphRevision` |
| `web/src/lib/features.ts` | Update BASELINE: `hasExternalRefSelector: true`, `hasGraphRevisions: false` |
| `web/src/lib/features.test.ts` | Add baseline assertions for new/changed fields |
| `web/src/lib/highlighter.test.ts` | Add regression test for CEL comprehension macros |
| `web/src/tokens.css` | Add `--badge-cluster-bg`, `--badge-cluster-fg` tokens |
| `web/src/components/RGDCard.tsx` | Show "Cluster" scope badge |
| `web/src/components/RGDCard.css` | `.rgd-scope-badge` class |
| `web/src/components/RGDDetailHeader.tsx` (or equivalent) | Scope badge + `lastIssuedRevision` chip |
| `web/src/components/DocsTab.tsx` | Render `types` section |
| `web/src/components/DocsTab.test.tsx` | Add types section unit tests |
| `web/src/components/RGDAuthoringForm.tsx` | "Add iterator" button for cartesian forEach |

---

## Adding the GraphRevision Handler

### Step 1: GVR constant in client.go

```go
// internal/k8s/client.go
// Add alongside existing GVR constants:
var graphRevisionGVR = schema.GroupVersionResource{
    Group:    "internal.kro.run",
    Version:  "v1alpha1",
    Resource: "graphrevisions",
}
```

### Step 2: New handler file

```go
// internal/api/handlers/graph_revisions.go
// Copyright 2026 The Kubernetes Authors. ...
// ListGraphRevisions handles GET /api/v1/kro/graph-revisions?rgd=<name>
// GetGraphRevision handles GET /api/v1/kro/graph-revisions/{name}
```

Follow the exact same pattern as `internal/api/handlers/rgds.go`:
- Get clients from `h.factory.Clients()`
- Use `dyn.Resource(graphRevisionGVR)`
- Use `respondError` / `respond` helpers
- Wrap with 5-second context deadline

### Step 3: Field selector filter

```go
// When listing by RGD name, use field selector:
listOpts := metav1.ListOptions{
    FieldSelector: "spec.snapshot.name=" + rgdName,
}
list, err := dyn.Resource(graphRevisionGVR).List(ctx, listOpts)
```

If the CRD doesn't exist, the dynamic client returns a "no matches for kind" error.
Catch this and return `{items: []}`.

### Step 4: Sort by spec.revision descending

After listing, sort items client-side:
```go
sort.Slice(list.Items, func(i, j int) bool {
    ri := revisionNum(list.Items[i])
    rj := revisionNum(list.Items[j])
    return ri > rj  // descending
})
```

---

## Adding the Scope Badge

### tokens.css

```css
--badge-cluster-bg: color-mix(in srgb, var(--color-pending) 15%, transparent);
--badge-cluster-fg: var(--color-pending);
```

### RGDCard.tsx

```tsx
const scope = nestedGet(rgd, 'spec', 'schema', 'scope') as string | undefined
// ...
{scope === 'Cluster' && (
  <span className="rgd-scope-badge" aria-label="Cluster-scoped resource">
    Cluster
  </span>
)}
```

### RGDCard.css

```css
.rgd-scope-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  background: var(--badge-cluster-bg);
  color: var(--badge-cluster-fg);
}
```

---

## Adding the Types Section to DocsTab

```tsx
// DocsTab.tsx — after existing Spec section
const rawTypes = nestedGet(rgd, 'spec', 'schema', 'types') as Record<string,string> | null
const hasTypesData = caps.schema.hasTypes && rawTypes && typeof rawTypes === 'object'

{hasTypesData && (
  <section>
    <h2>Types</h2>
    {Object.entries(rawTypes).map(([typeName, typeSchema]) => (
      <div key={typeName}>
        <h3>{typeName}</h3>
        <FieldTable fields={parseSchema(typeSchema)} />
      </div>
    ))}
  </section>
)}
```

---

## Running the E2E Journeys

The relevant E2E journeys are non-fatal (use `test.skip` when fixture not ready):
- `043-cluster-scoped.spec.ts` — validates scope badge (Step 1–3)
- `043-cartesian-foreach.spec.ts` — validates multi-dimension forEach
- `043-cel-comprehensions.spec.ts` — validates CEL comprehension rendering

```bash
# Run E2E for specific journeys (with existing cluster):
SKIP_KIND_DELETE=true make test-e2e
```

---

## Verification Checklist

Before opening a PR:

```bash
make go                                    # Go build passes
GOPROXY=direct GONOSUMDB="*" go test -race ./...  # All Go tests pass
cd web && bun run typecheck               # TS typecheck passes
cd web && bun test                        # Frontend unit tests pass
go vet ./...                              # No vet issues
```
