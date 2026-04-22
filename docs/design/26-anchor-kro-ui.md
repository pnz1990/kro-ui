# 26 — kro-ui Anchor Journeys

**Status**: Active
**Deciders**: @pnz1990
**Date**: 2026-04
**Refs**: `test/e2e/journeys/`, `docs/aide/definition-of-done.md`

---

## Problem statement

kro-ui has 70+ E2E journeys organised by feature (one spec → one journey file).
This is good for regression coverage but misses an important testing dimension:
end-to-end persona journeys that cross feature boundaries. An operator who
deploys an RGD and monitors its instances exercises Overview, Catalog, RGD
detail, Instance list, Instance detail, and Health chips — all in a single
workflow. No single feature journey covers that path.

Anchor journeys complement the feature matrix: they are the "user stories from
`definition-of-done.md`" expressed as Playwright tests, not isolated unit
verifications.

---

## Design

### Persona: Operator

The kro operator is a platform engineer who:
1. Browses the Overview to check cluster health at a glance
2. Navigates to Catalog to find a specific RGD
3. Opens the RGD detail Graph tab to inspect the resource topology
4. Goes to the Instances tab to see live deployments
5. Clicks an instance to drill into its health state, conditions, and events
6. Uses the health chips to verify the instance is healthy

### Anchor journey structure

Each anchor journey:
- Covers one persona end-to-end (>= 4 pages / feature areas)
- Uses existing fixtures (no new cluster resources required)
- Is idempotent and hermetic — safe to run in CI on the kind cluster
- Documents which `definition-of-done.md` journey it validates

### Anchor journey numbering

Anchor journeys use prefix `071–079` to distinguish them from feature journeys.
They do not map 1:1 to a feature spec; they map to a persona and a dod-journey.

---

## Present

✅ 26.1 — Operator persona journey (PR #457): deploys RGD, verifies instances, checks health (covers DoD journeys 1 + 2).
✅ 26.2 — SRE persona journey (PR #460): fleet anomaly investigation — Overview SRE dashboard → RGD errors tab → instance detail → events panel.

---

## Present (continued)

✅ 26.3 — Developer persona journey (PR #461): RGD Designer workflow — /author nav → authoring form → YAML preview → DAG preview → scope configuration.

---

## Future

- ✅ Degraded-cluster persona anchor journey: an operator who sees a degraded cluster in the Fleet view investigates — Fleet matrix → failing RGD → Errors tab → raw YAML → conditions panel; this path is not covered by any existing anchor journey and is a key production-use scenario (PR #653)
- ✅ RBAC-restricted persona journey: an operator with read-only access to only 2 of 5 namespaces opens the /instances page; the journey must assert the "N RGDs hidden — insufficient permissions" advisory is visible (tests the partial-RBAC gap in 29-instance-management.md) (PR #527)
- 🔲 Air-gapped environment smoke test: start kro-ui binary with no external network access (block fonts.googleapis.com at the host level); assert the UI is still fully functional and all text renders with a system fallback font — required before self-hosting fonts (spec 27.16) to prove the fallback path works
