# Spec: E2E Journey for Designer Cluster Import Panel

**Issue**: GH #619
**Branch**: feat/issue-619
**Date**: 2026-04-21

## Design reference
- **Design doc**: `docs/design/30-rgd-designer.md`
- **Section**: `§ E2E coverage`
- **Implements**: E2E journey for ClusterImportPanel (added in PR #618) — verifies
  the "Load from Cluster" flow in the RGD Designer against a live kind cluster with
  the test-app fixture installed (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: A file `test/e2e/journeys/082-designer-cluster-import.spec.ts` exists and
contains at least one `test.describe` block with at least 4 `test()` steps.

**O2**: The journey navigates to `/author` and clicks the "Load from Cluster"
toggle (`data-testid="cluster-import-toggle"`). A violation is any implementation
that skips this click.

**O3**: After clicking the toggle, the journey uses `waitForFunction` polling (not
`waitForTimeout`) to wait for the RGD dropdown to populate with at least one option.
A violation is any use of `page.waitForTimeout` or any fixed-ms sleep.

**O4**: The journey selects the `test-app` RGD from the dropdown
(`data-testid="cluster-import-select"`) and clicks Load (`data-testid="cluster-import-load"`).

**O5**: After Load completes, the journey asserts the RGD name field in the
authoring form (`#rgd-name`) has a non-empty value (i.e., the import replaced
the form state). A violation is asserting on a static default value.

**O6**: The journey file is assigned to an existing Playwright chunk in
`playwright.config.ts` so it is not silently skipped (AGENTS anti-pattern rule).
The `082` prefix MUST appear in a `testMatch` pattern.

**O7**: The journey follows the Apache 2.0 copyright header standard used by all
other journey files in the repo.

**O8**: All E2E anti-patterns from AGENTS.md §Known anti-patterns are observed:
- No `waitForTimeout` / fixed-ms guards
- SPA HTTP-200 pitfall is avoided (API route used to verify cluster is live if needed)
- `locator.or()` is not used where multiple elements may both be visible
- Missing `})` brace depth error is avoided

---

## Zone 2 — Implementer's judgment

- Whether the journey checks the toggle collapses after Load (nice to have)
- Whether to test the error state when no RGD is on the cluster (not required —
  kind cluster always has test-app)
- Exact timeout values (15 000 ms is conventional for this project)
- Whether to add the test to chunk-9 (existing) or a new chunk-10 (use chunk-9)

---

## Zone 3 — Scoped out

- Unit tests for ClusterImportPanel (11 already exist in PR #618)
- Backend API tests for `/api/v1/rgds`
- Testing import of RGDs other than test-app
- Visual regression or screenshot tests
