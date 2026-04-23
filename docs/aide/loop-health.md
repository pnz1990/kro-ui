# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-23 (scan 7).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-23 — batch-2 sess-826241e3)

| Field | Value |
|-------|-------|
| **Health** | GREEN — 1 design-doc-backed PR merged (PR #752); CI all-green; E2E pass 11m43s |
| **Last feature PR** | PR #752 — feat(designer): apply-to-cluster action, POST /api/v1/rgds/apply with canApplyRGDs gate (issue #713 ✅, 2026-04-23) |
| **Last meaningful feature PR** | PR #752 — Designer apply-to-cluster (issue #713 ✅); PR #748 — kro upstream field parity SLO (issue #710 ✅) |
| **Next priority** | issue-717 [NEEDS HUMAN] #751 (workflows permission for perf.yml); issue-679 (27.24 community outreach); skills_delta=0 for 9 consecutive runs — learning velocity issue pending per 27.31 |

> ⚠️ **issue-717 blocked**: feat(perf): Lighthouse regression comment on PRs is implemented but GitHub App token lacks `workflows` permission. See issue #751.

> ℹ️ **skills_delta=0** for 9 consecutive runs. Learning velocity issue should be opened per 27.31 rule (threshold: 5). Already past threshold at 9 — open `/otherness.learn` targeting top 3 issues by comment count.

---

## Donation Readiness

Open issues queue: **~2 open issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key remaining donation-readiness items:
- `#728` 27.24 — second OWNERS approver (social gap, not code — requires community outreach; this is the **only remaining hard blocker**)
- ✅ `#720` Health snapshot clipboard export — shipped PR #740
- ✅ `#712` SRE dashboard in-session health sparkline — shipped PR #739
- ✅ `#711` Stuck-reconciling escalation banner (10min + kubectl describe) — shipped PR #738
- ✅ `#719` Live DAG polling pause on tab background + manual toggle — shipped PR #736
- ✅ `#716` Structured zero-RGD empty state — shipped PR #733
- ✅ `#676` Air-gapped environment smoke test — shipped PR #704

Items shipped since scan 7 update:
- ✅ PR #748 — docs(contributing): kro upstream field parity SLO (issue #710) — 2026-04-23

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
| 2026-04-22 | reconstructed-6 | ~71 | - | 16 | 0 | PRs #737–#741; feat: SRE sparkline (#739), health snapshot (#740), stuck-escalation (#738); fix: Lighthouse 50→45 (⚠️ regression); pressure: 0/5 bullets; backlog cap active (48 items) |
| 2026-04-23 | reconstructed-7 | ~72 | - | 16 | 0 | PR #743: feat(designer) CEL expression linter (issue #721 ✅); pressure: 0/5 bullets (7th consecutive scan); open feat: issues: #744 #717 #713 #710; SM §4b still not reached; backlog cap active (48 items) |

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
