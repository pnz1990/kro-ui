# Spec: Health Alert Subscriptions (issue-540)

> Status: Draft | Author: otherness[bot] | Date: 2026-04-21

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Health alert subscriptions: notify when RGD/instance enters error state (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1** — A "Subscribe to health alerts" button appears in the top bar. Clicking it requests
browser Notification permission when not yet granted. While subscribed, the button shows
an active/enabled state (filled bell icon or equivalent visual indicator).

**O2** — When an instance transitions to `error` or `degraded` health state during a 5-second
polling cycle, and the user is subscribed, a browser Notification is dispatched with:
  - Title: `kro-ui: Health Alert`
  - Body: `<InstanceName> (<Namespace>/<RGDName>) → <state>` (e.g. "my-app (default/webapp) → error")
  - No alert is fired for states: ready, reconciling, pending, unknown

**O3** — Alerts fire on transition only. If an instance is already in `error` at subscription
time, no alert is fired for it. If it was in `error` on the previous poll and still is on
the next poll, no duplicate alert is fired. The first transition from non-error → error fires
once. Re-entering error after recovering also fires once.

**O4** — If the browser denies notification permission, the button shows a "notifications
blocked" state (muted/disabled bell icon + tooltip "Notifications blocked by browser"). No
silent failure — the user can see why alerts are not working.

**O5** — The subscription state is per-session only. Refreshing the page starts unsubscribed.
No localStorage, no backend changes.

**O6** — The feature degrades gracefully when `Notification` API is not available (e.g.
non-https context or old browser): the subscribe button is hidden entirely or shown as
disabled with tooltip "Browser notifications not supported".

**O7** — The subscribe/unsubscribe toggle is accessible: the `<button>` has `aria-label`
set to "Subscribe to health alerts" (unsubscribed) or "Unsubscribe from health alerts"
(subscribed), and `aria-pressed` reflects the subscription state.

---

## Zone 2 — Implementer's judgment

- Icon choice: a bell icon using CSS or Unicode; must be consistent with other TopBar icons
- Placement: right side of TopBar, before or after the context switcher
- Notification icon: default browser notification icon is acceptable
- Alert deduplication: the previous-state tracking may be a React `useRef` map keyed by
  `namespace/instanceName` in the consuming page component, or a custom hook
- Which pages track health transitions: at minimum, the Home (Overview) page where all
  instances across all RGDs are polled. The feature need not cover every page that shows
  instances (InstanceDetail, RGDDetail) in the first iteration.

---

## Zone 3 — Scoped out

- Backend changes: no new Go API endpoints
- Persistent subscriptions across page refreshes (localStorage)
- Email/Slack/webhook notifications
- Alerts for states other than error/degraded (reconciling transitions, etc.)
- Per-RGD granular subscription (subscribe to alerts for just one RGD)
- Sound/vibration on notification
- Mobile push notifications

---

## Tasks

- [x] Write spec
- [ ] Implement `useAlertSubscription` hook (manages permission state + transition tracking)
- [ ] Implement `AlertBellButton` component in TopBar
- [ ] Wire home-page polling to call `checkTransitions(instances)` on each successful fetch
- [ ] Write unit tests for hook and component
- [ ] Self-validate: build + test + lint
- [ ] Update design doc 30-health-system.md (🔲 → ✅)
- [ ] Commit and open PR
