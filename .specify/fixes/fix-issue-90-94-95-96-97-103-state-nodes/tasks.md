# Fix: State nodes, MetricsStrip, Validation UX, Events skeleton

**Issue(s)**: #90, #94, #95, #96, #97, #103
**Branch**: fix/issue-90-94-95-96-97-103-state-nodes
**Labels**: bug (#94, #96), enhancement (#90, #95, #97, #103)

## Root Cause

kro's `state:` field feature produces resource nodes with no `template:` and
no `kind`. This single root cause creates cascading issues:
- #94: frontend renders `?` instead of nodeId fallback (§XII violation)
- #95: state nodes look identical to managed resource nodes (misleading DAG)
- #96: ResourceSummary counts state nodes as managed (wrong object count)

Unrelated standalone fixes:
- #97: MetricsStrip "Controller metrics unavailable" — no distinction between
  "not configured" vs "unreachable"; no actionable guidance
- #103: ConditionItem renders raw kro Go error strings verbatim; known patterns
  (GVK resolution failure, unknown identifiers) should be restated in plain English
- #90: Events page shows static "Loading events…" text — no visual skeleton

## Files to change

- `web/src/lib/dag.ts` — add `'state'` NodeType; fix `classifyResource` to detect
  state nodes (has `state:`, no `template:`); `kind` already falls back to nodeId ✓
- `web/src/components/DAGGraph.css` — add `.dag-node--state` fill/stroke rules
- `web/src/components/StaticChainDAG.css` — same state node rules
- `web/src/components/LiveDAG.css` — same state node rules (if separate)
- `web/src/tokens.css` — add `--node-state-bg` / `--node-state-stroke` tokens
- `web/src/components/ResourceSummary.tsx` — count state nodes separately
- `web/src/components/MetricsStrip.tsx` — improve degraded message with context
- `web/src/lib/api.ts` — expose error type/reason from metrics API response
- `web/src/components/ConditionItem.tsx` — rewrite known error patterns + "Show raw" toggle
- `web/src/pages/Events.tsx` (check for skeleton loading state) — #90

## Tasks

### Phase 1 — #94 + #95: State node type in dag.ts

- [ ] Add `'state'` to `NodeType` union in `dag.ts`
- [ ] Add `'state': 'State Store'` to `NODE_TYPE_LABEL` map
- [ ] Update `classifyResource` to return `'state'` when `res.state` is present and no `template:` and no `externalRef:`
- [ ] Verify `buildDAGGraph` kind fallback to `id` already covers state nodes (it does: `if (!kind) kind = id`)
- [ ] Add `COLLECTION_NODE_HEIGHT`-style constant `STATE_NODE_HEIGHT = 48` (same as resource, no change needed)
- [ ] Update `nodeBadge` to return `'⊞'` (or `null`) for state nodes — use `null` (state nodes have no badge; the type label distinguishes them)

### Phase 2 — #95: State node visual treatment in CSS

- [ ] Add `--node-state-bg` and `--node-state-stroke` tokens to `tokens.css` (dark + light blocks)
- [ ] Add `.dag-node--state` fill/stroke rules to `DAGGraph.css`
- [ ] Add same rules to `StaticChainDAG.css` (which mirrors DAGGraph.css rules for static chain view)

### Phase 3 — #96: ResourceSummary counts state nodes

- [ ] Add `stateNodes: number` to `NodeCounts` interface in `ResourceSummary.tsx`
- [ ] Count `node.nodeType === 'state'` in `computeSummary`
- [ ] Exclude state nodes from `managed` count
- [ ] Render state node count in the breakdown (only when > 0), e.g. "9 state"

### Phase 4 — #97: MetricsStrip actionable degraded message

- [ ] Check what error string the API returns for 503 (unreachable) vs default
- [ ] In `MetricsStrip.tsx`, pass `error` message to degraded state and show context:
  - Default (no metrics-url configured): keep "Controller metrics unavailable — run with `--metrics-url` to enable"  
  - Unreachable: "Controller metrics unavailable — cannot reach metrics endpoint"
- [ ] No backend change needed — the error message from `usePolling` already contains the HTTP error

### Phase 5 — #103: ConditionItem raw error rewriting

- [ ] Add `rewriteConditionMessage(reason: string, message: string): string` helper to `ConditionItem.tsx`
- [ ] Pattern 1: `reason === 'InvalidResourceGraph' && message.includes('cannot resolve group version kind')` → extract kind name, emit plain-English explanation
- [ ] Pattern 2: `reason === 'InvalidResourceGraph' && message.includes('references unknown identifiers')` → emit CEL field reference hint  
- [ ] Pattern 3: all other messages: keep as-is but wrap raw text in a `<details><summary>Show details</summary>` toggle instead of always-visible `<pre>`
- [ ] Update existing "Show more" truncation to work alongside the new details toggle

### Phase 6 — #90: Events page loading skeleton

- [ ] Read `web/src/pages/Events.tsx` to check current loading state
- [ ] If "Loading events…" is plain text with no animation, add `aria-busy` + a CSS shimmer class consistent with MetricsStrip's `metrics-strip--loading` skeleton cells

### Phase 7 — Tests + Verify

- [ ] Update `dag.test.ts` / `DAGGraph.test.tsx` to cover state node classification
- [ ] Update `ValidationTab.test.tsx` (ResourceSummary) to cover state node count
- [ ] Update `ConditionItem` tests or add new test for pattern rewriting
- [ ] Run `bun run --cwd web tsc --noEmit`
- [ ] Run `bun run --cwd web vitest run`

### Phase 8 — PR

- [ ] Commit: `fix(web): state node type, MetricsStrip context, Validation UX, Events skeleton — closes #90, #94, #95, #96, #97, #103`
- [ ] Push: `git push -u origin fix/issue-90-94-95-96-97-103-state-nodes`
- [ ] Open PR
