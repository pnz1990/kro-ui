


<img src="logo.png" alt="kro-ui" width="160" /> 

# kro-ui   

[![CI](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/pnz1990/kro-ui/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/pnz1990/kro-ui)](https://github.com/pnz1990/kro-ui/releases)

A read-only web dashboard for [kro](https://kro.run) — visualize ResourceGraphDefinitions, inspect live instances, explore your resource graphs, and understand RBAC gaps directly from the cluster.

> Unofficial. Out-of-tree. Built for velocity. Path to kro org adoption when stable.

## Features

- **Overview page** (`/`) — operational health dashboard: RGD card grid with status dots, kind badges, resource count, age, multi-segment health chips (✗/⚠/↻ counts per state), controller metrics strip, terminating badges, debounced search, error count badges, **compile-error banner** (count of RGDs with compile errors + one-click error-only filter), and **health filter chips** synced to `?health=` URL (shareable/bookmarkable filtered views); virtualized for 5,000+ RGDs; **SRE executive dashboard** — 7-widget single-cluster health view (fleet health summary, controller metrics, error patterns, reconciling count, degraded trends, event anomalies, top-failing RGDs) selectable via layout toggle
- **Catalog page** (`/catalog`) — browsable RGD directory with search, label filter, **compile-status filter (All/Ready/Errors)**, sort controls, per-RGD instance counts, "Used by" chaining rows, and forEach collapse suggestions (optimization advisor)
- **RGD static chaining graph** — detect and visualize chained RGD relationships; expand parent/child chains without a live cluster
- **RGD detail** — nine tabs: Graph · Instances · Errors · YAML · Validation · Access · Docs · Generate · Revisions; **stat strip** (Age / Resources / Instances / Latest revision) below the header mirrors the instance telemetry panel; DAG rendered in a surface card matching the instance detail layout
  - **Graph tab** — interactive DAG with all managed resources, forEach collections, external refs, and `includeWhen` conditions; `readyWhen` CEL expressions and `forEach` cardinality badges (warnings at ≥900 items, error at 1000) on hover; instance overlay selector to visualize which nodes are active for a specific CR; "refreshed X ago" indicator
  - **Instances tab** — table of all CR instances with namespace filter, 6-state health badges (Ready/Degraded/Reconciling/Pending/Error/Unknown), health filter chips (synced to URL), fully-clickable rows, **instance spec diff** (select 2 rows to compare field-by-field), and links to live detail
  - **Errors tab** — cross-instance error aggregation: failures grouped by resource node with affected instance count, percentage, most common error message, and drill-down; `IN_PROGRESS` instances with `Ready=False` (stuck reconciling) are surfaced as actionable errors; genuinely transitioning instances (active `Progressing=True` condition) are skipped
  - **YAML tab** — clean syntax-highlighted RGD manifest (managedFields, last-applied-configuration, resourceVersion, uid stripped) with CEL expression highlighting and copy-to-clipboard
  - **Validation tab** — RGD condition checklist (GraphVerified, CRD synced, Topology ready) with resource type summary and CEL cross-reference map
  - **Access tab** — RBAC permission matrix for kro's auto-detected service account (runtime-discovered from the kro controller Deployment) against all managed resources, with kubectl fix suggestions and manual SA override form
  - **Docs tab** — auto-generated API documentation from the RGD schema: field types, defaults, CEL status expressions, custom type definitions (kro v0.9.0+ `spec.schema.types`), required fields sorted first with a summary banner, and a copyable example manifest
  - **Generate tab** — two-mode YAML generator: interactive instance form (per-field controls with type coercion, `{}` defaults for map/object fields) and batch mode (one line = one manifest); link to RGD Designer for new RGD authoring
  - **Revisions tab** (kro v0.9.0+) — GraphRevision history: revision number, compiled status (Compiled/Failed), age, compilation error; click to expand YAML
- **Live instance detail** — live DAG with 5s polling, **6-state** per-node colors (alive/reconciling/degraded/error/pending/not-found), node YAML inspection (clean — no managedFields), spec/conditions/events/telemetry panels
  - **Per-child node state** — each child resource is judged on its *own* `status.conditions`, not the CR-level reconciling state; a Namespace or ConfigMap created in wave 1 shows green even while a downstream RDS instance is still provisioning
  - `Available=True` wins over `Progressing=True` — a Deployment serving traffic during a rolling update shows green, not amber; amber only shows when `Progressing=True` without `Available=True` (not yet serving)
  - External refs (`externalRef`) show green while the CR is `IN_PROGRESS` — the ref was already resolved in an earlier wave; only shows grey when the CR has a hard failure
  - **Degraded state** — shown when the CR is Ready=True but a child resource has `Available=False` (distinct orange from amber reconciling)
  - Per-node state derived from each child resource's own `status.conditions` via `kro.run/node-id` label (not kind) — kube-generated resources (EndpointSlice etc.) are silently skipped
  - `IN_PROGRESS` kro state maps to Reconciling (amber) at the CR level — shown when readyWhen is unmet but kro is still working; escalates to a banner with human-readable duration (e.g. "2d 16h") and actionable hint after 5 minutes
  - **Reconcile-paused banner** — shown when `kro.run/reconcile: disabled` annotation is present (kro v0.9.0+)
  - **Stuck finalizer escalation** — when deletion is blocked by finalizers for ≥5 minutes, shows the exact `kubectl patch` command to force-remove them
  - Hover tooltip shows live state label with per-state explanatory hint for every node
  - **Refresh now** button (↻) — triggers immediate re-poll instead of waiting for the next 5s cycle
  - **Copy instance YAML** button (⎘) — copies full instance YAML to clipboard
  - **Telemetry panel** — per-instance age, state duration, child resource health table, and reconcile health indicators
  - **Deletion debugger** — when an instance has a `deletionTimestamp`, surfaces a Terminating banner showing elapsed time, active finalizers (with controller ownership), blocking child resources, and deletion-related events
  - **forEach collection explorer** — drill into collection fan-outs with per-item health badges, cardinality badge (`N/M`; stateless resources like ConfigMap correctly count as healthy), and individual resource YAML (clean display)
  - **Deep graph** — recursively expand chained RGD instances up to 4 levels deep, revealing the full composed resource tree
- **Instance health roll-up** — 6-state health badges (Ready/Degraded/Reconciling/Pending/Error/Unknown) on all instance list rows and RGD cards; multi-segment health bar on cards showing counts per state
- **Instance spec diff** — select any 2 instances in the Instances tab to compare their spec fields side-by-side; differing fields highlighted; identical fields collapsible
- **Global /instances page** (`/instances`) — cross-RGD flat instance table with search, namespace dropdown, 6-state health filter chips (URL-synced), health-priority sort (reconciling/error first), and status message tooltip on dots
- **RGD Designer** (`/author`) — first-class nav section alongside Overview/Catalog/Fleet/Events; full kro feature coverage: all 5 node types (Managed resource, forEach collection, External ref, External ref collection, Root CR), `includeWhen` conditions, `readyWhen` CEL (with `omit()` help for kro v0.9.0+), schema field editor with type/default/enum/min/max; live DAG preview (updates within 300ms, client-side only); Home and Catalog empty states link directly to it
- **Events** — kro-filtered Kubernetes event stream with anomaly detection (stuck reconciliation, error bursts), **condition-transition events** (kro v0.9.0+ `HasInstanceConditionEvents`) with distinct green visual, deletion event tagging, grouping by instance, and URL-param pre-filtering
- **Fleet overview** — multi-cluster view across all kubeconfig contexts: health status, RGD/instance counts (degraded + reconciling shown separately), cross-cluster RGD presence matrix with abbreviated ARN context labels, per-cluster kro version (read from instance labels), and per-cluster kro controller metrics column
- **Controller metrics panel** — kro controller metrics auto-discovered via pod proxy (zero configuration); per-context correct after context switch; powers Fleet metrics column via `?context=` fan-out
- **Context switcher** — switch kubeconfig contexts at runtime without restart; subtitle shown for all abbreviated context names (EKS ARNs, long names)
- **CEL/schema highlighting** — custom pure-TS tokenizer for kro YAML (CEL expressions, kro keywords, SimpleSchema types, JSON Schema object/array/map types rendered correctly)
- **Capabilities detection** — auto-detects kro features via cluster introspection, gates UI accordingly; kro v0.9.0+ features: `GraphRevision` API (Revisions tab), cluster-scoped RGD badges, collection limit badges, condition-transition events, `omit()` CEL function; multi-version kro support with version warning banner
- **First-time onboarding** — Overview page tagline, descriptive empty state with getting-started kubectl snippets, global footer with kro.run and GitHub links, and live version display
- **Dark/light theme** — dark default, full design token system, SVG favicon

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

> **Pinned to the latest release** — update this tag on every new release.

```bash
docker run -p 40107:40107 \
  -v ~/.kube/config:/home/nonroot/.kube/config:ro \
  ghcr.io/pnz1990/kro-ui:v0.9.2
# open http://localhost:40107
```

**EKS clusters** use the `aws` exec credential plugin. Mount your AWS config and
set the profile:

```bash
docker run -p 40107:40107 \
  -v ~/.kube/config:/home/nonroot/.kube/config:ro \
  -v ~/.aws:/home/nonroot/.aws:ro \
  -e AWS_PROFILE=<your-aws-profile> \
  ghcr.io/pnz1990/kro-ui:v0.9.2
# open http://localhost:40107
```

**Controller metrics** are now auto-discovered via pod proxy — no `--metrics-url` flag required. kro-ui finds the kro controller pod automatically using label selectors and proxies through the kube-apiserver.

### In-cluster (Helm)

> **Pinned to the latest release** — update this version on every new release.

```bash
helm upgrade --install kro-ui oci://ghcr.io/pnz1990/kro-ui/charts/kro-ui \
  --version 0.9.2 \
  --namespace kro-system --create-namespace

kubectl port-forward svc/kro-ui 40107:40107 -n kro-system
# open http://localhost:40107
```

## API

All endpoints are read-only. No mutating k8s API calls are ever issued.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/healthz` | GET | Health check (no cluster I/O) |
| `/api/v1/version` | GET | Build-time version info (version, commit, buildDate) |
| `/api/v1/contexts` | GET | List kubeconfig contexts + active |
| `/api/v1/contexts/switch` | POST | Switch active context |
| `/api/v1/rgds` | GET | List all RGDs |
| `/api/v1/rgds/{name}` | GET | Get single RGD |
| `/api/v1/rgds/{name}/instances` | GET | List instances of an RGD |
| `/api/v1/rgds/{name}/access` | GET | RBAC permission check for kro's service account (`?saNamespace=&saName=` for manual override) |
| `/api/v1/rgds/validate` | POST | Online RGD validation (cluster-connected condition check) |
| `/api/v1/rgds/validate/static` | POST | Offline static RGD analysis (no k8s API calls; GH #303) |
| `/api/v1/instances` | GET | List all instances across all RGDs (fan-out, `?health=` filter) |
| `/api/v1/instances/{ns}/{name}` | GET | Get instance detail |
| `/api/v1/instances/{ns}/{name}/events` | GET | Instance events |
| `/api/v1/instances/{ns}/{name}/children` | GET | Instance child resources |
| `/api/v1/resources/{ns}/{group}/{ver}/{kind}/{name}` | GET | Raw resource YAML |
| `/api/v1/kro/capabilities` | GET | Detected kro capabilities and feature gates |
| `/api/v1/kro/metrics` | GET | kro controller metrics auto-discovered via pod proxy; `?context=<name>` for per-cluster Fleet fan-out |
| `/api/v1/kro/graph-revisions` | GET | List GraphRevision objects for an RGD (`?rgd=<name>`); requires kro v0.9.0+, returns `{items:[]}` on older clusters |
| `/api/v1/kro/graph-revisions/{name}` | GET | Get a single GraphRevision by Kubernetes name; requires kro v0.9.0+ |
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
