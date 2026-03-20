# kro-ui

A read-only web dashboard for [kro](https://kro.run) — visualize ResourceGraphDefinitions, inspect live instances, and understand your resource graphs directly from the cluster.

> Unofficial. Out-of-tree. Built for velocity. Path to kro org adoption when stable.

## Features

- **RGD explorer** — list all ResourceGraphDefinitions, view their dependency DAGs
- **CEL/schema highlighting** — aligned with kro.run's custom highlighter
- **Live instance view** — 5s auto-refresh, spec/conditions/events, node YAML inspection
- **Context switcher** — switch kubeconfig contexts at runtime
- **Cluster-wide + namespace filter** — see everything or narrow by namespace
- **Dark/light theme** — dark default, aligned with kro.run palette

## Quickstart

### Local (Docker)

```bash
docker run -p 10174:10174 \
  -v ~/.kube/config:/root/.kube/config:ro \
  ghcr.io/pnz1990/kro-ui:latest
# open http://localhost:10174
```

### In-cluster (Helm)

```bash
helm install kro-ui oci://ghcr.io/pnz1990/helm-charts/kro-ui \
  --namespace kro-system --create-namespace

kubectl port-forward svc/kro-ui 10174:10174 -n kro-system
# open http://localhost:10174
```

## Development

**Requirements:** Go 1.25+, Bun 1.3+

```bash
# 1. Install frontend deps and build
make web

# 2. Start Go server (reads web/dist)
make run

# 3. In a separate terminal — frontend hot-reload with proxy to Go server
make dev-web
```

The Go server runs on `:10174`. The Vite dev server proxies `/api/*` to it.

## Architecture

```
cmd/kro-ui/         # Binary entrypoint (cobra)
internal/
  cmd/              # CLI commands (serve, version)
  server/           # HTTP server, go:embed frontend, routes
  api/handlers/     # Route handlers — thin layer over k8s package
  k8s/              # Dynamic client, discovery, context switching
  version/          # Build-time version info
web/
  src/
    components/     # DAGGraph, KroCodeBlock, ContextSwitcher, Layout, ...
    pages/          # Home, RGDDetail, InstanceDetail
    lib/api.ts      # Typed fetch client
    hooks/          # usePolling (5s refresh)
helm/kro-ui/        # Helm chart for in-cluster deployment
Dockerfile          # Multi-stage: bun → go → distroless (~15MB)
```

**Key design decisions:**
- All k8s access via the **dynamic client** — no hardcoded type assumptions, survives kro API changes
- **Discovery-based** resource resolution — new kro CRDs (e.g. GraphRevision) are picked up automatically
- Frontend is **embedded** in the Go binary via `go:embed` — single binary, no file server config

## Port

`10174` — letters k(10), r(17), o(14) with A=0.

## License

Apache 2.0
