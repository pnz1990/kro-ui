# Fix: instance overlay on static RGD DAG renders schema/Dungeon node on top of child nodes

**Issue(s)**: #183
**Branch**: fix/issue-183-overlay-dag-height
**Labels**: bug

## Root Cause

When an instance is selected via the overlay picker on the RGD detail Graph tab,
the static DAG renders incorrectly — the schema/root CR node appears floating over
child nodes and the DAG shows 2–3 stacked rows.

Two distinct sub-problems:

1. **SVG height over-report** (`StaticChainDAG.tsx`): `baseHeight` was computed via
   `fittedHeight(graph.nodes, graph.height)`, a redundant recalculation that adds
   `PADDING` on top of node bounding boxes. In production this equals `graph.height`,
   but the function depends on live `graph.nodes[*].y` values rather than the
   authoritative Dagre output (`graph.height`). When the overlay bar is a DOM sibling
   in a flex context, the container height can change on re-render, causing the
   bounding-box computation to see different coordinate space. Fix: use `graph.height`
   directly as `baseHeight`.

2. **SVG element not constrained to its attribute height** (`StaticChainDAG.css`):
   SVG elements inside flex/block containers can be stretched beyond their explicit
   `height` attribute by the browser layout engine if no CSS `height` or `max-height`
   is set on the element. Adding `display: block` on the SVG (overriding the default
   `inline` rendering) ensures the SVG never overflows its bounding box.

## Files to change

- `web/src/components/StaticChainDAG.tsx` — replace `fittedHeight(graph.nodes, graph.height)` with `graph.height`; remove now-unused `fittedHeight` function
- `web/src/components/StaticChainDAG.css` — add `display: block` to the `[data-testid="dag-svg"]` selector (or the container SVG) to prevent browser inline-stretch
- `web/src/components/StaticChainDAG.test.tsx` — add tests covering overlay (nodeStateMap) SVG height and live-state classes

## Tasks

### Phase 1 — Fix height calculation
- [x] `StaticChainDAG.tsx` — replace `const baseHeight = fittedHeight(graph.nodes, graph.height)` with `const baseHeight = graph.height` on line 275
- [x] `StaticChainDAG.tsx` — remove the `fittedHeight` helper function (lines 78–81) since it is no longer used

### Phase 2 — Fix SVG CSS containment
- [x] `StaticChainDAG.css` — add `display: block` to `.static-chain-dag-container svg` rule so the SVG renders as a block element and cannot be stretched by the inline/flex context

### Phase 3 — Tests
- [x] `StaticChainDAG.test.tsx` — add test: "SVG height equals graph.height when nodeStateMap is provided (overlay active)"
- [x] `StaticChainDAG.test.tsx` — add test: "nodes get dag-node-live--alive class when nodeStateMap is active"
- [x] `StaticChainDAG.test.tsx` — add test: "state nodes do NOT get live-state class when overlay is active"

### Phase 4 — Verify
- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`

### Phase 5 — PR
- [ ] Commit: `fix(web): static DAG overlay — svgHeight uses graph.height, SVG display:block — closes #183`
- [ ] Push branch
- [ ] Open PR
