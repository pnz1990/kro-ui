# Spec: issue-663 — E2E Scale Fixture (27.18)

> Status: Active | Created: 2026-04-22

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.18 — E2E scale fixture: add `scale-test-rgds.yaml` with a
  single wide RGD (20 resource nodes, the largest in CI), `scale-test-instances.yaml`,
  and journey 083 that verifies Overview TTI and DAG render under scale
  (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: `test/e2e/fixtures/scale-test-rgds.yaml` MUST exist and define a
`ResourceGraphDefinition` named `scale-wide` with ≥ 20 resource nodes.
Violation: the fixture file is absent or has < 20 resource entries.

**O2**: `test/e2e/fixtures/scale-test-instances.yaml` MUST exist and define
at least one CR instance of the `scale-wide` RGD kind (`ScaleWideApp`).
Violation: the instances file is absent or references a different RGD kind.

**O3**: `fixture-state.ts` and `global-setup.ts` MUST be updated to include a
`scaleReady` flag — `globalSetup` applies the scale fixture and sets
`fixtureState.scaleReady = true` on success (non-fatal on failure).
Violation: `scaleReady` is missing from the `FixtureState` interface or
`globalSetup` does not apply the scale fixture YAML files.

**O4**: Journey `083-scale-fixture.spec.ts` MUST exist in
`test/e2e/journeys/` and test.skip gracefully when `!fixtureState.scaleReady`.
The journey MUST assert:
- The Overview page renders (card grid or empty state) within 2000ms of
  navigation (wall-clock, not Lighthouse — CI budget allows headroom).
- Navigating to the `scale-wide` RGD detail page renders the DAG without a
  JS error (no `console.error` from `dagre` or `SVG` overflow).
Violation: the journey is absent, does not skip when `scaleReady` is false, or
does not assert rendering within the time budget.

**O5**: Journey 083 MUST be assigned to a Playwright chunk in
`playwright.config.ts` (chunk-9 `testMatch` pattern must include `083`).
Violation: the journey is not matched by any `testMatch` pattern — it is
silently skipped in CI (the anti-pattern from `docs/agents/AGENTS.md`).

**O6**: The design doc `docs/design/27-stage3-kro-tracking.md` MUST have
item 27.18 updated from `🔲 Future` to `✅ Present`.
Violation: the design doc still shows `🔲 27.18`.

---

## Zone 2 — Implementer's judgment

- The scale fixture uses 20 ConfigMaps (not 50) — a kind cluster's kro
  controller can reconcile 20 resources comfortably in CI; 50 would extend
  E2E setup time beyond the 20-minute budget.
- ConfigMaps are stateless (healthy by existence) so the instances become
  Ready almost immediately — no readyWhen conditions needed.
- Journey 083 uses `performance.getEntriesByType('navigation')[0].domInteractive`
  for the TTI measurement, consistent with journey 080.
- The DAG render check navigates to `/rgds/scale-wide` and waits for either
  `[data-testid="dag-svg"]` or a no-nodes hint — does not assert layout
  correctness, only absence of JS errors.

---

## Zone 3 — Scoped out

- 200-node scenario — would require a dedicated test namespace and exceed the
  CI performance budget. Documented as a follow-up in 27.18 design doc note.
- Snapshot comparisons of the rendered SVG — pixel-level DAG layout is
  non-deterministic across Chromium versions.
- Performance regression for the RGD detail page — journey 080 already
  covers the Overview; this spec only adds the DAG render smoke test.
