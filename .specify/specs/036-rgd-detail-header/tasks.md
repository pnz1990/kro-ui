# Tasks: 036 — RGD Detail Header: Kind Label + Status Badge

**Input**: Design documents from `.specify/specs/036-rgd-detail-header/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓  
**GitHub Issue**: #130  
**Tests**: Not requested in spec — no test tasks generated.

**Organization**: Single user story (US1) covers all requirements. Phase 1 is skipped
(no project initialization needed — editing existing files). Phase 2 is trivial
(no blocking infrastructure). Implementation goes straight to Phase 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths included in all descriptions

---

## Phase 1: Setup

> No setup needed — this feature edits two existing files in an already-initialized
> project. No new directories, dependencies, or infrastructure required.

---

## Phase 2: Foundational

> No blocking prerequisites — `StatusDot`, `extractRGDKind`, `extractReadyStatus`,
> and all CSS tokens already exist in the codebase. Implementation can begin immediately.

---

## Phase 3: User Story 1 — RGD Detail Header Shows Kind + Status (Priority: P1) 🎯 MVP

**Goal**: The RGD detail page header (`/rgds/:name`) shows the RGD name, a status dot
(green/red/gray via `StatusDot`), and a Kind badge (muted blue pill) — matching the
information visible on the home page `RGDCard`.

**Independent Test**: Navigate to any RGD detail page. Header must show:
1. StatusDot (green if Ready=True, red if Ready=False, gray if absent)
2. RGD name as `<h1>`
3. Kind badge below (or omitted entirely if `spec.schema.kind` is absent)

All acceptance criteria from spec.md must be met. Run `bun run typecheck` — zero errors.

### FR-001 — Kind Label in Detail Header

- [x] T001 [P] [US1] Add `.rgd-detail-header-row` flex rule and `.rgd-detail-kind` pill badge styles to `web/src/pages/RGDDetail.css`; adjust `.rgd-detail-name` margin-bottom from `16px` to `0`

### FR-002 + FR-003 — StatusDot + Consistent Extraction in RGDDetail.tsx

- [x] T002 [US1] Import `StatusDot` from `@/components/StatusDot` and import `extractRGDKind`, `extractReadyStatus` from `@/lib/format` in `web/src/pages/RGDDetail.tsx`
- [x] T003 [US1] Extract `rgdKind` and `readyState` local variables from the already-fetched `rgd` object (after the `if (!rgd) return null` guard) in `web/src/pages/RGDDetail.tsx`
- [x] T004 [US1] Replace the `{/* Header */}` block (lines 198–201) in `web/src/pages/RGDDetail.tsx` with the two-row layout: `.rgd-detail-header-row` wrapping `<StatusDot>` + `<h1>`, followed by conditional `<span className="rgd-detail-kind">` when `rgdKind` is truthy

**Checkpoint**: Open any RGD detail page — header shows status dot, name, and Kind badge. TypeScript compiles cleanly.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T005 Run `bun run typecheck` in `web/` and fix any type errors introduced by T002–T004
- [x] T006 Verify no hardcoded `rgba()` or hex values appear in the new CSS rules added in T001 — all colors must use `var(--token-name)` references from `tokens.css`
- [x] T007 Verify Kind badge is omitted (not blank, not `?`) when navigating to an RGD whose `spec.schema.kind` is absent or empty
- [x] T008 Update spec comment in `RGDDetail.tsx` JSDoc block (line ~28) to reference spec `036-rgd-detail-header`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: No foundational phase to wait for — begin immediately
- **Phase 4 (Polish)**: Depends on T001–T004 complete

### Within User Story 1

- **T001** (CSS) and **T002** (imports) are independent — both can be done in parallel
- **T003** depends on T002 (imports must exist before variables are added)
- **T004** depends on T003 (variables must exist before JSX uses them)
- **Phase 4** tasks T005–T008 can all run after T004

### Parallel Opportunities

```
T001 (CSS changes in RGDDetail.css)
T002 (Import additions in RGDDetail.tsx)
  ↓
T003 (Variable extraction in RGDDetail.tsx)
  ↓
T004 (JSX header replacement in RGDDetail.tsx)
  ↓
T005, T006, T007, T008 (all polish tasks run in parallel)
```

---

## Parallel Example: User Story 1

```
# Step 1 — can run in parallel (different concerns, same file is fine sequentially):
T001: Add CSS rules to web/src/pages/RGDDetail.css
T002: Add imports to web/src/pages/RGDDetail.tsx

# Step 2 — sequential (T003 needs T002's imports, T004 needs T003's vars):
T003 → T004

# Step 3 — all polish tasks independent of each other:
T005, T006, T007, T008
```

---

## Implementation Strategy

### MVP (This feature is entirely US1 — ship as one increment)

1. T001 — CSS rules (can be done first, no deps)
2. T002 — Add imports
3. T003 — Extract variables
4. T004 — Replace header JSX
5. T005–T008 — Polish and verify
6. **VALIDATE**: `bun run typecheck` passes; visual check on RGD detail page

### Incremental Delivery

This feature is small enough to land as a single commit:

```
feat(web): add Kind badge and status dot to RGD detail header (#130)
```

Files changed: `web/src/pages/RGDDetail.tsx`, `web/src/pages/RGDDetail.css`

---

## Notes

- [P] tasks = different files or independent concerns, no dependencies between them
- T001 and T002 touch different files — genuinely parallelizable
- T003 and T004 both touch `RGDDetail.tsx` — must be sequential
- No backend changes, no new files, no new npm dependencies
- `extractRGDKind` returns `''` when absent — the `{rgdKind && ...}` guard handles graceful omission automatically
- `extractReadyStatus` never returns null — `state: 'unknown'` is the safe default
