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

- 🔲 Slow-API / fetch-timeout E2E scenario: `AbortController` and `withTimeout()` (30s, added PR #652) plumbing is untested in CI; add a kind-cluster E2E journey that delays an API endpoint via tc-netem or a mock handler and asserts the UI shows a "Request timed out" error rather than hanging indefinitely (GH #664, doc 27 §27.19)
- 🔲 Scale E2E fixture: the largest test-app RGD has ~15 nodes; add a 50-node and 50-RGD fixture to the kind cluster CI to catch scale regressions before they surface in production; DAG minimap, VirtualGrid card math, and the DAGScaleGuard fallback are all tested manually but never under scale conditions in CI (GH #663, doc 27 §27.18)

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

