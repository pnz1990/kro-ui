# Quickstart: RGD List — Home Page

**Spec**: `002-rgd-list-home`
**Date**: 2026-03-20

---

## Prerequisites

- Go 1.25+ installed
- bun installed (package manager for frontend)
- A kubeconfig with access to a cluster running kro (or kind for local dev)

---

## Development Workflow

### 1. Start the Go backend

From the repo root:

```bash
make run
```

This starts the Go server on port 40107 with SPA serving and all API routes.
The server needs a valid kubeconfig to connect to a cluster.

### 2. Start the Vite dev server

In a second terminal:

```bash
cd web && bun run dev
```

Vite starts on `http://localhost:5173` with hot module replacement. API calls
to `/api/*` are proxied to `http://localhost:40107` (configured in
`vite.config.ts`).

### 3. Open the dashboard

Navigate to `http://localhost:5173` in a browser. You should see the home page
with RGD cards (if the connected cluster has RGDs) or the empty state.

---

## Running Tests

### Frontend unit tests

```bash
cd web && bun run test         # run once (CI mode)
cd web && bun run test:watch   # watch mode (development)
```

Or from the repo root:

```bash
make test-web
```

### Go backend tests

```bash
make go-test
```

Or directly:

```bash
GOPROXY=direct GONOSUMDB="*" go test -race -v ./...
```

### TypeScript type checking

```bash
cd web && bun run typecheck
```

Or from the repo root:

```bash
make typecheck
```

---

## Key Files for This Feature

| File | What it does |
|------|-------------|
| `web/src/pages/Home.tsx` | Main page: fetches RGDs, renders card grid |
| `web/src/pages/Home.css` | Home page styles (grid layout, states) |
| `web/src/components/Layout.tsx` | Shared layout: TopBar + `<Outlet />` |
| `web/src/components/TopBar.tsx` | Context name display in header |
| `web/src/components/RGDCard.tsx` | Single RGD summary card |
| `web/src/components/StatusDot.tsx` | Colored status indicator |
| `web/src/components/SkeletonCard.tsx` | Loading placeholder card |
| `web/src/lib/format.ts` | Age formatting, status extraction, field helpers |
| `web/src/tokens.css` | CSS design tokens (already exists, read-only) |
| `web/src/lib/api.ts` | API client (already exists, read-only) |

---

## Verifying the Implementation

### Manual verification

1. **With RGDs in cluster**: Cards should show with name, kind, resource count,
   age, and green/red/gray status dot
2. **Empty cluster**: Empty state message with link to kro.run/docs
3. **Server down**: Error state with "Retry" button
4. **Context name**: Visible in the top bar, matching
   `kubectl config current-context`
5. **Navigation**: Click "Graph" → `/rgds/:name`; Click "Instances" →
   `/rgds/:name?tab=instances`; Browser Back → home page at same position

### Automated verification

```bash
# TypeScript strict mode
cd web && bun run typecheck  # expect 0 errors

# Unit tests
cd web && bun run test       # all tests pass

# E2E (requires kind cluster)
make test-e2e                # full journey passes
```

---

## Using a Local Kind Cluster

If you don't have a cluster with kro:

```bash
# Create kind cluster
kind create cluster --name kro-test

# Install kro via Helm
helm install kro oci://ghcr.io/kro-run/kro/chart \
  --namespace kro-system --create-namespace

# Wait for kro to be ready
kubectl wait --for=condition=Available deployment/kro-controller-manager \
  -n kro-system --timeout=120s

# Apply test fixture
kubectl apply -f test/e2e/fixtures/test-app-rgd.yaml

# Start kro-ui
make run
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "connection refused" in browser | Start the Go backend: `make run` |
| Cards show but all have gray status dots | RGDs may not have conditions yet; wait for kro to reconcile |
| Empty page (white screen) | Check browser console for JS errors; ensure `Layout.tsx` renders `<Outlet />` |
| "Cannot find module '@/lib/api'" | Run `bun install` in `web/` |
| Vite proxy 502 | Go backend is not running on port 40107 |
