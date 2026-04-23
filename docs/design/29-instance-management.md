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

- 🔲 Reliability: live DAG polling pause (issue #719, PR #736) shipped but the E2E journey asserting the pause/resume behavior was never written — PR #736 merged the feature but no Playwright journey step covers: (a) tab becoming backgrounded pauses the 5s poll, (b) the manual "Pause"/"Resume" toggle button works, (c) the poll resumes on tab foreground; without E2E coverage a regression in the `usePolling` pause logic will pass CI; add a journey step to `005-instance-detail-live.spec.ts` or a dedicated chunk-9 journey (date: 2026-04-23)
- 🔲 Onboarding: the deletion debugger surface is never shown to a new user until they encounter a stuck Terminating instance — operators unfamiliar with kro finalizers need to know the debugger exists before they are in a production incident; add a discoverable "What is this?" help link on the Terminating banner that opens an explanatory tooltip with: (1) what kro finalizers are, (2) why instances get stuck, (3) what the `kubectl patch` command does; this converts an emergency tool into an educational one (date: 2026-04-23)
- 🔲 Self-improvement: the 6-state health model has no automated conformance test — any change to `extractInstanceHealth()` or `isReconciling()` that breaks the IN_PROGRESS→reconciling or Ready=False+reason=NotReady→reconciling mappings will pass CI unless explicitly tested; add a unit test suite `web/src/lib/health.test.ts` with ≥12 cases covering each of the 6 states from raw kro API responses (including the AGENTS.md anti-patterns: IN_PROGRESS, ResourcesReady.reason=NotReady, degraded=Ready=False without IN_PROGRESS); this is a regression guard for the most bug-prone logic in kro-ui (date: 2026-04-23)
- 🔲 Visibility: instance namespace count pills (PR #734, spec issue-718) have no hover tooltip explaining what the badge numbers mean — first-time users see "default 3" and "production 7" without knowing these are instance counts per namespace; the "M err" badge on pills is ambiguous (error? erroring instances?); add `title` attributes and an `aria-label` to each pill: "3 instances in namespace default" and "2 error instances in namespace production"; also add a brief legend line above the pills: "Instances per namespace" (already has aria-label — expose it as visible text when >3 namespaces are shown) (date: 2026-04-23)
- 🔲 Reliability: `ListAllInstances` fan-out has no circuit-breaker for clusters that consistently time out — the 5s per-goroutine timeout (increased from 2s in PR #352) allows 1 slow cluster to add 5s to every `/instances` page load; if a cluster is consistently unreachable, subsequent sessions waste 5s*N (where N = number of contexts) on timeouts; add a per-context error rate tracker in the response cache: if a context has returned a timeout error in ≥3 of the last 5 calls, skip it in the fan-out and add a "context unreachable (cached)" entry in the response; restore it to active after a successful call (date: 2026-04-23)

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

