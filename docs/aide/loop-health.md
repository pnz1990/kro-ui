# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-23 (scan 9).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-23 — scan 9)

| Field | Value |
|-------|-------|
| **Health** | GREEN — 6 meaningful PRs merged since batch-1 (PR #752 Designer apply-to-cluster, #757 Lighthouse diff comment, #782 RGD changes-since-revision banner, #785 reconciliation timeline, #787 kro-contributor persona journey, #749 SM loop-health update); CI all-green |
| **Last feature PR** | PR #787 — feat(e2e): journey 091 — kro contributor / donation reviewer persona (26.7 ✅, 2026-04-23) |
| **Last meaningful feature PR** | PR #785 — reconciliation timeline on ConditionsPanel (29.1 ✅); PR #787 — journey 091 kro contributor persona (26.7 ✅) |
| **Next priority** | Open feat: issues: #781 (31.4), #780 (31.3), #779 (31.2), #778 (30.5), #774 (29.5); skills_delta=0 for 10 consecutive runs — **27.S1 gate threshold exceeded at 3, SM must auto-trigger /otherness.learn before next batch**; #728 community outreach for second OWNERS approver remains the only donation hard-blocker |

> ⚠️ **SM agent files audit (scan 9)**: 27.32 (loop-health.md write) is NOT in `~/.otherness/agents/phases/sm.md` — no `loop-health` grep match. 27.22 (busywork-spiral detection) has §4f consecutive-worsening code but NOT specifically for chore-only PR detection. 27.46 (COORD feat-first enforcement) is NOT in `standalone.md`. All 3 top items remain unimplemented in agent files.

> ⚠️ **pressure**: 3/5 pressure bullets addressed (60% — at the Scan 5 threshold). `skills_delta=0` persists for 10 consecutive runs (threshold is 3 per 27.S1 — SM must auto-trigger `/otherness.learn` before the next batch). New gaps added this scan: 27.25 frame-lock breaking playbook, 28.6 product advancement visibility, 30.6 health chip data freshness, vision.md onboarding time-to-value measurement.

---

## Donation Readiness

Open issues queue: **~2 open issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key remaining donation-readiness items:
- `#728` 27.24 — second OWNERS approver (social gap, not code — requires community outreach; this is the **only remaining hard blocker**)
- ⚠️ Lighthouse CI threshold at 45 — target is ≥60 (doc 28 §28.5 added to track this)
- ✅ `#787` Journey 091: kro contributor / donation reviewer persona — shipped PR #787
- ✅ `#785` Reconciliation timeline on ConditionsPanel (29.1) — shipped PR #785
- ✅ `#782` RGD changes-since-revision banner — shipped PR #782
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
| 2026-04-22 | reconstructed-4 | ~65 | - | 16 | 0 | PRs #732–#733; feat: zero-RGD empty state (#733); pressure: 0/5 bullets addressed; backlog cap active (48 items) |
| 2026-04-22 | reconstructed-5 | ~66 | - | 16 | 0 | PRs #734–#736; feat: live DAG polling pause (#736, issue #719); pressure: 0/5 bullets; backlog cap active (48 items) |
| 2026-04-22 | reconstructed-6 | ~71 | - | 16 | 0 | PRs #737–#741; feat: SRE sparkline (#739), health snapshot (#740), stuck-escalation (#738); fix: Lighthouse 50→45 (⚠️ regression); pressure: 0/5 bullets; backlog cap active (48 items) |
| 2026-04-23 | reconstructed-7 | ~72 | - | 16 | 0 | PR #743: feat(designer) CEL expression linter (issue #721 ✅); pressure: 0/5 bullets (7th consecutive scan); open feat: issues: #744 #717 #713 #710; SM §4b still not reached; backlog cap active (48 items) |
| 2026-04-23 | batch-1 | 73 | - | 16 | 0 | session sess-7d63c961; PR #748: kro upstream field parity SLO; SM phase wrote loop-health.md (27.32 partial ✅); skills_delta=0 (8th run); pressure: 0/5 |
| 2026-04-23 | reconstructed-8 | 82 | - | 16 | 0 | PRs #749–#782; feat: apply-to-cluster (#752), Lighthouse diff PR comment (#757), RGD changes-since-revision (#782); 28.5 new gap added; pressure: 3/5 (60% — scan 5 threshold reached); skills_delta=0 (9th run — 27.24 threshold exceeded at 5, SM must open learning velocity issue) |
| 2026-04-23 | reconstructed-9 | 87 | - | 16 | 0 | PRs #785–#787; feat: reconciliation timeline (#785, 29.1 ✅), journey 091 kro-contributor persona (#787, 26.7 ✅); backlog cap updated 48→51; 4 new pressure-lens gaps added; skills_delta=0 (10th run — 27.S1 gate threshold exceeded at 3); SM agent file audit: 27.32/27.22/27.46 NOT in agent files |

> ⚠️ Metrics rows for batches 52–current are missing. SM §4b is not writing metrics rows.
> This is item 27.55. Reconstructed rows above are estimates from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. The SM should pick ONE per session.

1. **27.32** — Write `loop-health.md` every batch (SM §4f): **CONFIRMED NOT in sm.md** — grep for `loop-health` returns nothing; file exists only because vibe-vision-auto scan stub wrote it
2. **27.22** — Busywork-spiral detection: **PARTIALLY in sm.md** — §4f has consecutive-worsening detection but NOT chore-only PR-type filtering; the specific "chore-only = AMBER" rule is missing
3. **27.46** — COORD must refuse chore work when feat: issues open: **CONFIRMED NOT in standalone.md** — no feat-priority pick enforcement found
4. **27.S1** — `/otherness.learn` auto-trigger when skills_delta=0: **threshold EXCEEDED** (10 runs, threshold=3); SM MUST invoke `/otherness.learn` before next batch
5. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps

> ⚠️ The System Loop Health section in doc 27 now has **51 unimplemented items** (27.22–27.68 + 27.S1–27.S5).
> Per item 27.66: the scan will NOT add new items until at least the top 3 are implemented.
> The loop must consume its backlog before adding new queue items.
> ⚠️ **CRITICAL**: `skills_delta=0` for 10 consecutive runs. Per 27.S1 rule: threshold is 3 batches. SM MUST invoke `/otherness.learn` targeting top 3 open issues by comment count BEFORE the next batch starts.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
