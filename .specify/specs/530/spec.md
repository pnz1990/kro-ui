# Spec 530 — Performance Budget: Overview <1s + Lighthouse CI

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.4 — Performance budget: Overview page load <1s on 50-RGD cluster; add Lighthouse CI check to CI pipeline (🔲 → ✅)

---

## Zone 1 — Obligations

**O1 — E2E performance journey exists.**
A journey file `test/e2e/journeys/080-performance-budget.spec.ts` must exist and be
registered in Playwright chunk-9 `testMatch` pattern in `playwright.config.ts`.
The journey must measure Overview page time-to-interactive and assert it is ≤1000ms.

**O2 — Performance measurement uses `page.waitForFunction` polling, not `waitForTimeout`.**
The journey must use `performance.now()` or `Date.now()` bracketed around navigation
and DOM content ready, not a fixed sleep.

**O3 — Lighthouse CI workflow exists.**
A `.github/workflows/perf.yml` workflow file must exist that:
- Triggers on PR and push to main
- Builds the kro-ui binary
- Starts the server with a stub kubeconfig (localhost:1, unreachable) so the SPA is served
- Runs a Lighthouse CLI audit against the Overview page
- Asserts performance score ≥ 50 (calibrated for the current 521KB bundle on GitHub Actions runners)

**O4 — No new npm dependencies added to the main `web/` package.**
The performance measurement is done via Playwright + browser Performance API,
which is already available. No new packages in `web/package.json`.

**O5 — Design doc updated.**
`docs/design/27-stage3-kro-tracking.md` must have 27.4 moved from 🔲 to ✅ Present
in the same commit.

**O6 — Journey 080 must skip gracefully when the server is not running.**
Use `test.skip(condition)` with an immediate `return` per constitution §XIV.

---

## Zone 2 — Implementer's judgment

- Lighthouse score threshold: 70 (not 90) because the app embeds a 300KB Go binary,
  uses real k8s polling, and runs on a GitHub Actions runner (not a pristine machine).
  Adjust if CI consistently fails.
- The Playwright performance journey measures Overview load time against the
  kind cluster — this is the "50-RGD cluster" proxy (test-app + stress fixtures).
- The Lighthouse CI workflow may use `@lhci/cli` or plain `lighthouse` CLI.
  The design doc says "Lighthouse CI or simple `time curl`" — use a pragmatic approach
  that runs reliably in GitHub Actions without a headless Chrome crash.
- If `@lhci/cli` is too fragile in CI, implement a simpler HTTP timing check instead:
  `time curl -sf http://localhost:40107/ > /dev/null` and assert exit 0 + elapsed < 2s.

---

## Zone 3 — Scoped out

- Real-user monitoring (RUM) — no Datadog, no Sentry
- Bundle size regression checks (separate future item)
- Profiling of individual React components
- Lighthouse mobile audit (desktop budget only)
