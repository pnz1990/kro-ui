# Loop Health Dashboard

> Updated by: vibe-vision-auto (initial stub) | SM phase should update this every batch.
> See doc 27 §27.29 — the SM must be programmed to write this file.

---

## Quick Glance

| Signal | Value |
|--------|-------|
| **Loop status** | 🟡 AMBER — SM not yet writing this file (27.29 open) |
| **Last feature PR** | #605 feat(web): instance full YAML diff — side-by-side line diff for two instance snapshots |
| **Next priority** | 27.28 (simulation non-functional), 27.29 (SM must write this file), 27.30 (COORD slot reservation) |

---

## Current State (2026-04-21)

- **Total PRs merged**: ~605
- **Open queue items**: 17 open issues
- **Donation readiness**: Hard blockers resolved; significant gaps remain (see vision.md)
- **Active work**: Instance resource graph (issue #538), bulk operations (issue #536/537)
- **E2E journeys**: 81 journey files | passing 344–352 per CI run

---

## Loop System Health

| Pressure lens | Status | Gap item |
|---|---|---|
| Reliability | 🟡 AMBER | 27.22 (busywork spiral detector), 27.30 (COORD slot reservation) |
| Loop honesty | 🟡 AMBER | 27.23 (quantitative GREEN threshold), 27.28 (simulation non-functional) |
| Self-improvement | 🔴 RED | 27.24 (skills stuck at 12), 27.25 (frame-lock undetected) |
| Onboarding | 🟡 AMBER | 27.27 (onboarding untested) |
| Visibility | 🟡 AMBER | 27.29 (SM not writing this file), 27.26 (file exists but SM not updating it) |

---

## Metrics Table (recent batches)

| Date | Batch | prs_merged | needs_human | ci_red_hours | skills_count | todo_shipped | notes |
|------|-------|-----------|-------------|--------------|-------------|-------------|-------|
| 2026-04-20 | 1 | 16 | 0 | 0 | - | 1 | sess-412931da; PR #457 (operator journey) |
| 2026-04-20 | 2 | 3 | 0 | 0 | - | 3 | sess-412931da; PRs #460,#461 (SRE+Dev journeys) |
| 2026-04-20 | 3 | 31 | 0 | 0 | 12 | 1 | sess-475a6159; PR #498 (fleet/metrics coverage) |
| 2026-04-20 | 4 | 44 | 0 | 0 | 12 | 1 | sess-7780ed82; PR #503 (usePageTitle test) |
| 2026-04-20 | 5 | 47 | 0 | 0 | 12 | 1 | sess-bea1648c; PR #509 (pickPod coverage) |
| 2026-04-20 | 6 | 48 | 0 | 0 | 12 | 1 | sess-a2827ba4; PR #514 (scrapeWithCache 100%) |
| 2026-04-20 | 7 | 49 | 0 | 0 | 12 | 1 | sess-a2827ba4; PR #516 (handlers coverage) |
| 2026-04-20 | 8 | 55 | 0 | 0 | 12 | 5 | sess-e227815e; PRs #510,#512,#521,#522 |
| 2026-04-20 | 51 | 16 | 0 | 0 | 12 | 3 | sess-2dcdc244; PRs #545,#546,#547 (kro-upstream-check, a11y, error-state journeys) |

**Note**: Batches 3–8 are chore-only (coverage micro-PRs). The SM was reporting GREEN throughout.
This is the pattern that prompted items 27.22 and 27.23.

---

## Donation Readiness Summary

| Category | Status |
|---|---|
| Hard blockers | 3/4 resolved (GOVERNANCE, CoC, OWNERS ✅; supply chain signing 🔲 27.10) |
| Significant gaps | 8 open (DAG scale, GraphRevision diff, partial-RBAC, color-blind health, bundle size, fleet timeout, scale fixture, frontend timeout) |
| Community | 1 approver — need 2nd for kubernetes-sigs (27.24 community outreach) |

---

> **SM implementation required (27.29)**: Add a step to `phases/sm.md §4f` that runs after posting the issue comment and writes this file with current batch data. The vibe-vision-auto scan will promote 27.26 and 27.29 to ✅ once the SM is consistently updating this file.
