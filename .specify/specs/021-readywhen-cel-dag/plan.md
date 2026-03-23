# Implementation Plan: readyWhen CEL Expressions on DAG Nodes

**Branch**: `021-readywhen-cel-dag` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-readywhen-cel-dag/spec.md`

## Summary

Surface `readyWhen` CEL conditions on DAG nodes via three complementary surfaces:

1. **Hover tooltip** (P1): A shared portal-rendered `DAGTooltip` component that appears on `onMouseEnter` for any DAG node carrying `readyWhen` expressions. Shows node id, kind, type, `includeWhen` (if present), and `readyWhen` with full CEL syntax highlighting. Viewport-clamped per the constitution.

2. **Detail panel section split** (P2): Replace the merged "CEL Expressions" block in `NodeDetailPanel` and `LiveNodeDetailPanel` with four independent, individually conditional sections: "Ready When", "Include When", "forEach", "Status Projections".

3. **Node badge indicator** (P3): A small `⧖` badge on the node shape when `hasReadyWhen === true`, using a new `--color-ready-when` design token.

No backend changes are required. All `readyWhen` data is already on `DAGNode`.

---

## Technical Context

**Language/Version**: Go 1.25 (backend — no changes this spec) / TypeScript 5.9 (frontend)
**Primary Dependencies**: React 19, React Router v7, Vite 8, Vitest 4; no new deps introduced
**Storage**: N/A (read-only frontend feature; no state persistence)
**Testing**: Vitest (unit), Playwright (E2E via `make test-e2e`)
**Target Platform**: Web browser (modern Chromium/Firefox/Safari), served from Go binary
**Project Type**: Web application — Go-embedded SPA
**Performance Goals**: Tooltip appears within 200 ms of hover; no jank (single `useEffect` for clamping)
**Constraints**: No CSS frameworks; no external highlighting libraries; no component libraries; all colors via `tokens.css` custom properties
**Scale/Scope**: Pure frontend change — affects ~10 source files; no new packages

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design below.*

| Rule | §Ref | Status | Notes |
|------|------|--------|-------|
| No mutating K8s API calls | §III Read-Only | ✅ Pass | Pure UI feature, zero backend changes |
| No CSS frameworks (Tailwind, Bootstrap, MUI) | §V / §IX | ✅ Pass | Plain CSS + `tokens.css` tokens only |
| No external code highlighters | §V / §IX | ✅ Pass | Reusing existing `tokenize()` + `KroCodeBlock` |
| No state management libraries | §V | ✅ Pass | `useState` only |
| No component libraries (Radix, shadcn) | §V | ✅ Pass | Custom `DAGTooltip` component |
| All colors via `tokens.css` custom properties | §IX | ✅ Pass | New tokens `--shadow-tooltip`, `--shadow-panel`, `--color-ready-when`, `--z-tooltip` added |
| Portal tooltip with viewport clamping | §XIII | ✅ Pass | `createPortal` + `getBoundingClientRect` clamping in `useEffect` |
| Tooltip shows id, kind, type, includeWhen | §XIII | ✅ Pass | `DAGTooltip` contract includes all four fields |
| Single shared implementation (no duplication) | §IX / anti-pattern #77 | ✅ Pass | One `DAGTooltip.tsx` imported by all three graph components |
| Fix pre-existing `rgba()` violation in NodeDetailPanel.css | §IX / anti-pattern #77 | ✅ Pass | `--shadow-panel` token replaces hardcoded `rgba(0,0,0,0.3)` |
| Shared rendering helpers defined once | §IX / anti-pattern #77 | ✅ Pass | `nodeTypeLabel` already in `dag.ts`; no new cross-file duplication |
| Graceful degradation for empty/absent readyWhen | §XII | ✅ Pass | Filter `s.trim() !== ''` before rendering; missing → section absent |
| Conventional Commits | §VIII | ✅ Pass (to be enforced at commit time) | |
| No new Go dependencies | §V | ✅ Pass | No Go changes |

**Constitution Check Result**: All gates pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/021-readywhen-cel-dag/
├── plan.md              ← This file
├── research.md          ← Phase 0: architecture decisions, resolved unknowns
├── data-model.md        ← Phase 1: entities, tokens, file change map
├── contracts/
│   └── ui-contracts.md  ← Phase 1: component prop/behavior contracts + test contracts
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (affected files)

```text
web/src/
├── tokens.css                          ← ADD: --shadow-tooltip, --shadow-panel,
│                                               --color-ready-when, --z-tooltip
│
├── components/
│   ├── DAGTooltip.tsx                  ← NEW: shared portal tooltip component
│   ├── DAGTooltip.css                  ← NEW: tooltip styles (tokens only)
│   │
│   ├── DAGGraph.tsx                    ← MOD: hover handlers, DAGTooltip, readyWhen badge
│   ├── DAGGraph.css                    ← MOD: .dag-node-badge--ready-when
│   ├── DAGGraph.test.tsx               ← MOD: hover + badge assertions
│   │
│   ├── LiveDAG.tsx                     ← MOD: hover handlers, DAGTooltip, readyWhen badge
│   ├── LiveDAG.css                     ← MOD: .dag-node-badge--ready-when
│   │
│   ├── DeepDAG.tsx                     ← MOD: hover handlers, DAGTooltip
│   │
│   ├── NodeDetailPanel.tsx             ← MOD: split CEL block into 4 sections
│   ├── NodeDetailPanel.css             ← MOD: fix rgba() violation → var(--shadow-panel)
│   ├── NodeDetailPanel.test.tsx        ← MOD: update section label assertions
│   │
│   └── LiveNodeDetailPanel.tsx         ← MOD: split CEL block into 4 sections
│
└── (no changes to lib/, hooks/, pages/)

test/e2e/journeys/                      ← MOD: verify tooltip appears on readyWhen node
                                             (appNamespace in test-rgd.yaml already has one)
```

---

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Phase 0 Artifacts

- [research.md](./research.md) — All design decisions made, all unknowns resolved.

Key decisions:
- Portal tooltip via `createPortal(…, document.body)` — avoids SVG clip.
- Tooltip content: id + kind + nodeType + includeWhen (if any) + readyWhen (if any). Matches §XIII mandate.
- Shared `DAGTooltip` component, one import per graph component.
- Viewport clamping in `useEffect` with `getBoundingClientRect()`, `opacity: 0 → 1` transition.
- Detail panel section split: 4 independent named sections.
- `⧖` badge on nodes with `hasReadyWhen`.
- Fix pre-existing `--shadow-panel` rgba violation.

---

## Phase 1 Artifacts

- [data-model.md](./data-model.md) — Entity shapes, CSS token additions, file change map, state transitions.
- [contracts/ui-contracts.md](./contracts/ui-contracts.md) — Component prop contracts, DOM structure, test contracts.

---

## Post-Design Constitution Re-check

All constitution checks remain green after Phase 1 design:

- `DAGTooltip` uses `createPortal`, `getBoundingClientRect`, and `opacity` transition — exactly the pattern mandated by §XIII.
- The four-section split in `NodeDetailPanel`/`LiveNodeDetailPanel` improves clarity with no regressions.
- The `--shadow-panel` token addition fixes the existing rgba violation from NodeDetailPanel.css:21.
- No new dependencies of any kind are introduced.
- Test coverage covers all new behavior (tooltip show/hide, badge presence, section labelling).
