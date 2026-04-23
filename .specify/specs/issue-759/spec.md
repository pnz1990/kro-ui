# Spec: issue-759

## Design reference
- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: 26.8 — Persona: multi-cluster operator (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: `test/e2e/journeys/092-multi-cluster-operator-persona.spec.ts` exists.
  Verification: `test -f test/e2e/journeys/092-multi-cluster-operator-persona.spec.ts`

**O2**: The journey has at least 6 test() blocks (Fleet, injected multi-cluster, degraded, RGD, context-switcher, cache-flush).
  Verification: `grep -c "test('" test/e2e/journeys/092-multi-cluster-operator-persona.spec.ts` returns ≥ 6

**O3**: `playwright.config.ts` chunk-9 testMatch includes `092`.
  Verification: `grep '092' test/e2e/playwright.config.ts` exits 0

**O4**: The journey injects a 3-cluster fleet summary via page.route().
  Verification: `grep 'THREE_CLUSTER_FLEET_SUMMARY' test/e2e/journeys/092-multi-cluster-operator-persona.spec.ts` exits 0

**O5**: The journey exercises the context switch endpoint and verifies cache-flush behavior.
  Verification: `grep 'contexts/switch' test/e2e/journeys/092-multi-cluster-operator-persona.spec.ts` exits 0

**O6**: `docs/design/26-anchor-kro-ui.md` marks 26.8 as ✅ Present.
  Verification: `grep '✅.*26\.8' docs/design/26-anchor-kro-ui.md` exits 0

---

## Zone 2 — Implementer's judgment

- Journey numbering: 092 (next after 091)
- Steps cover: Fleet page, injected 3-cluster view, degraded cluster identification, RGD drill-down, context switcher presence, cache-flush via contexts/switch API
- Graceful skips when cluster has fewer than 2 contexts (single-cluster CI environment)
- Uses page.route() injection for 3-cluster fleet to avoid cluster state dependency

---

## Zone 3 — Scoped out

- Actual context switch UI interaction (locator.click on dropdown) — too flaky on throttled CI
- Testing that injected data renders as specific text/counts (too brittle)
- Verifying the cluster matrix renders with specific cluster names from the injection
