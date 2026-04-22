# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-22 (scan 3).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-22, scan 3)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20) |
| **Last feature PR** | PR #704 — feat(e2e): journey 085 air-gapped smoke test (2026-04-22) |
| **Last meaningful feature PR** | PR #704 — feat(e2e): journey 085 air-gapped (issue #676 ✅); PRs #705/#706 open for degraded-cluster and RBAC-restricted persona journeys |
| **Next priority** | Open: #679 (27.24 community outreach — social gap), #675 (RBAC-restricted), #674 (degraded-cluster), #673 (Lighthouse CI threshold fix) |

---

## Donation Readiness

Open issues queue: **5 open feat/fix issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key open items:
- `#679` 27.24 — second OWNERS approver (social gap, not code)
- `#675` RBAC-restricted persona anchor journey (PR #706 open)
- `#674` Degraded-cluster persona anchor journey (PR #705 open)
- `#673` Lighthouse threshold fix (needs-human)
- `#677` 27.17 OS light-mode issue — shipped (PR #692) but issue not closed

Items shipped since last update:
- ✅ PR #704 — air-gapped smoke test E2E journey 085 (issue #676)
- ✅ PR #703 — fix(ci): TypeScript 6.0.3 pin for bun 1.3.13 compat
- ✅ PR #701 — docs(security): Post-Donation Security Policy section (issue #678)
- ✅ PR #700 — slow-API / fetch-timeout E2E (27.19)
- ✅ PR #699 — scale E2E fixture: scale-wide 20-node RGD + journey 083 (27.18)
- ✅ PR #694 — GraphRevision diff navigate-by-change arrows
- ✅ PR #692 — OS-preference light mode (27.17)
- ✅ PR #689 — Designer axe-core scan promoted to blocking
- ✅ PR #688 — Designer tab focus sessionStorage persistence

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
| 2026-04-22 | *reconstructed* | ~51 | - | 15 | +3 | PRs #612–#701; feat: a11y (DAG nav, SR text, aria-live, skip-link, Designer axe), designer (draft persist, tab focus, cluster import, collab, node-lib), supply-chain, partial-RBAC, code-splitting, self-hosted-fonts, OS light-mode, scale E2E, fetch-timeout E2E, GraphRevision diff nav |

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

> ⚠️ The System Loop Health section in doc 27 now has 47 unimplemented items (27.22–27.68).
> Per item 27.66: the scan will NOT add new items until at least the top 3 are implemented.
> The loop must consume its backlog before adding new queue items.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md) for the
> recovery protocol. Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
