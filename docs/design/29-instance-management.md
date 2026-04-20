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

## Future (🔲)

- 🔲 Instance bulk operations: select multiple instances, bulk delete with confirmation
- 🔲 Instance diff: full side-by-side comparison between two instance snapshots
- 🔲 Instance resource graph: show all k8s resources owned by this instance

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

