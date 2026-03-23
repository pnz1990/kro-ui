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
  properties. No hardcoded hex values or `rgba()` literals anywhere in component
  code. This applies to `box-shadow`, `border`, `background`, and every other CSS
  property — if a color value is needed, it must first be defined as a named token
  in `tokens.css` and referenced via `var(--token-name)`.
- **Shadow tokens**: `box-shadow` values that contain color (e.g. `rgba(0,0,0,0.4)`)
  MUST be defined as named tokens in `tokens.css` (e.g. `--shadow-tooltip`,
  `--shadow-dropdown`) and referenced via `var()`. Never write `rgba()` inline in
  component CSS.
- **`color-mix()` in component CSS**: acceptable (wide browser support) but only
  if the resulting combination is also added as a named token in `tokens.css` first.
  Inline `color-mix()` that has no corresponding token is a nit, not a blocker.
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
- **Shared rendering helpers**: utility functions used across more than one
  component (e.g. `nodeTypeLabel`, `tokenClass`, node-type-to-string mappers)
  MUST be defined once in an appropriate shared module (`@/lib/dag.ts` for
  graph-related helpers, a dedicated `@/lib/` module otherwise) and imported
  where needed. Copy-pasting the same function into multiple component files is
  prohibited — divergence is guaranteed when new node types or token types are
  added upstream.

---

## X. Licensing and Attribution

- License: Apache 2.0 (same as `kubernetes-sigs/kro`)
- `LICENSE` file MUST be present in the repo root
- Every Go source file MUST have the Apache 2.0 copyright header (§VI)
- `CONTRIBUTING.md` MUST reference `kubernetes-sigs` contribution guidelines
  as a model

## XI. API Performance Budget (NON-NEGOTIABLE)

Every HTTP handler MUST respond within a bounded time on a healthy cluster.
Unbounded discovery loops are prohibited.

- **All API handlers: 5-second response budget** (enforced via context deadline)
- **Discovery operations** (`ServerGroupsAndResources`, `ServerResourcesForGroupVersion`)
  MUST be cached for ≥30 seconds. Never call discovery on every request.
- **Fan-out list operations** (listing across multiple resource types or namespaces)
  MUST use `errgroup` with a per-resource timeout of **2 seconds**. Any resource
  that exceeds the timeout is silently skipped — a partial result is better than
  a hung request.
- **No sequential API calls in a loop** — if N resources must be listed, list them
  concurrently, not one after another.
- Performance anti-patterns that are **prohibited**:
  - Calling `ServerGroupsAndResources()` per-request without a cache
  - Iterating over all API resources in the cluster to find child resources
    (`listChildResourcesByLabel` pattern with no parallelism and no timeout)
  - Any blocking call in a hot path with no deadline

---

## XII. Graceful Degradation for Unknown Data

The cluster is the source of truth, but it is not always complete. kro-ui must
**never crash or show an error state** when expected data is merely absent.

- **Unknown or absent `kind`**: render the raw `kind` string as-is; if `kind` is
  empty, render the `nodeId` instead. Never render `?`.
- **Absent `status.conditions`**: treat as an empty array. Do not fabricate
  condition entries for types the cluster did not emit. Show "Not reported" for
  expected-but-absent conditions — never "Pending" (which implies stuckness).
- **Absent condition fields** (`reason`, `message`, `lastTransitionTime`):
  omit the field entirely from the UI rather than rendering `undefined`, `null`,
  "N/A", or an empty cell.
- **Schema fields with unknown types or unparseable values**: render the raw
  string value rather than silently dropping the field.
- **API errors on secondary data** (events, children, fleet summaries): show
  a degraded state for that specific piece, not a full-page error. Other data
  on the page must continue to function.

---

## XIII. Frontend UX Standards

These rules apply to every frontend component and page.

### Page titles
Every page MUST update `document.title` to reflect the current content.
Format: `<specific content> — kro-ui`. The home page title is just `kro-ui`.
This is required for browser tab identification, history, and bookmarking.

### Route completeness
Every route must have a corresponding rendered component. A catch-all `path="*"`
route rendering a `NotFound` component is REQUIRED in the router. A blank page
on unknown routes is never acceptable.

### Interactive card elements
Any card or list item that represents a navigable resource (RGD, instance, etc.)
MUST be fully clickable — the entire card body navigates to the primary action
(the Graph tab for RGDs, the instance detail for instances). Secondary actions
(e.g., "Instances" link) may remain as explicit buttons within the card. Users
must never need to hunt for a small link inside a card to navigate.

### Data table standards
- Every sortable table MUST have visible sort indicators on column headers
- Default sort order MUST be documented in the spec (e.g., name A→Z, newest first)
- Tables with status/health data MUST default to "worst first" (errors before healthy)
- Empty state MUST be a distinct, readable message — not an empty container

### Navigation and wayfinding
- Pages deeper than 2 levels in the hierarchy (e.g., instance detail) MUST have
  a breadcrumb: `Home / <RGD name> / Instances / <instance name>`
- Each breadcrumb segment must be a link to that level
- Active page segment is not a link

### Tooltips on complex elements
- DAG nodes MUST show a tooltip on hover with: node ID, kind, node type, and
  any `includeWhen` CEL expression
- DAG tooltips MUST be rendered via `createPortal(…, document.body)` to avoid
  SVG clipping. The portal element MUST clamp its position within the viewport:
  measure the rendered bounding box with `getBoundingClientRect()` in a
  `useEffect` and flip left/top when the tooltip would overflow the right or
  bottom edge. This must be applied consistently to every tooltip component —
  not just the static DAG tooltip but also the live DAG tooltip and any future
  portal-based overlays.
- Truncated text (context names, ARNs, long labels) MUST show the full value
  in a `title` attribute or tooltip

### Context/cluster disambiguation
When displaying cluster or context names that may be ambiguous (full AWS ARNs,
multiple clusters with the same short name):
- The displayed label MUST include enough information to distinguish the context
  from others in the same kubeconfig (e.g., account ID + cluster name for EKS)
- The full context name MUST be accessible on hover

### Scale requirements
UI components must be designed for real-world scale:
- Home page and Catalog: must function correctly at 5,000+ RGDs (search/filter required, virtualized rendering — see spec `024-rgd-list-virtualization`)
- Fleet matrix: must function at 10+ clusters × 50+ RGD kinds (sticky headers, scroll)
- Instances table: must function at 500+ instances (virtual scroll or pagination)
- Events stream: already capped at 200 (maintained)

### No hardcoded configuration values
Do not hardcode Kubernetes resource names, service account names, ClusterRole names,
namespaces, or label keys that may vary between installations. Use data returned
from the API, or make the value configurable with a documented fallback.

---

## Governance

This constitution supersedes all other documentation when there is a conflict.
Amendments:
1. Update this file with the change and rationale
2. Bump the version number (MINOR for new principles, PATCH for clarifications)
3. Reference the amendment in the relevant spec or commit message

**Version**: 1.4.0 | **Ratified**: 2026-03-22 | **Last Amended**: 2026-03-22

**Amendment log**:
- 1.4.0 (2026-03-22): §XIII Scale requirements updated from 100+ to 5,000+ RGDs for Home page and Catalog; virtualized rendering (spec `024-rgd-list-virtualization`) is now the required strategy.
