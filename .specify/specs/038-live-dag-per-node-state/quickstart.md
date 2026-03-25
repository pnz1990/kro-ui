# Quickstart: 038-live-dag-per-node-state

## What this spec does

Upgrades the live DAG on the Instance Detail page so each node independently
reflects its own Kubernetes health state, rather than inheriting one instance-level
colour. Adds the missing `pending` (violet) state for `includeWhen`-excluded nodes.
Wires live state labels into the node hover tooltip.

---

## Prerequisites

- Node.js 22+ / Bun installed
- Go 1.25 installed (GOPROXY=direct required — see AGENTS.md)
- The worktree for this branch is already active

---

## Development workflow

### 1. Install frontend dependencies (if not done by wt hook)

```bash
cd web && bun install
```

### 2. Start the dev server (frontend hot-reload)

```bash
make web-dev
# Or: cd web && bun run dev
```

The Go backend is not needed for frontend-only changes. The dev server
proxies API calls to `http://localhost:40107` if a backend is running.

### 3. Build + typecheck

```bash
# TypeScript typecheck (required before commit)
cd web && bun run typecheck

# Full build (Go + frontend)
make build
```

### 4. Run unit tests

```bash
cd web && bun run test
```

---

## Files to modify (in order)

### Step 1 — Extend the type and algorithm

**`web/src/lib/instanceNodeState.ts`**

1. Add `'pending'` to `NodeLiveState`.
2. In `buildNodeStateMap()`, in Step 3 (absent nodes): replace the unconditional
   `'not-found'` with:
   ```typescript
   const hasCond = node.includeWhen.some(e => e.trim() !== '')
   state = hasCond ? 'pending' : 'not-found'
   ```
3. In Step 2 (present children): when `globalState === 'alive'`, inspect the
   child's own `status.conditions` for `Ready=False`, `Available=False`,
   `Progressing=True`.

### Step 2 — Extend the CSS class helper

**`web/src/lib/dag.ts`**

In `liveStateClass()`, add:
```typescript
case 'pending': return 'dag-node-live--pending'
```

### Step 3 — Add the CSS rule

**`web/src/components/LiveDAG.css`**

After the existing `.dag-node-live--notfound` block, add:
```css
.live-dag-container .dag-node-live--pending rect.dag-node-rect {
  fill:             var(--node-pending-bg);
  stroke:           var(--node-pending-border);
  stroke-dasharray: 6 3;
}
```

### Step 4 — Extend tooltip internals

**`web/src/components/DAGTooltip.tsx`**

Add to `stateClass()`:
```typescript
case 'pending': return 'pending'
```

Add to `STATE_LABEL`:
```typescript
pending: 'Pending',
```

**`web/src/components/DAGTooltip.css`**

Add:
```css
.dag-tooltip__state--pending { color: var(--color-pending); }
```

### Step 5 — Wire nodeState into tooltip

**`web/src/components/LiveDAG.tsx`**

Import `nodeStateForNode` (already imported) and pass:
```tsx
<DAGTooltip
  ...
  nodeState={
    hoveredTooltip?.node
      ? nodeStateForNode(hoveredTooltip.node, nodeStateMap)
      : undefined
  }
/>
```

**`web/src/components/DeepDAG.tsx`** — same change at its `DAGTooltip` call site.

---

## Verification checklist

- [ ] `bun run typecheck` passes with 0 errors
- [ ] `bun run test` passes
- [ ] `make build` succeeds
- [ ] In the browser, navigate to a live instance with mixed resource health
- [ ] Nodes with `includeWhen` excluded show violet dashed ring
- [ ] Nodes with `Ready=False` condition show rose ring (even when CR is Ready=True)
- [ ] Hovering any node shows "State: Alive/Reconciling/Error/Pending/Not found" in tooltip
- [ ] `not-found` nodes (absent, no `includeWhen`) show gray dashed ring

---

## No backend changes

This spec is entirely frontend. No Go files are modified. `go vet ./...` will
continue to pass with no changes.
