# Tasks: 035-global-footer

**Input**: Design documents from `.specify/specs/035-global-footer/`
**Source**: plan.md, research.md, data-model.md, quickstart.md
**Feature**: Global footer — links to kro.run, GitHub, and License on every page (GitHub issue #127)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths are relative to the worktree root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing shell structure and prepare the insertion point.
No project init needed — this is a net-new component inside an already-running app.

- [x] T001 Read `web/src/components/Layout.tsx` and `web/src/components/Layout.css` to confirm the current shell structure before making changes
- [x] T002 [P] Read `web/src/tokens.css` to confirm existing tokens cover all footer visual needs (per research.md §Q1 and §Q6 — no new tokens expected)

**Checkpoint**: Shell structure confirmed; token list verified; ready to author the component.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blockers exist for this feature. The CSS module
(`Footer.css`) must be created before `Footer.tsx` imports it, so CSS is authored first.

- [x] T003 Create `web/src/components/Footer.css` with the following rules (tokens only — no hex or rgba):
  - `.footer`: `display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 40px; background: var(--color-surface); border-top: 1px solid var(--color-border-subtle); font-family: var(--font-sans); font-size: 0.75rem; color: var(--color-text-faint); flex-shrink: 0;`
  - `.footer__left`: no extra styles needed (inherits flex-child defaults)
  - `.footer__right`: `display: flex; align-items: center; gap: 16px;`
  - `.footer__right a`: no color override (inherits global `a { color: var(--color-primary) }` from tokens.css)

**Checkpoint**: `Footer.css` exists; token audit passes (no inline colors); ready to wire the component.

---

## Phase 3: User Story 1 — Global footer visible on every page (Priority: P1) 🎯 MVP

**Goal**: A `<footer>` element appears at the bottom of every page in kro-ui. It
shows "kro-ui" on the left and three external links (kro.run, GitHub, License) on
the right. All links open in a new tab. The footer adapts correctly in both dark
and light mode using existing design-system tokens only.

**User Story**: As a platform engineer using kro-ui, I want to see links to kro
documentation and the GitHub repository so that I can find help and community
resources without leaving the tool.

**Independent Test**:
1. `make web` builds without TypeScript errors
2. Navigate to `/` — footer is visible below page content
3. Navigate to `/catalog`, `/fleet`, `/events`, `/rgds/:name`, and the `*` catch-all — footer present on all
4. Click "kro.run" → opens `https://kro.run` in a new tab
5. Click "GitHub" → opens `https://github.com/kubernetes-sigs/kro` in a new tab
6. Click "License" → opens `https://www.apache.org/licenses/LICENSE-2.0` in a new tab
7. Set `document.documentElement.dataset.theme = 'light'` in DevTools → footer colors adapt
8. Inspect `Footer.css` → confirm zero `rgba()`, hex literals, or hardcoded values

### Implementation for User Story 1

- [x] T004 [US1] Create `web/src/components/Footer.tsx` — stateless functional component `() => JSX.Element` that renders:
  ```tsx
  import './Footer.css'
  export default function Footer() {
    return (
      <footer className="footer">
        <div className="footer__left">kro-ui</div>
        <div className="footer__right">
          <a href="https://kro.run" target="_blank" rel="noopener noreferrer">kro.run</a>
          <a href="https://github.com/kubernetes-sigs/kro" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">License</a>
        </div>
      </footer>
    )
  }
  ```

- [x] T005 [US1] Edit `web/src/components/Layout.tsx` — add `import Footer from './Footer'` at the top and render `<Footer />` as the third flex child of `.layout`, immediately after `</main>` (before the closing `</div>`)

- [x] T006 [US1] Run `cd web && npx tsc --noEmit` and fix any TypeScript errors

- [x] T007 [US1] Run `make web` (or `cd web && bun run build`) to confirm the frontend builds cleanly with no errors or warnings

**Checkpoint**: Footer is rendered on every route. Typecheck and build pass. All three links open in new tab. Token compliance verified (no inline colors in Footer.css).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation pass across all routes, modes, and build artifacts.

- [x] T008 [P] Manually verify the footer appears on all routes: `/`, `/catalog`, `/fleet`, `/events`, a valid RGD detail page (or the 404 fallback), and the `*` catch-all (`/does-not-exist`)
- [x] T009 [P] Verify dark → light mode adaptation: in browser DevTools console run `document.documentElement.dataset.theme = 'light'` and confirm footer background, border, and text colors update correctly
- [x] T010 Run `make go` to build the full Go binary with embedded frontend and confirm the binary starts with `./kro-ui serve`
- [x] T011 [P] Token compliance audit: inspect `web/src/components/Footer.css` — confirm zero `rgba()`, hex `#` literals, or hardcoded shadow values; all color references must be `var(--token-name)` only (constitution §IX gate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 are parallel reads
- **Phase 2 (Foundational)**: Can start after Phase 1 confirms token coverage — T003 authors `Footer.css`
- **Phase 3 (US1)**: T004 depends on T003 (CSS must exist before component imports it); T005 depends on T004; T006–T007 depend on T005
- **Phase 4 (Polish)**: Depends on Phase 3 completion; T008, T009, T011 are parallel; T010 depends on T007

### Within User Story 1

```
T003 (Footer.css) → T004 (Footer.tsx) → T005 (Layout.tsx) → T006 (tsc) → T007 (build)
```

T008, T009, T011 can run in parallel after T007.

### Parallel Opportunities

- T001 and T002 (Phase 1 reads) run in parallel
- T008, T009, T011 (Phase 4 validations) run in parallel

---

## Parallel Example: Phase 1

```
# These two reads have no dependencies on each other:
Task: Read web/src/components/Layout.tsx and Layout.css
Task: Read web/src/tokens.css to verify token coverage
```

## Parallel Example: Phase 4

```
# These three validations are independent — run together:
Task: Manual route verification (T008)
Task: Dark/light mode check (T009)
Task: Token compliance audit (T011)
```

---

## Implementation Strategy

### MVP (this feature is already a single story — complete it in one pass)

1. Complete Phase 1: Read Layout + tokens (parallel)
2. Complete Phase 2: Author `Footer.css`
3. Complete Phase 3: Author `Footer.tsx`, wire into `Layout.tsx`, typecheck, build
4. **STOP and VALIDATE**: run through the Independent Test checklist above
5. Complete Phase 4: Polish validations

### Commit message (after all phases)

```
feat(web): add global footer with links to kro.run and GitHub

Implements GitHub issue #127. Footer is a static presentational component
inserted as a third flex child of Layout. Uses only existing design-system
tokens — no new tokens, no new npm dependencies.
```

---

## Notes

- No spec.md exists for this feature; user stories are derived from GitHub issue #127 and planning artifacts
- No backend changes — purely frontend
- No new npm packages — React already present
- No new tokens — existing set covers all needs (verified in research.md §Q1 and §Q6)
- `[P]` tasks touch different files and have no incomplete dependencies
- Constitution §IX gate: `Footer.css` must pass token audit before this feature ships
