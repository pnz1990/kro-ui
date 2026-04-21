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

v0.10.0 — production-capable. 80+ features merged across 600+ PRs. kro v0.9.1 support.
Pending work: donation readiness gaps (doc 27), loop system health gaps (doc 27 §27.22–27.27),
and kro upstream features as they land (new CRDs, GraphRevision hash, CEL extensions).

---

## Donation Readiness Gap Analysis

> Last updated: 2026-04-21 — autonomous vision scan (vibe-vision-auto, pressure-lens pass)

The bar is donation to `kubernetes-sigs`. The gaps below are what a kubernetes-sigs maintainer
reviewing this today would find. Each has a corresponding `🔲 Future` item in a design doc.

### Hard blockers (would prevent donation acceptance)

| Gap | Design doc item | Why it blocks |
|-----|----------------|---------------|
| No signed artifacts or SBOM in release | doc 27 §27.10 | kubernetes-sigs projects are expected to produce cosign-signed images and SBOM; goreleaser v2 supports this natively |
| ~~No `GOVERNANCE.md`~~ ✅ shipped | doc 27 §27.8 | Shipped (PR #592) |
| ~~No `CODE_OF_CONDUCT.md` at repo root~~ ✅ shipped | doc 27 §27.9 | Shipped (PR #592) |
| ~~Single approver in `OWNERS`~~ ✅ shipped | doc 27 §27.11 | Shipped (PR #592) |

### Significant gaps (would produce review comments)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| DAG unusable at 200+ nodes | doc 28 + doc 27 §27.13 | Large production RGDs render as a dense locked-up SVG; no collapse, minimap, or text fallback |
| GraphRevision diff — line-level YAML panel is raw blocks | doc 28 (new item) | YAML diff panel shows two unrelated KroCodeBlock side-by-side; no line highlighting; user cannot find what changed without reading both blocks; the DAG diff (RGDDiffView) exists but the raw YAML panel is not a real diff view |
| No partial-RBAC test | doc 27 §27.12 | User with access to some namespaces but not others gets silent omissions; no visible "N hidden" indicator |
| Color as sole health differentiator | doc 30 | HealthChip bar segments and OverviewHealthBar chips use border/bg color as the primary differentiator; fails WCAG 2.1 SC 1.4.1 (Use of Color) for red-green colorblind users |
| 521KB bundle / Lighthouse ~60 | doc 27 §27.14 | No code splitting; initial load on a slow connection is poor; perf.yml threshold set to 50 acknowledges the gap |
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
| Housekeeping-only batch spiral undetected | doc 27 §27.22 (loop) | Loop shipped 7 consecutive batches of coverage micro-PRs while reporting GREEN; no self-correction trigger exists |
| SM health signal has no quantitative threshold | doc 27 §27.23 (loop) | GREEN means nothing without a minimum bar (≥1 design-doc-backed feature PR); honesty requires enforced thresholds |
| `/otherness.learn` not running | doc 27 §27.24 (loop) | `skills_count` stuck at 12 across all measured batches; skills library not growing; loop not getting smarter |
| Monoculture / frame-lock undetected | doc 27 §27.25 (loop) | All sessions use the same COORD→ENG→QA chain with no mechanism to detect systematic errors |
| No single-page loop health view | doc 27 §27.26 (loop) | Issue #439 comment stream is dense; a human cannot verify loop health in <30s without reading every comment |
| Onboarding quality untested | doc 27 §27.27 (loop) | `/otherness.onboard` output is never validated; a new project setup may still require manual editing |
| Silent session failure indistinguishable from empty batch | doc 27 §27.28 | No heartbeat comment posted when session crashes before SM phase; failure looks identical to "ran and shipped nothing" |
| Queue-empty stall — no autonomous backlog drain | doc 27 §27.29 | When open issue queue is empty, session stalls or ships housekeeping; SM must drain `🔲 Future` items from design docs into issues automatically |
| Simulation predictions never compared to outcomes | doc 27 §27.30 | Predicted batch output is never validated against actual; calibration failures go undetected indefinitely |
| Metrics table drives zero automated decisions | doc 27 §27.31 | `skills_count`, `ci_red_hours`, `needs_human` are flat lines with no threshold-crossing rules; collected data is not acted on |
| Report issue comments too verbose for quick scan | doc 27 §27.32 | 600+ PR repo with hourly batches; comment stream is hundreds of entries of debug-level detail; no 3-line quick-glance format |
| Design doc §27 numbering collision (product vs loop items) | doc 27 §27.33 | Items 27.22–27.24 used twice in same doc; ambiguous references in PRs and commit messages |

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

