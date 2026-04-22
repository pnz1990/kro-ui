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

v0.10.0 — production-capable. 90+ features merged across 690+ PRs. kro v0.9.1 support.
Pending work: donation readiness gaps (doc 27), loop system health gaps (doc 27 §27.32–27.64),
and kro upstream features as they land (new CRDs, GraphRevision hash, CEL extensions).

---

## Donation Readiness Gap Analysis

> Last updated: 2026-04-22 — autonomous vision scan (vibe-vision-auto)

The bar is donation to `kubernetes-sigs`. The gaps below are what a kubernetes-sigs maintainer
reviewing this today would find. Each has a corresponding `🔲 Future` item in a design doc.

### Hard blockers (would prevent donation acceptance)

| Gap | Design doc item | Why it blocks |
|-----|----------------|---------------|
| ~~No signed artifacts or SBOM in release~~ ✅ shipped | doc 27 §27.10 | Shipped (PR #626): cosign keyless signing + CycloneDX SBOM + SLSA provenance attestation |
| ~~No signed artifacts or SBOM in release~~ ✅ shipped (PR #626) | doc 27 §27.10 | Shipped: cosign keyless signing, CycloneDX SBOM via anchore/sbom-action, SLSA provenance attestation |
| ~~No `GOVERNANCE.md`~~ ✅ shipped | doc 27 §27.8 | Shipped (PR #592) |
| ~~No `CODE_OF_CONDUCT.md` at repo root~~ ✅ shipped | doc 27 §27.9 | Shipped (PR #592) |
| ~~Single approver in `OWNERS`~~ ✅ shipped | doc 27 §27.11 | Shipped (PR #592) |

### Significant gaps (would produce review comments)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| ~~DAG unusable at 200+ nodes~~ ✅ shipped (PR #613) | doc 28 + doc 27 §27.13 | DAG scale guard shipped: text-mode fallback for >100-node graphs with opt-in toggle |
| ~~GraphRevision diff — line-level YAML panel is raw blocks~~ ✅ shipped (PR #624) | doc 28 | YAML diff line-level highlighting shipped: LCS algorithm in `@/lib/diff`, added/removed lines highlighted green/red (duplicate row removed) |
| ~~No partial-RBAC test~~ ✅ shipped (PR #622) | doc 27 §27.12 | `rbacHidden` field in ListAllInstancesResponse; "N RGD(s) hidden — insufficient permissions" advisory on /instances; Go unit tests + E2E journey 081 |
| ~~GraphRevision diff — line-level YAML panel is raw blocks~~ ✅ shipped (PR #624) | doc 28 | YAML diff line-level highlighting shipped: LCS algorithm in `@/lib/diff`, added/removed lines highlighted green/red |
| ~~No partial-RBAC test~~ ✅ shipped (PR #622) | doc 27 §27.12 | Shipped: `rbacHidden` counter, "N RGDs hidden — insufficient permissions" advisory, E2E journey 081 |
| ~~Color as sole health differentiator~~ ✅ shipped | doc 30 | `HEALTH_STATE_ICON` map exported from `format.ts`; icon prefixes (✓/✗/⚠/↻/…/?) added to HealthPill, ReadinessBadge, OverviewHealthBar chips; satisfies WCAG 2.1 SC 1.4.1 (spec issue-580) |
| ~~521KB bundle / Lighthouse ~60~~ ✅ shipped (PR #612) | doc 27 §27.14 | Code splitting shipped: route-based React.lazy reduces initial bundle; perf.yml threshold raised to 70 |
| ~~Fleet per-cluster timeout not implemented~~ ✅ shipped (PR #653) | doc 27 §27.21 + doc 29 | `summariseContext` adds `context.WithTimeout(parent, 5*time.Second)`; `TestFleetSummaryHandler_ContextTimeout` verifies 6s completion when a cluster hangs |
| No scale E2E fixture | doc 27 §27.18 | Largest fixture RGD has ~15 nodes; no 50-node or 50-RGD scenario in CI; scale regressions are invisible until a user reports in production |
| ~~Frontend API calls have no internal timeout~~ ✅ shipped (PR #652) | doc 27 §27.20 | `withTimeout()` in `api.ts` wraps every `get()`/`post()` with `AbortSignal.any([callerSignal, AbortSignal.timeout(30_000)])`; matches 30s server-side route deadline |

### Minor gaps (should be addressed before donation, not blockers)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| ~~axe-core covers only 4 pages~~ ✅ shipped (PR #634) | doc 30 | axe-core coverage expanded to 8 pages including Designer, Fleet, SRE dashboard, Errors tab |
| ~~No skip-to-main-content link~~ ✅ shipped (PR #669) | doc 30 | Skip-nav link added as first focusable element in Layout; `id="main-content"` on `<main>`; WCAG 2.1 SC 2.4.1 |
| ~~No `aria-live` on health state transitions~~ ✅ shipped (PR #670) | doc 30 | `aria-live="polite"` region in InstanceDetail with `prevRef` transition tracking; WCAG 2.1 SC 4.1.3 |
| ~~DAG arrow-key navigation missing~~ ✅ shipped (PR #685) | doc 28 | ArrowKey navigation between DAG nodes (y ASC, x ASC reading order); WCAG 2.1 SC 2.1.1 |
| ~~External Google Fonts dependency~~ ✅ shipped (PR #650) | doc 27 §27.16 | Self-hosted Inter + JetBrains Mono WOFF2 in `web/public/fonts/`; `index.html` no longer references Google Fonts CDN |
| OS-preference light mode ignored | doc 27 §27.17 | `window.matchMedia('prefers-color-scheme')` never read; light-mode users see wrong contrast ratios |
| Slow-API/fetch-timeout E2E untested | doc 27 §27.19 | `AbortController` plumbing exists but is never exercised in CI; hanging API goes untested |
| ~~Designer tab focus not persisted~~ ✅ shipped (PR #688) | doc 31 | Tab bar with sessionStorage focus restoration shipped; navigating away and returning restores active tab and selected DAG node |
| ~~Designer draft not persisted~~ ✅ shipped (PR #654) | doc 31 | `localStorage` auto-save with "Restore draft?" prompt; disabled in readonly/shared-URL mode |
| ~~DAG screen reader text alternative missing~~ ✅ shipped (PR #686) | doc 28 | `buildDagDescription()` generates human-readable summary; SVGs have `aria-describedby`; WCAG 2.1 SC 1.1.1 |

### Development loop gaps (not donation blockers, but slow the path there)

These gaps mean the autonomous loop is slower and less honest than it could be.
Each has a corresponding `🔲 Future` item in doc 27.

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| Housekeeping-only batch spiral undetected | doc 27 §27.22 | Loop shipped 7 consecutive batches of coverage micro-PRs while reporting GREEN; no self-correction trigger exists |
| SM health signal has no quantitative threshold | doc 27 §27.23 | GREEN means nothing without a minimum bar (≥1 design-doc-backed feature PR); honesty requires enforced thresholds |
| `/otherness.learn` not running | doc 27 §27.24 | `skills_count` stuck at 12 across all measured batches; skills library not growing; loop not getting smarter |
| Monoculture / frame-lock undetected | doc 27 §27.25 | All sessions use the same COORD→ENG→QA chain with no mechanism to detect systematic errors |
| No single-page loop health view | doc 27 §27.26 | Issue #439 comment stream is dense; a human cannot verify loop health in <30s without reading every comment |
| Onboarding quality untested | doc 27 §27.27 | `/otherness.onboard` output is never validated; a new project setup may still require manual editing |
| Silent session failure undetected | doc 27 §27.28 | A session that runs but posts nothing is indistinguishable from a session that never ran; no circuit-breaker emits a FAILED signal when `prs_merged=0` and no comment was posted |
| Empty-queue causes stall or busywork spiral | doc 27 §27.29 | When the board queue is empty the loop falls back to micro-PRs instead of self-filling the queue from code gaps or clearly signalling that human direction is needed |
| Simulation predictions not tracked vs. actual | doc 27 §27.30 | Metrics record actuals but not predictions; without `predicted_prs` vs `actual_prs` the simulation cannot self-correct — the same optimistic predictions recur every batch regardless of track record |
| Learning velocity not measurable | doc 27 §27.31 | `skills_count` is a total, not a rate; 9 batches at skills_count=12 is stagnation, but the metrics table cannot distinguish stagnation from growth without a `skills_delta` column |
| SM never writes `docs/aide/loop-health.md` | doc 27 §27.32 | 27.26 specifies this file but SM §4f has no code to write it; file doesn't exist today |
| `cancel-in-progress: true` kills in-flight sessions | doc 27 §27.33 | Hourly cron kills a running 2-hour session at minute 60 before SM can post health signal or commit metrics |
| `skills_count` written as stale value in metrics | doc 27 §27.34 | SM writes 12 but actual count is 15; delta calculations will be wrong without live `wc -l` computation |
| `predicted_prs` and `skills_delta` columns decorative | doc 27 §27.35 | Header documents them, SM never writes them; every row has `-` in both columns |
| `vision.md` donation gaps table updated manually | doc 27 §27.36 | Shipped items (DAG scale guard, code splitting) stay in the gap table until a human removes them |
| Metrics table has 43-batch audit gap (batches 9–50 missing) | doc 27 §27.37 | Batch numbering jumps from 8 to 51 with no record; cannot verify what shipped or was skipped during that period |
| Rework rate not tracked; low-quality first passes invisible | doc 27 §27.38 | No `rework_prs` column; a session with 3 features + 2 same-session hotfixes looks identical to a clean 3-feature session |
| New project onboarding produces no initial pressure context | doc 27 §27.39 | `/otherness.onboard` generates a Step A prompt with no "Context for this vision scan:" block; first scan is blind |
| `vision.md` donation gaps table never auto-updated | doc 27 §27.40 | Scan 1 only promotes items in `docs/design/`; `docs/aide/vision.md` rows stay stale until a human edits them |
| Partial-work lost silently when session is cancelled | doc 27 §27.41 | `cancel-in-progress: true` kills sessions without recording what was abandoned; next run starts blind |
| Metrics gaps are sentinel rows only, not reconstructed | doc 27 §27.42 | Gap rows say "N batches unrecorded" but never attempt to reconstruct counts from PR history |
| Pressure block lives in workflow YAML — high edit friction | doc 27 §27.43 | Updating pressure requires a PR + CI run + review; extracing to `docs/aide/pressure-context.md` removes this barrier |
| SM batch comment has no plain-English summary first line | doc 27 §27.44 | Humans reading issue #439 must parse batch IDs and technical fields to assess health; a plain-English line is required |
| Chore-only sessions don't trigger skill creation | doc 27 §27.45 | SM only invokes `/otherness.learn` on DEFECT; two consecutive chore-only batches should also trigger a learn |
| COORD picks hygiene work even when feature issues are open | doc 27 §27.46 | Busywork detection (27.22) is SM-level (retrospective); COORD must refuse chore issues at pick time when feat: issues exist — enforcement must be at decision time |
| Prediction misses don't adjust spec scoping | doc 27 §27.47 | Halving `predicted_prs` is a symptom fix; COORD must constrain spec scope (max 2 files) when accuracy < 0.5 for 2 batches — the over-ambitious spec is the root cause |
| vibe-vision-auto never detects a stale `loop-health.md` | doc 27 §27.48 | 27.26+27.32 say SM must write the file; but no scan verifies it was written; add a Scan 0 that alerts when the file is missing or >48h old |
| `otherness-config.yaml` correctness never validated at onboard time | doc 27 §27.49 | Wrong `report_issue` or `build_command` fail silently in session 1; a `/otherness.validate-config` startup check must assert all required fields before first batch |
| vibe-vision-auto scan has deduplication bug — same items appear twice | doc 27 §27.50 | Scan append logic is not idempotent; 27.40–27.45 duplicated in doc 27 System Loop Health section; scan must deduplicate before commit |
| Skills library utilization is untraceable — consulted count never recorded | doc 27 §27.51 | 15 skills exist but no session log records which were read; ENG must add `## Skills consulted` to work log; SM must track `skills_consulted` as a metrics column |
| Scan output never validated before commit — corrupt writes silently committed | doc 27 §27.52 | Python crash mid-write produces truncated doc; post-write validation of section structure must run before `git commit`; failures must post a `[SCAN ERROR]` comment |
| Skills library content quality is invisible to human and loop alike | doc 27 §27.53 | `skills_count=15` says nothing about coverage; `docs/aide/skills-inventory.md` must list each skill with summary, age, and citation count |
| vision-scan PRs accumulate unmerged — docs on main stay stale | doc 27 §27.54 | PRs #643, #651, #655 are open vision-scan outputs that never landed on main; future items promoted in those PRs are invisible until merged |
| Metrics table has no row since batch 51 (2026-04-20) despite active shipping | doc 27 §27.55 | 30+ PRs merged after 2026-04-20 with no metrics row; SM §4b is not running or not reaching the write step |
| Daily report issue rotation fragments health history across issues | doc 27 §27.56 | REPORT_ISSUE rotated #439→#637; no permanent single view of multi-day health trend; loop-health items in the development loop gaps table have no cross-day continuity |
| System Loop Health `🔲` items in doc 27 unverifiable — sit indefinitely unimplemented | doc 27 §27.57 | 27.22–27.53 cannot be promoted by Scan 1 (which matches PR titles); need a Scan 1b that checks agent file timestamps against item creation date |
| `docs/aide/loop-health.md` missing 2+ days after being specified | doc 27 §27.58 | Items 27.26 and 27.32 both specified this file; it still doesn't exist; SM §4f is not writing it; all health visibility depends on this file existing |
| Vision-scan PRs accumulate unmerged — docs on main diverge from scan output | doc 27 §27.59 | PR #672 is an open vision-scan output; `main` doc 27 lacks items 27.40–27.57; SM §4g needs a recovery step to squash-merge stale vision-scan PRs at batch start |
| GREEN health signal is un-falsifiable — no substantive PR threshold | doc 27 §27.60 | A `chore(config):` one-liner earns GREEN; substantive_pr_count (feat: + design-doc issue link) required before GREEN is honest |
| vibe-vision-auto Step A output may never land on main if Step B fails | doc 27 §27.61 | Step A commits to a session branch; if Step B is cancelled or exits early, the scan PR is never merged; add auto-merge of stale vision-scan PRs at the start of Step A |
| Pressure block in workflow YAML never self-evolves | doc 27 §27.62 | Scan 5 detects stale pressure but only queues a Future item; if 27.43 (extract to `pressure-context.md`) is implemented, Scan 5 must actually rewrite the file — agents raise the bar, not humans |
| Scheduled workflow Step A requires full prompt copy per project — can't inherit scan improvements | doc 27 §27.63 | All projects must copy-paste the full vibe-vision-auto prompt into their workflow; bug fixes and new scans require a workflow PR per project; use `prompt: "read and follow ~/.otherness/agents/vibe-vision-auto.md"` instead |
| No machine-readable health endpoint for external monitoring | doc 27 §27.64 | `loop-health.md` is markdown; a dashboard tool cannot consume it; `loop-health.json` companion file enables COORD to read prior session health and adjust its plan |

### Already addressed (recent PRs)

- ✅ OWNERS file (kubernetes-sigs format) — PR shipped
- ✅ DCO sign-off enforcement (`dco.yml`) — PR shipped
- ✅ CONTRIBUTING.md with DCO section — PR shipped
- ✅ GOVERNANCE.md — PR #592 shipped
- ✅ CODE_OF_CONDUCT.md at repo root — PR #592 shipped
- ✅ OWNERS breadth + reviewer path documented — PR #592 shipped
- ✅ WCAG 2.1 AA axe-core scan on 4 Tier-1 pages (journey 074) — PR shipped
- ✅ Lighthouse CI performance budget (perf.yml) — PR shipped
- ✅ kro upstream release tracking automation — PR shipped
- ✅ Cluster unreachable global banner in Layout — PR #583 shipped
- ✅ Condition detail drill-down (per-condition expand/collapse) — PR #566 shipped
- ✅ v0.10.0 release (goreleaser binary + Docker image) — PR #589 shipped
- ✅ DAG scale guard (>100-node text-mode fallback) — PR #613 shipped (2026-04-21)
- ✅ Frontend code splitting (React.lazy per route, bundle ~150KB gzipped) — PR #612 shipped (2026-04-21)
- ✅ Supply chain security: cosign signing + CycloneDX SBOM + SLSA provenance — PR #626 shipped (2026-04-21)
- ✅ Partial-RBAC graceful degradation: `rbacHidden` indicator + "N hidden" advisory on /instances — PR #622 shipped (2026-04-21)
- ✅ Supply chain security: cosign signing, SBOM, SLSA provenance — PR #626 shipped (2026-04-21)
- ✅ Partial-RBAC graceful degradation: rbacHidden indicator, "N RGDs hidden" advisory — PR #622 shipped (2026-04-21)
- ✅ YAML diff line-level highlighting in RevisionsTab (LCS algorithm) — PR #624 shipped (2026-04-21)
- ✅ Color-blind accessible health indicators: `HEALTH_STATE_ICON` map, icon prefixes on HealthPill/ReadinessBadge/OverviewHealthBar — spec issue-580 shipped (2026-04-21)
- ✅ axe-core coverage expanded to 8 pages (Designer, Fleet, SRE dashboard, Errors tab) — PR #634 shipped (2026-04-21)
- ✅ Self-hosted Google Fonts (Inter + JetBrains Mono WOFF2) — no more CDN dependency — PR #650 shipped (2026-04-21)
- ✅ Fleet per-cluster 5s inner deadline in `summariseContext` — PR #653 shipped (2026-04-21)
- ✅ Per-request 30s fetch timeout via `AbortSignal.timeout` in `api.ts` — PR #652 shipped (2026-04-21)
- ✅ Partial-RBAC instance visibility: second implementation pass with `rbacHidden` advisory — PR #656 shipped (2026-04-21)
- ✅ Designer draft localStorage persistence with "Restore draft?" restore prompt — PR #654 shipped (2026-04-22)
- ✅ Skip-to-main-content link in Layout — PR #669 shipped (2026-04-22)
- ✅ `aria-live` health state announcements in InstanceDetail — PR #670 shipped (2026-04-22)
- ✅ DAG Arrow key navigation between nodes (WCAG 2.1 SC 2.1.1) — PR #685 shipped (2026-04-22)
- ✅ DAG screen reader text alternative via `buildDagDescription()` (WCAG 2.1 SC 1.1.1) — PR #686 shipped (2026-04-22)
- ✅ Designer tab bar with sessionStorage focus restoration — PR #688 shipped (2026-04-22)
- ✅ GraphRevision diff navigate-by-change arrows — prev/next change navigation with auto-scroll and counter — PR #694 shipped (2026-04-22)

