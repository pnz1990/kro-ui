# kro-ui: Current Progress

> Updated by standalone agent after each batch.

## Current State

- **Active queue**: none (first otherness run pending)
- **Completed stages**: 0, 1, 2 — all features through v0.9.4 shipped
- **In-flight items**: none

## Stage Completion

| Stage | Name | Status | Notes |
|---|---|---|---|
| 0 | Foundation | ✅ Complete | Server, RGD API, React shell, design system |
| 1 | Rich Observability | ✅ Complete | Fleet, events, collections, RBAC, errors |
| 2 | UX Polish + kro v0.9 | ✅ Complete | 70+ features, 430+ PRs merged, kro v0.9.1 |
| 3 | Ongoing | 🔄 Active | Bug fixes, kro upstream tracking, E2E coverage |

## Spec Status (merged)

70+ specs merged — see AGENTS.md §Spec inventory for complete list.
All specs from `000-design-system` through `063-kro-v091-upgrade` and numerous fixes are merged.

## E2E Coverage

70 journey files (`001` through `070`), 9 parallel Playwright chunks + 1 serial project.
All journeys run against a hermetic kind cluster with kro v0.9.1.

## Recent Releases

- v0.9.4: drop Helm chart from repo (helm/ removed)
- v0.9.3: kro v0.9.1 upgrade — version pins, hash column, CEL hash help, reconcile-paused annotation
- v0.9.2: deep-dag fixes, ValidationTab v0.9.0 condition names, RevisionsTab GraphVerified
- v0.9.1: RGD detail stat strip, Graph tab DAG card panel
- v0.9.0: initial v0.9.0 release — GraphRevision CRD, scope badge, capabilities baseline
