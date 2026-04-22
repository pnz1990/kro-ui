# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub written and refreshed by vibe-vision-auto
> because the SM has not been writing this file (see doc 27 §27.26, §27.32, §27.58, §27.68).
> The SM should replace this stub with a live-computed version on the next batch completion.
> Last refreshed by scan: 2026-04-22 09:45 UTC

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20) |
| **Last feature PR** | PR #694 — feat(revisions): navigate-by-change arrows in GraphRevision YAML diff (2026-04-22) |
| **Next priority** | Implement top 3 System Loop Health items: 27.46 (COORD feat: enforcement), 27.32 (SM write loop-health.md), 27.65 (SM rules audit) |

---

## Donation Readiness

Open issues: **11 open issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key open items:
- `#683` Designer axe-core coverage
- `#679` feat: 27.24 (/otherness.learn frequency gate)
- `#678` feat: 27.23 (SM health signal accuracy thresholds)
- `#677` OS-preference light mode (doc 28)
- `#676` Air-gapped environment smoke test (doc 26)
- `#675` RBAC-restricted persona journey (doc 26)
- `#674` Degraded-cluster persona anchor journey (doc 26)
- `#673` fix(ci): Lighthouse threshold variance
- `#664` Slow-API/fetch-timeout E2E (doc 29)
- `#663` Scale E2E fixture (doc 29)

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
| 2026-04-22 | *reconstructed* | ~50 | - | 16 | +4 | PRs #612–#694; feat: a11y, designer, supply-chain, DAG nav, revisions diff |

> ⚠️ Metrics rows for batches 52–current are missing. SM §4b is not writing metrics rows.
> This is item 27.55. The reconstructed row above is an estimate from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. Per rule 27.66 (52 unimplemented items > threshold of 20), no new loop-health items are being added this scan. The SM should pick ONE per session from this ordered list:

1. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforcement at pick time, not retrospectively)
2. **27.32** — SM must write `loop-health.md` with live data every batch (replaces this scan-generated stub)
3. **27.65** — SM phase rules audit: verify each loop-health rule actually exists in `sm.md` code (without this, all 52 items are aspirational)
4. **27.28** — Silent session failure detection: circuit-breaker when `prs_merged=0` and no comment posted
5. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
