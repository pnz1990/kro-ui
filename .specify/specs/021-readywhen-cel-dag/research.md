# Research: readyWhen CEL Expressions on DAG Nodes

**Branch**: `021-readywhen-cel-dag`
**Date**: 2026-03-22
**Phase**: 0 — Research & Unknowns Resolution

---

## 1. Current State of `readyWhen` in the Codebase

### Decision
`readyWhen` is already fully parsed and available on `DAGNode`. No backend or data-layer work is needed.

### Rationale
- `DAGNode` (dag.ts:23–51) already carries `readyWhen: string[]` and `hasReadyWhen: boolean`.
- `buildDAGGraph()` in dag.ts:423 reads `asStringArray(res.readyWhen)` from the raw RGD object.
- Both `NodeDetailPanel.tsx:81–85` and `LiveNodeDetailPanel.tsx:243–246` already reference `node.readyWhen` to build the merged CEL code block.
- The E2E fixture (`test/e2e/fixtures/test-rgd.yaml:53–54`) has a concrete `readyWhen` expression on `appNamespace`, providing a built-in test case.

### Alternatives considered
- Exposing `readyWhen` as a named field in the backend API response (typed Go struct). Rejected: the dynamic pass-through is the intentional architecture (Cluster Adaptability, Constitution §II). Adding a typed field would require Go changes and would lock the shape of `readyWhen` in the API contract.

---

## 2. Tooltip Architecture: Portal vs Inline vs Native `title`

### Decision
Use `createPortal(…, document.body)` for the hover tooltip, rendered from a new shared component `web/src/components/DAGTooltip.tsx`.

### Rationale
The DAG is an SVG element. SVG clips its children to the SVG bounding box; a tooltip rendered inside `<svg>` using a `<foreignObject>` is both fragile and non-portable. A portal appended to `document.body` avoids all clipping. This is mandated by the constitution (§XIII: "DAG tooltips MUST be rendered via `createPortal(…, document.body)`").

The native HTML `title` attribute produces browser-native tooltips that cannot be styled, cannot show highlighted CEL content, and have a fixed ~1 second delay. This is unacceptable for the UX goal of showing syntax-highlighted CEL expressions.

An inline React-rendered HTML `<div>` positioned via `position: absolute` inside the `.dag-graph-container` scroll div would be clipped by `overflow: auto` on that container. Portal to `document.body` is the only approach that works reliably.

### Alternatives considered
- `<foreignObject>` inside SVG: works technically but adds SVG-specific complexity and must still handle scroll offsets. Rejected in favour of portal.
- Native `title` attribute: invisible CEL highlighting, poor UX. Rejected.
- Inline `<div>` inside scroll container: clipped. Rejected.

---

## 3. Viewport Clamping Strategy

### Decision
After the tooltip `<div>` is rendered but before it is visible, measure its bounding box via `getBoundingClientRect()` inside a `useEffect` and apply CSS transforms to keep it within `window.innerWidth` × `window.innerHeight`.

### Rationale
This is the pattern mandated by the constitution (§XIII and anti-pattern #77): "measure the rendered bounding box with `getBoundingClientRect()` in a `useEffect` and flip left/top when the tooltip would overflow the right or bottom edge."

The tooltip is positioned relative to the pointer coordinates captured at `onMouseEnter` time (SVG element `getBoundingClientRect()` gives absolute coordinates to anchor from). The default position is below-right of the node. If the tooltip's right edge exceeds `window.innerWidth`, flip to left-of-node. If the bottom edge exceeds `window.innerHeight`, flip to above-node.

The tooltip should be invisible (`opacity: 0`) until the clamping `useEffect` fires, then become visible (`opacity: 1`) to avoid a one-frame position jump.

### Alternatives considered
- CSS `max-width`/`max-height` only: prevents overflow of content but does not prevent the tooltip box itself from starting off-screen. Rejected.
- Intersection Observer API: fires asynchronously and adds complexity. `getBoundingClientRect()` in `useEffect` is synchronous enough for one-frame delay. Rejected.

---

## 4. Shared Tooltip Component Design

### Decision
Create a single `web/src/components/DAGTooltip.tsx` (+ `DAGTooltip.css`) that is imported by all three graph components: `DAGGraph`, `LiveDAG`, and `DeepDAG`.

### Rationale
The constitution (§IX, anti-pattern #77 row "Duplicating `nodeTypeLabel` / `tokenClass` across component files"): "Define once in an appropriate `@/lib/` module and import — never copy-paste graph helpers."

The same rule applies to the tooltip: one shared component, imported by all three graph components. The tooltip state (`hoveredNode`, `tooltipPos`) is local to each graph component (plain `useState`) and passed as props to `DAGTooltip`.

`DAGTooltip` receives:
- `node: DAGNode | null` — `null` means hidden
- `x: number`, `y: number` — viewport-relative anchor coordinates

### Alternatives considered
- A custom hook `useDAGTooltip()` that returns both the portal element and the event handlers: cleaner API surface but adds indirection. For simplicity, the component accepts direct props. Can be refactored later.
- Embedding the tooltip logic inside each graph component separately: exactly the anti-pattern that is prohibited. Rejected.

---

## 5. Tooltip Content: readyWhen Only vs Full Node Metadata

### Decision
The tooltip shows only `readyWhen` content: a "Ready When" label followed by each expression syntax-highlighted via `KroCodeBlock`.

Nodes with no `readyWhen` (or only empty-string expressions) produce `node === null` — the tooltip does not appear.

### Rationale
The spec (FR-001, FR-002, User Story 1) is explicit: the tooltip surfaces `readyWhen` conditions. The constitution (§XIII) also mandates: "DAG nodes MUST show a tooltip on hover with: node ID, kind, node type, and any `includeWhen` CEL expression."

This is an important discovery: the constitution requires the tooltip to show **node ID, kind, node type, and `includeWhen`** in addition to `readyWhen`. The spec's User Story 1 focuses on `readyWhen` discoverability but does not prohibit other metadata. We will include the full set mandated by the constitution: **id, kind, node type, `includeWhen` (if present), and `readyWhen` (if present)**.

This aligns with the constitution and ensures the tooltip is useful even for nodes that only have `includeWhen` but not `readyWhen`. A node with no `readyWhen` and no `includeWhen` still shows at minimum its id, kind, and type.

### Alternatives considered
- readyWhen-only tooltip: simpler but violates the constitution's existing tooltip mandate. Rejected.
- Full detail panel data in tooltip: too verbose. Tooltip stays lightweight (no Concept text, no External Ref details). Rejected.

---

## 6. Detail Panel Separation: "Ready When" Section

### Decision
Replace the merged `celCode` string in both `NodeDetailPanel.tsx` and `LiveNodeDetailPanel.tsx` with separate named sections:
- **"Ready When"** — `node.readyWhen` (only shown if non-empty)
- **"Include When"** — `node.includeWhen` (only shown if non-empty)
- **"forEach"** — `node.forEach` (only shown if set)
- **"Status Projections"** — `node.schemaStatus` entries (root node only)

Each section uses its own `KroCodeBlock` with the minimal relevant code snippet (e.g., `readyWhen:\n  - <expr>` for the "Ready When" section).

### Rationale
The spec (FR-006, FR-007, User Story 2) requires `readyWhen` in its own clearly labelled section. Splitting the merged string also makes each section independently hideable — if `readyWhen` is absent, only that section is hidden; `includeWhen` and `forEach` sections remain visible if present.

The merged-string approach was a design shortcut that conflated semantically distinct fields. Separation is a strict improvement.

### Alternatives considered
- Keep the merged block, add a heading above the `readyWhen` lines within it: fragile — depends on the string order and makes independent visibility conditional impossible. Rejected.
- Use a single `KroCodeBlock` with a separator comment: would confuse the highlighter. Rejected.

---

## 7. Node Badge for readyWhen Indicator (P3)

### Decision
Add a small SVG text element `⧖` (hourglass, U+29D6) or the text `rw` as a badge on the node, styled analogously to the existing `∀` (forEach) and `⬡` (external) badges, positioned at the bottom-left of the node rect. Use the token `--color-ready-when` (new token, amber-adjacent to suggest "waiting") in `tokens.css`.

### Rationale
The existing badge system (DAGGraph.tsx:49–57, LiveDAG.tsx:81–89) already uses text badges positioned at a corner of the node rect. Using the same mechanism keeps the implementation trivial and visually consistent.

The `⧖` character (or a shortened text tag) is semantically appropriate — it suggests "waiting for condition". The new `--color-ready-when` token follows the naming pattern of existing semantic color tokens and avoids hardcoding a hex value (constitution §IX).

### Alternatives considered
- A small colored dot: too subtle; could be confused with the `•` reconciling pulse. Rejected.
- Changing the node border color: conflicts with the existing node-type color coding and conditional dashed-border pattern. Rejected.
- An SVG `<rect>` mini-badge: more complex than a text glyph. Rejected in favour of the established text-badge pattern.

---

## 8. CSS Token Additions Required

The following tokens must be added to `tokens.css` (both `:root` and `[data-theme="light"]`):

| Token | Purpose | Dark value | Light value |
|-------|---------|-----------|------------|
| `--shadow-tooltip` | Box shadow for the hover tooltip overlay | `0 4px 12px rgba(0,0,0,0.4)` | `0 4px 12px rgba(0,0,0,0.15)` |
| `--shadow-panel` | Box shadow for the slide-in detail panel (fixes existing violation in NodeDetailPanel.css:21) | `-4px 0 16px rgba(0,0,0,0.3)` | `-4px 0 16px rgba(0,0,0,0.08)` |
| `--color-ready-when` | Badge color for `readyWhen` node indicator | `#f59e0b` (amber, "waiting") | `#d97706` |
| `--z-tooltip` | Z-index for portal tooltip | `200` | `200` |

The `--shadow-panel` token also fixes the pre-existing `rgba()` violation at `NodeDetailPanel.css:21` (flagged in the research above). Fixing it here is the right time since we are already touching that file.

---

## 9. Existing Test Coverage Impact

- `NodeDetailPanel.test.tsx` tests: the merged `celCode` block tests will fail after the section split. They must be updated to assert on individual section headings and content.
- `LiveNodeDetailPanel` has no test file (confirmed by component listing). New unit tests should be added for the `readyWhen` section separately from `includeWhen`.
- `DAGGraph.test.tsx` exists; hover tests will need to be added for the new tooltip behavior.
- E2E journey `008` (or the appropriate existing journey) covers node inspection. The E2E fixture already has `readyWhen` on `appNamespace` — existing journeys should pick up the tooltip automatically once implemented.

---

## 10. No Backend Changes Required

**Decision**: No Go code changes needed.

**Rationale**: `readyWhen` is already surfaced in the raw RGD JSON that the backend passes through unchanged. The Go layer has zero knowledge of `readyWhen` and requires none.
