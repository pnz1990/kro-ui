<p align="center">
  <img src="logo.png" alt="kro-ui" width="160" />
</p>

# kro-ui

[![CI](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/pnz1990/kro-ui)](https://github.com/pnz1990/kro-ui/releases)

A read-only web dashboard for [kro](https://kro.run) — visualize ResourceGraphDefinitions, inspect live instances, explore your resource graphs, and understand RBAC gaps directly from the cluster.

> Unofficial. Out-of-tree. Built for velocity. Path to kro org adoption when stable.

## Features

- **Home page** — RGD card grid with status dots, kind badges, resource count, age, and chaining indicators
- **RGD catalog** — searchable, filterable registry of all RGDs with chaining detection and per-RGD instance counts
- **RGD detail** — six tabs: Graph · Instances · YAML · Validation · Access · Docs
  - **Graph tab** — interactive DAG showing all managed resources, forEach collections, external refs, and `includeWhen` conditions with live state colors
  - **Instances tab** — table of all CR instances with namespace filter, readiness badges, and links to live detail
  - **YAML tab** — syntax-highlighted RGD manifest with CEL expression highlighting and copy-to-clipboard
  - **Validation tab** — RGD condition checklist (GraphVerified, CRD synced, Topology ready) with resource type summary and CEL cross-reference map
  - **Access tab** — RBAC permission matrix for kro's service account against all managed resources, with kubectl fix suggestions
  - **Docs tab** — auto-generated API documentation from the RGD schema: field types, defaults, CEL status expressions, and a copyable example manifest
- **Live instance detail** — live DAG with 5s polling, per-node state colors (alive/reconciling/error), node YAML inspection, spec/conditions/events panels
  - **forEach collection explorer** — drill into collection fan-outs with per-item health badges, status table, and individual resource YAML
  - **Deep graph** — recursively expand chained RGD instances up to 4 levels deep, revealing the full composed resource tree
- **Events** — kro-filtered Kubernetes event stream with anomaly detection (stuck reconciliation, error bursts), grouping by instance, and URL-param pre-filtering
- **Fleet overview** — multi-cluster view across all kubeconfig contexts: health status, RGD/instance counts, cross-cluster RGD presence matrix
- **Context switcher** — switch kubeconfig contexts at runtime without restart
- **CEL/schema highlighting** — custom pure-TS tokenizer for kro YAML (CEL expressions, kro keywords, SimpleSchema types)
- **Capabilities detection** — auto-detects kro features via cluster introspection, gates UI accordingly
- **Dark/light theme** — dark default, full design token system

## Quickstart

### Binary

```bash
# Build from source
make build
./bin/kro-ui serve

# With flags
./bin/kro-ui serve --port 9000 --kubeconfig ~/.kube/config --context staging
```

Download pre-built binaries from [Releases](https://github.com/pnz1990/kro-ui/releases).

### Docker

```bash
docker run -p 40107:40107 \
  -v ~/.kube/config:/home/nonroot/.kube/config:ro \
  ghcr.io/pnz1990/kro-ui:latest
# open http://localhost:40107
```

### In-cluster (Helm)

```bash
helm install kro-ui ./helm/kro-ui \
  --namespace kro-system --create-namespace

kubectl port-forward svc/kro-ui 40107:40107 -n kro-system
# open http://localhost:40107
```

## API

All endpoints are read-only. No mutating k8s API calls are ever issued.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/healthz` | GET | Health check (no cluster I/O) |
| `/api/v1/contexts` | GET | List kubeconfig contexts + active |
| `/api/v1/contexts/switch` | POST | Switch active context |
| `/api/v1/rgds` | GET | List all RGDs |
| `/api/v1/rgds/{name}` | GET | Get single RGD |
| `/api/v1/rgds/{name}/instances` | GET | List instances of an RGD |
| `/api/v1/rgds/{name}/access` | GET | RBAC permission check for kro's service account |
| `/api/v1/instances/{ns}/{name}` | GET | Get instance detail |
| `/api/v1/instances/{ns}/{name}/events` | GET | Instance events |
| `/api/v1/instances/{ns}/{name}/children` | GET | Instance child resources |
| `/api/v1/resources/{ns}/{group}/{ver}/{kind}/{name}` | GET | Raw resource YAML |
| `/api/v1/kro/capabilities` | GET | Detected kro capabilities and feature gates |
| `/api/v1/events` | GET | kro-filtered Kubernetes events (`?namespace=`, `?rgd=`) |
| `/api/v1/fleet/summary` | GET | Multi-cluster summary across all kubeconfig contexts |

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

The Go server runs on `:40107`. The Vite dev server proxies `/api/*` to it.

**Note:** `proxy.golang.org` is blocked in this environment. The Makefile
handles this automatically. If running `go` commands directly, use:
```bash
GOPROXY=direct GONOSUMDB="*" go ...
```

## Testing

```bash
# Go unit tests (with race detector)
GOPROXY=direct GONOSUMDB="*" go test -race ./...

# Frontend unit tests
cd web && bun run test

# TypeScript strict mode check
cd web && bun run typecheck

# E2E tests (requires kind, helm, kubectl)
make test-e2e-install   # one-time: install Playwright + Chromium
make test-e2e           # full run (creates kind cluster, runs tests, teardown)
```

E2E tests auto-detect the latest kro release and install it via Helm from
`registry.k8s.io/kro/charts/kro`. Override with `KRO_CHART_VERSION=0.8.5`.

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
  k8s/              # Dynamic client, discovery, RBAC, fleet helpers
  version/          # Build-time version info (set via ldflags)
web/
  embed.go          # go:embed frontend FS
  src/
    components/     # 40+ components: DAGGraph, LiveDAG, DeepDAG, KroCodeBlock, ...
    pages/          # Home, Catalog, Fleet, RGDDetail, InstanceDetail, Events
    lib/            # api.ts, dag.ts, highlighter.ts, schema.ts, events.ts, ...
    hooks/          # usePolling (5s refresh), useCapabilities
helm/kro-ui/        # Helm chart for in-cluster deployment
test/e2e/           # Playwright E2E journeys + kind cluster infra
Dockerfile          # Multi-stage: bun → go → distroless (~15MB)
```

**Key design decisions:**
- All k8s access via the **dynamic client** — no hardcoded type assumptions, survives kro API changes
- **Discovery-based** resource resolution — new kro CRDs are picked up automatically
- Frontend is **embedded** in the Go binary via `go:embed` — single binary, no file server config
- **Read-only** — never issues mutating k8s API calls; Helm RBAC enforces `get`/`list`/`watch` only
- **No CSS frameworks, no component libraries, no state management libraries** — plain CSS with design tokens, plain React state

## Port

`40107` — letters D(4), A(01), G(07) → DAG.

## License

Apache 2.0
