# Quickstart: 040-Per-Context Controller Metrics

## Prerequisites

- Go 1.25, `bun` (for frontend), `make`
- A kubeconfig with at least one context pointing to a cluster with kro installed
- The GOPROXY workaround is already set in the Makefile (`GOPROXY=direct GONOSUMDB="*"`)

---

## Running the new code

```bash
# Build and start (no --metrics-url flag any more)
make build
./kro-ui serve --kubeconfig ~/.kube/config --context my-cluster

# The MetricsStrip on the Home page will now show data from "my-cluster"
# Switch context via the UI and MetricsStrip will show data from the new cluster
# within the next 30s poll.

# Test graceful degradation (cluster without kro):
./kro-ui serve --kubeconfig ~/.kube/config --context no-kro-cluster
# MetricsStrip shows "Not reported" — 200 OK with null fields
```

---

## Key tests

```bash
# Unit tests (Go)
make go CMD="test -race -v ./internal/k8s/... ./internal/api/handlers/..."

# TypeScript typecheck
make web CMD="run typecheck"

# Full test suite
make go CMD="test -race ./..."
```

---

## Testing the ?context= endpoint manually

```bash
# Scrape active context
curl http://localhost:40107/api/v1/kro/metrics | jq .

# Scrape a specific context
curl "http://localhost:40107/api/v1/kro/metrics?context=kind-kro-ui-demo" | jq .

# Unknown context — should return 404
curl -i "http://localhost:40107/api/v1/kro/metrics?context=nonexistent"
```

---

## Verifying the Helm RBAC change

```bash
helm template ./helm/kro-ui | grep -A5 "pods/proxy"
# Expected output:
# - apiGroups: [""]
#   resources: ["pods/proxy"]
#   verbs: ["get"]
```

---

## Breaking change notice

The `--metrics-url` flag has been removed. Any startup script or Helm value
that passes `--metrics-url` will now fail with:

```
Error: unknown flag: --metrics-url
```

**Action required**: Remove `--metrics-url` from any startup commands or Helm
`extraArgs` values. No replacement flag is needed — pod discovery is automatic.

---

## Architecture summary

```
GET /api/v1/kro/metrics[?context=<name>]
        │
        ▼
  Handler.GetMetrics
        │
        ├── contextName="" → use ClientFactory.ActiveContext()
        │
        └── contextName="foo" → BuildContextClient("foo")  [ephemeral, same as fleet]
                │
                ▼
        MetricsDiscoverer.ScrapeMetrics(ctx, contextName)
                │
                ├── PodRefCache.get(contextName)  ──hit──→ scrapeViaProxy(podRef)
                │                                                    │
                │                                              proxy 404? → invalidate cache
                │                                                    │        └─ re-discover once
                └── cache miss → discoverKroPod(contextName)
                                        │
                                  pod found → PodRefCache.set → scrapeViaProxy
                                        │
                                  not found → return ControllerMetrics{all nil}
                                               (200 OK)
```
