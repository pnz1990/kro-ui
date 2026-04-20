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

---

## Donation Readiness Gap Analysis

> Last updated: 2026-04-20 — autonomous vision scan (vibe-vision-auto)

The bar is donation to `kubernetes-sigs`. The gaps below are what a kubernetes-sigs maintainer
reviewing this today would find. Each has a corresponding `🔲 Future` item in a design doc.

### Hard blockers (would prevent donation acceptance)

| Gap | Design doc item | Why it blocks |
|-----|----------------|---------------|
| No `GOVERNANCE.md` | doc 27 §27.8 | kubernetes-sigs requires a governance model with maintainer list and decision process |
| No `CODE_OF_CONDUCT.md` at repo root | doc 27 §27.9 | kubernetes-sigs org requires this file to exist (not just a link in CONTRIBUTING.md) |
| No signed artifacts or SBOM in release | doc 27 §27.10 | kubernetes-sigs projects are expected to produce cosign-signed images and SBOM; goreleaser v2 supports this natively |
| Single approver in `OWNERS` | doc 27 §27.11 | kubernetes-sigs rejects donations with a single-person bus factor; >= 2 approvers required |

### Significant gaps (would produce review comments)

| Gap | Design doc item | Impact |
|-----|----------------|--------|
| DAG unusable at 200+ nodes | doc 28 + doc 27 §27.13 | Large production RGDs render as a dense locked-up SVG; no collapse, minimap, or text fallback |
| GraphRevision diff incomplete | doc 28 | The two-panel line-level diff with navigate-by-change arrows is missing; the Revisions tab is visible on every RGD detail page and presents as a half-built feature |
| No partial-RBAC test | doc 27 §27.12 | User with access to some namespaces but not others gets silent omissions; no visible "N hidden" indicator |
| Color as sole health differentiator | doc 30 | HealthChip bar segments rely on hue only; fails WCAG 2.1 SC 1.4.1 (Use of Color) for red-green colorblind users |
| 521KB bundle / Lighthouse ~60 | doc 27 §27.14 | No code splitting; initial load on a slow connection is poor; perf.yml threshold set to 50 acknowledges this |
| Fleet per-cluster timeout not implemented | doc 29 | `proposals/003-fleet-timeout-budget.md` specifies a 2s per-cluster deadline but `summariseContext` uses the 30s route context directly; one hung cluster blocks the entire Fleet page for up to 30s; the unit test specified in the proposal was never written |
| No scale E2E fixture | doc 27 §27.18 | Largest fixture RGD has 7 nodes; no 50-node or 50-RGD scenario exists in CI; scale regressions are invisible |

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

### Already addressed (recent PRs)

- ✅ OWNERS file (kubernetes-sigs format) — PR shipped
- ✅ DCO sign-off enforcement (`dco.yml`) — PR shipped
- ✅ CONTRIBUTING.md with DCO section — PR shipped
- ✅ WCAG 2.1 AA axe-core scan on 4 Tier-1 pages (journey 074) — PR shipped
- ✅ Lighthouse CI performance budget (perf.yml) — PR shipped
- ✅ kro upstream release tracking automation — PR shipped
- ✅ Cluster unreachable global banner in Layout — PR #582 shipped

