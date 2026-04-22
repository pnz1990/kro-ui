# Loop Health Dashboard

> **Maintained by**: SM phase (§4f) every batch. Last updated by vibe-vision-auto on 2026-04-22 (scan 3 — pressure lens pass).
> The SM should replace this stub with a live-computed version on the next batch completion.
> See doc 27 §27.26, §27.32, §27.58, §27.68.

---

## Quick-Glance (as of 2026-04-22)

| Field | Value |
|-------|-------|
| **Health** | AMBER — SM not writing this file; metrics table stale; 10 stale vision-scan PRs closed; PR #707 pending CI |
| **Last feature PR** | PR #706 — feat(e2e): journey 087 RBAC-restricted persona anchor journey (2026-04-22) |
| **Last meaningful feature PR** | PR #706 — feat(e2e): journey 087 RBAC-restricted persona anchor (issue #675) |
| **Next priority** | OS-preference light mode (PR #692, issue #677 open); kro upstream tracking; loop health SM implementation |

---

## Donation Readiness (updated 2026-04-22)

**Hard blockers**: all resolved — signed artifacts ✅, GOVERNANCE.md ✅, CODE_OF_CONDUCT.md ✅, OWNERS breadth ✅

**Open social gap**: #679 — second OWNERS approver (community outreach, not code, weeks-long process)

**v0.10.0 shipped**: PR #589 — goreleaser binary + Docker image.

Items shipped in this batch:
- ✅ PR #704 — journey 085 air-gapped smoke test (26.4)
- ✅ PR #705 — journey 086 degraded-cluster persona (26.5)
- ✅ PR #706 — journey 087 RBAC-restricted persona (26.6)
- ✅ PR #703 — fix(ci): pin TypeScript 6.0.3

Items in flight:
- ⏳ PR #707 — vision scan: 8 product gaps added to docs 28-31 (awaiting CI)
- ⏳ PR #692 — feat(theme): OS-preference light mode (issue #677, awaiting review)

---

## Stale Vision-Scan PRs (cleaned up 2026-04-22)

PRs #672 #687 #691 #693 #695 #696 #697 #698 #702 #690 — 10 stale vision-scan PRs closed.
All were superseded by PR #707 (latest scan, currently pending CI).
This resolves doc 27 §27.59 partially — recovery step in SM §4g still needed.

---

## Metrics (last rows from docs/aide/metrics.md)

| Date | Batch | prs_merged | predicted_prs | skills_count | skills_delta | notes |
|------|-------|-----------|---------------|-------------|-------------|-------|
| 2026-04-20 | 1 | 16 | - | - | - | sess-412931da |
| 2026-04-20 | 8 | 55 | - | 12 | 0 | sess-e227815e; 5 PRs |
| 2026-04-20 | 51 | 16 | - | 12 | 0 | sess-2dcdc244; kro-upstream + a11y |
| 2026-04-22 | *reconstructed* | ~51 | - | 15 | +3 | PRs #612–#701 |
| 2026-04-22 | *reconstructed-3* | ~6 | - | 17 | +2 | PRs #703–#706; feat: anchor journeys 085/086/087, TypeScript pin, 10 stale PR closures |

> ⚠️ Metrics rows for batches 52–current missing. SM §4b is not writing metrics rows (item 27.55).

---

## System Loop Health Items: Priority Queue

These 27.xx items are the highest-impact open gaps. The SM should pick ONE per session.

1. **27.32** — Write `loop-health.md` every batch (SM §4f): this file must be written by SM, not the vision scan
2. **27.22** — Busywork-spiral detection in SM: if ≥3 consecutive batches ship only test/chore PRs, post AMBER and pick a `feat:` issue
3. **27.46** — COORD must refuse chore work when `feat:` issues are open (enforcement at decision time, not retrospectively)
4. **27.61** — Merge stale vision-scan PRs at START of Step A run (10 stale PRs closed manually this scan — this must be automated)
5. **27.28** — Silent session failure detection: circuit-breaker posts FAILED comment when 0 PRs merged + 0 comments posted

> ⚠️ The System Loop Health section in doc 27 has 47 unimplemented items (27.22–27.68).
> Per item 27.66: the scan will NOT add new 27.xx items until top 3 are implemented.

---

> This file is maintained by the SM phase. If the date above is more than 48 hours old,
> the SM is not reaching §4f. See [doc 27 §27.58](../design/27-stage3-kro-tracking.md).
> Report the gap in issue [#439](https://github.com/pnz1990/kro-ui/issues/439).
