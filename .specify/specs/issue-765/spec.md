# Spec: issue-765

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: 30.1 — Health state prediction: when an instance has been reconciling for >2× its historical average reconcile time (tracked in session via `useHealthTrend`), surface a yellow "taking longer than usual" banner on the instance detail page; no new backend required; threshold configurable via a `RECONCILE_SLOW_FACTOR=2` constant

---

## Zone 1 — Obligations (falsifiable)

- **O1**: When an instance is currently reconciling AND reconciling duration > `RECONCILE_SLOW_FACTOR` × average ready-cycle time (estimated from condition `lastTransitionTime` delta), a yellow informational banner appears on the Instance detail page with text "taking longer than usual". Falsifiable: render InstanceDetail with a mock instance where reconciling duration is 3× estimated average → banner is visible.
- **O2**: When the instance is NOT reconciling, no "taking longer than usual" banner is shown. Falsifiable: render with ACTIVE instance → no banner.
- **O3**: The `RECONCILE_SLOW_FACTOR` constant is defined as `2` and exported from the utility module where the prediction logic lives. Falsifiable: `grep -q 'RECONCILE_SLOW_FACTOR = 2' src/...`.
- **O4**: The banner uses `--color-warning` / `--color-warning-bg` tokens (no hardcoded hex/rgba). Falsifiable: grep banner CSS for hex/rgba → empty.
- **O5**: The prediction logic is a pure function, unit-tested. Falsifiable: `describe('predictReconcileDelay', ...)` exists in test file with ≥3 test cases.

---

## Zone 2 — Implementer's judgment

- Average ready-cycle time estimation: use the time since the *oldest* condition with a non-True status (same as `reconcilingSinceMinutes` pattern in InstanceDetail). When no prior completed cycle is available (first reconcile), the banner is suppressed — no data to compare against.
- The "average" in this spec means: the session average from `healthSamples` — specifically, from the RGD-level samples, we can estimate using the last known `reconciling` count transition. However, since `useHealthTrend` is RGD-level, the simpler approach is to track per-instance reconcile start time and compare against `RECONCILE_SLOW_FACTOR × STUCK_RECONCILING_THRESHOLD_MINS / 2` (5 min) as the baseline.
- **Revised approach**: The design doc mentions `RECONCILE_SLOW_FACTOR=2` and "2× historical average". Without actual historical per-instance data (this is a first-session view), the baseline is the stuck-reconciling threshold ÷ 2 (= 5 minutes). If reconciling for >10 minutes (= 2× 5m), show the banner.
- This integrates naturally with the existing `reconcilingSinceMinutes` function in `InstanceDetail.tsx`.
- Banner should NOT show when the stuck-reconciling banner is already shown (10 min escalation already fires at 10 min). The "taking longer than usual" banner fires at 5 min, escalates to stuck at 10 min.

---

## Zone 3 — Scoped out

- Per-instance reconcile history persistence (localStorage, backend)
- Statistical averaging across multiple reconcile cycles (first-session only)
- "Predicted time to ready" estimate (out of scope for this item)
