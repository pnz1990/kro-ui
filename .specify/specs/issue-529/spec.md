# Spec: 27.2 — Accessibility Pass

> Issue: #529
> Branch: feat/issue-529
> Design ref: `docs/design/27-stage3-kro-tracking.md`

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.2 — Accessibility pass (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1 — Journey 074 runs in CI.**
`test/e2e/journeys/074-accessibility.spec.ts` must be assigned to a Playwright
chunk in `playwright.config.ts`. A file without a `testMatch` chunk is silently
skipped. After this PR: running `make test-e2e` must execute all 4 steps in 074.

**O2 — The chunk comment matches what's included.**
The chunk-9 comment header (`// chunk-9: 060-075`) must be updated to reference
journey 074 (accessibility) alongside the existing entries.

**O3 — The journey covers all 4 Tier 1 pages.**
`074-accessibility.spec.ts` already contains 4 steps: Catalog page, RGD DAG,
Instance list, Context switcher. No new steps needed — just chunk registration.

---

## Zone 2 — Implementer's judgment

- Journey 074 already exists with complete axe-core assertions for all Tier 1 pages.
- The only change required is adding `074` to chunk-9's `testMatch` regex.
- No modifications to the journey file itself — it is already correct.

---

## Zone 3 — Scoped out

- Fixing any actual axe violations found (those will be separate PRs per page/component)
- Adding the Overview page axe scan (Overview = `/` route; already covered by context-switcher
  step which scans the header/nav; full page scan is Zone 3 for 27.2)
- WCAG AAA compliance (only AA required)
