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

## Present (✅) — continued

- ✅ Fleet per-cluster inner deadline: `summariseContext()` in `fleet.go` adds `context.WithTimeout(parent, 5*time.Second)` as its first statement; the errgroup fan-out uses the bounded context; `TestFleetSummaryHandler_ContextTimeout` verifies the response completes within 6s when a cluster's `List()` hangs indefinitely (PR #653, 2026-04)

## Future (🔲)

- 🔲 Instance management: stuck-reconciling escalation banner — an instance can be in `reconciling` state for hours with no transition and no UI escalation; the deletion debugger escalates for *terminating* instances after 5 minutes (PR #290) but no equivalent exists for *reconciling* instances that are not terminating; add a "stuck reconciling" banner that triggers when an instance has been continuously in `reconciling` state for >10 minutes (detected via `creationTimestamp` vs current time or the last observed state-transition in conditions); the banner should show elapsed time and suggest `kubectl describe <kind> <name>` as a first debugging step; consistent with the terminating escalation pattern
- 🔲 Instance management: namespace instance count summary — the `/instances` page shows all instances from all namespaces but has no aggregate view of "how many instances per namespace"; an operator managing 20 namespaces cannot see at a glance which namespace has the most activity or the most errors; add a namespace summary header or collapsible group row to the `/instances` table that shows `N instances (M errors)` per namespace when more than 1 namespace is present
- 🔲 Instance management: live DAG polling pause on tab background — the live DAG polls at 5s unconditionally; a user who leaves an instance detail page open overnight generates thousands of unnecessary List API calls; add automatic pause when `document.visibilityState === 'hidden'` (tab backgrounded) and resume when foregrounded; also add a manual "Pause live updates" toggle; this reduces API load and prevents the aria-live region (PR #670) from announcing state transitions to screen reader users who are focused on a different tab

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

