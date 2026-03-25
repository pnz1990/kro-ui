# Research: 038-live-dag-per-node-state

## Overview

All unknowns for this spec were resolved through codebase exploration. No
external references required — the solution is a self-contained evolution of
existing code.

---

## Decision 1: Per-Node State Source

**Question**: Should per-node state come from the backend (new API field) or
be derived entirely in the frontend?

**Decision**: Frontend-only derivation from child resource `status.conditions`.

**Rationale**:
- The backend already returns full `K8sObject` items in `GET /instances/:ns/:name/children`
  — each item includes `status.conditions` in the raw unstructured JSON.
- Adding a backend state enrichment layer would require a new API shape, a new
  Go type, and a cache invalidation strategy — all for data already available.
- Frontend derivation is already the established pattern: `buildNodeStateMap()`
  in `instanceNodeState.ts` already derives state from the CR-level
  `status.conditions`. The change is to also inspect each child's own conditions.
- The 5-second response budget (§XI) is already satisfied; the children endpoint
  returns all raw resources. Computing state client-side costs <1ms.

**Alternatives considered**:
- **Backend enrichment**: rejected — adds complexity, a new API shape, and
  backend code changes. Violates §I (iterative-first) since we already have
  enough data client-side.
- **Separate `/state` endpoint**: rejected for the same reason; unnecessary API
  surface.

---

## Decision 2: `pending` State for `includeWhen`-excluded Nodes

**Question**: How do we detect which nodes are excluded by `includeWhen`?

**Decision**: On the frontend, a node is `pending` (rather than `not-found`)
when the DAG node has one or more non-empty `includeWhen` expressions AND the
node is absent from the children list.

**Rationale**:
- Upstream kro does not emit a `status.conditions` entry per excluded resource.
  There is no cluster-side signal for "this node was excluded by includeWhen".
- The DAG node object (`DAGNode.includeWhen: string[]`) already carries the
  `includeWhen` expressions parsed from the RGD spec.
- So the rule is: if `node.includeWhen.length > 0` AND the node is not in the
  children list → state is `'pending'`. Otherwise `'not-found'` (not yet created).
- This matches the design-system intent: violet (pending) = "waiting on
  dependency"; gray (not-found) = "resource doesn't exist yet".
- `--node-pending-bg` and `--node-pending-border` are already defined in
  `tokens.css` — no new token work required.

**Alternatives considered**:
- **Always `not-found` for absent nodes**: rejected — conflates two distinct
  user-visible situations (excluded vs. not yet created).
- **Separate API query**: rejected — all information is available from the DAG
  spec + children list.

---

## Decision 3: Per-Child Condition Inspection Strategy

**Question**: Which conditions on child resources determine their individual state?

**Decision**: Use the same precedence as the existing CR-level logic, applied
per-child:

| Child condition | Derived state |
|-----------------|---------------|
| `deletionTimestamp` set | `'error'` (already implemented — no change) |
| `Ready=False` | `'error'` |
| `Available=False` (Deployments) | `'error'` |
| `Progressing=True` | `'reconciling'` |
| Present, no error conditions | `'alive'` |

**Rationale**:
- `Ready=False` is the most universal K8s condition across resource types.
- `Available=False` (Kubernetes `Deployment` standard condition) is common.
- `Progressing=True` maps cleanly to the existing reconciling visual.
- The fallback to `'alive'` for "present, no error conditions" is safe — child
  resources without well-known conditions simply stay green.
- Per-child state is only used when `presentState` (global) is `alive`; if the
  CR itself is `reconciling` or `error`, the global state takes precedence. This
  prevents confusing mixed signals.

**Alternatives considered**:
- **Replace global state entirely**: rejected — the CR-level condition already
  summarises what kro thinks. Per-child adds detail, not replacement.
- **Only use `Ready` condition**: too narrow — Deployments use `Available`.
- **Check all conditions generically**: too noisy — many resources emit
  transient `False` conditions during normal startup.

---

## Decision 4: `liveStateClass()` Extension Strategy

**Question**: Where does the `'pending'` → CSS class mapping live?

**Decision**: Extend `liveStateClass()` in `web/src/lib/dag.ts` with the
`'pending'` case. Extend `stateClass()` and `STATE_LABEL` in `DAGTooltip.tsx`.
Add a single `.dag-node-live--pending` CSS rule to `LiveDAG.css`.

**Rationale**:
- `liveStateClass()` is already the single source of truth for state → CSS class
  (constitution §IX). Extending it keeps parity.
- TypeScript's exhaustiveness check on the switch statement will catch any future
  state additions at compile time.
- CSS is minimal: one new rule for fill/border — mirrors the existing 4 rules.

---

## Decision 5: Tooltip Wiring

**Question**: `DAGTooltip` already has a `nodeState` prop — why isn't it wired?

**Finding**: In `LiveDAG.tsx` line 278–284, `DAGTooltip` is rendered without
the `nodeState` prop. The prop was added in spec `029-dag-instance-overlay` to
relax the early-return guard, but `LiveDAG.tsx` was not updated to pass it.
This is a straightforward wire-up: pass `nodeStateForNode(hoveredTooltip.node, nodeStateMap)` as `nodeState` to `DAGTooltip`.

**Same gap in `DeepDAG.tsx`**: the `DAGTooltip` call site there also omits
`nodeState`. Fix both for parity.

---

## NEEDS CLARIFICATION Resolution

None. All questions were resolved through codebase analysis.

---

## Summary of Changes Required

| File | Change |
|------|--------|
| `instanceNodeState.ts` | Add `'pending'` to `NodeLiveState`; add per-child condition inspection when global state is `alive` |
| `dag.ts` | Add `'pending'` case to `liveStateClass()` switch |
| `LiveDAG.css` | Add `.dag-node-live--pending` rule using `--node-pending-bg/border` tokens; add dashed stroke |
| `LiveDAG.tsx` | Pass `nodeState` to `DAGTooltip` |
| `DeepDAG.tsx` | Pass `nodeState` to `DAGTooltip` |
| `DAGTooltip.tsx` | Add `'pending'` to `stateClass()` + `STATE_LABEL` |
| `DAGTooltip.css` | Add `.dag-tooltip__state--pending` rule |
| `tokens.css` | No change — tokens already exist |
