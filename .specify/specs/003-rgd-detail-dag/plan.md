# Implementation Plan: RGD Detail — DAG Visualization

**Branch**: `003-rgd-detail-dag` | **Date**: 2026-03-20 | **Spec**: `.specify/specs/003-rgd-detail-dag/spec.md`
**Input**: Feature specification from `/specs/003-rgd-detail-dag/spec.md`

## Summary

Implement the RGD detail page with a client-side DAG visualization showing the
complete resource topology of a kro ResourceGraphDefinition. The page has three
tabs (Graph, Instances, YAML) with URL-synced tab state. The Graph tab renders
an inline SVG dependency graph built from a pure `buildDAGGraph()` function that
classifies each resource into exactly one of the five upstream kro node types.
Clicking a node opens a right-side detail panel showing kind, concept
explanation, and CEL expressions highlighted via the existing `KroCodeBlock`
component. The YAML tab reuses `KroCodeBlock` for full-manifest rendering. No
external graph libraries, no D3, no force simulation — BFS-layered layout only.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) with React 19 + Vite 6.x; Go 1.25 backend (no changes needed for this spec)
**Primary Dependencies**: React 19, React Router v7, Vite 6, Vitest 4.1 (all already installed); no new dependencies added
**Storage**: N/A — all data fetched from `GET /api/v1/rgds/:name` and `GET /api/v1/rgds/:name/instances`; no local storage
**Testing**: Vitest (unit, jsdom) + @testing-library/react; Playwright (E2E); `bun run typecheck` for TS strict check
**Target Platform**: Modern browsers (Chrome/Firefox/Safari latest 2 versions); embedded in Go binary via `go:embed`
**Project Type**: Frontend feature within an existing web-service/dashboard (Go backend + React frontend, single binary)
**Performance Goals**: DAG renders all nodes for a 10-node RGD in under 500ms after API response (NFR-001); node click opens detail panel in under 50ms (NFR-002)
**Constraints**: No external graph libraries (§V Simplicity); no CSS frameworks (§V/§IX); all colors from `tokens.css` custom properties (§IX); no kro-specific logic in the SVG renderer (NFR-004); deterministic layout (FR-011)
**Scale/Scope**: Typical RGD has 3–15 resources; largest expected ~30 nodes; single-page feature with 3 tabs, 5 new/modified files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Clause | Rule | Status | Notes |
|--------|------|--------|-------|
| §I Iterative-First | Spec 002 merged before starting 003 | PASS | Branch depends on 002-rgd-list-home (merged) |
| §II Cluster Adaptability | Dynamic client, no typed clients for kro | PASS | Frontend-only spec; backend already uses dynamic client; all kro field paths isolated to `dag.ts` |
| §II Upstream Only | No `specPatch`/`stateFields` | PASS | FR-012 explicitly prohibits `specPatch`; test T009 verifies this |
| §III Read-Only | No mutating K8s API calls | PASS | Frontend reads `GET /api/v1/rgds/:name` only |
| §IV Single Binary | Frontend embedded via `go:embed` | PASS | No change to embed mechanism; build output goes to `web/dist/` |
| §V Simplicity — No D3 | No external graph library | PASS | BFS-layered layout in pure TS; spec FR-002 explicitly prohibits D3 |
| §V No CSS frameworks | Plain CSS + tokens.css | PASS | All node styles use `--node-*` CSS custom properties |
| §V No state mgmt libs | Plain React state + hooks | PASS | Tab state via URL params + `useState` for selected node |
| §V No highlight libs | Custom tokenizer only | PASS | Reuses existing `highlighter.ts` via `KroCodeBlock` |
| §VI Go Standards | Apache header, error wrapping | N/A | No Go changes in this spec |
| §VII Testing | Vitest unit + table-driven; co-located test files | PASS | Tests in `*.test.ts`/`*.test.tsx` alongside source |
| §VIII Commits | Conventional Commits | PASS | Will follow `feat(dag):` / `feat(web):` pattern |
| §IX Theme/UI | Colors from tokens.css; dark mode default; WCAG AA | PASS | All node tokens already defined in tokens.css; design spec 000 DAG section governs visual identity |

**Gate result**: PASS — no violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-rgd-detail-dag/
├── plan.md              # This file
├── research.md          # Phase 0: BFS layout algorithm, CEL parsing, node classification
├── data-model.md        # Phase 1: DAGNode, DAGEdge, DAGGraph types
├── quickstart.md        # Phase 1: Integration walkthrough
├── contracts/           # Phase 1: Component props and function signatures
│   └── dag-api.md       # buildDAGGraph contract + DAGGraph/NodeDetailPanel props
└── tasks.md             # Already exists (39 tasks across 6 phases)
```

### Source Code (repository root)

```text
web/src/
├── lib/
│   ├── dag.ts               # NEW: buildDAGGraph() — pure function, all kro parsing
│   └── dag.test.ts          # NEW: 10 unit tests (T002–T011)
├── components/
│   ├── DAGGraph.tsx          # REWRITE: SVG renderer (currently stub)
│   ├── DAGGraph.css          # NEW: Node/edge styles using tokens.css vars
│   ├── DAGGraph.test.tsx     # NEW: 5 unit tests (T015–T019)
│   ├── NodeDetailPanel.tsx   # NEW: Right-side inspection panel
│   ├── NodeDetailPanel.css   # NEW: Slide-in panel styles
│   ├── NodeDetailPanel.test.tsx # NEW: 6 unit tests (T023–T028)
│   └── KroCodeBlock.tsx      # EXISTING: Reused for CEL highlighting in panel + YAML tab
├── pages/
│   ├── RGDDetail.tsx         # REWRITE: Tab bar, DAG + panel wiring, YAML tab
│   ├── RGDDetail.css         # NEW: Page layout, tab bar, split-pane
│   └── RGDDetail.test.tsx    # NEW: Tab routing + node interaction tests (T034)
└── hooks/
    └── (no new hooks needed)

test/e2e/journeys/
└── 003-rgd-dag.spec.ts      # NEW: 7-step Playwright E2E journey (T036)
```

**Structure Decision**: Frontend-only changes within the existing `web/src/` structure.
Tests are co-located per constitution §VII. No new backend code. The key
architectural boundary is that `dag.ts` is the only file that knows kro field
paths (`spec.resources[].id`, `spec.resources[].template`, etc.) — the
`DAGGraph` component is a pure data-driven SVG renderer with zero kro knowledge.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
