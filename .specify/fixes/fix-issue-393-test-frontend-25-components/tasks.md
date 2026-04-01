# Fix: test(frontend): 25 components and 1 lib file lack dedicated test coverage

**Issue**: #393
**Branch**: fix/issue-393-test-frontend-25-components
**Labels**: enhancement

## Root Cause

24 components (and previously 1 lib file — kro.ts now covered) shipped without
unit tests. Constitution §VII requires unit tests for pure functions and component
rendering. Two items were closed since the issue was filed: SpecPanel (PR #404)
and kro.ts (PR #317). The remaining 24 components need coverage.

## Files to change

Add one `*.test.tsx` per component:
- web/src/components/AnomalyBanner.test.tsx
- web/src/components/BatchForm.test.tsx
- web/src/components/CatalogCard.test.tsx
- web/src/components/ConditionsPanel.test.tsx
- web/src/components/EventGroup.test.tsx
- web/src/components/EventRow.test.tsx
- web/src/components/EventsPanel.test.tsx
- web/src/components/ExpandableNode.test.tsx
- web/src/components/FieldTable.test.tsx
- web/src/components/FleetMatrix.test.tsx
- web/src/components/Footer.test.tsx
- web/src/components/HealthPill.test.tsx
- web/src/components/InstanceForm.test.tsx
- web/src/components/InstanceOverlayBar.test.tsx
- web/src/components/InstanceTable.test.tsx
- web/src/components/KroCodeBlock.test.tsx
- web/src/components/LabelFilter.test.tsx
- web/src/components/NamespaceFilter.test.tsx
- web/src/components/PermissionCell.test.tsx
- web/src/components/RBACFixSuggestion.test.tsx
- web/src/components/ResourceSummary.test.tsx
- web/src/components/RevisionsTab.test.tsx
- web/src/components/SearchBar.test.tsx
- web/src/components/VirtualGrid.test.tsx

## Tasks

### Phase 1 — Write tests
- [x] AnomalyBanner — dismiss toggle, type classes, message render
- [x] BatchForm — textarea, badge count, error list
- [x] CatalogCard — name/kind/stats render, label click, link targets
- [x] ConditionsPanel — empty state, healthy count, negation polarity
- [x] EventGroup — expand/collapse, warning badge count
- [x] EventRow — warning/normal/condition-transition row classes
- [x] EventsPanel — empty state with kubectl hint, sorted events
- [x] ExpandableNode — node render, toggle text, max-depth indicator
- [x] FieldTable — spec variant required sort, status variant CEL source
- [x] FleetMatrix — empty state, present/degraded/absent cells
- [x] Footer — renders links, shows version
- [x] HealthPill — all 6 states + loading skeleton
- [x] InstanceForm — required indicator, field types render
- [x] InstanceOverlayBar — picker states, loading/error/empty
- [x] InstanceTable — renders rows, name filter, sort headers, spec diff
- [x] KroCodeBlock — renders code, copy button, title bar
- [x] LabelFilter — shows selected pills, clear-all
- [x] NamespaceFilter — All Namespaces option, selected value
- [x] PermissionCell — granted ✓ / denied ✗, aria-label
- [x] RBACFixSuggestion — expand/collapse toggle, kubectl command
- [x] ResourceSummary — counts breakdown, empty spec
- [x] RevisionsTab — loading/error/empty states (API mocked)
- [x] SearchBar — renders input, clear button on non-empty, disabled state
- [x] VirtualGrid — renders items, empty state, unmeasured fallback

### Phase 2 — Verify
- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`

### Phase 3 — PR
- [ ] Commit: `test(frontend): add unit tests for 24 untested components — closes #393`
- [ ] Push branch
- [ ] Open PR
