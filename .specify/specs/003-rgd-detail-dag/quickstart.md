# Quickstart: RGD Detail — DAG Visualization

**Feature**: `003-rgd-detail-dag` | **Date**: 2026-03-20

---

## What this feature does

Adds a DAG (directed acyclic graph) visualization to the RGD detail page. When
an operator navigates to `/rgds/<name>`, they see an SVG dependency graph
showing the complete resource topology of the RGD. Clicking any node opens a
detail panel with CEL expressions and concept explanations. A YAML tab shows
the full RGD manifest with kro syntax highlighting.

---

## Integration scenario: Viewing an RGD graph

### Prerequisites

- kro-ui running against a cluster with kro installed
- At least one RGD applied (e.g., the `test-app` fixture)

### Steps

1. Navigate to `http://localhost:40107/rgds/test-app`
2. The Graph tab loads by default
3. The page fetches `GET /api/v1/rgds/test-app` (existing endpoint)
4. `buildDAGGraph(rgd.spec)` runs client-side, producing nodes and edges
5. The SVG renders all resource nodes in a layered layout
6. Click any node to open the detail panel on the right
7. Click the YAML tab to see the full manifest with CEL highlighting
8. The URL updates to `?tab=yaml` (bookmarkable)

### What happens under the hood

```
Browser                           Go Backend               Cluster
  │                                   │                       │
  │ GET /api/v1/rgds/test-app         │                       │
  │──────────────────────────────────►│                       │
  │                                   │ dynamic.Get()          │
  │                                   │──────────────────────►│
  │                                   │◄──────────────────────│
  │                                   │ raw JSON               │
  │◄──────────────────────────────────│                       │
  │                                   │                       │
  │ buildDAGGraph(rgd.spec)           │                       │
  │ ├─ classify nodes (5 types)       │                       │
  │ ├─ extract CEL references         │                       │
  │ ├─ build edges                    │                       │
  │ └─ BFS-layered layout             │                       │
  │                                   │                       │
  │ Render <DAGGraph />               │                       │
  │ (inline SVG)                      │                       │
```

---

## Integration scenario: Instances tab

The Instances tab fetches `GET /api/v1/rgds/test-app/instances` (existing
endpoint from spec 001b). For this spec, it renders a placeholder. The full
instance list implementation is spec 004.

---

## File map

| File | Purpose | New/Modified |
|------|---------|--------------|
| `web/src/lib/dag.ts` | `buildDAGGraph()` — all kro parsing + layout | New |
| `web/src/lib/dag.test.ts` | 10 unit tests for DAG builder | New |
| `web/src/components/DAGGraph.tsx` | SVG renderer (replaces stub) | Modified |
| `web/src/components/DAGGraph.css` | Node/edge styles | New |
| `web/src/components/DAGGraph.test.tsx` | 5 unit tests for renderer | New |
| `web/src/components/NodeDetailPanel.tsx` | Right-side inspection panel | New |
| `web/src/components/NodeDetailPanel.css` | Panel styles | New |
| `web/src/components/NodeDetailPanel.test.tsx` | 6 unit tests for panel | New |
| `web/src/pages/RGDDetail.tsx` | Page rewrite with tabs + DAG | Modified |
| `web/src/pages/RGDDetail.css` | Page layout + tab styles | New |
| `web/src/pages/RGDDetail.test.tsx` | Tab routing + interaction tests | New |
| `test/e2e/journeys/003-rgd-dag.spec.ts` | 7-step Playwright journey | New |

---

## Dependencies on prior specs

| Spec | What we use from it | Status |
|------|-------------------|--------|
| 001-server-core | Go server, `go:embed`, API routing | Merged |
| 001b-rgd-api | `GET /api/v1/rgds/:name`, `GET /api/v1/rgds/:name/instances` | Merged |
| 002-rgd-list-home | Home page card grid linking to `/rgds/:name` | Merged |
| 006-cel-highlighter | `KroCodeBlock` component, `tokenize()` function, `tokens.css` highlighter vars | Merged |
| 000-design-system | `tokens.css` node type visual identity tokens | Merged |

---

## What this feature does NOT do

- No live polling (that's spec 005-instance-detail-live)
- No instance list implementation (that's spec 004-instance-list)
- No forEach collection drill-down (that's spec 011-collection-explorer)
- No context switching (that's spec 007-context-switcher)
- No backend changes
