# 27 — Stage 3: kro Upstream Tracking + Next Features

> Status: Active | Created: 2026-04-20
> Applies to: kro-ui ongoing development (post-v0.9.4)

---

## Problem

kro-ui is mature at v0.9.4. The roadmap says "Track kro upstream releases and apply UI
changes as new CRDs/fields land" but there is no concrete queue backing this. Without
explicit Future items, the loop generates busywork (test coverage micro-PRs) instead of
meaningful product advancement.

This design doc provides the concrete queue for Stage 3.

---

## kro Upstream Tracking

kro v0.9.1 is the current supported version. The kro project is actively developed.
Each new kro release may add new CRD fields, new health states, new CEL functions,
or new ResourceGraphDefinition capabilities that kro-ui must reflect.

**Protocol**: Check `kubernetes-sigs/kro` releases before every batch. If a new
release has landed since our last check:
1. Read the release notes and changelog
2. Identify any CRD schema changes, new fields, or new API paths
3. Open a `feat(kro-vX.Y.Z): support new <feature>` issue per change
4. Implement the UI changes in the normal COORD→ENG→QA loop

---

## Present

✅ 27.0 — kro v0.9.1 support: GraphRevision CRD, hash column, CEL hash functions (PR #428)
✅ 27.1 — kro release tracking automation: `.github/workflows/kro-upstream-check.yml` weekly checks `kubernetes-sigs/kro` releases/latest; if newer than go.mod version, opens `feat(kro-vX.Y.Z)` issue automatically. `otherness-config.yaml` configured with `anchor.upstream_version_file`+`pattern` for local go.mod bump detection via SM §4g-anchor-upstream. (PR #545, issue #523)
 ✅ 27.2 — Accessibility pass: journey `074-accessibility.spec.ts` registered in Playwright chunk-9 testMatch pattern; axe-core WCAG 2.1 AA scan runs on Catalog, RGD DAG, Instance list, and Context switcher pages in CI. (PR #546, issue #529)
 ✅ 27.3 — Fleet persona anchor journey: 6-step journey covering multi-cluster fleet view → health matrix → context switch → per-cluster RGD count (journey 075, issue #524)
 ✅ 27.6 — Error state coverage: E2E journeys 076-079 added and registered in Playwright chunk-9; each uses `page.route()` to mock 5xx API responses and asserts the error state element is visible on Overview, Fleet, RGD detail, and Instance detail pages. (PR TBD, issue #531)
 ✅ 27.4 — Performance budget: `.github/workflows/perf.yml` Lighthouse CI check (score ≥ 50, calibrated for 521KB bundle on GA runners) + HTTP response time check (<500ms); E2E journey `080-performance-budget.spec.ts` asserts Overview DOM Interactive ≤1000ms and content-ready ≤1500ms; registered in Playwright chunk-9. (PR #549, issue #530)
 ✅ 27.7 — Donation readiness: `OWNERS` file (kubernetes-sigs format, approvers/reviewers: pnz1990); `.github/workflows/dco.yml` enforces DCO sign-off on all PRs; `CONTRIBUTING.md` updated with DCO section explaining `git commit -s` requirement. (issue #532)
 ✅ 27.15 — release.yml stale helm/ reference removed: the `Update and push Helm chart` step that references `helm/kro-ui` (removed in v0.9.4) has been deleted from `.github/workflows/release.yml`; v0.10.0 tag push will now succeed. (PR #588, issue #587)
 ✅ 27.5 — kro-ui v0.10.0 release: GitHub release with changelog from merged PRs since v0.9.4; goreleaser produces binary archives (Linux/Darwin/Windows amd64/arm64) and Docker image pushed to GHCR; release notes auto-generated from PR titles. (PR #589, issue #525)
 ✅ 27.8 — GOVERNANCE.md: lightweight governance model (kubernetes-sigs format — maintainers list, decision process, release managers, path to reviewer/approver); GOVERNANCE.md added at repo root. (issue #570)
 ✅ 27.9 — CODE_OF_CONDUCT.md at repo root: pointer file to Kubernetes Community CoC with reporting path and enforcement summary; satisfies kubernetes-sigs org requirement. (issue #571)
 ✅ 27.11 — OWNERS breadth: OWNERS now documents the path for community members to become reviewers; GOVERNANCE.md §Becoming a Reviewer/Approver added; comment in OWNERS noting the >= 2 approver requirement. (issue #573)

---

## Future

- 🔲 27.10 — Supply chain security for releases: add cosign keyless signing of container images, SBOM generation (syft/cyclonedx), and SLSA provenance attestation to `.github/workflows/release.yml`; kubernetes-sigs projects are expected to produce signed artifacts; note goreleaser v2 supports `signs:` and `sboms:` natively
- 🔲 27.12 — Partial-RBAC / restricted-namespace testing: add a Go unit test and an E2E journey that verifies kro-ui returns partial results (not 500) when the operator only has RBAC access to a subset of namespaces; both `ListAllInstances` and `ListInstances` must degrade gracefully with a visible "N namespaces hidden — insufficient permissions" indicator in the UI
- 🔲 27.13 — DAG scale: RGDs with 200+ nodes currently render as a single dense SVG with no escape hatch; add a node-count guard (> 100 nodes) that offers: (a) collapsed-by-depth view, (b) text-mode list fallback, (c) minimap for navigation; without this, large production RGDs are unusable in the browser
- 🔲 27.14 — Frontend code splitting: the current 521KB bundle scores ~60 on Lighthouse CI; implement route-based code splitting (React.lazy + Suspense per route) to reduce initial bundle below 200KB; raise perf.yml threshold to 70 after splitting; this is a prerequisite for a production-grade donation
- 🔲 27.16 — Google Fonts external dependency removal: `web/index.html` loads Inter and JetBrains Mono from `fonts.googleapis.com`; this (a) breaks in air-gapped cluster environments where the UI binary is the only internet-accessible service, (b) is a privacy concern for clusters with strict egress policies, and (c) blocks font rendering until the CDN responds; self-host both font families as static assets inside the embedded binary (download WOFF2 files, serve via `go:embed`); kubernetes-sigs reviewers from regulated industries will flag this immediately
- 🔲 27.17 — OS-preference light mode: `tokens.css` defines `[data-theme="light"]` but nothing in the app reads `window.matchMedia('(prefers-color-scheme: light)')` or exposes a theme toggle; users whose OS is in light mode see the dark theme; add a `useTheme()` hook that reads the OS preference on mount and syncs `document.documentElement.setAttribute('data-theme', ...)`, with a local-storage override for manual toggling; WCAG 2.1 SC 1.4.3 contrast ratios are calibrated per mode — the wrong mode can fail contrast requirements
- 🔲 27.18 — E2E scale fixture: the largest RGD in `test/e2e/fixtures/` has 7 nodes; there is no fixture that exercises the 50-RGD or 200-node scenario mentioned in the performance budget doc (journey 080 references "50-RGD cluster" but no such fixture exists in CI); add a `scale-test-rgds.yaml` fixture with a single wide RGD (50+ resource nodes) and a `scale-test-instances.yaml` to verify the Overview loads within the TTI budget and the DAG does not lock up the browser; without this, any regression at scale is invisible until a user reports it in production
- 🔲 27.19 — E2E slow-API / fetch-timeout scenario: the error-state journeys (076-079) mock HTTP 5xx responses but never simulate a slow or aborted fetch (e.g. a cluster that accepts the TCP connection but does not respond for 10s); add a journey that uses `page.route()` with a 12s `delayMs` to verify (a) the UI shows a loading indicator during the delay, (b) the timeout fires and shows a user-readable error, and (c) the retry button triggers a new fetch; this tests the `AbortController`/`AbortSignal` plumbing that exists in the frontend but is currently untested in E2E; a kubernetes-sigs reviewer would ask "what happens when the API hangs?"
- 🔲 27.20 — Frontend per-request fetch timeout: `web/src/lib/api.ts` `get()` and `post()` pass the caller-supplied `AbortSignal` but never add an internal timeout; a caller that omits a signal will hang indefinitely if the Go server accepts the TCP connection but holds the response (e.g. a stuck discovery call); add a `AbortSignal.any([options?.signal, AbortSignal.timeout(30_000)])` fallback in `get()` and `post()` so all API calls fail with a user-visible "Request timed out" error after 30s; required for the slow-API E2E scenario (27.19) to be testable
- 🔲 27.21 — Fleet per-cluster inner deadline: `internal/api/handlers/fleet.go` `summariseContext()` comment says "parent is already bounded by the route-level 30s timeout" and explicitly does NOT add a per-cluster deadline; `docs/design/proposals/003-fleet-timeout-budget.md` specifies a 2s inner deadline per cluster, and `TestFleetSummaryHandler_ContextTimeout` is documented in the proposal but never written; a single hung cluster can still hold the Fleet response for up to 30s; add `context.WithTimeout(parent, 5*time.Second)` in `summariseContext()` and write the timeout test

---

## Zone 1 — Obligations

**O1 — kro upstream tracking is automated.** SM §4a must check for new kro releases
every batch and open issues automatically. Manual tracking is not acceptable.

**O2 — Every UI change for a new kro version ships with an E2E journey update.**
A kro API change with no journey update is a regression risk.

**O3 — v0.10.0 release requires all 27.2–27.6 items shipped.**
Do not cut v0.10.0 with open items from this list.

---

## Zone 2 — Implementer's judgment

- Accessibility checks: use `@axe-core/playwright` which is already in package.json
- Performance budget: use Lighthouse CI or simple `time curl` in E2E fixture
- Release: use `gh release create` with auto-generated notes

---

## Zone 3 — Scoped out

- Argo Rollouts integration (requires kro plugin ecosystem, not in v0.10 scope)
- GraphRevision diff viewer for >100 nodes (performance problem for later)
