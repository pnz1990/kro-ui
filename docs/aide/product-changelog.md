# Product Changelog — kro-ui

> Advancement signal: last 10 user-visible features shipped across docs 28–31.
> Updated by the SM after each batch. Single-page answer to "is the product moving forward?".
> Distinct from `metrics.md` (batch velocity) and `loop-health.md` (system health).

| Feature | Docs area | Date shipped | PR |
|---|---|---|---|
| RGD complexity score badge and default sort on Catalog cards | 28 — RGD Display | 2026-04-23 | #791 |
| Slow-reconcile "taking longer than usual" banner on instance detail | 30 — Health System | 2026-04-23 | #783 |
| Designer onboarding guided tour (4-step overlay, localStorage key) | 31 — RGD Designer | 2026-04-23 | #790 |
| Reconciliation timeline on ConditionsPanel (sparkline of condition transitions) | 29 — Instance Health | 2026-04-23 | #785 |
| Changes-since-last-revision banner on RGD Graph tab (GraphRevision delta) | 28 — RGD Display | 2026-04-23 | #782 |
| Lighthouse score diff comment on PRs (PR vs main baseline with delta) | 28 — RGD Display | 2026-04-23 | #757 |
| Designer: apply-to-cluster action via POST /api/v1/rgds/apply | 31 — RGD Designer | 2026-04-23 | #752 |
| CEL expression linter for readyWhen/includeWhen fields in Designer | 31 — RGD Designer | 2026-04-22 | #743 |
| Namespace instance count summary with clickable pills | 29 — Instance Health | 2026-04-22 | #734 |
| Stuck-reconciling escalation banner at 10 minutes with kubectl describe | 29 — Instance Health | 2026-04-22 | #738 |

---

> **How to update**: After each batch, remove the oldest row and prepend the newest shipped feature.
> Format: `| Feature description | Doc N — Doc Name | YYYY-MM-DD | #PR |`
> Keep exactly 10 data rows.
