# Spec: issue-582 — Error state for unreachable cluster on initial load

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: "Error state for unreachable cluster on initial load" (🔲 → ✅)

## Summary

When the cluster API server is unreachable at page load time, all widget data fetches
fail simultaneously. The current behavior shows individual "failed to fetch" states per
widget. This spec adds a global "cluster unreachable" banner that fires when >50% of
initial fetches fail within 5s, so first-time users get a clear actionable message
rather than a page full of error fragments.

---

## Zone 1 — Obligations

**O1**: A global `ClusterUnreachableBanner` MUST appear in the `Layout` component
when ≥50% of parallel API calls from an initial page load fail with network errors
(connection refused, failed to fetch, or similar).

**O2**: The banner MUST include an actionable message: "Cannot reach cluster — check
that kro-ui is running and the kubeconfig context is reachable." plus a retry button.

**O3**: The banner MUST be dismissible by the user. Once dismissed, it does not
reappear until the next page load or context switch.

**O4**: The banner MUST NOT appear when individual widget errors occur that are not
network-level failures (e.g. 404, 403, 500 errors that indicate the server is reachable).

**O5**: The detection uses `isNetworkError(err)` — a testable pure function that
returns true for `TypeError: Failed to fetch`, `connection refused`, and `dial tcp`
patterns but NOT for HTTP error responses (which indicate the server is reachable).

**O6**: The banner MUST be rendered in the `Layout` component (above the `<main>`
content area, below the version-warning banner), visible on all pages.

**O7**: The banner MUST have `role="alert"` and `data-testid="cluster-unreachable-banner"`.

**O8**: The `isNetworkError` function MUST be exported from `@/lib/errors` and covered
by unit tests.

---

## Zone 2 — Implementer's judgment

- Detection threshold: 50% of fetches that report errors is the trigger threshold.
  The Layout already calls `getCapabilities()` on startup — this is the primary
  network probe. If it fails with a network error AND the prior fetch of contexts
  also fails with a network error, that's 2/2 = 100% → show the banner.
- The banner resets on context switch (same as the version-warning banner).
- Banner styling: use `--color-status-error` background-light variant, consistent
  with the version-warning banner but in error-red rather than amber.
- The Layout already has a single `getCapabilities` fetch; to implement the >50%
  rule cleanly, also check whether `listContexts` failed. Both are initial probes.
- Retry button calls `window.location.reload()` — the simplest actionable response
  when the server itself is unreachable.

---

## Zone 3 — Scoped out

- Backend ping endpoint — detection is purely frontend-side via fetch error inspection
- Continuous polling to auto-detect recovery — user clicks Retry
- Per-page unreachable states (each page already handles its own errors)
- Distinguishing "kro-ui process down" vs "cluster unreachable" (both surface the same message)
