# Spec: issue-711 — Instance management: stuck-reconciling escalation banner

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Instance management: stuck-reconciling escalation banner (🔲 → ✅)

## Summary

An instance can be in `reconciling` state for hours with no transition and no UI
escalation. The deletion debugger (TerminatingBanner) escalates after 5 minutes, but
no equivalent exists for instances stuck in reconciling state.

The existing reconciling banner escalates at 5 minutes but lacks a concrete kubectl
suggestion. This spec upgrades the escalation to trigger at 10 minutes and adds a
specific `kubectl describe` command to help operators diagnose the issue.

---

## Zone 1 — Obligations

**O1**: The reconciling banner MUST NOT escalate until the instance has been
continuously reconciling for ≥ 10 minutes (threshold = 600 seconds).

**O2**: When the stuck threshold is reached, the banner text MUST include the exact
`kubectl describe <kind> <name> [-n <namespace>]` command the operator should run
as the first debugging step.

**O3**: The escalated banner MUST be visually distinct from the normal reconciling
banner (color change to error-style amber/red palette).

**O4**: The escalation MUST NOT appear when the instance is in Terminating state
(the TerminatingBanner already handles that case).

**O5**: The `reconcilingSinceMinutes` function MUST correctly derive elapsed time
from the oldest unfulfilled condition's `lastTransitionTime`, not `creationTimestamp`.

---

## Zone 2 — Implementer's judgment

- The threshold (10 minutes) is a constant `STUCK_RECONCILING_THRESHOLD_MINS = 10`.
- The existing `formatReconcileDuration` helper is reused for the elapsed time display.
- The kubectl command shows `kubectl describe` (read-only diagnostic), not a mutating command.
  For cluster-scoped instances, the `-n` flag is omitted.

---

## Zone 3 — Scoped out

- Persistent notifications (outside this session)
- Automatic retry / self-healing logic
- Per-condition drill-down within the banner (handled by ConditionItem)
