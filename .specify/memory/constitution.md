# kro-ui Constitution

> This document governs all development decisions for kro-ui. It supersedes any
> conflicting guidance in individual specs or implementation plans. Amendments
> require explicit rationale documented in the relevant spec and a version bump
> to this file.
>
> kro-ui is intended for donation to `kubernetes-sigs`. Every standard here is
> chosen to be consistent with or stricter than the practices used in the
> [kro codebase](https://github.com/kubernetes-sigs/kro).

---

## I. Iterative-First (NON-NEGOTIABLE)

Build the smallest working thing, then expand. Every spec is independently
shippable. No spec, plan, or task may depend on code that has not yet been
merged. Each iteration leaves the binary in a runnable, deployable state.
Ship `001` before starting `002`. Ship `002` before starting `003`.

---

## II. Cluster Adaptability (NON-NEGOTIABLE)

kro is a rapidly evolving project. kro-ui must absorb new CRDs, fields, and
concepts with zero or minimal code changes.

- All cluster access MUST use `k8s.io/client-go/dynamic` — no typed clients
  for kro resources
- Resource kind resolution MUST use server-side discovery
  (`discovery.ServerResourcesForGroupVersion`) as the primary mechanism;
  naive pluralization is a last-resort fallback only
- No kro API field paths (e.g., `spec.resources[].id`) may be hardcoded outside
  of a single, isolated `internal/kro/` mapping package
- **Only upstream features** (`kubernetes-sigs/kro`) are enabled by default.
  Fork-only concepts (`specPatch`, `stateFields`) MUST NOT appear in any spec,
  component, or UI label.
- New upstream features (e.g., a future `GraphRevision` CRD) are detected
  automatically via the capabilities API (`GET /api/v1/kro/capabilities`) and
  slot into the UI without structural changes. See spec `008-feature-flags`.
- Alpha feature gates (`CELOmitFunction`, `InstanceConditionEvents`) are detected
  from the cluster and gate UI features accordingly. They are off by default.

---

## III. Read-Only (NON-NEGOTIABLE)

kro-ui is an observability tool. It MUST NOT issue any mutating Kubernetes API
call. Prohibited verbs: `create`, `update`, `patch`, `delete`, `apply`. The
Helm chart MUST enforce this at the RBAC level via a `ClusterRole` containing
only `get`, `list`, and `watch` verbs.

---

## IV. Single Binary Distribution

The Go binary MUST embed the compiled frontend via `go:embed`. No external
CDN, no runtime asset fetching, no separate static server. `./kro-ui serve`
is the only command required to run the full application. The binary MUST
work without any internet access after download.

---

## V. Simplicity Over Cleverness

Add a dependency only when the alternative is significantly more complex to
write correctly. Default to the standard library.

Prohibited on the backend:
- ORMs of any kind
- GraphQL
- Server-Sent Events or WebSockets (plain HTTP polling is sufficient)

Prohibited on the frontend:
- State management libraries (Redux, Zustand, Jotai, Recoil)
- CSS frameworks (Tailwind, Bootstrap, MUI, Chakra)
- Code highlighting libraries (highlight.js, Prism, shiki)
- Component libraries (shadcn, Radix UI, etc.)

Permitted:
- `github.com/go-chi/chi/v5` — HTTP routing
- `github.com/rs/cors` — CORS middleware
- `github.com/rs/zerolog` — structured logging (see §VIII)
- `github.com/spf13/cobra` — CLI
- React 19 + React Router v7 + Vite
- Plain CSS with CSS custom properties

---

## VI. Go Code Standards

These mirror the conventions used in `kubernetes-sigs/kro`.

### Error Handling

- Wrap with context: `fmt.Errorf("failed to list RGDs: %w", err)`
- Accumulate multiple errors: `errors.Join(err1, err2)`
- Use typed error structs with `Unwrap()` for categories that callers must
  distinguish (e.g., `clusterError`, `discoveryError`)
- Never silence errors. No `_ = someErr`.
- No `panic` in production code paths

### Logging

- Library: `github.com/rs/zerolog` via `zerolog.Ctx(ctx)` — structured,
  contextual, zero-allocation
- Levels: `log.Debug()` for operational detail, `log.Info()` for normal flow,
  `log.Error().Err(err).Msg(...)` at the call site that handles the error
- Always include structured fields: `.Str("rgd", name)`, `.Str("context", ctx)`,
  `.Int("port", port)`
- Logger is injected via `context.Context` (same pattern as `ctrl.LoggerFrom`)

### Package Structure

Mirrors the kro controller layout:

```
cmd/kro-ui/           # Binary entrypoint only — wires cobra, calls internal/
internal/
  server/
    server.go         # HTTP server setup, go:embed, routes
  api/
    handlers/
      handler.go      # Shared Handler struct, respond(), respondError()
      contexts.go     # ListContexts, SwitchContext handlers
      rgds.go         # ListRGDs, GetRGD, ListInstances handlers
      instances.go    # GetInstance, GetInstanceEvents, GetInstanceChildren handlers
      resources.go    # GetResource handler
    types/
      response.go     # Shared API response types
  k8s/
    client.go         # ClientFactory: dynamic + discovery clients, context switch
    rgd.go            # kro-specific field extraction helpers (the ONLY place that
                      # knows kro field paths)
    graph.go          # RGD → DAGGraph builder (port from open-krode)
    discover.go       # discoverPlural(), listChildResources()
  version/
    version.go        # Build-time version info (ldflags)
```

### File Naming

- `handler.go` — shared struct and helpers
- `<resource>.go` — handlers for a specific resource
- `<file>_test.go` — tests in the same package as the code under test
- No `util.go`, no `helpers.go`, no `common.go`

### Interface Definition

Define interfaces at the **consumption site**, not the implementation site.
Keep them small (1–3 methods). Do not create interfaces preemptively.

```go
// In internal/api/handlers/rgds.go
type rgdLister interface {
    ListRGDs(ctx context.Context) ([]unstructured.Unstructured, error)
    GetRGD(ctx context.Context, name string) (*unstructured.Unstructured, error)
}
```

### Copyright Header

Every `.go` file MUST begin with:

```go
// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
```

---

## VII. Testing Standards

These mirror the test conventions in `kubernetes-sigs/kro`.

### Unit Tests

- Location: `<file>_test.go` in the **same package** as the code under test
  (white-box, `package handlers` not `package handlers_test`)
- Framework: standard `testing` package + `github.com/stretchr/testify/assert`
  (non-fatal) + `github.com/stretchr/testify/require` (fatal)
- All test helpers MUST call `t.Helper()`
- Use `t.Cleanup()` for teardown, not `defer` in test bodies
- Table-driven tests MUST use a `build` func + `check` func structure per case
  (same pattern as kro's controller tests)
- Stubs are written by hand as unexported structs — no mockery, no gomock
- Run with `-race` always: `go test -race -v ./...`

### Integration Tests

- Use `sigs.k8s.io/controller-runtime/pkg/envtest` for tests that need a real
  API server
- Located in `test/integration/` using Ginkgo suites
- Not required for v0.1.0 — add when the k8s client layer is complex enough
  to warrant it

### Frontend Tests

- Unit tests for pure functions (tokenizer, DAG layout) via Vitest
- No snapshot tests, no visual regression tests at this stage
- Test files: `*.test.ts` alongside the source file

### Coverage

No hard coverage threshold in CI for v0.1.0. Coverage is tracked via
`go test -coverprofile` and reported but not gated.

---

## VIII. Commit and Branch Conventions

Following `kubernetes-sigs/kro`:

### Commit Messages — Conventional Commits

```
type(scope): short summary in imperative mood, ≤72 chars

Optional body: explain WHY the change is needed, not WHAT.
Reference specs: "Implements spec 001-go-api-server FR-004."
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`
Scopes: `api`, `k8s`, `server`, `dag`, `highlighter`, `helm`, `web`, `spec`

Examples:
```
feat(k8s): add ClientFactory with runtime context switching
feat(api): implement RGD list and get endpoints
fix(k8s): use discovery for plural resolution instead of naive +s
docs(spec): add kro development standards to constitution
chore(helm): add read-only ClusterRole for in-cluster deployment
test(api): add table-driven unit tests for context handler
```

### Branch Naming

```
NNN-short-description        # maps to spec number
001-go-api-server
002-rgd-list-home
```

### Design Proposals

Significant architectural decisions MUST be documented as a proposal under
`docs/design/proposals/NNN-title.md` before implementation. Format follows
kro's KREP structure:
- Problem statement
- Proposal / overview
- Design details
- Alternatives considered
- Testing strategy

---

## IX. Theme and UI Standards

The design system is fully specified in `.specify/specs/000-design-system/spec.md`.
That spec is the authoritative source — this section is a summary only.

**Key rules:**

- **Color tokens**: all colors are defined in `web/src/tokens.css` as CSS custom
  properties. No hardcoded hex values anywhere in component code.
- **Primary**: `#5b8ef0` (dark) / `#3b6fd4` (light) — refined from kro.run for
  higher contrast in interactive UI contexts
- **Semantic colors**: `--color-alive` (emerald), `--color-reconciling` (amber),
  `--color-pending` (violet), `--color-error` (rose), `--color-not-found` (gray).
  Each must only be used for its defined semantic purpose per the design spec
  usage guide.
- **Dark mode**: default. Light mode via `data-theme="light"` on `<html>`.
- **Fonts**: Inter + JetBrains Mono via Google Fonts in `index.html`. Falls back
  to system stack; binary works fully offline.
- **CEL highlighter**: 8 token types. Token hex values are defined in spec 006
  and `tokens.css`. No external highlighting library.
- **Accessibility**: WCAG AA minimum for all text and interactive elements.
  Semantic state colors MUST be paired with shape/icon/text — never color alone.
- **No CSS frameworks**: Tailwind, Bootstrap, MUI are prohibited. Plain CSS
  using `tokens.css` custom properties only.

---

## X. Licensing and Attribution

- License: Apache 2.0 (same as `kubernetes-sigs/kro`)
- `LICENSE` file MUST be present in the repo root
- Every Go source file MUST have the Apache 2.0 copyright header (§VI)
- `CONTRIBUTING.md` MUST reference `kubernetes-sigs` contribution guidelines
  as a model

---

## Governance

This constitution supersedes all other documentation when there is a conflict.
Amendments:
1. Update this file with the change and rationale
2. Bump the version number (MINOR for new principles, PATCH for clarifications)
3. Reference the amendment in the relevant spec or commit message

**Version**: 1.1.0 | **Ratified**: 2026-03-20 | **Last Amended**: 2026-03-20
