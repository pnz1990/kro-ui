# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-23 (scan 9).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-23 — scan 9 / reconstructed-9)

| Field | Value |
|-------|-------|
| **Health** | GREEN — 4 meaningful PRs merged since scan 8: #785 reconciliation timeline (29.1 ✅), #787 E2E journey 091 donation-reviewer persona, #788 E2E journey 092 multi-cluster operator, #790 Designer onboarding guided tour (31.1 ✅); CI all-green |
| **Last feature PR** | PR #790 — feat(designer): onboarding guided tour — 4-step overlay on first /author visit (31.1 ✅, 2026-04-23) |
| **Last meaningful feature PR** | PR #790 — Designer guided tour; PR #785 — reconciliation timeline; PR #787/#788 — E2E persona journeys |
| **Next priority** | Open feat: issues: #781 (31.4), #780 (31.3), #779 (31.2), #778 (30.5), #774 (29.5), #763 (pressure rewrite); skills_delta=0 for **10 consecutive runs** — 27.24 learning frequency gate OVERDUE (threshold 5); #728 community outreach for second OWNERS approver remains the only donation hard-blocker |

> ⚠️ **pressure**: 4/5 pressure bullets addressed (80% — above 60% threshold). Self-improvement bullet (skills_delta=0) remains the **only unaddressed lens**. The pressure block needs a rewrite to push harder on skills utilization and frame-lock prevention.

> ⚠️ **skills_delta=0 for 10 consecutive runs**: SM must open a learning velocity issue before next batch (rule: 27.31, threshold 5). This is the most critical loop health gap — the skills library has not grown in 10 scans despite ongoing feature delivery.

> ℹ️ **backlog cap status**: 51 unimplemented 27.xx System Loop Health items (count GREW since scan 8 — 47 → 51). Cap is ACTIVE — no new 27.xx items added this scan per 27.66 rule. The loop must close 3 items before the cap lifts.

---

## Donation Readiness

Open issues queue: **~2 open issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key remaining donation-readiness items:
- `#728` 27.24 — second OWNERS approver (social gap, not code — requires community outreach; this is the **only remaining hard blocker**)
- ⚠️ Lighthouse CI threshold at 45 — target is ≥60 (doc 28 §28.5 added by scan 8 to track this)
- ✅ `#766` Designer onboarding guided tour — shipped PR #790 (scan 9)
- ✅ `#764` Reconciliation timeline on ConditionsPanel — shipped PR #785 (scan 9)
- ✅ `#767` RGD changes-since-last-revision banner — shipped PR #782 (scan 8)
- ✅ `#720` Health snapshot clipboard export — shipped PR #740
- ✅ `#712` SRE dashboard in-session health sparkline — shipped PR #739
- ✅ `#711` Stuck-reconciling escalation banner (10min + kubectl describe) — shipped PR #738
- ✅ `#719` Live DAG polling pause on tab background + manual toggle — shipped PR #736
- ✅ `#716` Structured zero-RGD empty state — shipped PR #733
- ✅ `#676` Air-gapped environment smoke test — shipped PR #704

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
| 2026-04-23 | batch-1 | 73 | - | 16 | 0 | session sess-7d63c961; PR #748: kro upstream field parity SLO; SM phase wrote loop-health.md (27.32 partial ✅); skills_delta=0 (8th run); pressure: 0/5 |
| 2026-04-23 | reconstructed-8 | 82 | - | 16 | 0 | PRs #749–#782; feat: apply-to-cluster (#752), Lighthouse diff PR comment (#757), RGD changes-since-revision (#782); 28.5 new gap added; pressure: 3/5 (60% — scan 5 threshold reached); skills_delta=0 (9th run — 27.24 threshold exceeded at 5, SM must open learning velocity issue) |
| 2026-04-23 | reconstructed-9 | 90 | - | 16 | 0 | PRs #783–#790; feat: reconciliation timeline (#785, 29.1 ✅), E2E journey 091 (#787), E2E journey 092 (#788), Designer guided tour (#790, 31.1 ✅); pressure: 4/5 (80% — only self-improvement bullet unaddressed); skills_delta=0 (10th run); backlog cap ACTIVE (51 items — grew); donation blocker: #728 only |

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

> ⚠️ The System Loop Health section in doc 27 now has **51 unimplemented items** (27.22–27.68, 27.S1–27.S6).
> Per item 27.66: the scan will NOT add new items until at least the top 3 are implemented.
> The loop must consume its backlog before adding new queue items.
> ⚠️ **CRITICAL**: `skills_delta=0` for **10 consecutive runs**. Per 27.31 rule: threshold is 5 batches. SM MUST open a learning velocity issue before the next batch. The loop is not self-improving.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
