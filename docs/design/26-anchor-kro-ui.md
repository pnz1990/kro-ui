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

*(All 3 anchor journeys shipped — future work may add Fleet persona and advanced authoring journeys)*
