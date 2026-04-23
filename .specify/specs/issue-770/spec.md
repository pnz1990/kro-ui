# Spec: 28.4 — Product changelog advancement signal

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md` §Future item 28.4
- **Issue**: #770
- **Closes**: #770

## What
Add `docs/aide/product-changelog.md`: a 10-row rolling table of the most
recently shipped user-visible features across product docs 28–31.

The SM updates this file the same way `loop-health.md` is updated — after each
batch. It is the single-page answer to "is the product moving forward?".

## Why
A human looking at the Overview today cannot quickly tell if kro-ui's RGD
display capability is better than it was last week. The metrics table tracks
batch velocity; loop-health.md tracks system health. Neither answers the
"advancement" question. product-changelog.md fills that gap.

## Acceptance criteria

### Zone 1 — Must
- [x] `docs/aide/product-changelog.md` exists with ≥10 feature rows
- [x] Table columns: Feature | Docs area | Date shipped | PR
- [x] Rows cover docs 28–31 product surfaces
- [x] `docs/design/28-rgd-display.md` 28.4 promoted 🔲→✅

## Out of scope
- UI integration (no page change — this is a docs/process artifact)
- Backend changes
