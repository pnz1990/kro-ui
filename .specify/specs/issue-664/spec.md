# Spec: issue-664 — E2E slow-API / fetch-timeout scenario (27.19)

> Status: Active | Created: 2026-04-22

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.19 — E2E slow-API / fetch-timeout scenario:
  add a journey using `page.route()` to verify loading indicator, timeout
  error display, and retry button behavior (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: Journey `084-fetch-timeout.spec.ts` MUST exist in
`test/e2e/journeys/` and be added to chunk-9 in `playwright.config.ts`.
Violation: the journey file is absent, or chunk-9 does not match `084`.

**O2**: The journey MUST use `page.route()` with a delayed response to
simulate a slow/hanging API call, and assert that the UI shows a loading
indicator during the delay.
Violation: the journey mocks no routes, or there is no loading-state assertion.

**O3**: The journey MUST simulate a fetch timeout (using `route.abort('timedout')`
or a fulfilled response with `abort: true` equivalent) and assert that the UI
shows a user-readable error state — not a blank page, not raw `"failed to fetch"`.
Violation: the timeout path is not exercised, or the error state assertion is absent.

**O4**: The journey MUST assert that clicking the Retry button (`.home__retry-btn`
or equivalent) triggers a new fetch attempt — i.e. the loading indicator
reappears after clicking Retry.
Violation: the retry button is not tested.

**O5**: The design doc `docs/design/27-stage3-kro-tracking.md` MUST have
item 27.19 updated from `🔲 Future` to `✅ Present`.
Violation: the design doc still shows `🔲 27.19`.

---

## Zone 2 — Implementer's judgment

- The frontend's `withTimeout()` uses `AbortSignal.timeout(30_000)`.
  Waiting 30s in E2E is impractical; instead use `route.abort('timedout')`
  which immediately raises `net::ERR_TIMED_OUT` — the same error path as a
  30s timeout (the browser throws a `DOMException {name: "AbortError"}`).
- Loading indicator: the Overview page sets a loading state while fetching;
  use a route that delays 1s and assert `.home__loading` or a spinner is
  visible during the delay window.
- Error state: the Overview page renders `<div class="home__error" role="alert">`
  when all API calls fail — assert this contains a non-empty message.
- Retry: after the error state appears, click the retry button; assert the
  loading state reappears (even momentarily) or the page re-fetches.

---

## Zone 3 — Scoped out

- Simulating a 30s timeout with actual wall-clock wait — would exceed the
  60s per-test budget.
- Testing timeout on all 4 error-state pages (076–079) — this spec covers
  the Overview page only; extending to other pages is a future item.
- Testing `AbortSignal.any()` polyfill behavior — complex multi-signal
  scenarios are unit-testable; E2E only tests the user-visible path.
