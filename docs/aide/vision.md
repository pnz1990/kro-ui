# kro-ui: Vision

> Created: 2026-04-14
> Status: Active

## What This Is

kro-ui is a standalone read-only web dashboard for [kro](https://kro.run) (`kubernetes-sigs/kro`).
It connects to a Kubernetes cluster via kubeconfig, reads kro's CRDs (ResourceGraphDefinitions,
Instances, GraphRevisions), and presents a rich visual interface: DAG graphs, health states,
fleet views, event streams, and policy authoring. Single Go binary, frontend embedded via
`go:embed`. No external database, no internet access required at runtime. Port 40107.

It is designed for donation to the `kubernetes-sigs` org when stable. Every standard is
chosen to be consistent with or stricter than the practices used in the kro codebase.

## Key Design Constraints

1. **Read-only**: no mutating Kubernetes API calls. Ever. The RBAC ClusterRole contains only `get`, `list`, `watch`.
2. **Dynamic client everywhere**: all kro resource access uses `k8s.io/client-go/dynamic`. No typed clients for kro resources. This is what makes the UI survive kro API changes without code changes.
3. **Single binary**: `go:embed` all frontend assets. `./kro-ui serve` is the only command needed.
4. **No CSS frameworks, no state management libraries**: plain CSS with `tokens.css` custom properties, plain React `useState`. Constitution §V enforces this.
5. **Discovery-based**: resource kind resolution uses server-side discovery, not hardcoded strings. No kro API field paths outside `internal/k8s/rgd.go`.

## Current Status

v0.9.4 — mature, production-capable. 70+ features merged across 430+ PRs. kro v0.9.1 support.
Pending work: remaining open GitHub issues, E2E journey improvements, and kro upstream features
as they land (new CRDs, GraphRevision hash, CEL extensions).
