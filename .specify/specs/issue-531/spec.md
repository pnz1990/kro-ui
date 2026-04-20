# Spec: 27.6 — Error State Coverage

> Issue: #531
> Branch: feat/issue-531
> Design ref: `docs/design/27-stage3-kro-tracking.md`

## Design reference

- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future`
- **Implements**: 27.6 — Error state coverage (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1 — E2E journeys 076-079 exist and are assigned to a Playwright chunk.**
Four new journey files must be created:
- `076-error-state-overview.spec.ts` — Overview (/) error state
- `077-error-state-fleet.spec.ts` — Fleet (/fleet) error state
- `078-error-state-rgd-detail.spec.ts` — RGD detail (/rgds/test-app) error state
- `079-error-state-instance-detail.spec.ts` — Instance detail error state

Each must be registered in `playwright.config.ts` chunk-9 testMatch.

**O2 — Each journey uses Playwright `page.route()` to mock the relevant API returning 500.**
The mock must intercept the specific API endpoint and return a 500 response body.
After routing, navigating to the page must show the error state within 10s.

**O3 — Each journey asserts the error state element is visible.**
- Overview: `[role="alert"]` with class `home__error` is visible
- Fleet: `[role="alert"]` with class `fleet__error` is visible
- RGD detail: `[data-testid="rgd-detail-error"]` is visible
- Instance detail: `[role="alert"]` within `.instance-detail-error` is visible

**O4 — All journeys use `test.skip` guards with `fixtureState`.**
Each journey must skip if the cluster is unavailable (same pattern as 074).

---

## Zone 2 — Implementer's judgment

- Playwright `page.route()` intercepts HTTP requests — use `route.fulfill()` with
  `status: 500` and a JSON body `{ error: "internal server error" }`.
- API base path is `/api/v1/` — intercept the specific endpoint for each page.
- Journeys are short (1-2 tests each) — just navigate + assert error visible.
- Use the same PORT/BASE constants as other journeys.

---

## Zone 3 — Scoped out

- Testing retry behavior after the error state appears (separate concern)
- Testing partial failure (some widgets succeed, others fail)
- Testing network timeout vs 5xx (only 5xx covered)
- Fixing any discovered missing error states in components (separate PR)
