# kro-ui — AI Agent Context

## What This Is

A standalone read-only web dashboard for [kro](https://kro.run)
(`kubernetes-sigs/kro`). Cluster-first, connects via kubeconfig.
Out-of-tree, out for donation to kro org when stable.

**Stack**: Go 1.25 backend (chi, zerolog, client-go dynamic client) +
React 19 / Vite / TypeScript frontend, embedded via `go:embed`. Single binary.
Port 10174 (k=10, r=17, o=14 with A=0).

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

| Spec | GH Issue | What | Unblocks |
|------|----------|------|---------|
| `001-server-core` | #1 | Binary, CLI, healthz, embed, ClientFactory, contexts API | everything |
| `001b-rgd-api` | #2 | GET /rgds, GET /rgds/{name}, GET /rgds/{name}/instances | #4, #5 |
| `001c-instance-api` | #3 | Instance detail, events, children, raw resource, metrics stub | #6, #7 |
| `002-rgd-list-home` | #4 | Home page RGD card grid | — |
| `003-rgd-detail-dag` | #5 | DAG visualization, node inspection, YAML tab | — |
| `004-instance-list` | #6 | Instance table with namespace filter | — |
| `005-instance-detail-live` | #7 | Live DAG with 5s polling, node YAML | — |
| `006-cel-highlighter` | #8 | Pure TS kro CEL/schema tokenizer | #5, #7 |
| `007-context-switcher` | #9 | Runtime kubeconfig context switching | — |
| `008-feature-flags` | #11 | kro capabilities API, feature gate system | — |

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

### Frontend (TypeScript/React)

- **No CSS frameworks**: Tailwind, Bootstrap, MUI are prohibited. Use
  `web/src/tokens.css` CSS custom properties only.
- **No state management libraries**: plain React state + hooks.
- **No external highlighters**: the kro CEL/schema highlighter is a custom pure
  TS tokenizer in `web/src/lib/highlighter.ts`.
- **Feature flags via `useCapabilities()`**: spec `008-feature-flags` defines
  how features are gated on what the connected kro cluster actually supports.

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
- **Not a required status check** — informational, may be promoted later

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
- Required status checks: `build`, `govulncheck`, `analyze (go)`, `analyze (javascript-typescript)`
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
