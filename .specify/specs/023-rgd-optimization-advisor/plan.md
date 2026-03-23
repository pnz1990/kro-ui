# Implementation Plan: RGD Optimization Advisor

**Branch**: `023-rgd-optimization-advisor` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)

## Summary

Add a passive read-only optimization advisor to the RGD detail Graph tab. A
pure-function `detectCollapseGroups` (added to `web/src/lib/dag.ts`) analyzes
the already-loaded RGD `spec.resources` array to find sibling `NodeTypeResource`
nodes that share the same `apiVersion/kind` and have structurally similar
templates (≥ 70% Jaccard key-set overlap, or ≥ 3 in the same kind group). A new
`OptimizationAdvisor` component renders dismissible, expandable suggestion items
below the DAG SVG — each explaining what `forEach` would change and linking to
the kro forEach documentation. Zero new API calls; zero backend changes.

---

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Vitest 4  
**Primary Dependencies**: React 19 + React Router v7 + Vite 8 (no new deps)  
**Storage**: N/A — all state is transient session state (`useState`)  
**Testing**: Vitest (unit), Playwright (E2E — not required for this spec)  
**Target Platform**: Browser (embedded in kro-ui single Go binary)  
**Project Type**: Frontend-only feature; web application component  
**Performance Goals**: Advisor appears within 100ms of DAG render (synchronous derivation from already-loaded data)  
**Constraints**: No new API calls; no CSS frameworks; no external libraries; all colors via `tokens.css` tokens  
**Scale/Scope**: Analysis runs on up to 50+ resources; O(n²) worst case for pairwise Jaccard within same-kind groups; acceptable at this scale

---

## Constitution Check

| Rule | Status | Notes |
|------|--------|-------|
| §II Cluster Adaptability — dynamic client | ✅ PASS | No backend changes; purely frontend |
| §III Read-Only — no mutating calls | ✅ PASS | Advisor is informational only; renders links, no buttons that mutate |
| §V Simplicity — no new deps | ✅ PASS | No new npm packages; uses only React `useState` + DOM |
| §IX Theme — no hardcoded colors | ✅ PASS | 3 new `--color-advisor-*` tokens added to `tokens.css`; component CSS uses `var()` only |
| §IX Shared helpers — no duplicated DAG logic | ✅ PASS | `classifyResource` extracted as shared private helper in `dag.ts`; imported by both `buildDAGGraph` and `detectCollapseGroups` |
| §XII Graceful degradation | ✅ PASS | `detectCollapseGroups` returns `[]` for any malformed/absent input; `OptimizationAdvisor` renders `null` for empty groups |
| §XIII Page titles | ✅ N/A | Advisor is a sub-component of RGDDetail; page title set by RGDDetail |
| §XIII Cards fully clickable | ✅ N/A | Advisor cards are informational panels, not navigable resources |

**No constitution violations. No complexity tracking required.**

---

## Project Structure

### Documentation (this feature)

```text
specs/023-rgd-optimization-advisor/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── ui-contracts.md  ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes (repository root)

```text
web/src/
├── tokens.css                                 MODIFIED — add 3 --color-advisor-* tokens
├── lib/
│   ├── dag.ts                                 MODIFIED — add detectCollapseGroups export
│   │                                                    + private classifyResource helper
│   └── dag.test.ts                            MODIFIED — add detectCollapseGroups test suite
├── components/
│   ├── OptimizationAdvisor.tsx                NEW
│   ├── OptimizationAdvisor.css                NEW
│   └── OptimizationAdvisor.test.tsx           NEW
└── pages/
    └── RGDDetail.tsx                          MODIFIED — import + render OptimizationAdvisor
                                                          in Graph tab
```

**No backend files modified.**

---

## Phase 0: Research Summary

All unknowns resolved. Key decisions:

1. **Similarity metric**: Jaccard on top-level template key sets, 70% threshold.
   Groups of ≥ 3 qualify unconditionally. See `research.md §1`.

2. **Function location**: New export in `web/src/lib/dag.ts`. Node-type
   classification extracted into shared private helper `classifyResource`. See
   `research.md §2–3`.

3. **Placement in UI**: `<OptimizationAdvisor>` rendered inside `activeTab ===
   "graph"` branch in `RGDDetail.tsx`, after `rgd-graph-area`, before the
   `NodeDetailPanel` conditional. See `research.md §4`.

4. **CSS tokens**: Amber advisory color family (3 tokens) added to `tokens.css`.
   Uses existing `--color-reconciling` hue at reduced opacity. See `research.md §6`.

5. **Docs URL**: Module-level constant `FOREACH_DOCS_URL` in
   `OptimizationAdvisor.tsx`. See `research.md §7`.

---

## Phase 1: Design & Contracts Summary

### Data Model

Two TypeScript interfaces (defined in `dag.ts` and used by the component):

```typescript
// Exported from web/src/lib/dag.ts
export interface CollapseGroup {
  apiVersion: string   // shared apiVersion (empty string if absent in template)
  kind: string         // shared kind (never empty)
  nodeIds: string[]    // IDs of qualifying NodeTypeResource nodes, length ≥ 2
}

// UI-only, internal to OptimizationAdvisor
interface CollapseGroupSuggestion {
  group: CollapseGroup
  dismissed: boolean
  expanded: boolean
}
```

See `data-model.md` for full algorithm specification and token list.

### UI Contracts

`OptimizationAdvisor` accepts `{ groups: CollapseGroup[] }`. Renders `null` when
all groups are dismissed or `groups` is empty. `data-testid` surface documented
in `contracts/ui-contracts.md`.

### New CSS Tokens

```css
/* :root (dark) */
--color-advisor-bg: rgba(245, 158, 11, 0.06);
--color-advisor-border: rgba(245, 158, 11, 0.25);
--color-advisor-icon: #f59e0b;

/* [data-theme="light"] */
--color-advisor-bg: rgba(217, 119, 6, 0.06);
--color-advisor-border: rgba(217, 119, 6, 0.25);
--color-advisor-icon: #d97706;
```

---

## Post-Design Constitution Re-check

All gates pass. The design introduces:
- Zero new npm dependencies
- Zero new API endpoints
- Zero hardcoded color values (all via `var(--color-advisor-*)`)
- Zero duplication of node classification logic (shared `classifyResource`)
- Zero persistent state (session-only dismiss via `useState`)
