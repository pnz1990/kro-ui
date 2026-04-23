# Autonomous Team Metrics

> **Columns added 2026-04-21 (vision scan 27.30 + 27.31):**
> - `predicted_prs`: COORD estimate at session start; compare to `prs_merged` to track prediction accuracy
> - `skills_delta`: change in `skills_count` vs. prior batch (negative = skills removed, 0 = stagnant, +N = growing)
>
> SM rule: if prediction accuracy (actual/predicted) < 0.5 for 3 consecutive batches, halve next prediction and record reason in notes.
> SM rule: if `skills_delta=0` for 5 consecutive batches, open a learning velocity issue before next batch.

| Date | Batch | prs_merged | predicted_prs | needs_human | ci_red_hours | skills_count | skills_delta | todo_shipped | notes |
|------|-------|-----------|---------------|-------------|--------------|-------------|-------------|-------------|-------|
| 2026-04-20 | 1 | 16 | - | 0 | 0 | - | - | 1 | session sess-412931da; merged PR #457 (issue-450) |
| 2026-04-20 | 2 | 3 | - | 0 | 0 | - | - | 3 | session sess-412931da; merged PRs #460,#461 (SRE+Dev journeys) |
| 2026-04-20 | 3 | 31 | - | 0 | 0 | 12 | - | 1 | session sess-475a6159; merged PR #498 (fleet/metrics coverage 85.4%→92.0%); stale state cleanup |
| 2026-04-20 | 4 | 44 | - | 0 | 0 | 12 | 0 | 1 | session sess-7780ed82; merged PR #503 (usePageTitle test + cache WriteHeader 94.3%→98.6%) |
| 2026-04-20 | 5 | 47 | - | 0 | 0 | 12 | 0 | 1 | session sess-bea1648c; merged PR #509 (pickPod/pickPodFromClusterList 100% cov); closed PR #508 (dup); merged PR #504 (e2e error resilience) |
| 2026-04-20 | 6 | 48 | - | 0 | 0 | 12 | 0 | 1 | session sess-a2827ba4; merged PR #514 (scrapeWithCache 100%, ValidateCELExpressions 100%, validate 91.9%→95.5%) |
| 2026-04-20 | 7 | 49 | - | 0 | 0 | 12 | 0 | 1 | session sess-a2827ba4; merged PR #516 (handlers 95.9%→97.0%, summariseContext 97.8%, ValidateRGD 92.2%) |
| 2026-04-20 | 8 | 55 | - | 0 | 0 | 12 | 0 | 5 | session sess-e227815e; merged PRs #510,#512 (E2E journey depth+a11y), #521 (k8s 92.6%→93.9%: ScrapeMetrics 64%→93%, RBAC aggregation 100%), #522 (handlers 97.0%→98.2%, total 94.8%→95.9%) |
| 2026-04-20 | 51 | 16 | - | 0 | 0 | 12 | 0 | 3 | session sess-2dcdc244; merged PRs #545 (kro-upstream-check), #546 (a11y journey 074 chunk), #547 (error-state journeys 076-079) |
| 2026-04-21 | 52-92 (gap) | - | - | - | - | - | - | - | notes=41 batches unrecorded — SM §4b not running; see session logs and item 27.55 |
| 2026-04-22 | reconstructed | 40 | - | - | - | 16 | +4 | ~10 | reconstructed by vibe-vision-auto from gh pr list; PRs #549–#688; feat: a11y (DAG nav, SR text, aria-live, skip-link), designer (draft persist, tab focus, cluster import), supply-chain (cosign+SBOM), partial-RBAC, code-splitting, self-hosted-fonts; skills_count from ls ~/.otherness/agents/skills/*.md; item 27.55 |
| 2026-04-22 | reconstructed-2 | 51 | - | - | - | 16 | 0 | ~8 | reconstructed by vibe-vision-auto scan 2; PRs #689–#701; feat: OS light-mode (27.17), Designer axe-core blocking, Designer tab focus (27.19 E2E journey 084), scale E2E fixture journey 083 (27.18), GraphRevision diff nav arrows (PR #694), SECURITY post-donation section; item 27.55 |
| 2026-04-22 | reconstructed-3 | 62 | - | - | - | 16 | 0 | ~7 | reconstructed by vibe-vision-auto scan 3; PRs #702–#731; feat: a11y DAG arrow-nav (#685), a11y DAG SR text (#686), persona journeys 085/086/087 (air-gapped/#704, degraded-cluster/#705, RBAC-restricted/#706); fix: CI workflow (#726 regex, #730 branch commit, #731 missing fi — 5h outage); fix CI ts pin (#703); ci_red_hours≈5 (workflow breakage 2026-04-22); skills_count=16 (ls ~/.otherness/agents/skills/*.md); item 27.55 |
| 2026-04-22 | reconstructed-4 | 65 | - | - | - | 16 | 0 | ~1 | reconstructed by vibe-vision-auto scan 4; PRs #732–#733; feat: zero-RGD empty state with kro health detection (#733, issue #716); skills_count=16; pressure scan: 0/5 pressure bullets addressed — all 5 lenses (reliability, honesty, self-improvement, onboarding, visibility) remain open; backlog cap active (48 unimplemented 27.xx items); item 27.55 |
| 2026-04-22 | reconstructed-5 | 66 | - | - | - | 16 | 0 | ~1 | reconstructed by vibe-vision-auto scan 5; PRs #734–#736; feat: live DAG polling pause on tab background + manual toggle (#736, issue #719); skills_count=16; pressure: 0/5 bullets addressed; backlog cap active (48 items); item 27.55 |
| 2026-04-22 | reconstructed-6 | 71 | - | - | - | 16 | 0 | ~4 | reconstructed by vibe-vision-auto scan 6; PRs #737–#741; feat: SRE dashboard sparkline (#739, issue #712), health snapshot clipboard export (#740, issue #720), stuck-reconciling escalation banner 10min (#738, issue #711), namespace instance count summary (#734); fix(ci): Lighthouse threshold 50→45 (⚠️ regression — threshold should rise post code-splitting, not fall); scan PR #737 landed on main; pressure: 0/5 bullets addressed; backlog cap active (48 items); item 27.55 |
