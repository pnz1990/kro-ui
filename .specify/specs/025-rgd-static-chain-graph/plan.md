# Implementation Plan: RGD Static Chaining Graph

**Branch**: `025-rgd-static-chain-graph` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-rgd-static-chain-graph/spec.md`

---

## Summary

Add static chain awareness to the RGD detail DAG: detect nodes whose `kind`
matches another RGD's `spec.schema.kind`, mark them with a teal ring indicator,
and provide two visually distinct affordances: (1) a `▸` expand toggle that
inlines the chained RGD's own static DAG as a nested subgraph (synchronous —
no API fetches, all data from already-loaded RGD specs), and (2) a "View RGD →"
link that navigates to the chained RGD's detail page with a breadcrumb back.
Cycle detection (set-based ancestor tracking) and a max-recursion-depth cap of
4 are required. The new expand toggle must use a distinct teal color token
(`--color-chain-text`) versus spec 012's live-instance toggle (`--color-text-muted`).

No backend changes are needed. All logic is purely frontend.

---

## Technical Context

**Language/Version**: TypeScript 5.9 + Go 1.25
**Primary Dependencies**: React 19, React Router v7, Vite 8, Bun (frontend); chi v5, zerolog, client-go dynamic (backend)
**Storage**: N/A — read-only, no persistence
**Testing**: Vitest (frontend unit), `go test -race` (backend), Playwright (E2E)
**Target Platform**: Web browser (modern Chromium/Firefox/Safari); single-binary Go server
**Project Type**: Web application (embedded frontend)
**Performance Goals**: Expand subgraph renders in under 200ms from click (synchronous — no I/O); initial chain detection adds < 5ms to DAG build time
**Constraints**: No CSS frameworks; no state libraries; no new backend endpoints; zero new npm packages; `tsc --noEmit` 0 errors; `go vet ./...` 0 warnings
**Scale/Scope**: Frontend-only change; 8 files modified/added (see data-model.md)

---

## Constitution Check

*GATE: Must pass before proceeding to implementation.*

| Rule | Check | Status |
|---|---|---|
| §I Iterative-First | All dependencies merged (003, 012 merged per spec inventory) | ✓ PASS |
| §II Cluster Adaptability | Chain detection uses already-present dynamic-client data; no new typed clients | ✓ PASS |
| §III Read-Only | No mutating calls; "View RGD →" is navigation only | ✓ PASS |
| §IV Single Binary | No new external assets; static chain subgraph is built client-side | ✓ PASS |
| §V Simplicity | No new npm packages; no new Go dependencies; pure TS logic | ✓ PASS |
| §VI Go Standards | No Go changes expected; if any arise, Apache 2.0 header required | ✓ PASS |
| §VII Testing | Vitest unit tests required for `findChainedRgdName`, `buildChainSubgraph`, cycle detection; E2E fixtures required | ✓ PASS |
| §IX Theme | 7 new tokens defined in `tokens.css` (teal hue, WCAG AA verified); no hardcoded hex in components | ✓ PASS |
| §XI API Performance | No new API calls on expand (data already in memory); `listRGDs` called once on Graph tab mount | ✓ PASS |
| §XII Graceful Degradation | Absent RGD for a chainable kind → null subgraph → "RGD not found" indicator; never crash | ✓ PASS |
| §XIII UX Standards | Breadcrumb for navigated-to RGD detail page; chainable cards fully clickable (node body + affordances) | ✓ PASS |

**Complexity Tracking**: No violations. No additional justification needed.

---

## Project Structure

### Documentation (this feature)

```text
.specify/specs/025-rgd-static-chain-graph/
├── spec.md               # Feature spec (written)
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── ui-contracts.md   # Component API contracts + test IDs
└── tasks.md              # Phase 2 output (/speckit.tasks — NOT yet created)
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── tokens.css                    # MODIFY: add 7 --color-chain-* tokens
│   ├── lib/
│   │   ├── dag.ts                    # MODIFY: DAGNode.isChainable, chainedRgdName;
│   │   │                             #         findChainedRgdName(), buildChainSubgraph();
│   │   │                             #         extend buildDAGGraph(spec, rgds?)
│   │   └── dag.test.ts               # MODIFY: add chain detection test cases
│   ├── components/
│   │   ├── StaticChainDAG.tsx        # NEW: static DAG with expand + nav affordances
│   │   ├── StaticChainDAG.css        # NEW: .node-chainable, .static-chain-* styles
│   │   └── StaticChainDAG.test.tsx   # NEW: unit tests (cycle, depth, chainable rendering)
│   └── pages/
│       ├── RGDDetail.tsx             # MODIFY: fetch listRGDs(), use StaticChainDAG,
│       │                             #         add breadcrumb from router state
│       └── RGDDetail.css             # MODIFY: breadcrumb styles
└── ...

test/e2e/
└── fixtures/
    ├── chain-parent.yaml             # NEW: RGD with a resource whose kind = ChainChild
    ├── chain-child.yaml              # NEW: RGD with spec.schema.kind: ChainChild
    └── chain-cycle-a.yaml           # NEW (optional): cycle detection fixture
```

**Structure Decision**: Single web application project layout (existing pattern). No backend changes. All new code lives in `web/src/` following the established component/lib/page hierarchy.

---

## Phase 0 Research Output

See [research.md](./research.md) for full findings.

**Key decisions**:

1. **RGD list fetch**: `listRGDs()` called once in `RGDDetail` on graph-tab mount; passed as `rgds` prop to `StaticChainDAG`
2. **New helpers in `dag.ts`**: `findChainedRgdName()` and `buildChainSubgraph()` (pure functions, no component knowledge)
3. **Separate component**: `StaticChainDAG` mirrors `DeepDAG` structure but is fully static; not a mode of `DeepDAG`
4. **Cycle detection**: `ancestorSet: ReadonlySet<string>` prop threaded through recursive renders
5. **Breadcrumb**: React Router `navigate(url, { state: { from: name } })`
6. **Token hue**: Teal/sky (`#0ea5e9` dark, `#0284c7` light) — unused by any existing token

---

## Phase 1 Design Output

See [data-model.md](./data-model.md) and [contracts/ui-contracts.md](./contracts/ui-contracts.md).

**New types summary**:

```typescript
// DAGNode — 2 new fields
isChainable: boolean          // set by buildDAGGraph when rgds provided
chainedRgdName?: string       // set iff isChainable=true

// StaticChainDAGProps — new component
graph, rgds, onNodeClick, selectedNodeId, ancestorSet, depth, rgdName

// RGD detail breadcrumb state (React Router location.state)
{ from?: string }
```

**Visual distinction matrix** (from contracts):

| Affordance | Class | Token |
|---|---|---|
| Live expand (012) | `.deep-dag-expand-toggle` | `--color-text-muted` |
| Static expand (025) | `.static-chain-expand-toggle` | `--color-chain-text` |
| Chain ring | `.node-chainable` | `--color-chain-border` |
| View RGD link | `.static-chain-view-link` | `--color-primary` |

---

## Post-Design Constitution Re-check

| Concern | Verdict |
|---|---|
| No hardcoded colors in `StaticChainDAG.css` | ✓ — all `var(--color-chain-*)` and `var(--node-chain-*)` |
| `nodeTypeLabel` / `tokenClass` helpers not duplicated | ✓ — `nodeBadge()` and class helpers defined in `dag.ts`, imported |
| Portal tooltip clamping (§XIII) | N/A — no new portal tooltips; existing DAG tooltip is unchanged |
| SVG viewBox fitted after layout (anti-pattern #64) | ✓ — `StaticChainDAG` uses same `fittedHeight()` pattern as `DAGGraph` |
| "View RGD →" link clickable area adequate (anti-pattern #65) | ✓ — link is a `foreignObject`-embedded `<a>`, full-width within the node affordance zone |
