# Tasks: 033-first-time-onboarding

**Input**: Design documents from `.specify/specs/033-first-time-onboarding/`
**Source issue**: #120 — "ux: No onboarding — first-time visitor has zero context about what kro-ui is"
**Branch**: `033-first-time-onboarding`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths relative to repository root

## User Stories

| ID | Priority | Title | Delivers |
|----|----------|-------|---------|
| US1 | P1 | Site-wide footer with kro links + version | `Footer` component in `Layout` — visible on every page |
| US2 | P2 | Rich home empty-state onboarding panel | Richer `Home` empty-state when cluster has 0 RGDs |
| US3 | P3 | Home page tagline / descriptor | Sub-heading in home empty-state: one-liner explaining kro-ui |

> Note: US3 overlaps with US2 (the tagline lives inside the empty-state panel). It is included as a
> separate story to match the three distinct deliverables from issue #120: tagline, footer, empty-state.
> In practice, US3 is completed as part of the US2 empty-state panel copy.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify pre-conditions and add the one missing API helper. No new
packages. No backend changes.

- [X] T001 Verify `Layout.css` has `display:flex; flex-direction:column; min-height:100vh` on `.layout` and `flex:1` on `.layout__content` — no edit needed if already present in `web/src/components/Layout.css`
- [X] T002 Add `VersionResponse` type and `getVersion()` function to `web/src/lib/api.ts` (append after `getControllerMetrics` at line 163; follows existing `get<T>()` pattern)

**Checkpoint**: `bun typecheck` passes. `getVersion` is exported from `@/lib/api`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No additional foundational work beyond Phase 1 — this feature has
no shared infrastructure beyond the `getVersion` API call added in T002. Both
US1 (Footer) and US2 (empty-state) can proceed directly after Phase 1.

**⚠️ Note**: T002 must complete before T004 (Footer imports `getVersion`).

---

## Phase 3: User Story 1 — Site-wide Footer (Priority: P1) 🎯 MVP

> **⚠️ Superseded by spec 035-global-footer (PR #138)**: The Footer component
> and its CSS were delivered by spec 035, which had independent, more complete
> requirements. The tasks below are marked complete; the canonical Footer.tsx
> implementation is in spec 035. The merged Footer.tsx renders kro.run and GitHub
> links in a `<footer role="contentinfo">` element. Version display was dropped
> from the final implementation (the version API is available at `/api/v1/version`
> but the footer does not display it — onboarding page uses it instead).

**Goal**: Every page in kro-ui shows a footer with links to `kro.run`, the kro
GitHub repository, and the running app version. Version is fetched from
`/api/v1/version`; absent silently on failure.

**Independent Test**:
1. `bun typecheck` — no new TypeScript errors
2. Navigate to `/`, `/catalog`, `/fleet`, `/events`, `/rgds/anything` — footer visible on all
3. Footer shows "kro.run" and "GitHub" links that open in new tab
4. Footer version shows a version string (e.g. `v0.2.1`) when backend is reachable
5. Footer version is absent (no error, no `?`) when `/api/v1/version` returns an error
6. No hex literals in `web/src/components/Footer.css` (grep `#[0-9a-fA-F]` returns 0)

### Implementation for User Story 1

- [X] T003 [US1] Create `web/src/components/Footer.tsx` — `<footer role="contentinfo">` with copyright year, `kro.run` + GitHub nav links, conditional version span; fetches `getVersion()` on mount with silent error handling; imports `Footer.css`
- [X] T004 [P] [US1] Create `web/src/components/Footer.css` — `.footer`, `.footer__inner`, `.footer__copy`, `.footer__links`, `.footer__link` (hover), `.footer__version`; all colors via `var(--token)` only; `border-top: 1px solid var(--color-border-subtle)` as separator
- [X] T005 [US1] Modify `web/src/components/Layout.tsx` — import `Footer` from `'./Footer'`; add `<Footer />` below `</main>` inside `.layout` div

**Checkpoint**: After T003–T005, footer appears on every route. Run typecheck.
`bun typecheck` must pass with zero new errors.

---

## Phase 4: User Story 2 — Rich Home Empty State (Priority: P2)

**Goal**: When a cluster has zero ResourceGraphDefinitions, the home page shows
an informative onboarding panel: a title, a one-line description of kro-ui and
kro, and two CTA links ("Get started with kro" → docs, "kro on GitHub").

**Independent Test**:
1. With an empty cluster (or by temporarily stubbing `listRGDs` to return `{items:[]}`) — the home page shows the onboarding panel with title, description, and two CTA links
2. The search no-results case ("No RGDs match…") is unchanged — still shows "Clear search" button
3. No hex literals in new Home.css additions
4. `bun typecheck` passes

### Implementation for User Story 2

- [X] T006 [US2] Modify `web/src/pages/Home.tsx` — replace the `items.length === 0` empty-state JSX block (lines 64–70) with the onboarding panel: `<div class="home__empty home__empty--onboarding">` containing `.home__empty-title` h2, `.home__empty-desc` paragraph (with inline kro.run link), and `.home__empty-actions` div with two `.home__empty-cta` links; keep search no-results branch unchanged
- [X] T007 [P] [US2] Add new CSS rules to `web/src/pages/Home.css` — append `.home__empty--onboarding`, `.home__empty-title`, `.home__empty-desc` (and `a` / `a:hover` child rules), `.home__empty-actions`, `.home__empty-cta`, `.home__empty-cta:hover`, `.home__empty-cta--secondary`, `.home__empty-cta--secondary:hover`; all colors via `var(--token)` only

**Checkpoint**: After T006–T007, the onboarding panel is visible on empty clusters.
Existing card grid, search filtering, and loading/error states are unaffected.

---

## Phase 5: User Story 3 — Home Page Tagline (Priority: P3)

**Goal**: A first-time visitor reading the empty-state panel immediately
understands what kro-ui is (the `home__empty-title` and `home__empty-desc`
together serve as the tagline). This story is completed as part of US2 copy.

**Independent Test**:
1. On empty cluster, home page shows: title "No ResourceGraphDefinitions found"
   and paragraph starting with "kro-ui is a read-only observability dashboard for kro"
2. The inline `kro.run` link in the description opens in a new tab

### Implementation for User Story 3

- [X] T008 [US3] Verify that `Home.tsx` empty-state copy (from T006) includes the tagline text: `"kro-ui is a read-only observability dashboard for kro — the Kubernetes Resource Orchestrator"` and that the inline `<a href="https://kro.run">kro</a>` has `target="_blank" rel="noopener noreferrer"` — adjust wording if needed; no new files

**Checkpoint**: Tagline is visible and accurate. If T006 was done correctly, T008 is a
verification step only.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gate before PR — accessibility, token compliance,
typecheck, and quick smoke test.

- [X] T009 [P] Accessibility audit — verify `<footer role="contentinfo">` landmark present, footer `<nav aria-label="External resources">` present, all interactive elements have accessible names; check in browser DevTools Accessibility panel
- [X] T010 [P] Token compliance audit — run `grep -n '#[0-9a-fA-F]' web/src/components/Footer.css web/src/pages/Home.css` and confirm zero matches in the newly added rules
- [X] T011 Run `bun typecheck` and resolve any TypeScript errors
- [X] T012 Run `go vet ./...` — confirms no backend regressions (backend is unchanged)
- [X] T013 Light-mode smoke test — toggle `data-theme="light"` on `<html>` in DevTools; verify footer and empty-state render correctly via existing token overrides in `tokens.css`
- [X] T014 Verify `document.title` is still "kro-ui" on the home page (unchanged)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► T002 (getVersion in api.ts)
        └─► T003 (Footer.tsx — imports getVersion)
              ├─► T004 [P] (Footer.css — parallel with T003 once Footer.tsx exists)
              └─► T005 (Layout.tsx — imports Footer)

Phase 1 (Setup) also unblocks:
  └─► T006 (Home.tsx empty-state — no dependency on Footer)
        └─► T007 [P] (Home.css additions — parallel with T006)
              └─► T008 (US3 verification — depends on T006)

All implementation phases complete:
  └─► Phase 6 (Polish — T009–T014)
```

### User Story Dependencies

- **US1 (Footer)**: T001 → T002 → T003 + T004 (parallel) → T005
- **US2 (Empty State)**: T001 → T006 + T007 (parallel)
- **US3 (Tagline)**: Depends on T006 (US2) — tagline is part of the empty-state copy
- **Polish**: All US1–US3 tasks complete

### Parallel Opportunities

- T004 (Footer.css) and T003 (Footer.tsx) can be written in parallel since they are separate files
- T007 (Home.css additions) can be written alongside T006 (Home.tsx changes) since they are separate files
- T009 and T010 (audit tasks) can run in parallel
- US1 (Footer work: T003–T005) and US2 (empty-state: T006–T007) are fully independent of each other and can be worked on in parallel after T001–T002

---

## Parallel Example: US1 + US2 together

```bash
# After T001 + T002 complete, launch US1 and US2 in parallel:

# US1 stream
Task: "Create web/src/components/Footer.tsx (T003)"
Task: "Create web/src/components/Footer.css (T004)"  # parallel with T003
# then T005 after T003+T004

# US2 stream (fully independent)
Task: "Modify web/src/pages/Home.tsx empty state (T006)"
Task: "Add CSS to web/src/pages/Home.css (T007)"    # parallel with T006
```

---

## Implementation Strategy

### MVP First (US1 Only — Footer)

1. Complete Phase 1: T001 + T002 (verify Layout.css, add getVersion)
2. Complete US1: T003 + T004 (parallel) → T005
3. **STOP and VALIDATE**: Footer visible on all routes, version resolves, no hex literals, typecheck passes
4. Ship US1 alone if needed

### Incremental Delivery

1. T001–T002 → Foundation ready
2. T003–T005 → Footer on every page (US1 complete) → can demo
3. T006–T007 → Rich home empty state (US2 complete) → can demo
4. T008 → Tagline verified (US3 complete)
5. T009–T014 → Polish + quality gate → ready for PR

### Key constraints

- T003 (Footer.tsx) must be complete before T005 (Layout.tsx imports it)
- T002 (getVersion) must be complete before T003 (Footer.tsx calls it)
- T006 (Home.tsx) must be complete before T008 (US3 verification)
- No backend changes at any step
- `bun typecheck` must pass after every phase

---

## Notes

- **No spec.md file exists** — user stories derived from GitHub issue #120 and design documents
- **No tests requested** — spec does not request TDD; no test tasks generated
- `Layout.css` already has `flex-direction: column; min-height: 100vh` and `flex: 1` on `layout__content` (confirmed) — T001 is a verification-only task
- `getVersion()` does not yet exist in `web/src/lib/api.ts` — T002 adds it
- All CSS must use `var(--token)` — no hex or `rgba()` literals
- [P] tasks = different files, no blocking dependencies on unfinished tasks
- [Story] label maps each task to a specific user story for traceability
