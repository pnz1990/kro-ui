# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub written by vibe-vision-auto on 2026-04-22
> because the SM has not been writing this file (see doc 27 §27.26, §27.32, §27.58, §27.68).
> The SM should replace this stub with a live-computed version on the next batch completion.

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20) |
| **Last feature PR** | PR #688 — feat(designer): tab bar with sessionStorage focus restoration (2026-04-22) |
| **Next priority** | Implement top 3 System Loop Health items: 27.65 (SM rules audit), 27.32 (write loop-health.md), 27.22 (busywork detection) |

---

## Donation Readiness

Open blockers visible via GitHub issues: **10 open feat/fix issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key open blockers:
- `#683` Designer axe-core coverage (27.65 prerequisite)
- `#680` GraphRevision diff two-panel line-level diff
- `#677` OS-preference light mode (27.17)
- `#676` Air-gapped environment smoke test
- `#664` E2E slow-API / fetch-timeout scenario (27.19)

---

## Metrics (last 10 rows from docs/aide/metrics.md)

| Date | Batch | prs_merged | predicted_prs | skills_count | skills_delta | notes |
|------|-------|-----------|---------------|-------------|-------------|-------|
| 2026-04-20 | 1 | 16 | - | - | - | sess-412931da |
| 2026-04-20 | 2 | 3 | - | - | - | sess-412931da |
| 2026-04-20 | 3 | 31 | - | 12 | - | sess-475a6159; coverage micro-PRs |
| 2026-04-20 | 4 | 44 | - | 12 | 0 | sess-7780ed82; coverage micro-PRs |
| 2026-04-20 | 5 | 47 | - | 12 | 0 | sess-bea1648c; coverage micro-PRs |
| 2026-04-20 | 6 | 48 | - | 12 | 0 | sess-a2827ba4; coverage micro-PRs |
| 2026-04-20 | 7 | 49 | - | 12 | 0 | sess-a2827ba4; coverage micro-PRs |
| 2026-04-20 | 8 | 55 | - | 12 | 0 | sess-e227815e; 5 PRs |
| 2026-04-20 | 51 | 16 | - | 12 | 0 | sess-2dcdc244; kro-upstream + a11y |
| 2026-04-22 | *reconstructed* | ~40 | - | 15 | +3 | PRs #612–#688; feat: a11y + designer + supply-chain |

> ⚠️ Metrics rows for batches 52–current are missing. SM §4b is not writing metrics rows.
> This is item 27.55. The reconstructed row above is an estimate from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. The SM should pick ONE per session.

1. **27.32** — Write `loop-health.md` every batch (SM §4f): this file's existence is the precondition for all other visibility improvements
2. **27.22** — Busywork-spiral detection in SM: if ≥3 consecutive batches ship only test/chore PRs, post AMBER and pick a `feat:` issue
3. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforcement at decision time, not retrospectively)
4. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps
5. **27.28** — Silent session failure detection: circuit-breaker posts FAILED comment when 0 PRs merged + 0 comments posted

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
