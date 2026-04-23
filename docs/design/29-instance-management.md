# 29 — Instance Management

> Status: Active | Created: 2026-04-20
> Applies to: pnz1990/kro-ui

---

## What Instance Management covers

The instance management surface spans the global instance list, per-RGD instance tables,
instance detail with live DAG, and tools for debugging stuck or terminating instances.

---

## Present (✅)

- ✅ Instance list: table with namespace filter per RGD (PR #46, 2026-04)
- ✅ Instance detail live: Live DAG with 5s polling, node YAML (PR #48, 2026-04)
- ✅ Instance telemetry panel: age, state, children health (PR #134, 2026-04)
- ✅ Instance health rollup: 5-state badges, error count on cards (PR #136, 2026-04)
- ✅ Instance deletion debugger: Terminating banner, finalizers, events tab (PR #142, 2026-04)
- ✅ Live DAG per-node state: pending state, per-child conditions, tooltip wiring (PR #180, 2026-04)
- ✅ DAG instance overlay: overlay active/excluded nodes on RGD DAG (PR #137, 2026-04)
- ✅ Global instance search: /instances page + GET /api/v1/instances fan-out (PR #327, 2026-04)
- ✅ Instance namespace filter: /instances namespace dropdown + health state filter chips (PR #345, 2026-04)
- ✅ Instance diff: F-8 snooze error DAG nodes; YAML diff foundation (PR #318, 2026-04)
- ✅ Degraded health state (6th state), multi-segment health bar, copy instance YAML button (PR #277, 2026-04)
- ✅ WARNINGS counter includes failed/unknown conditions (PR #328, 2026-04)
- ✅ Instance diff: full side-by-side YAML comparison — LCS-based line diff with added/removed highlights; "Compare full YAML" button alongside spec diff in InstanceTable (PR #537, 2026-04)
- ✅ Instance bulk operations: multi-select + bulk YAML export on /instances page (PR #536, 2026-04)
- ✅ Instance resource graph: show all k8s resources owned by this instance, grouped by kind, with health status dots and clickable rows (spec issue-538, 2026-04)
- ✅ Partial-RBAC instance visibility: `ListAllInstances` tracks forbidden RGDs via atomic counter and returns `rbacHidden` in response; `ListInstances` returns 200 + `{"items":[],"warning":"insufficient permissions"}` on Forbidden; `/instances` page and RGD detail Instances tab show "N RGD(s) hidden — insufficient permissions" when rbacHidden > 0; Go unit tests + E2E journey 081 (spec issue-648, 2026-04)
- ✅ Namespace instance count summary: when >1 namespace is present on `/instances` and no namespace filter is active, a row of clickable namespace pills appears below the health filter chips showing `{name} {N}` with an additional `M err` badge on pills with erroring instances; clicking a pill filters the table to that namespace (also hides the summary); pills are sorted by instance count desc; accessible via `role="group" aria-label="Instances per namespace"` (spec issue-718, 🔲→✅ 2026-04)

## Present (✅) — continued

- ✅ Fleet per-cluster inner deadline: `summariseContext()` in `fleet.go` adds `context.WithTimeout(parent, 5*time.Second)` as its first statement; the errgroup fan-out uses the bounded context; `TestFleetSummaryHandler_ContextTimeout` verifies the response completes within 6s when a cluster's `List()` hangs indefinitely (PR #653, 2026-04)
- ✅ Stuck-reconciling escalation banner: reconciling banner escalates to error-style "stuck" variant after 10 minutes with an explicit `kubectl describe <kind> <name>` command; cluster-scoped instances omit the `-n` flag; 3 unit tests cover the 10-minute threshold, command format, and cluster-scoped case (spec issue-711, 2026-04)

## Future (🔲)

- 🔲 Instance "time in current state" display — the instance detail page shows health state (e.g. `reconciling`) but not how long the instance has been in that state; an operator cannot tell if an instance has been reconciling for 30 seconds or 30 hours without checking events manually; add a `stateAge` field derived from the most recent condition `lastTransitionTime` showing "in this state for N"; display it in the telemetry panel alongside Age; if `stateAge > 10m` and state is `reconciling`, auto-trigger the stuck-reconciling escalation banner (which currently only activates from a client-side timer, not from a persisted transition timestamp); this closes the reliability gap: operators today must stay on the page to catch the 10-minute escalation — if they navigate away and return, the timer resets (reliability lens, 2026-04-23)
- 🔲 Instance YAML export includes status — the "Copy YAML" button (PR #277) produces a stripped YAML that removes `managedFields`, `resourceVersion`, `uid` (PR #291); but `status` is also stripped, meaning the exported YAML omits the current health state, conditions, and ready information; add a toggle "Include status" in the copy menu that preserves `status.conditions`, `status.state`, and `status.ready` for debugging; the default (off) keeps the apply-safe stripped format; this addresses the honesty lens: the feature is called "Copy YAML" but silently omits information the operator needs for debugging — the current behavior should be an explicit "Copy apply YAML" label and the debug variant should be accessible (loop honesty lens applied to product, 2026-04-23)
- 🔲 Cross-instance reconciling time distribution — the global `/instances` page (PR #327) shows health states but gives no aggregate signal on reconciliation performance; add a panel below the health filter chips showing "median reconcile time: N seconds" and "p95 reconcile time: N seconds" computed from the `stateAge` of instances that just reached `ready` state in the current browser session (from reconciling to ready delta); this is a zero-persistence, in-session metric that gives SRE operators an instant performance signal without requiring Prometheus; addresses the visibility lens: a human looking at GitHub (or at the product) cannot quickly tell if the system is healthy, what it shipped today, and whether instances are converging fast or slowly (visibility lens, 2026-04-23)
- 🔲 Instance finalizer resolution guide — the deletion debugger (PR #142) shows blocking finalizers but gives no guidance on how to remove them; when the `kubectl patch` command is shown in the stuck-finalizer escalation banner (PR #290), it removes ALL finalizers; this is dangerous if some finalizers are legitimate; add a `?` help icon next to each finalizer that, when hovered, shows a one-line explanation of what that finalizer does (from a static map of known kro finalizers + a "unknown finalizer" fallback); for the `kro.run/finalizer` specifically, explain that it will be removed automatically when kro finishes processing; this closes the onboarding lens gap for deletion workflows: a new kro operator seeing "Terminating for 6 minutes" today has no idea whether to wait or intervene (onboarding lens, 2026-04-23)
- 🔲 Instance list silent empty-state disambiguation — when an RGD has `status.active = false`, the instance list shows "no instances" (PR #296) but the empty state gives no context on WHY the RGD is inactive; the message should distinguish between: (1) RGD is inactive because compile failed → link to ValidationTab; (2) RGD is inactive because it was just created → show "RGD is compiling — instances will appear here once compilation succeeds"; (3) RGD is active but truly has no instances → show the existing "no instances" state with a "Create instance →" CTA; three different situations currently render identically, meaning the empty state is visually correct but semantically wrong — the system knows which case applies but discards that information before display (loop honesty lens, 2026-04-23)

---

## Zone 1 — Obligations

**O1**: Instance health state MUST be visible without entering the detail page.
**O2**: Terminating instances MUST surface the blocking finalizers and their resolution path.
**O3**: Instance YAML copy MUST produce valid kubectl-apply-able YAML.

---

## Zone 2 — Implementer's judgment

- Polling interval for live DAG: 5s is the established default; configurable via feature flag.
- Health state machine: 6 states (unknown, pending, reconciling, degraded, ready, error); do not add states without design review.

---

## Zone 3 — Scoped out

- Instance mutation (editing YAML and applying to cluster) — read-only UI
- Instance resource quota / resource usage metrics

