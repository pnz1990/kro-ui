# Tasks: issue-766

## Pre-implementation
- [CMD] `go vet ./...` in worktree — expected: no new errors

## Implementation
- [AI] Create `DesignerTour.tsx` + `DesignerTour.css` component — O1, O2, O3, O4, O5, O6, O7, O8
- [AI] Update `AuthorPage.tsx` to render `DesignerTour` and "?" button — O1, O5, O8
- [AI] Write `DesignerTour.test.tsx` unit tests (render, skip, finish, re-trigger) — O1–O8
- [CMD] grep new CSS for hardcoded colors → expect empty — O6
- [AI] Update design doc 31 to mark 31.1 as ✅

## Post-implementation
- [CMD] `go vet ./...` — expected: no errors
- [CMD] tsc --noEmit check
