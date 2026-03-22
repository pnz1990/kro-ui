# Implementation Plan: RGD Validation & Linting View

**Spec**: 017-rgd-validation-linting
**Created**: 2026-03-21
**Stack**: React 19 / TypeScript / Vite (frontend only — no backend changes needed)

---

## Overview

Add a "Validation" tab to the RGD detail page (`RGDDetail.tsx`) that surfaces
`status.conditions` from the already-loaded RGD object and displays a resource
summary computed from `spec.resources`. No new API endpoints are required.

---

## Architecture

### Component Tree

```
RGDDetail.tsx              (modified — adds 4th tab: "validation")
└── ValidationTab.tsx      (new — container, orchestrates child components)
    ├── ConditionItem.tsx  (new — single condition row with icon/reason/message)
    └── ResourceSummary.tsx (new — node type breakdown + CEL cross-ref list)
```

### Data Flow

1. `RGDDetail` already fetches `rgd` via `getRGD(name)` on mount
2. `ValidationTab` receives `rgd` as a prop (no additional API call — FR-001)
3. `ConditionItem` receives a single condition object
4. `ResourceSummary` receives `rgd.spec` and calls `buildDAGGraph` to compute the breakdown (FR-004)

---

## File Structure

### New files

```
web/src/components/ValidationTab.tsx      # Main validation tab container
web/src/components/ValidationTab.css      # Styles (tokens.css only)
web/src/components/ConditionItem.tsx      # Single condition row
web/src/components/ResourceSummary.tsx    # Node type breakdown + CEL refs
web/src/components/ValidationTab.test.tsx # Unit tests (Vitest)
```

### Modified files

```
web/src/pages/RGDDetail.tsx               # Add "validation" to TabId, tab bar, tab content
```

---

## Key Decisions

### No new CSS files for ConditionItem / ResourceSummary

`ConditionItem` and `ResourceSummary` are styled via `ValidationTab.css` to
keep the file count low (§V Simplicity). They are not independently reusable
pages — they are sub-components of `ValidationTab` only.

### Known condition types (FR-002)

The four known condition types have friendly labels; unknown types render
generically with their raw `type` value (FR-003). The known set is a constant
array to allow future additions in one place.

### Message truncation (edge case)

Messages longer than 200 characters are truncated with a "Show more" toggle
implemented via React `useState` inside `ConditionItem`.

### CEL cross-reference extraction (FR-005)

`ResourceSummary` reuses `buildDAGGraph` from `web/src/lib/dag.ts`. The edges
in the result represent CEL cross-references (from → to), which are displayed
as a list.

### URL param: `?tab=validation` (FR-006)

`TabId` union is extended to include `"validation"`. The `setTab("graph")`
clean-URL logic is preserved; `setTab("validation")` sets `{ tab: "validation" }`.

---

## Acceptance Criteria Checklist

- [ ] FR-001: Validation tab reads from already-loaded RGD — no extra API call
- [ ] FR-002: Known conditions shown with icon (✓/✗/○), reason, message, timestamp
- [ ] FR-003: Unknown conditions rendered generically without crashing
- [ ] FR-004: Resource summary computed client-side from spec.resources via buildDAGGraph
- [ ] FR-005: CEL cross-references extracted from graph edges
- [ ] FR-006: Tab accessible via ?tab=validation
- [ ] NFR-001: Renders within 200ms (synchronous — no API call)
- [ ] NFR-002: TypeScript strict mode passes (tsc --noEmit)
- [ ] Unit tests pass for all 5 ValidationTab test cases from spec
