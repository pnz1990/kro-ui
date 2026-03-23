# Feature Specification: Generate Form Polish + DAG Legend + Overlay Fixes

**Feature Branch**: `034-generate-form-polish`
**Created**: 2026-03-23
**Updated**: 2026-03-23
**Status**: In Progress
**Depends on**: `026-rgd-yaml-generator` (merged, PR #112), `025-rgd-static-chain-graph` (merged), `029-dag-instance-overlay` (merged)
**GitHub Issues**: #118, #121
**Constitution ref**: §IX (Theme), §XII (Graceful Degradation), §XIII (UX Standards — accessibility, WCAG AA)

---

## Context

Three distinct problem areas, all frontend-only fixes, no new backend endpoints:

### Area 1 — Generate tab accessibility (issue #121)
The Instance Form uses a `●` indicator next to required fields. There is no
visible legend, `aria-required` is missing, and the tooltip text is vague.

### Area 2 — DAG legend missing (issue #118)
The static RGD DAG and live instance DAG display badge symbols (`?`, `∀`, `⬡`)
on nodes with no legend, tooltip explanation, or key. A compact inline legend
must be added below the DAG.

### Area 3 — Instance overlay crashes + expand panel layout bugs
Three bugs observed on `dungeon-graph`:

1. **"Overlay failed: t is not iterable"** — The `/children` endpoint returns
   `{"items": null}` for instances with no children. `buildNodeStateMap` calls
   `for (const child of children)` where `children` is `null`, throwing at
   runtime (minified as "t is not iterable"). Fix: coerce `null` → `[]`.

2. **Expanded subgraphs overlap each other** — When two chainable nodes are
   expanded simultaneously, the nested `foreignObject` elements are both
   positioned below their respective nodes at `node.y + node.height + 8`.
   Because the SVG height only accounts for the tallest single expansion, and
   multiple subgraphs can be anchored to nodes at the same vertical level, they
   overlap visually. Fix: stack expansions vertically in the SVG layout — only
   allow one expansion open at a time, OR reposition subsequent expansions below
   all preceding ones.

3. **Expanded subgraphs may extend outside the SVG clip rect** — The current
   `extraHeight` calculation uses `Math.max(extra, nestedH …)` per node, taking
   only the largest single expansion. When multiple nodes are expanded, the
   cumulative height is not accounted for, clipping content. Fix: sum heights
   for all currently expanded nodes.

---

## User Scenarios & Testing

### User Story 1 — Required field indicator is explained and accessible (P1) — issue #121

**Acceptance Scenarios**:

1. A visible legend `● required  ● optional` appears above the field rows in the
   Instance Form
2. Each `●` required-indicator `<span>` has `title="Required field"`; optional
   has `title="Optional field"`
3. Every required `<input>`, `<select>`, `<textarea>` has `aria-required="true"`
4. The `metadata.name` `<input>` has `aria-required="true"`
5. Optional fields have `aria-required` absent or `"false"`

---

### User Story 2 — RGDAuthoringForm "req" label is readable (P2) — issue #121

1. The required-checkbox label in RGDAuthoringForm reads `Required` (not `req`)

---

### User Story 3 — DAG legend explains node badges (P1) — issue #118

A compact legend row is rendered below each DAG view (static chain DAG on the
Graph tab) explaining badge symbols:

1. **Given** any RGD with conditional resources, **When** the Graph tab is
   displayed, **Then** a legend row appears below the DAG with at minimum:
   `?  conditional (includeWhen)`
   `∀  forEach collection`
   `⬡  external reference`

2. **Given** a node with a `?` badge, **When** the user hovers the node,
   **Then** the existing DAGTooltip already shows the `includeWhen` CEL
   expression (no new tooltip needed — the legend alone satisfies #118)

3. **Given** any RGD, **When** the Graph tab is shown, **Then** the legend is
   always visible (not toggled) and takes minimal vertical space

4. **Given** the legend, **When** inspected, **Then** every badge character uses
   its node-type CSS color (matching the badge colors already in the DAG)

---

### User Story 4 — Overlay does not crash when children list is null (P0 — crash fix)

1. **Given** an instance whose `/children` response is `{"items": null}`,
   **When** the user selects it in the overlay picker, **Then** the overlay
   applies normally (node states default to `not-found` for all nodes)
   without showing "Overlay failed: t is not iterable"

2. **Given** the same instance, **When** the overlay is applied, **Then** nodes
   that would normally be colored show the `not-found` state (gray dashed ring)
   because no children data is available

---

### User Story 5 — Multiple expanded subgraphs do not overlap (P1 — layout fix)

1. **Given** two chainable nodes expanded simultaneously (e.g. `monsterCRs` and
   `bossCR`), **When** the graph renders, **Then** the two nested subgraphs do
   NOT visually overlap — they are stacked vertically with adequate separation

2. **Given** a single expanded chainable node, **When** a second chainable node
   is expanded, **Then** the SVG height expands to accommodate both subgraphs

3. **Given** two expanded nodes, **When** the first is collapsed, **Then** the
   SVG shrinks back appropriately

**Implementation approach**: Allow only one expansion at a time — clicking `▸`
on a second node collapses the previously expanded node (accordion behaviour).
This is simpler than multi-expand layout math and avoids overlaps entirely.
The expand toggle already supports this pattern (single `Set<string>` state).

---

### Edge Cases

- Overlay instance with `items: null` from `/children` → coerce to `[]` in RGDDetail or `buildNodeStateMap`
- DAG with no collection/conditional/external nodes → legend still shown (the symbols may simply not appear on any node, but the legend explains the vocabulary)
- Legend in nested subgraph render → legend is only added to top-level StaticChainDAG (depth === 0)

---

## Requirements

### Functional Requirements

**Generate form polish (issue #121)**:
- **FR-001**: Visible legend in Instance Form header explaining `●` required / `●` optional
- **FR-002**: `title="Required field"` on required `●` spans; `title="Optional field"` on optional
- **FR-003**: `aria-required="true"` on all required form controls (non-boolean inputs, selects, textareas)
- **FR-004**: `aria-required="true"` on the `metadata.name` input
- **FR-005**: RGDAuthoringForm checkbox label reads `Required` not `req`

**DAG legend (issue #118)**:
- **FR-006**: A `<DAGLegend>` component renders below the DAG SVG on the Graph tab
- **FR-007**: Legend always shows three entries: `?` conditional, `∀` forEach, `⬡` external ref
- **FR-008**: Legend is only rendered at depth === 0 (top-level DAG, not nested subgraphs)
- **FR-009**: Badge colors in the legend match badge colors in the DAG nodes

**Overlay crash fix**:
- **FR-010**: `getInstanceChildren` response with `items: null` is coerced to `[]`
  before being passed to `buildNodeStateMap` — fix applied in `RGDDetail.tsx`

**Expand layout fix**:
- **FR-011**: `StaticChainDAG` uses accordion behavior — expanding a node auto-collapses
  any previously expanded node (only one subgraph open at a time)
- **FR-012**: SVG `extraHeight` calculation accounts for the one open expansion correctly
  (existing single-expansion math remains valid after accordion change)

### Non-Functional Requirements

- **NFR-001**: No new CSS hex/rgba literals — all via `tokens.css` custom properties
- **NFR-002**: TypeScript strict mode: 0 errors
- **NFR-003**: No new npm dependencies
- **NFR-004**: Existing tests continue to pass; update assertions for new `aria-required` attributes
- **NFR-005**: DAGLegend component defined in `web/src/components/DAGLegend.tsx` + `.css`

### Key Components Changed

| Component | Change |
|-----------|--------|
| `InstanceForm.tsx` | Add legend header, update `title` attrs, add `aria-required` |
| `InstanceForm.css` | Add `.instance-form__legend` styles |
| `RGDAuthoringForm.tsx` | `req` → `Required` label text |
| `DAGLegend.tsx` (new) | Compact badge legend: `?` conditional, `∀` forEach, `⬡` external |
| `DAGLegend.css` (new) | Legend layout, badge colors via token vars |
| `StaticChainDAG.tsx` | Accordion expand (single open), render `<DAGLegend>` at depth 0 |
| `RGDDetail.tsx` | Coerce `childrenRes.items ?? []` before `buildNodeStateMap` call |

---

## Testing Requirements

### Unit Test Updates

- `web/src/components/GenerateTab.test.tsx` — update assertions for new `aria-required`
- `web/src/components/StaticChainDAG.test.tsx` — add test: expanding node B collapses node A

### New Tests

- `web/src/components/DAGLegend.test.tsx` — renders all three legend entries

---

## Success Criteria

- **SC-001**: Visible legend present in Instance Form — issue #121 resolved and closed
- **SC-002**: All required inputs carry `aria-required="true"` — issue #121 resolved
- **SC-003**: DAG legend visible on Graph tab — issue #118 resolved and closed
- **SC-004**: Selecting an overlay instance never shows "t is not iterable"
- **SC-005**: Expanding two chainable nodes never produces visual overlap
- **SC-006**: `bun run --cwd web tsc --noEmit` — 0 errors
- **SC-007**: `bun run --cwd web test` — all tests pass
- **SC-008**: GitHub issues #118 and #121 are resolved and closed
