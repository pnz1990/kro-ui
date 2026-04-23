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

- 🔲 29.1 — Instance reconciliation timeline: a per-instance horizontal timeline showing state transitions (pending → reconciling → ready, or → error) with timestamps from condition `lastTransitionTime`; operators currently have no way to tell how long a given state has been active without cross-referencing raw YAML; timeline view on the Instance detail Conditions tab (or new Timeline sub-tab); requires no backend change (data is in conditions already); display window: last 10 transitions per node — ⚠️ Inferred from recurring operator question "how long has this instance been stuck?"
- 🔲 29.2 — Live DAG node selection keyboard shortcut: pressing `/` (forward slash) while the Instance detail live DAG is focused opens a node-search box that filters nodes by kind or ID; pressing Enter selects the top match and opens its detail panel; this completes the keyboard navigation story started by DAG arrow-key navigation (doc 28 + WCAG 2.1 SC 2.1.1) — the arrow-key approach requires knowing the layout; search lets operators jump directly to the node they care about
- 🔲 29.3 — Instance comparison: when 2+ instances of the same RGD are in different health states (one ready, one error), the operator has no quick way to spot which resource is the difference; add a "Compare with healthy" button in the error-state instance detail that opens a 2-column diff of the live DAG node states (not YAML) — showing which nodes are red vs green in each instance side-by-side; this is a higher-level diff than the spec diff in 29.present (which diffs YAML, not live health)
- 🔲 29.4 — Per-node reconciliation duration badge: each live DAG node shows how long it has been in its current state (e.g. "reconciling 4m32s"); for ready nodes, shows time since last transition; this answers the most frequent operator triage question ("has this node always been stuck or did it just transition?") without requiring YAML inspection; data source is `conditions[type=Ready].lastTransitionTime`; badge uses the `formatAge()` utility (already exists in `@/lib/format.ts`)
- 🔲 29.5 — Loop honesty gate: instance management features must have user-visible E2E coverage before being marked ✅ — the "ship a feature, write no journey" pattern has produced Present items with no test evidence; add a Zone 1 obligation: every new Present item in doc 29 MUST reference a journey number (e.g. "E2E journey 09X") before it can be promoted from 🔲 to ✅; this is a self-policing quality gate for this specific surface area — it ensures the reliability signal (CI green = product works) is actually true for instance management
- 🔲 29.6 — Reliability: instance management shipped 4 features in the last week (health snapshot, sparkline, stuck-escalation, namespace pills) but the loop's pressure scan still shows "reliability not good enough"; the disconnect is that features are shipping but the question is whether they advance toward donation — add a `donation_relevance` tag (high/medium/low) to each Future item in this doc, where "high" means "a kubernetes-sigs reviewer would specifically ask about this"; shipping medium-relevance features while high-relevance gaps remain open is a form of loop dishonesty that the SM must detect and correct; this is the donation-readiness bridge from instance management to the broader loop health signal

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

