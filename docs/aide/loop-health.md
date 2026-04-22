# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Stub updated by vibe-vision-auto on 2026-04-22 (scan 3).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale since batch 51 (2026-04-20) |
| **Last feature PR** | PR #726 — fix(workflow): agent_version/upgrade_policy regex (2026-04-22) |
| **Last meaningful feature PR** | PR #706 — feat(e2e): journey 087 RBAC-restricted persona anchor journey (2026-04-22) |
| **Next priority** | Open issues: #721 (Designer CEL linter), #720 (health snapshot export), #719 (live DAG polling pause), #718 (namespace instance count), #717 (Lighthouse PR comment), #716 (first-time empty state), #679 (27.24 community outreach) |

---

## Donation Readiness

Open issues queue: **~14 open feat/fix issues** (see [issue tracker](https://github.com/pnz1990/kro-ui/issues)).

Key open items:
- `#679` 27.24 — second OWNERS approver (social gap, not code)
- `#721` Designer: CEL expression linter
- `#720` Health system: health snapshot clipboard export
- `#719` Instance management: live DAG polling pause on tab background
- `#718` Instance management: namespace instance count summary
- `#717` RGD display: Lighthouse score regression comment on PRs
- `#716` RGD display: first-time user zero-RGD empty state

Items shipped since last update:
- ✅ PR #726 — fix(workflow): agent_version/upgrade_policy regex
- ✅ PR #706 — feat(e2e): journey 087 RBAC-restricted persona anchor (issue #675 CLOSED)
- ✅ PR #705 — feat(e2e): journey 086 degraded-cluster persona anchor (issue #674 CLOSED)
- ✅ PR #704 — feat(e2e): journey 085 air-gapped smoke test (issue #676 CLOSED)
- ✅ PR #703 — fix(ci): pin typescript 6.0.3
- ✅ PR #701 — docs(security): Post-Donation Security Policy (issue #678 CLOSED)
- ✅ PR #700 — feat(e2e): journey 084 fetch-timeout / slow-API scenario (27.19)
- ✅ PR #699 — feat(e2e): scale-wide fixture + journey 083 (27.18)
- ✅ PR #694 — feat(revisions): navigate-by-change arrows in GraphRevision diff
- ✅ PR #692 — feat(theme): OS-preference light mode (27.17)
- ✅ PR #689 — feat(a11y): Designer axe-core scan promoted to blocking
- ✅ PR #688 — feat(designer): tab bar sessionStorage focus persistence

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
