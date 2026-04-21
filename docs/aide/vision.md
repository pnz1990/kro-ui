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

v0.10.0 — production-capable. 90+ features merged across 615+ PRs. kro v0.9.1 support.
Pending work: donation readiness gaps (doc 27), loop system health gaps (doc 27 §27.32–27.36),
and kro upstream features as they land (new CRDs, GraphRevision hash, CEL extensions).

---

## Donation Readiness Gap Analysis

> Last updated: 2026-04-21 — autonomous vision scan (vibe-vision-auto, run 6)

The bar is donation to `kubernetes-sigs`. The gaps below are what a kubernetes-sigs maintainer
reviewing this today would find. Each has a corresponding `🔲 Future` item in a design doc.

### Hard blockers (would prevent donation acceptance)

| Gap | Design doc item | Why it blocks |
|-----|----------------|---------------|
| ~~No signed artifacts or SBOM in release~~ ✅ shipped (PR #626) | doc 27 §27.10 | Shipped: cosign keyless signing, CycloneDX SBOM via anchore/sbom-action, SLSA provenance attestation |
| ~~No `GOVERNANCE.md`~~ ✅ shipped | doc 27 §27.8 | Shipped (PR #592) |
| ~~No `CODE_OF_CONDUCT.md` at repo root~~ ✅ shipped | doc 27 §27.9 | Shipped (PR #592) |
| ~~Single approver in `OWNERS`~~ ✅ shipped | doc 27 §27.11 | Shipped (PR #592) |

### Significant gaps (would produce review comments)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| ~~DAG unusable at 200+ nodes~~ ✅ shipped (PR #613) | doc 28 + doc 27 §27.13 | DAG scale guard shipped: text-mode fallback for >100-node graphs with opt-in toggle |
| ~~GraphRevision diff — line-level YAML panel is raw blocks~~ ✅ shipped (PR #624) | doc 28 | YAML diff line-level highlighting shipped: LCS algorithm in `@/lib/diff`, added/removed lines highlighted green/red |
| ~~No partial-RBAC test~~ ✅ shipped (PR #622) | doc 27 §27.12 | Shipped: `rbacHidden` counter, "N RGDs hidden — insufficient permissions" advisory, E2E journey 081 |
| Color as sole health differentiator | doc 30 | HealthChip bar segments and OverviewHealthBar chips use border/bg color as the primary differentiator; fails WCAG 2.1 SC 1.4.1 (Use of Color) for red-green colorblind users |
| ~~521KB bundle / Lighthouse ~60~~ ✅ shipped (PR #612) | doc 27 §27.14 | Code splitting shipped: route-based React.lazy reduces initial bundle; perf.yml threshold raised to 70 |
| Fleet per-cluster timeout not implemented | doc 27 §27.21 + doc 29 | `summariseContext` uses the 30s route context; one hung cluster blocks the Fleet page for up to 30s; the `TestFleetSummaryHandler_ContextTimeout` test documented in proposals/003 was never written |
| No scale E2E fixture | doc 27 §27.18 | Largest fixture RGD has ~15 nodes; no 50-node or 50-RGD scenario in CI; scale regressions are invisible until a user reports in production |
| Frontend API calls have no internal timeout | doc 27 §27.20 | `api.ts` passes caller `AbortSignal` but adds no internal timeout; callers that omit a signal hang indefinitely on a stuck server; `AbortSignal.timeout(30_000)` needed in `get()` and `post()` |

### Minor gaps (should be addressed before donation, not blockers)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| axe-core covers only 4 pages | doc 30 | Designer, Fleet, SRE dashboard, Errors tab not scanned; could have WCAG violations |
| No skip-to-main-content link | doc 30 | Keyboard users tab through the full nav on every page load; WCAG 2.1 SC 2.4.1 |
| No `aria-live` on health state transitions | doc 30 | Screen readers not informed when instance health changes during 5s polling cycle; WCAG 2.1 SC 4.1.3 |
| DAG arrow-key navigation missing | doc 28 | Tab-only traversal of DAG nodes; no spatial movement between graph neighbours; WCAG 2.1 SC 2.1.1 |
| External Google Fonts dependency | doc 27 §27.16 | Breaks in air-gapped clusters; privacy concern; blocks rendering until CDN responds |
| OS-preference light mode ignored | doc 27 §27.17 | `window.matchMedia('prefers-color-scheme')` never read; light-mode users see wrong contrast ratios |
| Slow-API/fetch-timeout E2E untested | doc 27 §27.19 | `AbortController` plumbing exists but is never exercised in CI; hanging API goes untested |
| Designer tab focus not persisted | doc 31 (new item) | Navigating away from `/author` and returning resets active tab; `sessionStorage` persistence needed |
| Designer draft not persisted | doc 31 | Closing `/author` silently discards all edits; `localStorage` auto-save needed |

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
| Scan 6 not added to vibe-vision-auto.md | doc 27 §27.46 | 27.40 specifies Scan 6 to auto-update vision.md donation rows, but the step was never added to the agent file; donation table stays stale |
| AGENTS.md Recent Changes stale at v0.9.4 | doc 27 §27.47 | Post-v0.10.0 features (PRs #607–#631) not in Recent Changes; new sessions plan against wrong baseline |
| Scan 5 keyword matching structurally broken | doc 27 §27.48 | Abstract pressure keywords ("otherness reliable enough") can never match PR titles; 60% threshold is unreachable; pressure block can never self-update |
| vision.md donation table has no "in-progress" state | doc 27 §27.49 | Two-state table (gap/addressed) cannot distinguish "being worked on" from "ignored"; Fleet timeout and API timeout rows look identical to pre-GOVERNANCE.md era blockers |

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
- ✅ Supply chain security: cosign signing, SBOM, SLSA provenance — PR #626 shipped (2026-04-21)
- ✅ Partial-RBAC graceful degradation: rbacHidden indicator, "N RGDs hidden" advisory — PR #622 shipped (2026-04-21)
- ✅ YAML diff line-level highlighting in RevisionsTab (LCS algorithm) — PR #624 shipped (2026-04-21)
- ✅ Instance resource graph: grouped k8s resources with health dots — PR #607 shipped (2026-04-21)
- ✅ Instance full YAML diff: side-by-side LCS diff for two instance snapshots — PR #605 shipped (2026-04-21)
- ✅ Instance bulk operations: multi-select + bulk YAML export on /instances page — PR #602 shipped (2026-04-21)
- ✅ Health trend sparkline on RGD detail Instances tab — PR #610 shipped (2026-04-21)
- ✅ Health alert subscriptions: browser Notification bell — PR #615 shipped (2026-04-21)
- ✅ Designer: import existing RGD from cluster — PR #618 shipped (2026-04-21)
- ✅ E2E journey 082 for Designer cluster import panel — PR #631 shipped (2026-04-21)

