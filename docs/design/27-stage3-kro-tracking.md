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
- ✅ 27.12 — Partial-RBAC / restricted-namespace testing: `ListAllInstances` tracks Forbidden errors via atomic counter and returns `rbacHidden` in the response; `ListInstances` returns 200 + `{"items":[],"warning":"insufficient permissions"}` on Forbidden instead of 500; `/instances` page and RGD detail Instances tab show "N RGDs hidden — insufficient permissions" when rbacHidden > 0; Go unit tests cover both handlers; E2E journey 081. (spec issue-574, 2026-04)
- ✅ 27.13 — DAG scale guard: RGDs with >100 nodes show a text-mode node list by default instead of a dense SVG that locks up the browser; a "Show graph (N nodes — may be slow)" toggle allows opt-in to the full render; nodes are grouped by type with conditional badges; DAGScaleGuard wraps DAGGraph and StaticChainDAG. (PR #613, spec issue-575)
- ✅ 27.14 — Frontend code splitting: route-based React.lazy + Suspense per route reduces initial bundle from ~521KB to vendor + entry chunks (~150KB gzipped); perf.yml threshold raised from 50 to 70; PageLoader shimmer fallback renders within Layout shell while chunks load. (PR #612, spec issue-576)
- 🔲 27.16 — Google Fonts external dependency removal: `web/index.html` loads Inter and JetBrains Mono from `fonts.googleapis.com`; this (a) breaks in air-gapped cluster environments where the UI binary is the only internet-accessible service, (b) is a privacy concern for clusters with strict egress policies, and (c) blocks font rendering until the CDN responds; self-host both font families as static assets inside the embedded binary (download WOFF2 files, serve via `go:embed`); kubernetes-sigs reviewers from regulated industries will flag this immediately
- 🔲 27.17 — OS-preference light mode: `tokens.css` defines `[data-theme="light"]` but nothing in the app reads `window.matchMedia('(prefers-color-scheme: light)')` or exposes a theme toggle; users whose OS is in light mode see the dark theme; add a `useTheme()` hook that reads the OS preference on mount and syncs `document.documentElement.setAttribute('data-theme', ...)`, with a local-storage override for manual toggling; WCAG 2.1 SC 1.4.3 contrast ratios are calibrated per mode — the wrong mode can fail contrast requirements
- 🔲 27.18 — E2E scale fixture: the largest RGD in `test/e2e/fixtures/` has 7 nodes; there is no fixture that exercises the 50-RGD or 200-node scenario mentioned in the performance budget doc (journey 080 references "50-RGD cluster" but no such fixture exists in CI); add a `scale-test-rgds.yaml` fixture with a single wide RGD (50+ resource nodes) and a `scale-test-instances.yaml` to verify the Overview loads within the TTI budget and the DAG does not lock up the browser; without this, any regression at scale is invisible until a user reports it in production
- 🔲 27.19 — E2E slow-API / fetch-timeout scenario: the error-state journeys (076-079) mock HTTP 5xx responses but never simulate a slow or aborted fetch (e.g. a cluster that accepts the TCP connection but does not respond for 10s); add a journey that uses `page.route()` with a 12s `delayMs` to verify (a) the UI shows a loading indicator during the delay, (b) the timeout fires and shows a user-readable error, and (c) the retry button triggers a new fetch; this tests the `AbortController`/`AbortSignal` plumbing that exists in the frontend but is currently untested in E2E; a kubernetes-sigs reviewer would ask "what happens when the API hangs?"
- 🔲 27.20 — Frontend per-request fetch timeout: `web/src/lib/api.ts` `get()` and `post()` pass the caller-supplied `AbortSignal` but never add an internal timeout; a caller that omits a signal will hang indefinitely if the Go server accepts the TCP connection but holds the response (e.g. a stuck discovery call); add a `AbortSignal.any([options?.signal, AbortSignal.timeout(30_000)])` fallback in `get()` and `post()` so all API calls fail with a user-visible "Request timed out" error after 30s; required for the slow-API E2E scenario (27.19) to be testable
- 🔲 27.21 — Fleet per-cluster inner deadline: `internal/api/handlers/fleet.go` `summariseContext()` comment says "parent is already bounded by the route-level 30s timeout" and explicitly does NOT add a per-cluster deadline; `docs/design/proposals/003-fleet-timeout-budget.md` specifies a 2s inner deadline per cluster, and `TestFleetSummaryHandler_ContextTimeout` is documented in the proposal but never written; a single hung cluster can still hold the Fleet response for up to 30s; add `context.WithTimeout(parent, 5*time.Second)` in `summariseContext()` and write the timeout test
- 🔲 27.22 — release.yml missing `id-token: write` permission: cosign keyless signing (27.10) requires `id-token: write` in the job `permissions` block to obtain an OIDC token from GitHub Actions; the current `release` job only declares `contents: write` and `packages: write`; attempting to run cosign without this permission fails with an auth error at signing time; add `id-token: write` as a prerequisite before implementing 27.10 — it is a one-line change with a non-obvious failure mode that will block the supply-chain work if missed
- 🔲 27.23 — SECURITY.md post-donation update: the current `SECURITY.md` references `pnz1990/kro-ui` GitHub Security Advisories; when donated to kubernetes-sigs, all security reports must be routed through the kubernetes-sigs security process (`security@kubernetes.io`); add a `## Post-Donation Security Policy` section that documents the planned update so it is not overlooked during the donation PR review; a kubernetes-sigs maintainer reviewing the donation PR will check SECURITY.md and flag an incorrect reporting URL as a blocker
- 🔲 27.24 — Community outreach for second OWNERS approver: `OWNERS` has a single approver (`pnz1990`); kubernetes-sigs rejects donations with a single-person bus factor and requires >= 2 approvers before accepting a project; `GOVERNANCE.md` documents the path to becoming a reviewer/approver but there is no concrete outreach plan; open a GitHub discussion or email the `kubernetes-sigs/kro` maintainer list to identify a candidate from the kro community who can review 3+ PRs and qualify as approver before the donation PR is filed; this is a social/process gap, not a code gap — it takes weeks, not days

---

## System Loop Health (🔲 Future)

These items address the *development system itself* — gaps identified by applying the 5 pressure lenses
(reliability, loop honesty, self-improvement, onboarding, visibility) to the current otherness loop for kro-ui.
They are not product features; they are process improvements the loop must make to stay honest.

- 🔲 27.22 — Loop reliability: housekeeping-only batch detection — batches 3–8 in the metrics table shipped exclusively test-coverage micro-PRs (one per batch, ~1% coverage each); the loop posted GREEN health signal throughout; add a check to `standalone.md` SM phase that inspects `prs_merged` vs `todo_shipped` type: if ≥3 consecutive batches ship only test coverage or docs with no design-doc-backed feature PRs, the SM must post AMBER and self-assign a `feat:` issue from the open queue before the batch ends; a truly reliable system must self-diagnose and self-correct busywork spirals without human intervention
- 🔲 27.23 — Loop honesty: SM health signal accuracy — the SM posts GREEN/AMBER/RED but GREEN has no quantitative threshold; a batch that ships `prs_merged=1` (coverage micro-PR) with `todo_shipped=1` is structurally identical to a batch that ships a major feature; add explicit thresholds to the health signal: GREEN requires ≥1 design-doc-backed feature PR merged; AMBER if only hygiene/test PRs shipped; RED if CI was broken >2h or 0 PRs merged; post these thresholds visibly in the report so the human can verify honesty without reading every PR
- 🔲 27.24 — Self-improvement: `/otherness.learn` frequency gate — the metrics table has 9 rows over 2 days with `skills_count` stuck at 12 for all 7 rows where it is reported; `/otherness.learn` is not running between sessions; add a rule to `standalone.md` SM phase: if `skills_count` has not increased in the last 5 batches, automatically invoke `/otherness.learn` targeting the top 3 open GitHub issues by comment count (proxy for "most discussed, most complex") before the next batch; the skills library must grow or the loop is not learning
- 🔲 27.25 — Self-improvement: monoculture / frame-lock detection — all sessions use the same `standalone.md` reasoning chain (COORD→ENG→QA→SM→PM); there is no mechanism to detect when this chain produces systematically wrong outputs (e.g. all QA passes that later turn out to have bugs, or all COORD specs that miss user-visible value); add a monthly `/otherness.arch-audit` invocation triggered by the SM when `prs_merged` in the last 30 days exceeds 20 but no new `🔲 Future` items have been added to design docs by the loop itself (a sign that the loop is executing but not discovering); the arch-audit should be instructed to assume the current approach is wrong and look for evidence
- 🔲 27.26 — Visibility: single-page loop health dashboard — issue #439 is the report issue but its comment stream is dense and technical (batch IDs, session hashes, coverage percentages); a human glancing at the repo today cannot answer in <30 seconds: (1) is the loop healthy? (2) what meaningful feature shipped most recently? (3) is the product moving toward donation readiness?; add a `docs/aide/loop-health.md` file that the SM updates on every batch with a 3-line quick-glance section (status, last feature PR, next priority) followed by the full metrics table; pin a link to this file in the issue #439 body so it is the first thing a human sees; the vibe-vision-auto scan should promote this to ✅ once the SM is consistently updating it
- 🔲 27.27 — Onboarding: zero-human-intervention validation — `otherness.setup.md` and `otherness.onboard.md` exist but their output quality is untested; add a validation step: once per quarter, run `/otherness.onboard` on a scratch repo (or use a dedicated `test-onboard` branch in kro-ui) and assert the result is a fully working `otherness-config.yaml` with no manual edits required; if human edits were needed, open a bug against the onboarding command and fix it before the next session; the goal is that a new project added today is running its first autonomous batch within 1 hour with zero human intervention
- 🔲 27.28 — Reliability: silent session failure detection — a session that runs to completion but produces 0 merged PRs and 0 issue comments (not even a status update) is indistinguishable from a session that never ran; the current health signal only reports on batches that successfully post to issue #439; add a circuit-breaker in the SM phase: if the session ends with `prs_merged=0` AND no comment was posted to the report issue, emit a FAILED status comment before exiting with the last error seen; GitHub Actions should surface this as a workflow annotation so the human sees it immediately; silent failures are the most dangerous because the human assumes the loop is running when it is not
- 🔲 27.29 — Reliability: empty-queue sentinel behavior — when the COORD phase finds no open issues on the board (queue empty), the current behavior is to stall or fall back to hygiene/coverage micro-PRs which does not advance the product; add an explicit empty-queue protocol to `standalone.md`: (1) check for any open GitHub issues (not just board items) labeled with the project label; (2) if none, run `vibe-vision-auto` to generate new items from code gaps; (3) if still none, post a "queue drained — new items needed" comment to the report issue and exit cleanly; the loop must never silently spin on empty input — it must either self-fill the queue or clearly signal that human direction is needed
- 🔲 27.30 — Self-improvement: simulation prediction feedback — the metrics table (`docs/aide/metrics.md`) records `prs_merged`, `skills_count`, and `todo_shipped` but there is no record of what the SM *predicted* would ship at batch start vs. what actually shipped; without this delta, the simulation cannot self-correct: the same optimistic predictions recur every batch regardless of actual track record; add a `predicted_prs` column to the metrics table that the COORD phase fills at session start (based on queue depth and item size), and require the SM to compute and record `accuracy = actual/predicted`; if accuracy is below 0.5 for 3 consecutive batches, the SM must halve its next prediction and post the reason — predictions that never change are not predictions, they are placeholders
- 🔲 27.31 — Self-improvement: learning velocity metric — `skills_count` is recorded in the metrics table but it is the total count, not the rate of growth; a skills library with 12 skills that has not grown in 9 batches is effectively stagnant; add a `skills_delta` column to the metrics table showing the change from the previous batch; add a SM rule: if `skills_delta=0` for 5 consecutive batches, the SM must (1) report the specific types of errors or rework that occurred in those batches and (2) propose a concrete new skill that would have prevented them; the goal is that the agents are demonstrably smarter (can solve problems faster with fewer retries) than they were 2 weeks ago — without a velocity metric this claim cannot be verified or falsified
- 🔲 27.32 — Visibility: SM must write `docs/aide/loop-health.md` every batch — item 27.26 specifies adding a `docs/aide/loop-health.md` quick-glance dashboard and having the SM update it, but the SM phase `§4f` has no code to write this file; `docs/aide/loop-health.md` does not exist today despite 27.26 being in the Future queue; add an explicit write step to SM §4f that creates/updates `docs/aide/loop-health.md` with: (1) 3-line quick-glance (current health, last feature PR, next priority), (2) donation readiness progress (open blockers count), and (3) the last 10 rows of metrics; the file must be committed on every batch so vibe-vision-auto can promote 27.26 to ✅; without this step 27.26 can never self-promote because the evidence it requires is never written
- 🔲 27.33 — Reliability: `cancel-in-progress: true` kills in-flight sessions mid-work — the scheduled workflow uses `concurrency: cancel-in-progress: true`; an hourly cron trigger that fires while a 2-hour session is running at minute 55 will silently kill the session before SM §4f can post its health signal or commit metrics; this produces exactly the silent-failure pattern 27.28 is meant to prevent — but from an infrastructure cause, not a code cause; evaluate changing to `cancel-in-progress: false` (queue the new run) or adding a pre-exit hook that the cancel signal triggers; the current setup means any session that runs for >60 minutes has a guaranteed kill before completion
- 🔲 27.34 — Honesty: SM-computed `skills_count` must reflect actual file count — the metrics table has `skills_count=12` across all historical rows, but `ls ~/.otherness/agents/skills/ | wc -l` currently returns 15; the SM is writing a stale or hardcoded value rather than computing the count at batch time; add an explicit `SKILLS_COUNT=$(ls ~/.otherness/agents/skills/*.md 2>/dev/null | wc -l)` computation in SM §4b before writing the metrics row; without this, the `skills_delta` calculation introduced in 27.31 will compute deltas from wrong baselines and the learning velocity signal will be misleading
- 🔲 27.35 — Honesty: `predicted_prs` and `skills_delta` columns added to metrics header but SM never writes them — PR #604 added a comment block to `docs/aide/metrics.md` documenting the new `predicted_prs` and `skills_delta` columns, but the SM phase code in `~/.otherness/agents/phases/sm.md` was not updated to populate them; every row written after PR #604 has `-` in both new columns, rendering the columns decorative rather than functional; update SM §4b to (1) compute PREDICTED_PRS from COORD queue depth at session start and write it at the beginning of the batch, and (2) compute SKILLS_DELTA as current_count minus the prior row's count and include it in the metrics row write
- 🔲 27.36 — Visibility: `docs/aide/vision.md` donation readiness table updated manually — the "Donation Readiness Gap Analysis" section in `docs/aide/vision.md` was written manually and is not updated by any automated scan; as gaps are resolved (e.g. GOVERNANCE.md, CODE_OF_CONDUCT.md shipped in PR #592) the table should move items from the gap list to "Already addressed"; the vibe-vision-auto scan should check each hard-blocker and significant-gap row against the merged PR list and move resolved items to the "Already addressed" section, rather than requiring a human to read every PR and update the table by hand

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
