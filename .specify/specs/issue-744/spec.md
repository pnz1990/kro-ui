# Spec: issue-744 — E2E journey for CEL expression linter in Designer

## Design reference
- **Design doc**: `docs/design/31-rgd-designer.md`
- **Section**: `§ Present`
- **Implements**: E2E Playwright journey for spec issue-721 CEL expression linter (🔲 → ✅)

## Zone 1 — Obligations (falsifiable)

**O1**: A Playwright journey exists at `test/e2e/journeys/091-designer-cel-linter.spec.ts` covering
the CEL linter feature shipped in PR #743 (spec issue-721).

**O2**: The journey prefix (`091`) MUST appear in a `testMatch` pattern in
`test/e2e/playwright.config.ts` — unregistered journeys are silently skipped (anti-pattern §310).

**O3**: The journey includes at minimum:
  1. Load `/author`, assert form visible
  2. Add a resource node
  3. Expand advanced options for the resource
  4. Add a `readyWhen` expression row
  5. Type an unclosed string literal (e.g. `"hello`) — assert CEL error hint appears
  6. Clear/fix the expression — assert CEL error hint disappears

**O4**: All waits use `waitForFunction` — no `waitForTimeout` (anti-pattern §339, constitution §XIV).

**O5**: Journey uses `page.request.get(apiUrl)` for server health check (SPA returns HTTP 200 for
non-existent routes — anti-pattern §310).

**O6**: Journey is registered in `chunk-9` (or new chunk) in `playwright.config.ts` and is
reachable from CI.

## Zone 2 — Implementer's judgment

- Journey number: 091 (next available after 090)
- Debounce: the CEL hint fires after 300ms — use `waitForFunction` with a ≥400ms implied timeout;
  do NOT add explicit `waitForTimeout`.
- The `readyWhen` input is rendered only after: (a) a resource exists, (b) advanced section is
  expanded, (c) at least one readyWhen row is added. All three preconditions must be set up in
  the test.
- The test must be resilient to the first resource's generated `_key` value (use `data-testid`
  attribute substring matching if needed).

## Zone 3 — Scoped out

- Testing `includeWhen` lint (it uses the same code path; one CEL context is sufficient for E2E)
- Testing the warning-level bare-string check (same code path; error path is more critical)
- Testing CEL linter in combination with static validation panel
