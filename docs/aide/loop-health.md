# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-22 (scan 5).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20); CI outage ~5h (#731 resolved) |
| **Last feature PR** | PR #736 — feat(polling): live DAG polling pause on tab background + manual toggle (issue #719, 2026-04-22) |
| **Last meaningful feature PR** | PR #736 — DAG polling pause; PR #733 — zero-RGD onboarding empty state; PR #706/#705/#704 — persona anchor journeys |
| **Next priority** | Open issues: #728 (27.24 community outreach — second approver), #721 (Designer CEL linter), #720 (health snapshot), #713 (Designer apply-to-cluster), #712 (SRE sparkline) |

---

## Donation Readiness

Open issues queue: **~10 open feat/fix issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key remaining donation-readiness items:
- `#728` 27.24 — second OWNERS approver (social gap, not code — requires community outreach)
- ✅ `#719` Live DAG polling pause on tab background + manual toggle — shipped PR #736
- ✅ `#716` Structured zero-RGD empty state — shipped PR #733
- ✅ `#676` Air-gapped environment smoke test — shipped PR #704
- ✅ `#675` RBAC-restricted persona anchor journey — shipped PR #706
- ✅ `#674` Degraded-cluster persona anchor journey — shipped PR #705

Items shipped since scan 4 update:
- ✅ PR #736 — feat(polling): live DAG polling pause on tab background + manual toggle (issue #719, 2026-04-22)

---

## Metrics (last 10 rows from docs/aide/metrics.md)

| Date | Batch | prs_merged | predicted_prs | skills_count | skills_delta | notes |
|------|-------|-----------|---------------|-------------|-------------|-------|
| 2026-04-20 | 1 | 16 | - | - | - | sess-412931da |
| 2026-04-20 | 8 | 55 | - | 12 | 0 | sess-e227815e; 5 PRs |
| 2026-04-20 | 51 | 16 | - | 12 | 0 | sess-2dcdc244; kro-upstream + a11y |
| 2026-04-21 | 52-92 (gap) | - | - | - | - | 41 batches unrecorded — SM §4b not running; item 27.55 |
| 2026-04-22 | reconstructed | ~40 | - | 16 | +4 | PRs #549–#688; feat: a11y, designer, supply-chain, partial-RBAC, code-splitting, fonts |
| 2026-04-22 | reconstructed-2 | ~51 | - | 16 | 0 | PRs #689–#701; OS light-mode, axe blocking, tab focus, scale/timeout E2E, GraphRevision nav |
| 2026-04-22 | reconstructed-3 | ~62 | - | 16 | 0 | PRs #702–#731; persona journeys 085/086/087; 3 CI workflow fixes; ci_red_hours≈5 |
| 2026-04-22 | reconstructed-4 | ~65 | - | 16 | 0 | PRs #732–#733; feat: zero-RGD empty state (#733); pressure: 0/5 bullets addressed; backlog cap active (48 items) |
| 2026-04-22 | reconstructed-5 | ~66 | - | 16 | 0 | PRs #734–#736; feat: live DAG polling pause (#736, issue #719); pressure: 0/5 bullets; backlog cap active (48 items) |

> ⚠️ Metrics rows for batches 52–current are missing. SM §4b is not writing metrics rows.
> This is item 27.55. Reconstructed rows above are estimates from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. The SM should pick ONE per session.

1. **27.32** — Write `loop-health.md` every batch (SM §4f): this file's existence is the precondition for all other visibility improvements
2. **27.22** — Busywork-spiral detection in SM: if ≥3 consecutive batches ship only test/chore PRs, post AMBER and pick a `feat:` issue
3. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforcement at decision time, not retrospectively)
4. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps
5. **27.28** — Silent session failure detection: circuit-breaker posts FAILED comment when 0 PRs merged + 0 comments posted

> ⚠️ The System Loop Health section in doc 27 now has 48 unimplemented items (27.22–27.68).
> Per item 27.66: the scan will NOT add new items until at least the top 3 are implemented.
> The loop must consume its backlog before adding new queue items.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
