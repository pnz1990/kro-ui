# kro-ui — AI Agent Context

## What This Is

A standalone read-only web dashboard for [kro](https://kro.run)
(`kubernetes-sigs/kro`). Cluster-first, connects via kubeconfig.
Out-of-tree, out for donation to kro org when stable.

**Stack**: Go 1.25 backend (chi, zerolog, client-go dynamic client) +
React 19 / Vite / TypeScript frontend, embedded via `go:embed`. Single binary.
Port 40107 (D=4, A=01, G=07 → DAG).

---

## Development workflow

This project uses **spec-driven development** with spec-kit.

### PR workflow (required)

All changes go through PRs. Direct push to `main` is blocked.

1. Work on a spec branch in its worktree (see Worktrunk below)
2. Push the branch: `git push -u origin <branch>`
3. Open a PR: `gh pr create --base main --head <branch>`
4. CI must pass (see CI pipeline below)
5. 1 approving review required (CODEOWNERS auto-assigns @pnz1990)
6. Squash merge only (configured at repo level)
7. Branch is auto-deleted on merge

### Spec inventory (delivery order)

| Spec | GH Issue | What | Status |
|------|----------|------|--------|
| `000-design-system` | #10 | Color palette, typography, spacing, motion tokens | Merged |
| `001-server-core` | #1 | Binary, CLI, healthz, embed, ClientFactory, contexts API | Merged (PR #12) |
| `001b-rgd-api` | #2 | GET /rgds, GET /rgds/{name}, GET /rgds/{name}/instances | Merged (PR #32) |
| `001c-instance-api` | #3 | Instance detail, events, children, raw resource, metrics stub | Merged (PR #33) |
| `002-rgd-list-home` | #4 | Home page RGD card grid | Merged (PR #35) |
| `006-cel-highlighter` | #8 | Pure TS kro CEL/schema tokenizer | Merged (PR #34) |
| `008-feature-flags` | #11 | kro capabilities API, feature gate system | Merged (PR #36) |
| `003-rgd-detail-dag` | #5 | DAG visualization, node inspection, YAML tab | Merged (PR #38) |
| `007-context-switcher` | #9 | Runtime kubeconfig context switching | Merged (PR #37) |
| `004-instance-list` | #6 | Instance table with namespace filter | Merged (PR #46) |
| `015-rgd-catalog` | #17 | Searchable RGD registry with filtering and chaining detection | Merged (PR #47) |
| `005-instance-detail-live` | #7 | Live DAG with 5s polling, node YAML | Merged (PR #48) |
| `011-collection-explorer` | #14 | forEach collection drill-down and health badges | Merged (PR #49) |
| `017-rgd-validation-linting` | #18 | Surface RGD validation conditions in the UI | Merged (PR #50) |
| `018-rbac-visualizer` | #19 | Permission gap detection for RGD managed resources | Merged (PR #51) |
| `019-smart-event-stream` | #20 | Filtered, grouped, anomaly-detecting event view | Merged (PR #53) |
| `014-multi-cluster-overview` | #16 | Fleet view across kubeconfig contexts | Merged (PR #52) |
| `012-rgd-chaining-deep-graph` | #15 | Recursive expansion of chained RGD instances | Merged (PR #54) |
| `020-schema-doc-generator` | #21 | Auto-generated API docs from RGD schema | Merged (PR #55) |
| `026-rgd-yaml-generator` | — | RGD YAML generator — instance form, batch mode, YAML preview | Merged (PR #144) |
| `home-search-dag-tooltip` | #77 | Home search filter + DAG node hover tooltip | Merged (PR #77) |
| `023-rgd-optimization-advisor` | #78 | forEach collapse suggestions in catalog | Merged (PR #78) |
| `022-controller-metrics-panel` | #79 | kro controller metrics panel | Merged (PR #79) |
| `024-rgd-list-virtualization` | #80 | RGD list virtualization for 5,000+ RGDs | Merged (PR #80) |
| `021-collection-node-cardinality` | #81 | forEach cardinality badge and expression on DAG nodes | Merged (PR #81) |
| `025-rgd-static-chain-graph` | #82 | RGD static chaining graph — detect, expand, navigate | Merged (PR #82) |
| `021-readywhen-cel-dag` | #83 | Surface readyWhen CEL expressions on DAG nodes | Merged (PR #83) |
| `009-rgd-graph-diff` | #13 | RGD graph revision diff | Blocked (needs kro KREP-013) |
| `027-instance-telemetry-panel` | — | Per-instance telemetry panel (age, state, children health) | Merged (PR #134) |
| `030-error-patterns-tab` | — | Cross-instance error aggregation — Errors tab on RGD detail | Merged (PR #135) |
| `028-instance-health-rollup` | — | Instance health roll-up — 5-state badges, error count on cards | Merged (PR #136) |
| `029-dag-instance-overlay` | — | Instance-contextual RGD DAG — overlay active/excluded nodes | Merged (PR #137) |
| `035-global-footer` | #127 | Global footer with kro.run and GitHub links | Merged (PR #138) |
| `033-first-time-onboarding` | #120 | First-time onboarding — footer, tagline, rich empty state, version API | Merged (PR #139) |
| `031-deletion-debugger` | — | Instance deletion debugger — Terminating banner, finalizers, events | Merged (PR #142) |
| `032-rbac-sa-autodetect` | #115 | RBAC SA auto-detection — replace hardcoded kro/kro with runtime discovery | Merged (PR #141) |
| `036-rgd-detail-header` | #130 | RGD detail page header — Kind badge and status dot on all tabs | Merged (PR #140) |
| `034-generate-form-polish` | #121 | Generate tab form polish — required field indicator, aria-required | Merged (PR #144) |
| `037-ia-home-catalog-merge` | #163 | Home/Catalog IA — rename Home to Overview, add subtitles | Merged (PR #179) |
| `038-live-dag-per-node-state` | #166 | Live DAG per-node state — pending state, per-child conditions, tooltip wiring | Merged (PR #180) |
| `039-rgd-authoring-entrypoint` | #162 | Global `/author` route and `+ New RGD` top bar entrypoint | Merged (PR #181) |
| `040-per-context-controller-metrics` | #174 | Per-context controller metrics via pod-proxy discovery | Merged (PR #182) |
| `041-error-states-ux-audit` | #187 | Error states UX audit — translateApiError, enriched empty states, symbol legends | Merged (PR #208) |
| `042-rgd-designer-nav` | #196 | RGD Designer — promote /author to nav, remove New RGD mode, add live DAG preview | Merged (PR #206) |
| `fix/issue-183` | #183 | Static DAG overlay svgHeight — use graph.height directly, SVG display:block | Merged (PR #209) |
| `fix/issue-210` | #210 | Live YAML resolve child resource by kro.run/node-id label | Merged (PR #211) |
| `043-upstream-fixture-generator` | #222 | Upstream fixture generator — cmd/dump-fixtures, full kro feature coverage, contagious includeWhen fix | Merged (PR #224) |

### Worktrunk (required workflow)

Each spec gets its own **worktree** (not just a branch). Never use
`git checkout -b` directly — always use worktrunk:

```bash
wt switch --create 001-server-core    # creates worktree + branch + runs hooks
wt list                               # shows all worktrees and their paths
wt switch 001-server-core             # switch to existing worktree
wt merge main                         # squash merge when done
```

The worktree is created as a sibling directory (e.g., `../kro-ui.001-server-core/`).
All work for that spec happens inside its worktree directory.

**Spec-kit integration**: The `/speckit.*` commands detect the current branch
name automatically. They work from any worktree — the branch name maps to the
spec directory in `.specify/specs/`. The `create-new-feature.sh` script uses
`wt switch --create --no-cd` when worktrunk is installed, with a fallback to
`git checkout -b` when it is not.

Hooks (defined in `.config/wt.toml`):
- `post-create`: installs Go + frontend + e2e deps
- `post-start`: copies node_modules/web/dist caches (avoids cold start)
- `pre-commit`: `go vet` + TypeScript typecheck
- `pre-merge`: `go test -race` + `go build`
- `list.url`: `http://localhost:{hash_port}` per worktree

---

## Go module quirk

`proxy.golang.org` is blocked in this environment. All `go` commands that
download modules MUST use:

```bash
GOPROXY=direct GONOSUMDB="*" go ...
```

The Makefile `go` and `tidy` targets already set this. Use `make go` and
`make tidy` rather than running `go` directly.

---

## Key architectural decisions

### Backend (Go)

- **Dynamic client everywhere**: `k8s.io/client-go/dynamic` for all kro
  resources. No typed clients. This is what makes the UI survive kro API changes.
- **Discovery-based pluralization**: `discovery.ServerResourcesForGroupVersion`
  before any naive `kind + "s"` fallback.
- **`ClientFactory`**: holds dynamic + discovery clients, `sync.RWMutex`-protected,
  supports runtime `SwitchContext`.
- **kro field paths isolated**: only `internal/k8s/rgd.go` knows about
  `spec.schema.kind`, `spec.resources[].id`, etc.
- **Upstream kro only**: `specPatch`/`stateFields` are fork-only concepts that
  do NOT exist in `kubernetes-sigs/kro`. Never add them.
- **Performance budget**: every handler must respond in ≤5s. Discovery results
  must be cached (≥30s). Fan-out list operations use `errgroup` with 2s per-resource
  timeout. **Never** call `ServerGroupsAndResources()` per-request without caching.
  **Never** loop sequentially over all API resource types — this will hang on
  large clusters (EKS with many controllers routinely has 200+ resource types).
- **No hardcoded config**: never hardcode service account names, ClusterRole names,
  namespace names, or label key values. Derive them from the cluster or expose
  them as configurable with documented defaults.

### Frontend (TypeScript/React)

- **No CSS frameworks**: Tailwind, Bootstrap, MUI are prohibited. Use
  `web/src/tokens.css` CSS custom properties only.
- **No state management libraries**: plain React state + hooks.
- **No external highlighters**: the kro CEL/schema highlighter is a custom pure
  TS tokenizer in `web/src/lib/highlighter.ts`.
- **Feature flags via `useCapabilities()`**: spec `008-feature-flags` defines
  how features are gated on what the connected kro cluster actually supports.
- **Page titles**: every page MUST update `document.title`. Format: `<content> — kro-ui`.
- **404 route**: `path="*"` catch-all rendering `NotFound` is REQUIRED in the router.
- **Cards are fully clickable**: every resource card's entire body navigates to
  the primary view. Small text links inside cards as the only navigation target
  is a UX violation.
- **Graceful degradation**: absent data (conditions, kinds, fields) renders as
  "not reported" / raw value — never as `?`, `undefined`, `null`, or an error state.
  A `?` kind label on a DAG node is always a bug.

### Known anti-patterns (DO NOT repeat)

These were discovered in production QA. Every one produced a GitHub issue.

| Anti-pattern | Issue | Correct approach |
|---|---|---|
| `ServerGroupsAndResources()` per-request to find child resources | #57 (75s response) | Cache discovery; use label-selector on known GVRs only |
| Rendering absent `status.conditions` entries as "Pending" | #59 | Show "Not reported" for absent expected conditions |
| Mixing schema constraints into the `default` field of `ParsedType` | #60 | Parse `enum=`, `min=`, `max=` as separate named fields |
| Checking `default !== undefined` where `default=0`/`false`/`""` are falsy | #61 | Use `'default' in parsedType` (key existence), not `!== undefined` |
| DAG nodes returning `?` for unresolvable kind | #58 | Fall back to raw `kind` string, then `nodeId` — never `?` |
| Fully ARN context names truncated to ambiguous suffix | #63 | Show account ID fragment + cluster name |
| SVG viewBox not fitted to content after layout | #64 | Measure bounding box after Dagre runs; set height accordingly |
| Resource cards with only small text links as navigation | #65 | Wrap entire card in `<Link>` |
| Filter UI that only works via URL params (no input fields) | #66 | Provide actual input controls; URL params are a bonus |
| Hardcoded `rgba()` / hex in component CSS (e.g. `box-shadow`) | #77 review | Define a named token in `tokens.css` (`--shadow-tooltip`, etc.) and reference via `var()` |
| Portal tooltip without viewport boundary clamping | #77 review | Measure bounding box with `getBoundingClientRect()` in `useEffect`; flip left/top when tooltip overflows right or bottom edge. Apply to ALL portal tooltip components |
| Duplicating `nodeTypeLabel` / `tokenClass` across component files | #77 review | Define once in `@/lib/dag.ts` (or appropriate `@/lib/` module) and import — never copy-paste graph helpers |

### Upstream kro node types (5 real types, from `pkg/graph/node.go`)

| NodeType | kro-ui label | Condition |
|----------|-------------|-----------|
| `NodeTypeInstance` | Root CR | ID = `schema` |
| `NodeTypeResource` | Managed resource | has `template`, no `forEach` |
| `NodeTypeCollection` | forEach fan-out | has `template` + `forEach` |
| `NodeTypeExternal` | External ref | `externalRef.metadata.name` set |
| `NodeTypeExternalCollection` | External ref collection | `externalRef.metadata.selector` set |

`includeWhen` is a **modifier** on any node type, not a separate type.

---

## Code standards (mirrors kubernetes-sigs/kro)

- Every `.go` file: Apache 2.0 copyright header
- Error wrapping: `fmt.Errorf("context: %w", err)`
- Logging: zerolog via `zerolog.Ctx(ctx)` with structured fields
- Tests: table-driven `build`/`check` pattern, `testify/assert` + `require`,
  `go test -race` always
- Commits: Conventional Commits `type(scope): message`
- No `util.go`, no `helpers.go`, no `common.go`

---

## E2E tests

Kind cluster, hermetic, fully automated:
```bash
make test-e2e-install   # one-time: install Playwright + Chromium
make test-e2e           # full run (creates kind cluster, runs tests, teardown)
SKIP_KIND_DELETE=true make test-e2e  # keep cluster for iteration
```

Fixtures: `test/e2e/fixtures/` — `test-app` RGD (WebApp kind, 3 resources)
Journeys: `test/e2e/journeys/001-*.spec.ts` through `008-*.spec.ts`

---

## CI pipeline

All workflows live in `.github/workflows/`. They run on push to `main` and on
PRs targeting `main`.

### CI (`ci.yml`) — 3 parallel jobs

| Job | What | Blocks merge? |
|-----|------|---------------|
| `build` | `go vet` → `go test -race` → `go build` → `bun typecheck` | Yes |
| `govulncheck` | Go vulnerability scanner. Warns on stdlib-only findings; fails on third-party dependency vulns | Yes |
| `trivy` | Builds Docker image, scans with Trivy for CRITICAL/HIGH CVEs, uploads SARIF to GitHub Security tab | Yes |

**Environment**: All Go steps inherit `GOPROXY=direct GONOSUMDB="*"` set at
workflow level (proxy.golang.org is blocked).

### CodeQL (`codeql.yml`)

- Languages: Go + JavaScript/TypeScript
- Triggers: PRs, push to main, weekly schedule (Monday 06:00 UTC)
- Queries: `security-extended` (broader than default)
- Required status check: `analyze (go)` and `analyze (javascript-typescript)`

### E2E (`e2e.yml`)

- Full Playwright journey suite against a kind cluster
- Installs kro via Helm, applies test fixtures, starts kro-ui binary
- 20-minute timeout
- Uploads Playwright report + traces as artifacts on failure
- **Required status check** — blocks merge on failure

### Release (`release.yml`)

- Triggers on `v*` tags
- Builds + pushes Docker image to `ghcr.io/pnz1990/kro-ui`
- Runs goreleaser for binary releases

---

## Security controls

### Branch protection on `main`

- PRs required — no direct push
- 1 approving review required
- CODEOWNERS review required (auto-assigned)
- Stale reviews dismissed on new push
- Required status checks: `build`, `govulncheck`, `Analyze (go)`, `Analyze (javascript-typescript)`, `e2e`
- Branch must be up to date before merge (strict mode)
- Linear history enforced
- Force push and branch deletion blocked
- Enforced for admins

### Dependency management

- **Dependabot** (`.github/dependabot.yml`): weekly scans for Go modules, npm
  (web + e2e), and GitHub Actions. Automated security fix PRs enabled.
- **Vulnerability alerts**: enabled at repo level

### Scanning

| Scanner | What | Where |
|---------|------|-------|
| CodeQL | Static analysis (SAST) for Go + JS/TS | Every PR + weekly |
| govulncheck | Known Go CVEs in deps and stdlib | Every PR |
| Trivy | Container image CVEs (CRITICAL/HIGH) | Every PR, SARIF → Security tab |
| Dependabot | Dependency version + security alerts | Weekly, auto-PR on findings |

### Repo settings

- Squash merge only (no merge commits, no rebase merge)
- Branches auto-deleted on merge
- `SECURITY.md` documents responsible disclosure via GitHub Security Advisories
- `CODEOWNERS` (`.github/CODEOWNERS`) auto-requests review from @pnz1990

---

## Repo layout

```
cmd/kro-ui/               # main.go — calls internal/cmd
internal/
  cmd/root.go             # cobra: serve, version
  server/server.go        # HTTP server, chi routes, SPA fallback
  api/handlers/           # Route handlers (one file per resource group)
  api/types/response.go   # Shared API response types
  k8s/                    # Dynamic client, discovery, rgd field extraction
  version/version.go      # ldflags version vars
web/
  embed.go                # go:embed all:dist — frontend FS
  dist/index.html         # Stub (overwritten by bun build)
  src/tokens.css          # ALL color/typography/spacing tokens (single source of truth)
  src/main.tsx            # React entry point
  src/pages/              # Home, RGDDetail, InstanceDetail
  src/components/         # DAGGraph, KroCodeBlock, NodeDetailPanel, ...
  src/lib/                # api.ts, dag.ts, highlighter.ts, features.ts
  src/hooks/              # usePolling.ts, useCapabilities.ts
.github/
  workflows/ci.yml        # Build + test + govulncheck + Trivy
  workflows/codeql.yml    # CodeQL SAST (Go + JS/TS)
  workflows/e2e.yml       # Playwright E2E against kind cluster
  workflows/release.yml   # Docker + goreleaser on v* tags
  dependabot.yml          # Dependency scanning (Go, npm, Actions)
  CODEOWNERS              # Auto-review assignment
.specify/
  memory/constitution.md  # NON-NEGOTIABLE rules
  specs/                  # 000-design-system through 008-feature-flags
test/e2e/                 # Playwright journeys + kind cluster infra
helm/kro-ui/              # Helm chart
Dockerfile                # multi-stage bun → go → distroless
SECURITY.md               # Responsible disclosure policy
.config/wt.toml           # worktrunk project hooks
Makefile                  # build, go, web, test-e2e, tidy targets
```

---

## Where to start

If no spec is in-progress: implement `001-server-core` first.
If a spec branch already exists: check `wt list` to see the current state.

To begin work on a spec, always create a worktree first:
```bash
wt switch --create 001-server-core   # from the main worktree
```
Then operate from the new worktree directory (shown by `wt list`).

### Before writing any code

These files MUST be read at the start of every session:

1. **Spec**: `.specify/specs/<NNN-feature-name>/spec.md` — requirements and
   acceptance criteria for the current feature
2. **Tasks**: `.specify/specs/<NNN-feature-name>/tasks.md` — ordered task
   checklist with phases and dependencies. Execute tasks in order, mark each
   `[x]` as completed. If no tasks.md exists, run `/speckit.tasks` first.
3. **Constitution**: `.specify/memory/constitution.md` — non-negotiable rules
   that override everything else
4. **Design system**: `.specify/specs/000-design-system/spec.md` — colors,
   typography, tokens (only needed for frontend work)

The current branch name tells you which spec to read. For example, branch
`001-server-core` maps to `.specify/specs/001-server-core/`.

Always read the spec before writing code. Always run `go vet ./...` and
`tsc --noEmit` before committing.


## Active Technologies
- Go 1.25 backend + TypeScript 5.x + React 19 + React Router v7 + Vite — no new npm or Go dependencies introduced since v0.2.1
- All state is local React `useState`; no persistence layer; no state management libraries
- Go 1.25 (backend) + TypeScript 5.x / Node (E2E setup script) + Playwright (E2E), kubectl, kind, helm (043-upstream-fixture-generator)
- N/A — no persistent storage (043-upstream-fixture-generator)
- TypeScript 5.x (frontend); Go 1.25 (backend — no changes needed) + React 19, Vite, plain CSS — no new npm or Go packages (045-rgd-designer-validation-optimizer)
- N/A — all state is local React `useState`; no persistence (045-rgd-designer-validation-optimizer)

## Recent Changes
- v0.4.3: upstream fixture generator (`cmd/dump-fixtures`, `make dump-fixtures`) covering all kro node types; contagious `includeWhen` BFS propagation fix in `dag.ts`; 6 new E2E journey files (43 total); `GetInstanceChildren` scoped to RGD resource types; spec-audit fixes (isItemReady isolation, FetchEffectiveRules deadline, extractInstanceHealth negation-polarity); demo/E2E setup hardened for kro v0.8.5 (non-fatal applies for v0.9.0+ fixtures); unit test coverage for InstanceDetail, Fleet, AuthorPage, NotFound, LiveDAG, format, collection
- v0.4.2: RGD Designer promoted to first-class nav (replaces `+ New RGD` button), live DAG preview on `/author`, error states UX audit (translateApiError, enriched empty states), static DAG overlay svgHeight fix (display:block + graph.height direct), Live YAML node resolution via kro.run/node-id label (fixes all RGDs where ID ≠ kind), cluster-scoped children fix + DeepDAG accordion + DAG panel layout
- v0.4.1: 9-issue bug-fix batch — breadcrumb rename (Overview), FieldTable scrollbar, OptimizationAdvisor layout, context-switch navigation, ValidationTab condition types (kro v0.4+), cluster-scoped Live YAML (Namespace/ClusterRole/PV), DAG tooltip hover persistence, DiscoverPlural discovery cache + Fleet errgroup fan-out + 5s server timeout, test coverage (access handler, 4 lib modules, 3 E2E journeys)
- v0.4.0: Overview/Catalog IA differentiation (Home renamed to Overview), live DAG per-node state with pending/per-child conditions + tooltip wiring, global `/author` RGD authoring entrypoint + `+ New RGD` top bar, per-context controller metrics via pod-proxy discovery (removes `--metrics-url`), Fleet per-cluster metrics column
- v0.3.4: negation-polarity condition fix (ReconciliationSuspended=False renders healthy), overlay node-mapping fix (all DAG nodes covered), Children denominator tooltip, condition inversion + schema defaults + catalog shimmer + home/fleet UX fixes, E2E journey backfill
- v0.3.3: cluster-wide child resource search (per-instance namespaces), parallel events fan-out with 2s timeout, DAG width fitted to node bounding boxes, null items guard for kro serialization edge cases, uniform card min-height
- v0.3.2: Docker image now includes aws CLI v2 for EKS exec credential plugin; mount `~/.aws` alongside `~/.kube/config`
- v0.3.1: DAG legend component, required-field a11y improvements, overlay crash fix, expand accordion fix, demo environment hardening (idempotent kind cluster, safe kubeconfig fallback, non-fatal CEL/collection waits)
- v0.3.0: instance telemetry panel, cross-instance error aggregation (Errors tab), instance health roll-up (5-state badges), DAG instance overlay, global footer, first-time onboarding + version API, deletion debugger, RBAC SA auto-detection, RGD detail header enrichment, 14 UX/bug fixes (catalog, fleet, events, schema parser, ARN disambiguation)
