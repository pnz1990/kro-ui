# 27 — Stage 3: kro Upstream Tracking + Next Features

> Status: Active | Created: 2026-04-20
> Applies to: kro-ui ongoing development (post-v0.9.4)

---

## Problem

kro-ui is mature at v0.9.4. The roadmap says "Track kro upstream releases and apply UI
changes as new CRDs/fields land" but there is no concrete queue backing this. Without
explicit Future items, the loop generates busywork (test coverage micro-PRs) instead of
meaningful product advancement.

This design doc provides the concrete queue for Stage 3.

---

## kro Upstream Tracking

kro v0.9.1 is the current supported version. The kro project is actively developed.
Each new kro release may add new CRD fields, new health states, new CEL functions,
or new ResourceGraphDefinition capabilities that kro-ui must reflect.

**Protocol**: Check `kubernetes-sigs/kro` releases before every batch. If a new
release has landed since our last check:
1. Read the release notes and changelog
2. Identify any CRD schema changes, new fields, or new API paths
3. Open a `feat(kro-vX.Y.Z): support new <feature>` issue per change
4. Implement the UI changes in the normal COORD→ENG→QA loop

---

## Present

✅ 27.0 — kro v0.9.1 support: GraphRevision CRD, hash column, CEL hash functions (PR #428)
✅ 27.3 — Fleet persona anchor journey: 6-step journey covering multi-cluster fleet view → health matrix → context switch → per-cluster RGD count (journey 075, issue #524)

---

## Future

- 🔲 27.1 — kro release tracking automation: SM §4a checks `kubernetes-sigs/kro` latest tag each batch; if newer than current supported version, opens a `feat(upstream): kro vX.Y support` issue automatically
- 🔲 27.2 — Accessibility pass: all Tier 1 pages (Overview, RGD list, RGD detail, Instance detail) pass axe-core with 0 violations; add to E2E journey 074
- 🔲 27.4 — Performance budget: Overview page load <1s on 50-RGD cluster; add Lighthouse CI check to CI pipeline
- 🔲 27.5 — kro-ui v0.10.0 release: cut GitHub release with changelog, tag, and release notes generated from merged PRs since v0.9.4
- 🔲 27.6 — Error state coverage: every page that fetches data must show a non-empty error state when the API returns 5xx; add E2E journeys 076-079 covering error states for Overview, Fleet, RGD detail, Instance detail
- 🔲 27.7 — Donation readiness checklist: CNCF sandbox criteria, kubernetes-sigs contribution guide, DCO sign-off enforcement, security policy file, OWNERS file

---

## Zone 1 — Obligations

**O1 — kro upstream tracking is automated.** SM §4a must check for new kro releases
every batch and open issues automatically. Manual tracking is not acceptable.

**O2 — Every UI change for a new kro version ships with an E2E journey update.**
A kro API change with no journey update is a regression risk.

**O3 — v0.10.0 release requires all 27.2–27.6 items shipped.**
Do not cut v0.10.0 with open items from this list.

---

## Zone 2 — Implementer's judgment

- Accessibility checks: use `@axe-core/playwright` which is already in package.json
- Performance budget: use Lighthouse CI or simple `time curl` in E2E fixture
- Release: use `gh release create` with auto-generated notes

---

## Zone 3 — Scoped out

- Argo Rollouts integration (requires kro plugin ecosystem, not in v0.10 scope)
- GraphRevision diff viewer for >100 nodes (performance problem for later)
