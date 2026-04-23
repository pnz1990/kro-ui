# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-23 (scan 8).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-23 — reconstructed-8 / scan 8)

| Field | Value |
|-------|-------|
| **Health** | GREEN — 2 feature PRs merged today (PR #748 docs SLO, PR #752 designer apply-to-cluster); CI all-green; skills_delta=+1 (first growth in 9 runs) |
| **Last feature PR** | PR #752 — feat(designer): apply-to-cluster action (issue #713 ✅, 2026-04-23) |
| **Last meaningful feature PR** | PR #752 — Designer apply-to-cluster; PR #748 — kro upstream SLO; PR #743 — CEL linter (issue #721 ✅) |
| **Next priority** | Open: #751 [NEEDS HUMAN] workflows permission; #744 E2E for CEL linter; #717 Lighthouse regression; #679 community outreach (hard blocker for donation) |

> ⚠️ **issue-717 blocked**: feat(perf): Lighthouse regression comment on PRs is implemented on branch `feat/issue-717` but cannot be pushed because the GitHub App token lacks `workflows` permission. See issue #751 for resolution path.

> ℹ️ **pressure**: 0/5 pressure bullets addressed for 9 consecutive scans. Scan 8 added 20 product Future items to docs 28-31 applying all 5 pressure lenses. Items 27.22 (housekeeping-detection), 27.46 (COORD refuse chore), and 27.32 (SM writes loop-health) remain unimplemented in agent files. skills_delta=+1 this scan (17 skills).

---

## Donation Readiness

Open issues queue: **~4 open feat: issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key remaining donation-readiness items:
- `#728` 27.24 — second OWNERS approver (social gap, not code — requires community outreach; this is the **only remaining hard blocker**)
- ✅ `#713` Designer apply-to-cluster — shipped PR #752 (2026-04-23)
- ✅ `#721` CEL expression linter in Designer — shipped PR #743 (2026-04-23)
- ✅ `#710` kro upstream field parity SLO — shipped PR #748 (2026-04-23)
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
| 2026-04-20 | 51 | 16 | - | 12 | 0 | sess-2dcdc244; kro-upstream + a11y |
| 2026-04-21 | 52-92 (gap) | - | - | - | - | 41 batches unrecorded — SM §4b not running; item 27.55 |
| 2026-04-22 | reconstructed | ~40 | - | 16 | +4 | PRs #549–#688; feat: a11y, designer, supply-chain, partial-RBAC, code-splitting, fonts |
| 2026-04-22 | reconstructed-2 | ~51 | - | 16 | 0 | PRs #689–#701; OS light-mode, axe blocking, tab focus, scale/timeout E2E, GraphRevision nav |
| 2026-04-22 | reconstructed-3 | ~62 | - | 16 | 0 | PRs #702–#731; persona journeys 085/086/087; 3 CI workflow fixes; ci_red_hours≈5 |
| 2026-04-22 | reconstructed-4 | ~65 | - | 16 | 0 | PRs #732–#733; feat: zero-RGD empty state (#733); pressure: 0/5 bullets addressed; backlog cap active |
| 2026-04-22 | reconstructed-5 | ~66 | - | 16 | 0 | PRs #734–#736; feat: live DAG polling pause (#736, issue #719) |
| 2026-04-22 | reconstructed-6 | ~71 | - | 16 | 0 | PRs #737–#741; feat: SRE sparkline, health snapshot, stuck-escalation; fix: Lighthouse 50→45 ⚠️ |
| 2026-04-23 | batch-1 | 73 | - | 16 | 0 | sess-7d63c961; PR #748 kro upstream SLO; CI all-green; health=GREEN |
| 2026-04-23 | reconstructed-8 | 75 | - | 17 | +1 | PRs #749, #752; feat(designer) apply-to-cluster (#752, #713 ✅); skills_delta=+1 (first in 9 runs); 20 product gaps added via pressure lens |

> ⚠️ Metrics rows for batches 52–current are reconstructed. SM §4b is not writing rows automatically.
> This is item 27.55. Reconstructed rows above are estimates from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. The SM should pick ONE per session.

1. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforces at decision time, not retrospectively)
2. **27.22** — Busywork-spiral detection in SM: if ≥3 consecutive batches ship only test/chore PRs, post AMBER
3. **27.32** — SM writes `loop-health.md` every batch (§4f): file exists but only via scan stub, not SM
4. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps
5. **27.28** — Silent session failure detection: circuit-breaker posts FAILED comment when 0 PRs merged + 0 comments posted

> ⚠️ The System Loop Health section in doc 27 now has 48 unimplemented items (27.22–27.68).
> Per item 27.66: the scan will NOT add new items until at least the top 3 are implemented.
> The loop must consume its backlog before adding new queue items.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).


---

## Quick-Glance (as of 2026-04-23 — batch-1 sess-7d63c961)

| Field | Value |
|-------|-------|
| **Health** | GREEN — 1 design-doc-backed PR merged (PR #748); CI all-green; E2E pass 11m49s; SM phase now writing this file (27.32 partial ✅) |
| **Last feature PR** | PR #748 — docs(contributing): kro upstream field parity SLO (issue #710 ✅, 2026-04-23) |
| **Last meaningful feature PR** | PR #748 — kro upstream field parity SLO; PR #743 — CEL expression linter (issue #721 ✅) |
| **Next priority** | Open: #747 [NEEDS HUMAN] feat/issue-717 push (GitHub App lacks `workflows` permission); #713 (Designer apply-to-cluster); #679 (27.24 community outreach); skills_delta=0 for 8 consecutive runs — 27.24 learn frequency gate still pending |

> ⚠️ **issue-717 blocked**: feat(perf): Lighthouse regression comment on PRs is implemented on branch `feat/issue-717` but cannot be pushed because the GitHub App token lacks `workflows` permission. See issue #747 for resolution path.

> ℹ️ **pressure**: 0/5 pressure bullets addressed for 8 consecutive runs. `skills_delta=0` persists. Items 27.22 (housekeeping-detection), 27.24 (learn frequency gate), and 27.46 (loop honesty thresholds) remain unimplemented in agent files.

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
