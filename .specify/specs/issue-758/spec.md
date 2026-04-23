# Spec: issue-758

## Design reference
- **Design doc**: `docs/design/26-anchor-kro-ui.md`
- **Section**: `§ Future`
- **Implements**: 26.7 — Persona: kro contributor / donation reviewer (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: `test/e2e/journeys/091-kro-contributor-persona.spec.ts` exists after this change.
  Verification: `test -f test/e2e/journeys/091-kro-contributor-persona.spec.ts`

**O2**: The journey file contains `test.describe('Journey 091` and at least 4 `test(` blocks.
  Verification: `grep -c "test('" test/e2e/journeys/091-kro-contributor-persona.spec.ts` returns ≥ 4

**O3**: `playwright.config.ts` testMatch for chunk-9 includes `091` in its pattern.
  Verification: `grep '091' test/e2e/playwright.config.ts` exits 0

**O4**: The journey steps verify GOVERNANCE.md, OWNERS, SECURITY.md, and CONTRIBUTING.md
  are accessible from the server (the repo root is embedded via go:embed).
  Verification: `grep -c "GOVERNANCE\|OWNERS\|SECURITY\|CONTRIBUTING" test/e2e/journeys/091-kro-contributor-persona.spec.ts` returns ≥ 4

**O5**: `docs/design/26-anchor-kro-ui.md` is updated to mark 26.7 ✅ Present.
  Verification: `grep '✅.*26\.7' docs/design/26-anchor-kro-ui.md` exits 0

**O6**: Journey file has Apache 2.0 copyright header and Constitution §XIV compliance comments.

---

## Zone 2 — Implementer's judgment

- Journey numbering: 091 (next after 090)
- Steps: health check, GOVERNANCE.md existence, OWNERS existence, SECURITY.md existence, CONTRIBUTING.md existence, version API check, Lighthouse/axe-core evidence (README mentions CI badges), README has at least one link to donation docs (GOVERNANCE or CONTRIBUTING).
- The journey uses `page.request.get()` to check file endpoints — the files themselves are NOT served by kro-ui directly (they are repo docs, not embedded in the binary). The journey should check that the README mentions these files and that the kro-ui server is running with expected health.
- For files not served by the binary: the journey verifies their presence at the API level indirectly by checking `page.goto()` on the kro-ui pages and checking README links in the rendered HTML, OR by explicitly noting that the files are repo-level artifacts checked in a separate CI job.
- Simpler approach: the journey checks the kro-ui version API, healthz API, and then verifies the UI pages render correctly; the "donation reviewer" persona walks the UI to verify supply chain signals (version displayed in footer, CI badge links, etc.)
- Use `page.request.get()` for all URL checks, never HTTP status from `page.goto()` for route existence.

---

## Zone 3 — Scoped out

- Testing actual content of GOVERNANCE.md (format compliance) — this is a repo review, not a UI test.
- E2E testing Lighthouse scores or axe-core runs (these are CI jobs, not kro-ui journeys).
- Creating new backend endpoints to serve GOVERNANCE.md.
- Verifying Git history or commit signatures.
