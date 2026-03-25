# Tasks: 017-rgd-validation-linting

**Spec**: `.specify/specs/017-rgd-validation-linting/spec.md`
**Branch**: `017-rgd-validation-linting`
**Depends on**: `003-rgd-detail-dag` (merged)

**Pre-existing assets**:
- `web/src/pages/RGDDetail.tsx` — add Validation tab alongside existing YAML/DAG/Instances tabs
- `web/src/lib/dag.ts` — `buildDAGGraph` already classifies node types; reuse for resource summary
- `web/src/lib/highlighter.ts` — CEL tokenizer; use for detecting `${...}` cross-references

---

## Phase 1 — Pure library: condition and resource summary helpers

- [ ] Create `web/src/lib/rgdValidation.ts`:
  - `extractConditions(rgd)` — returns typed array of `{ type, status, reason, message, lastTransitionTime }`
  - `isKnownConditionType(type)` — checks against known set: `GraphVerified`, `CustomResourceDefinitionSynced`, `TopologyReady`, `Ready`
  - `buildResourceSummary(rgd)` — walks `spec.resources`, returns `{ total, managed, collections, external }` counts using same classification logic as `buildDAGGraph` (reuse `detectNodeType` from `dag.ts`)
  - `extractCELReferences(rgd)` — scans all resource templates for `${...}` tokens; returns `Array<{ expr: string; sourceNode: string }>`
  - `truncateMessage(msg, max)` — truncates at word boundary with "… Show more" flag
- [ ] Create `web/src/lib/rgdValidation.test.ts`:
  - `extractConditions returns empty array when status absent`
  - `isKnownConditionType returns true for all 4 known types`
  - `buildResourceSummary counts node types correctly`
  - `extractCELReferences finds all ${ } tokens in template`
  - `truncateMessage truncates at 200 chars and preserves shorter strings`

## Phase 2 — ConditionItem component

- [ ] Create `web/src/components/ConditionItem.tsx`:
  - Props: `condition: RGDCondition; known: boolean`
  - Renders: status icon (✓ green / ✗ red / ○ gray for pending/unknown), type name, reason (monospace), message (with "Show more" toggle at 200 chars), last transition time
  - `data-testid="condition-item-{type}"`
- [ ] Create `web/src/components/ConditionItem.css` — tokens only; no hardcoded hex

## Phase 3 — ResourceSummary component

- [ ] Create `web/src/components/ResourceSummary.tsx`:
  - Props: `rgd: K8sObject`
  - Renders: "{total} resources: {managed} managed, {collections} collection, {external} external ref" (FR-004)
  - Below: collapsible CEL cross-reference list with source → target notation (FR-005)
  - `data-testid="resource-summary"`
- [ ] Create `web/src/components/ResourceSummary.css` — tokens only

## Phase 4 — ValidationTab component

- [ ] Create `web/src/components/ValidationTab.tsx`:
  - Props: `rgd: K8sObject`
  - Renders checklist of ALL conditions: known types first (in defined order), unknown types appended generically (FR-002, FR-003)
   - If no conditions: show "Not reported" state for all 4 known types with `condition-item--absent` styling (US1-SC4). Do NOT show "Pending" — absent conditions are not the same as Unknown-status conditions.
  - Below checklist: `<ResourceSummary rgd={rgd} />`
  - `data-testid="validation-tab"`
- [ ] Create `web/src/components/ValidationTab.css` — tokens only
- [ ] Create `web/src/components/ValidationTab.test.tsx`:
  - `shows green checkmark for True conditions`
  - `shows red X for False conditions`
  - `shows "Not reported" (–) with condition-item--absent for absent conditions`
  - `shows gray pending (○) with condition-item--pending for Unknown-status conditions`
  - `renders unknown condition types generically without crashing`
  - `shows resource summary with correct type breakdown`

## Phase 5 — RGDDetail page: add Validation tab

- [ ] Extend `web/src/pages/RGDDetail.tsx`:
  - Add `'validation'` to tab union type
  - Add "Validation" tab button in the tab bar
  - Read `?tab=validation` URL param on mount (FR-006); default to existing tab if param absent
  - Render `<ValidationTab rgd={rgd} />` when active tab is `'validation'`
  - No additional API call — uses already-loaded RGD object (FR-001)
- [ ] Update `web/src/pages/RGDDetail.css` if needed for tab layout changes

## Phase 6 — Tests and typecheck

- [ ] Run `bun run --cwd web vitest run` — zero failures
- [ ] Run `bun run --cwd web tsc --noEmit` — zero errors
- [ ] Run `go vet ./...` — zero errors (no Go changes in this spec)

## Phase 7 — PR

- [ ] Commit: `feat(web): implement spec 017-rgd-validation-linting — RGD validation tab with condition checklist`
- [ ] Push branch and open PR against `main`
