# kro-ui

[![CI](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml)

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

### Binary

```bash
# Build from source
make build
./bin/kro-ui serve

# With flags
./bin/kro-ui serve --port 9000 --kubeconfig ~/.kube/config --context staging
```

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

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/healthz` | GET | Health check (no cluster I/O) |
| `/api/v1/contexts` | GET | List kubeconfig contexts + active |
| `/api/v1/contexts/switch` | POST | Switch active context |
| `/api/v1/rgds` | GET | List all RGDs |
| `/api/v1/rgds/{name}` | GET | Get single RGD |
| `/api/v1/rgds/{name}/instances` | GET | List instances of an RGD |
| `/api/v1/instances/{ns}/{name}` | GET | Get instance detail |
| `/api/v1/instances/{ns}/{name}/events` | GET | Instance events |
| `/api/v1/instances/{ns}/{name}/children` | GET | Instance child resources |

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

**Note:** `proxy.golang.org` is blocked in this environment. The Makefile
handles this automatically. If running `go` commands directly, use:
```bash
GOPROXY=direct GONOSUMDB="*" go ...
```

## Testing

```bash
# Unit tests (with race detector)
GOPROXY=direct GONOSUMDB="*" go test -race ./...

# E2E tests (requires kind, helm, kubectl)
make test-e2e-install   # one-time: install Playwright + Chromium
make test-e2e           # full run (creates kind cluster, runs tests, teardown)
```

## CI & Security

All PRs run through these checks before merge:

| Check | What |
|-------|------|
| **build** | `go vet` → `go test -race` → `go build` → `bun typecheck` |
| **govulncheck** | Go vulnerability scanner (fails on third-party dep vulns) |
| **trivy** | Docker image scan for CRITICAL/HIGH CVEs |
| **CodeQL** | Static analysis for Go + JS/TS (security-extended queries) |
| **Dependabot** | Weekly dependency scans for Go, npm, and GitHub Actions |

Branch protection enforces: 1 approving review, all required checks green,
CODEOWNERS review, linear history, no force push.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Architecture

```
cmd/kro-ui/         # Binary entrypoint (cobra)
internal/
  cmd/              # CLI commands (serve, version)
  server/           # HTTP server, chi router, SPA fallback
  api/handlers/     # Route handlers — thin layer over k8s package
  api/types/        # Shared API response types
  k8s/              # Dynamic client, discovery, context switching
  version/          # Build-time version info
web/
  embed.go          # go:embed frontend FS
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
- **Read-only** — never issues mutating k8s API calls; Helm RBAC enforces `get`/`list`/`watch` only

## Port

`10174` — letters k(10), r(17), o(14) with A=0.

## License

Apache 2.0
