# kro-ui Loop Health Dashboard

> **Updated by vibe-vision-auto and SM after each batch.**
> This file is the single quick-glance health view for the autonomous loop.
> Pin link in issue #439 body for instant human visibility.

---

## Quick Glance

| | |
|---|---|
| **Status** | 🟢 GREEN — loop running, feature PRs shipping |
| **Last feature PR** | #612 feat(web): route-based code splitting — React.lazy per page (2026-04-21) |
| **Next priority** | Issue #579 — GraphRevision diff (spec 009 completion) |
| **E2E anchor** | 81 journeys · 340 pass · 0 fail (2026-04-21) |
| **Total merged PRs** | 612 |
| **Skills count** | 12 (stagnant — see 27.24) |

---

## Open Gaps (System Loop Health)

Items from `docs/design/27-stage3-kro-tracking.md` §System Loop Health that are
still unimplemented. These are the things that would make the loop genuinely better,
not just more active.

| # | Gap | Status |
|---|-----|--------|
| 27.22 | Housekeeping-only batch detection in SM | 🔲 Pending |
| 27.23 | SM health signal quantitative thresholds | 🔲 Pending |
| 27.24 | `/otherness.learn` frequency gate | 🔲 Pending |
| 27.25 | Monoculture / frame-lock detection | 🔲 Pending |
| 27.26 | This file (loop-health.md) being consistently updated by SM | 🔲 Pending |
| 27.27 | Onboarding zero-human-intervention validation | 🔲 Pending |
| 27.28 | Silent session failure detection | 🔲 Pending |
| 27.29 | Empty-queue sentinel behavior | 🔲 Pending |
| 27.30 | `predicted_prs` column filled by COORD (column defined, never populated) | 🔲 Pending |
| 27.31 | `skills_delta` column tracking (column defined, never populated) | 🔲 Pending |
| 27.32 | Metrics staleness — batches from 2026-04-21 not recorded | 🔲 Pending |
| 27.33 | `loop-health.md` created proactively by scan, not just tracked as Future item | ✅ Done (this file) |

---

## Metrics (last 10 batches)

> Full table: `docs/aide/metrics.md`

| Date | Batch | prs_merged | predicted | accuracy | skills | skills_Δ | notes |
|------|-------|-----------|-----------|----------|--------|----------|-------|
| 2026-04-20 | 1 | 16 | — | — | — | — | sess-412931da; PR #457 |
| 2026-04-20 | 2 | 3 | — | — | — | — | sess-412931da; PRs #460,#461 |
| 2026-04-20 | 3 | 31 | — | — | 12 | — | PR #498 (fleet/metrics) |
| 2026-04-20 | 4 | 44 | — | — | 12 | 0 | PR #503 (usePageTitle) |
| 2026-04-20 | 5 | 47 | — | — | 12 | 0 | PR #509 (pickPod 100%) |
| 2026-04-20 | 6 | 48 | — | — | 12 | 0 | PR #514 (scrapeWithCache) |
| 2026-04-20 | 7 | 49 | — | — | 12 | 0 | PR #516 (handlers 97%) |
| 2026-04-20 | 8 | 55 | — | — | 12 | 0 | PRs #510,#512,#521,#522 |
| 2026-04-20 | 51 | 16 | — | — | 12 | 0 | PRs #545,#546,#547 |
| 2026-04-21 | — | 612 total | — | — | 12 | 0 | batches not recorded — staleness gap |

**⚠️ Staleness alert**: Batches from 2026-04-21 (PRs #596–#612, ~17 PRs) have not been
recorded in the metrics table. The SM phase is not updating `docs/aide/metrics.md`
consistently. See gap 27.32 below.

---

## Product State

- **Stage**: 3 — Ongoing (kro upstream tracking, donation readiness)
- **Donation readiness blockers**: 27.10 (supply chain signing), 27.12 (partial-RBAC E2E),
  27.23 (SECURITY.md post-donation), 27.24 (second OWNERS approver)
- **Queue depth**: 13 open feature issues
- **E2E coverage**: 81 journeys, all passing

---

## How to Read the Status

| Signal | Meaning |
|--------|---------|
| 🟢 GREEN | ≥1 design-doc-backed feature PR merged this batch |
| 🟡 AMBER | Only hygiene/test PRs shipped; no feature progress |
| 🔴 RED | CI broken >2h or 0 PRs merged |

---

*Last updated by vibe-vision-auto scan — 2026-04-21*
*SM: update the Quick Glance table and Metrics after every batch.*
