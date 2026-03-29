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
| `009-rgd-graph-diff` | #13 | RGD graph revision diff | Unblocked (kro v0.9.0 ships GraphRevision CRD) |
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
| `044-rgd-designer-full-features` | #270 | RGD Designer full kro feature coverage — all 5 node types, includeWhen, readyWhen CEL, schema field editor | Merged (PR #144) |
| `045-rgd-designer-validation-optimizer` | — | RGD Designer YAML validation, editable YAML panel, expanded optimization advisor | Merged (PR #273) |
| `046-kro-v090-upgrade` | — | kro v0.9.0 upgrade — GraphRevision API, scope badge, DocsTab types, capabilities baseline update | Merged (PR #275) |
| `047-ux-improvements` | #276 | Degraded health state (6th state), multi-segment health bar, copy instance YAML button | Merged (PR #277) |
| `fix/node-id-state-map` | — | State map keyed by kro.run/node-id; IN_PROGRESS→reconciling; items:null→[]; EndpointSlice fix | Merged (PR #278) |
| `048-ui-polish-and-docs` | — | 26-gap UI polish: tooltips, legends, help text, abbr expansions, token fixes, AGENTS.md update | Merged (PR #279) |
| `049-designer-ux-refresh-button` | — | Refresh now button; Designer CEL/scope help text; optimizer docs URL fix | Merged (PR #280) |
| `050-kro-v090-phase2` | #274 | kro v0.9.0 phase 2 — reconcile-paused banner, cluster-scoped namespace display, displayNamespace utility | Merged (PR #281) |
| `fix/errortab-dedup-chip` | — | ErrorsTab unique-instance dedup in summary; OptimizationAdvisor emoji removed | Merged (PR #282) |
| `fix/schema-object-type` | — | DocsTab: JSON Schema object fields render as map/array type, not [object Object] | Merged (PR #283) |
| `fix/collection-item-ready` | — | isItemReady: stateless resources (ConfigMap etc.) are healthy by existence | Merged (PR #284) |
| `fix/extref-live-state` | — | External ref DAG nodes show alive/reconciling instead of not-found when CR is healthy | Merged (PR #285) |
| `fix/ux-polish-round2` | — | ErrorsTab skips IN_PROGRESS instances; CollectionPanel empty state shows forEach expr; stuck reconciliation escalation banner | Merged (PR #286) |
| `fix/finalizer-escalation` | #289 | Terminating banner shows kubectl patch command when finalizers block deletion > 5 minutes | Merged (PR #290) |
| `fix/yaml-clean-display` | — | YAML tab: strip managedFields, last-applied-configuration, resourceVersion, uid from displayed YAML | Merged (PR #291) |
| `fix/schema-object-type-generate` | — | GenerateTab: map/object fields initialize with {} not "" | Merged (PR #292) |
| `051-instance-diff` | #287 | Instance spec diff — select 2 instances and compare spec fields side-by-side | Merged (PR #293) |
| `fix/ux-polish-round2-continued` | — | TerminatingBanner unit tests; CollectionPanel escalation improvements | Merged (PR #294) |
| `fix/collection-legacy-remove` | — | CollectionPanel legacy kro < 0.8.0 warning removed; allChildrenLabelless dead code cleaned up | Merged (PR #295) |
| `fix/instances-inactive-rgd` | — | ListInstances returns empty list (not 500) for inactive RGDs; health chip now shows "no instances" | Merged (PR #296) |
| `fix/e2e-journey-backfill` | — | E2E journeys for PRs #277-#296: 047-ux-improvements, 047b-live-dag-state-map, updates to 028/031/011/002 + playwright chunk-7 | Merged (PR #297) |
| `fix/e2e-journey-syntax` | — | E2E syntax fixes: missing }), SPA HTTP-200 pitfall, locator.or() ambiguity, skeleton timeout | Merged (PR #310) |
| `docs/learned-lessons` | — | Constitution §XIV E2E standards; AGENTS anti-patterns +6 E2E rows; pdca-improvements CI failure guide | Merged (PR #311) |
| `fix/e2e-journey-syntax-fix2` | — | fixture-state.ts: lazy Proxy read per access (fixes fixture-state race causing 043 journeys to skip) | Merged (PR #312) |
| `fix/ux-polish-round2-continued` | #274 | omit() designer help text; collection limit badge (900/1000 warning); condition-transition event visual category | Merged (PR #313) |
| `046-kro-v090-revisions` | #274 | RGD Graph Revisions tab — revision history, compiled status, age, expand YAML (kro v0.9.0+) | Merged (PR #314) |
| `fix/ux-polish-round2-continued` | — | 005 Step 10 E2E fix: waitForFunction, aria-label (CI green) | Merged (PR #315) |
| `fix/ux-polish-round2-continued` | #303 #299 #298 #308 #309 | ValidateRGD PATCH→static; Fleet degraded color; ContextSwitcher subtitle; require.Nil; AGENTS/constitution docs | Merged (PR #316) |
| `fix/e2e-journey-syntax-fix2` | — | #301 errors.New sentinels; #300 handler timeout comment; #302 README features; #304 #305 #306 component tests | Merged (PR #317) |
| `051-instance-diff` | #276 #13 | F-8 snooze error DAG nodes; GraphRevision side-by-side YAML diff foundation (spec 009) | Merged (PR #318) |
| `fix/ux-polish-round2` | — | DocsTab required fields sorted first + summary banner; Graph tab resource complexity hint; advanced stress-test fixtures | In progress |
| `052-response-cache` | — | In-memory response cache — TTL-based k8s API call caching | Merged (PR #321) |
| `053-multi-version-kro` | — | Multi-version kro support — IsSupported, CompareKroVersions, version warning banner | Merged (PR #322) |
| `054-ux-gaps` | — | formatAge 'just now', MetricsStrip not-reported style, instance name filter | Merged (PR #323) |
| `055-overview-health-summary` | — | Overview health summary bar — aggregate fleet instance health chips | Merged (PR #324) |
| `056-rgd-status-tooltip` | — | RGD card error hint — one-line compile error on error-state cards | Merged (PR #325) |
| `057-cache-context-invalidation` | — | Cache flush on context switch — prevent stale cluster data | Merged (PR #326) |
| `058-global-instance-search` | — | Global instance search — /instances page + GET /api/v1/instances fan-out | Merged (PR #327) |
| `059-condition-warnings` | — | WARNINGS counter includes failed/unknown conditions | Merged (PR #328) |
| `060-health-filter` | — | Clickable OverviewHealthBar chips — filter Overview by health state | Merged (PR #329) |
| `061-helm-security` | — | Helm chart security hardening — runAsNonRoot, readOnlyRootFilesystem, drop ALL | Merged (PR #330) |
| `062-instance-namespace-filter` | — | /instances namespace dropdown + health state filter chips | Merged (PR #345) |
| `064-fleet-reconciling-count` | — | Fleet cluster card shows reconciling instance count separately from degraded | Merged (PR #347) |

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
| State map keyed by `kind` instead of `kro.run/node-id` label | #278 | Key `buildNodeStateMap` by `kro.run/node-id`; skip children without this label (kube-generated resources) |
| `IN_PROGRESS` kro state not mapped to reconciling | #278 | Check `status.state === 'IN_PROGRESS'` BEFORE checking conditions in `extractInstanceHealth` and `isReconciling()` |
| `items:null` in Go API responses | #278 | Init slices with `make([]T, 0)` not `var items []T`; coerce nil to `[]` before responding |
| External ref DAG nodes showing `not-found` when instance is healthy | #285 | In `buildNodeStateMap` step 3, map `external`/`externalCollection` nodes to `globalState` not `not-found` |
| Using `page.goto()` HTTP status to detect nonexistent SPA routes in E2E | #310 | SPA always returns 200. Use `page.request.get(apiUrl)` to check if the resource exists before navigating |
| E2E journey files not assigned to any Playwright chunk | #310 | Every journey file prefix MUST appear in a `testMatch` pattern in `playwright.config.ts`. Files without a match are silently skipped. |
| Missing `})` closing `test.describe` in E2E journey | #310 | Crashes the Playwright runner before any test runs. Always verify brace depth = 0 after editing journeys |
| `locator.or().toBeVisible()` when both elements may be visible | #310 | Use `waitForFunction()` polling the DOM; `locator.or()` throws when multiple elements match |
| `toHaveCount(0, {timeout:15000})` for skeleton removal | #310 | Use `waitForFunction()` polling the resolved text content; more resilient on slow CI runners |
| Response cache not flushed on context switch | #326 | Call `factory.RegisterContextSwitchHook(rc.Flush)` after creating the cache; stale cluster-A data must never be served on cluster-B |
| `formatAge()` returning "0s" for freshly created objects | #323 | Return "just now" for elapsed < 5s; "0s" at the same visual size as "30m" implies a data value, not "just created" |
| WARNINGS cell counting only expired kube events | #328 | Combine event warnings + `countFailedConditions()` (non-Ready conditions with status=False/Unknown); events expire after ~1h leaving WARNINGS=0 for stuck instances |
| HealthBar chips as non-interactive `<span>` when data is available | #329 | Render as `<button>` with `aria-pressed` when `onFilter` is provided; operators need to click chips to drill down |
| Helm chart missing security context | #330 | Always add `podSecurityContext` + `containerSecurityContext` with `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation=false`, `capabilities.drop=[ALL]` |
| E2E `waitForTimeout(2000)` as data-load guard | #339 | Replace with `waitForFunction` polling the DOM; fixed-ms waits are inherently flaky when the cluster is throttled |
| E2E test asserting kro-managed instance has no finalizers | #339 | kro adds `kro.run/finalizer` to ALL instances — never assert `.not.toBeVisible()` for the FinalizersPanel on a live kro instance |
| E2E context-switcher test using `locator.click()` on dropdown option without waiting for options to load | #341 | Use `waitForFunction()` polling the dropdown for the option text; context list loads from `/api/v1/contexts` which can be slow on throttled clusters |
| `/instances` page using `ready: "True"/"False"` to determine health instead of full 6-state model | #348 | Check `status.state === 'IN_PROGRESS'` FIRST; only then fall back to `ready` condition. IN_PROGRESS instances are "reconciling", not "error" — consistent with Overview/InstanceDetail. |
| Fleet `isInstanceDegraded()` only checking `Ready=False` without excluding IN_PROGRESS | #343 | Check `status.state === 'IN_PROGRESS'` before the Ready condition check; IN_PROGRESS instances are reconciling, not degraded |
| `ListAllInstances` fan-out timeout 2s insufficient on throttled clusters | #352 | Use 5s per-goroutine timeout; goroutines run in parallel so total handler latency ≈ max(individual) not sum(individual). 2s was leaving no time after DiscoverPlural (~1-2s on throttled clusters). |

### Upstream kro node types (5 real types + 1 kro-ui extension)

Labels from `NODE_TYPE_LABEL` in `web/src/lib/dag.ts:37-44`.

| NodeType | kro-ui label | Condition |
|----------|-------------|-----------|
| `NodeTypeInstance` | Root CR | ID = `schema` |
| `NodeTypeResource` | Managed Resource | has `template`, no `forEach` |
| `NodeTypeCollection` | forEach Collection | has `template` + `forEach` |
| `NodeTypeExternal` | External Ref | `externalRef.metadata.name` set |
| `NodeTypeExternalCollection` | External Ref Collection | `externalRef.metadata.selector` set |
| *(kro-ui ext.)* | State Store | has `state:` key, no `template:` — pending upstream NodeTypeState formalization (CA-05) |

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
- 6-state `InstanceHealthState` (ready/degraded/reconciling/error/pending/unknown); state map keyed by `kro.run/node-id` label (not by kind)
- kro v0.9.0 API: GraphRevision CRD, scope badge, capabilities baseline (`hasGraphRevisions`, `hasExternalRefSelector`, `hasCELOmitFunction`)
- Stress-test fixture RGDs on kind cluster: `never-ready`, `invalid-cel-rgd`, `typed-schema`, `optimization-candidate`, `triple-config`, `crashloop-app`, `multi-ns-app`, `multi-conditional`, `deep-dependency-chain`, `large-schema`, `multi-hpa-app`, `webapp-with-pdb`, `secret-configmap-pair`, `cross-namespace-config`

 ## Recent Changes
 - v0.7.0: /instances health sort (PR #350); status message tooltip (PR #351); 5s timeout fix for throttled clusters (PR #352)
 - v0.6.0: Fleet consistent health state (#343); ACTIVE WATCHES metric fallback for kro v0.8.5 (#344); /instances namespace+health filter (#345); Fleet reconciling count (#347); /instances reconciling state fix (#348)
 - v0.5.3: formatAge 'just now' (PR #323); Overview health bar (PR #324); RGD error hint (PR #325); cache flush on context switch (PR #326); global /instances search (PR #327); condition warnings counter (PR #328); Overview health filter (PR #329); Helm security (PR #330); AGENTS docs (PR #331); E2E fixes PRs #332-#341; ListAllInstances optimization (PR #334)
 - v0.5.2: multi-version kro support — IsSupported, CompareKroVersions, version warning banner (PR #322)
- v0.5.1 (cutting): Fleet matrix all-kinds-degraded bug fixed (PR #320); kro version in fleet cluster cards (PR #320); kro-ui version in footer (PR #320); DocsTab required fields sorted first (PR #319); Graph tab complexity hint (PR #319); response cache 30s/10s/5min TTLs (PR #321)
- v0.5.0: ALL GH issues resolved — snooze error DAG nodes (GH #276 F-8, PR #318); GraphRevision side-by-side YAML diff foundation (GH #13, PR #318); v0.4.15 fixes (GH #303 #299 #298 #308 #301 #300 #302 #304 #305 #306 #309 #315)
- v0.4.15: ValidateRGD PATCH→offline static (GH #303); Fleet degraded color fix (GH #299); ContextSwitcher subtitle fix (GH #298); require.Nil in tests (GH #308); errors.New sentinels (GH #301); handler timeout docs (GH #300); README features updated (GH #302); FinalizersPanel/DAGTooltip/CopySpecButton component tests (GH #305 #304 #306); constitution §II path fix + AGENTS node-type docs (GH #309); CI fix 005 Step 10 (PR #315)
- v0.4.14: RGD Graph Revisions tab — revision history, compiled status, age, expand YAML (PR #314, GH #274 closed)
- v0.4.13: omit() designer help; collection limit badge 900/1000 (PR #313); condition-transition events (PR #313); fixture-state path fix 043 journeys (PR #312); constitution §XIV E2E standards (PR #311); E2E journey backfill 20 PRs (PR #297)
- v0.4.12: ListInstances returns empty list (not 500) for Inactive RGDs; health chip now shows "no instances" (PR #296)
- v0.4.11: TerminatingBanner unit tests (PR #294); CollectionPanel legacy kro < 0.8.0 warning removed (PR #295)
- v0.4.10: instance spec diff (PR #293); GenerateTab map/object fields {} fix (PR #292)
- v0.4.9: YAML tab strips managedFields, last-applied-configuration, resourceVersion, uid (PR #291)
- v0.4.8: ErrorsTab skips IN_PROGRESS instances (PR #286); CollectionPanel empty state shows forEach expression (PR #286); stuck reconcile escalation banner >5m (PR #286); stuck finalizer kubectl patch command >5m (PR #290)
- v0.4.7: isItemReady stateless-resource fix (PR #284); external ref DAG nodes show alive/reconciling not not-found (PR #285)
- v0.4.6: kro v0.9.0 upgrade (PR #275); RGD Designer validation (PR #273); degraded health state + health bar + copy YAML (PR #277); state map node-id keying + IN_PROGRESS fix (PR #278); 26-gap UI polish (PR #279); refresh button + Designer CEL help (PR #280); reconcile-paused banner + cluster-scoped namespace (PR #281); ErrorsTab dedup + optimizer emoji (PR #282); DocsTab JSON Schema object types (PR #283)
- v0.4.5: degraded health state (6th InstanceHealthState) + multi-segment HealthChip bar (✗/⚠/↻ counts) + copy instance YAML button; state map keyed by kro.run/node-id (fixes two-Deployment node collision, EndpointSlice pollution); IN_PROGRESS kro state → reconciling pill+banner; items:null→[] on zero children; GraphProgressing compat (kro v0.8.x)
- v0.4.4: RGD Designer full kro feature coverage — all 5 node types, includeWhen, readyWhen CEL, schema field editor
- v0.4.3: upstream fixture generator (cmd/dump-fixtures); contagious includeWhen BFS fix; 43 E2E journeys; GetInstanceChildren scoped; demo/E2E hardened for kro v0.8.5
- v0.4.2: RGD Designer promoted to nav; live DAG preview; error states UX audit; static DAG overlay svgHeight fix; Live YAML by kro.run/node-id; cluster-scoped children fix
- v0.4.1: 9-issue bug-fix batch — breadcrumb, FieldTable, OptimizationAdvisor, context-switch nav, ValidationTab conditions, DAG tooltip persistence, DiscoverPlural cache, Fleet errgroup+timeout
- v0.4.0: Overview/Catalog IA differentiation; live DAG per-node state; global /author entrypoint; per-context controller metrics; Fleet metrics column
- v0.3.4: negation-polarity condition fix; overlay node-mapping fix; Children denominator tooltip; catalog/home/fleet UX fixes
- v0.3.3: cluster-wide child resource search; parallel events fan-out; DAG width fitted; null items guard
- v0.3.2: Docker image includes aws CLI v2 for EKS exec credential plugin
- v0.3.1: DAG legend; required-field a11y; overlay crash fix; expand accordion fix; demo hardening
- v0.3.0: instance telemetry panel; cross-instance error aggregation (Errors tab); instance health roll-up; DAG instance overlay; global footer; first-time onboarding; deletion debugger; RBAC SA auto-detection; RGD detail header enrichment
