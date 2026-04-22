# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Updated by vibe-vision-auto on 2026-04-22.
> The SM must replace this with a live-computed version on each batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68 for the SM obligation.

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20) |
| **Last feature PR** | PR #694 — feat(revisions): navigate-by-change arrows in GraphRevision YAML diff (2026-04-22) |
| **Next priority** | Implement top 3 System Loop Health items: 27.32 (SM writes this file), 27.22 (busywork detection), 27.46 (COORD refuses chore when feat: issues open) |

---

## Donation Readiness

Open blockers visible via GitHub issues: **11 open feat/fix issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key open items:
- `#683` Designer axe-core coverage (doc 31 🔲)
- `#677` OS-preference light mode (27.17)
- `#676` Air-gapped environment smoke test (doc 26 🔲)
- `#675` RBAC-restricted persona journey (doc 26 🔲)
- `#674` Degraded-cluster persona anchor journey (doc 26 🔲)
- `#664` E2E slow-API / fetch-timeout scenario (27.19)
- `#663` E2E scale fixture (27.18)

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
| 2026-04-22 | *reconstructed* | ~46 | - | 16 | +4 | PRs #612–#694; feat: a11y (DAG nav, SR text, aria-live, skip-link, revisions diff nav), designer (draft persist, tab focus, cluster import, node library, collab mode), supply-chain (cosign+SBOM), partial-RBAC, code-splitting, self-hosted-fonts |

> ⚠️ Metrics rows for batches 52–current are missing. SM §4b is not writing metrics rows.
> This is item 27.55. The reconstructed row above is an estimate from merged PR count.

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. **52 items queued, 0 implemented.**
Per item 27.66: do NOT add more items until at least 3 are ✅.
The SM should pick ONE per session.

1. **27.32** — Write `loop-health.md` every batch (SM §4f): this file's existence is the precondition for all other visibility improvements
2. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforcement at decision time, not retrospectively)
3. **27.22** — Busywork-spiral detection in SM: if ≥3 consecutive batches ship only test/chore PRs, post AMBER and pick a `feat:` issue
4. **27.28** — Silent session failure detection: circuit-breaker posts FAILED comment when 0 PRs merged + 0 comments posted
5. **27.37** — Metrics continuity: write gap sentinel row when batch number jumps

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#637](https://github.com/pnz1990/kro-ui/issues/637).
