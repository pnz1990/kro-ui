# Spec: DAG Minimap (issue-578)

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Item**: DAG minimap: for large graphs (>50 nodes) add a fixed-position mini-map (SVG overlay, no extra dependencies) so operators can orient themselves without scrolling; required for usability at real scale

## Summary

When a DAG has more than `DAG_MINIMAP_THRESHOLD` (50) nodes, render a fixed-position
minimap overlay in the bottom-right corner of the graph container. The minimap is a
scaled-down SVG rendering of the full graph showing node positions and edges. No external
dependencies — pure SVG.

## Zone 1 — Obligations (must be implemented exactly)

**O1**: Minimap activates when `graph.nodes.length > DAG_MINIMAP_THRESHOLD` (50).
**O2**: Minimap is positioned `position: fixed` bottom-right of the dag-graph-container.
**O3**: Minimap is a scaled-down SVG rendering all nodes (as small rects) and edges (as lines).
**O4**: No new npm dependencies — pure SVG.
**O5**: Minimap renders inside DAGGraph, adjacent to the main SVG (not a separate route/page).
**O6**: Minimap has `aria-label="Graph overview minimap"` and `role="img"`.
**O7**: Node colors in minimap match node type CSS variables from tokens.css.
**O8**: Minimap has a dismiss button (×) to hide it for users who find it distracting.
**O9**: Dismissed state is stored in localStorage key `dag-minimap-dismissed` so it persists across reloads.
**O10**: `DAG_MINIMAP_THRESHOLD` is exported from `DAGMinimap.tsx` for use in tests.

## Zone 2 — Implementer's judgment

- Minimap size: 160×120px is suggested, but can be adjusted for visual balance.
- Minimap border/shadow: use tokens, not hardcoded colors.
- Node rect size in minimap: calculated proportionally; minimum 2px per node for visibility.
- Edge lines: thin (0.5px stroke) with `--color-border` or `--color-text-muted`.
- The minimap should be visible when the parent graph container is scrolled.

## Zone 3 — Scoped out

- Viewport indicator rectangle in minimap (showing which part of the graph is visible) — deferred.
- Clickable minimap for navigation — deferred.
- Live-updating as the user scrolls — deferred (static snapshot is sufficient for v1).
