# Quickstart: 031-deletion-debugger

## What's Being Built

Deletion Debugger adds diagnostic surfaces that answer *"Why won't this instance delete?"* across kro-ui. All changes are frontend-only — no new API endpoints, no backend changes, no new dependencies.

---

## Prerequisites

- Spec branches set up: `wt switch --create 031-deletion-debugger` (already done)
- Run `bun install` inside `web/` if not already done
- `tsc --noEmit` should be clean before starting

---

## Implementation Order

Work is ordered to avoid merge conflicts and deliver independently runnable increments.

### Step 1 — Foundation: `web/src/lib/k8s.ts`

Create the shared utility module first. All other changes depend on it.

```typescript
// web/src/lib/k8s.ts
export type K8sObject = Record<string, unknown>

export interface KubernetesMetadata { ... }

export function extractMetadata(obj: K8sObject): KubernetesMetadata { ... }
export function isTerminating(obj: K8sObject): boolean { ... }
export function getFinalizers(obj: K8sObject): string[] { ... }
export function getDeletionTimestamp(obj: K8sObject): string | undefined { ... }
export function getKroFinalizers(obj: K8sObject): string[] { ... }
export function getNonKroFinalizers(obj: K8sObject): string[] { ... }

export const DELETION_REASONS: ReadonlySet<string>
export function isDeletionEvent(event: K8sObject): boolean { ... }
```

Verify: `tsc --noEmit` passes.

---

### Step 2 — Components: `TerminatingBanner` + `FinalizersPanel`

Create the two new reusable components.

**`web/src/components/TerminatingBanner.tsx`**:
```tsx
import { isTerminating, getDeletionTimestamp } from '@/lib/k8s'

// Props: { deletionTimestamp: string, tick: number }
// Renders: rose banner "⊗ Terminating since {relative}" with title={ISO}
```

**`web/src/components/TerminatingBanner.css`**:
```css
.terminating-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: var(--node-error-bg);
  border: 1px solid var(--node-error-border);
  border-radius: var(--radius);
  font-size: 13px; color: var(--color-error);
}
```

**`web/src/components/FinalizersPanel.tsx`**:
```tsx
// Props: { finalizers: string[], defaultExpanded?: boolean }
// Renders: collapsible section with finalizer pill badges
// kro.run/* badges get .finalizer-badge--kro modifier
```

**`web/src/components/FinalizersPanel.css`**:
```css
.finalizers-panel { ... }
.finalizers-panel-toggle { ... } /* show/hide button */
.finalizer-badges-list { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px; }
.finalizer-badge {
  padding: 2px 8px; border-radius: var(--radius-sm);
  font-size: 11px; font-family: var(--font-mono);
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.finalizer-badge--kro {
  border-color: var(--color-primary); color: var(--color-primary-text);
}
```

Verify: `tsc --noEmit` passes. Visual check in browser if dev server running.

---

### Step 3 — Instance Detail: FR-001 + FR-002

Modify `web/src/pages/InstanceDetail.tsx`:

1. Import `isTerminating`, `getDeletionTimestamp`, `getFinalizers` from `@/lib/k8s`
2. Import `TerminatingBanner`, `FinalizersPanel`
3. After the existing reconciling banner: add `TerminatingBanner` conditional on `isTerminating(fastData.instance)`
4. `TerminatingBanner` takes precedence — if terminating, skip the reconciling banner (they are mutually exclusive in display per spec FR-001)
5. After `ConditionsPanel`: add `FinalizersPanel` with `defaultExpanded={isTerminating(fastData.instance)}`

Pass `tick` from `usePolling` to `TerminatingBanner` for relative time updates.

---

### Step 4 — Live DAG: FR-003

Modify `web/src/components/DeepDAG.tsx` and `instanceNodeState.ts` (or equivalent):

1. In the child state derivation: add `terminating` and `deletionTimestamp` fields to `ChildNodeState` by reading `isTerminating(child)` from the children array
2. In `DeepDAG.tsx` node rendering: add `⊗` SVG text badge at top-left of node when `terminating === true`, using `dag-node-badge dag-node-badge--terminating` CSS class
3. Add CSS for `dag-node-badge--terminating` in `DAGGraph.css` or `DeepDAG.css`: `fill: var(--color-error)`
4. Ensure `terminating` state causes node ring to use error colour class via `liveStateClass()`

---

### Step 5 — Live Node Detail Panel: FR-006

Modify `web/src/components/LiveNodeDetailPanel.tsx`:

1. Extract `deletionTimestamp` and `finalizers` from the resource's raw YAML (already fetched via `GET /api/v1/resources/...`)
2. If `deletionTimestamp` is set: render `TerminatingBanner` (or an inline row) at top of panel
3. If `finalizers` is non-empty: render `FinalizersPanel` in the panel body

---

### Step 6 — Events Panel: FR-004

Modify `web/src/components/EventsPanel.tsx`:

1. Import `isDeletionEvent` from `@/lib/k8s`
2. For each event row: add `event-row--deletion` class when `isDeletionEvent(event)`
3. Render a small `⊘` text label / span with class `event-deletion-tag` inside `.event-header` when deletion event

Add CSS in `EventsPanel.css`:
```css
.event-row--deletion { border-left: 2px solid var(--color-error); }
.event-deletion-tag { font-size: 10px; color: var(--color-error); font-weight: 600; }
```

---

### Step 7 — Instances Table Filter: FR-005

Modify `web/src/pages/RGDDetail.tsx` (or `InstanceTable.tsx`):

1. Add `const [showTerminatingOnly, setShowTerminatingOnly] = useState(false)` near other filter state
2. Add a checkbox/toggle `<label><input type="checkbox"> Terminating only</label>` in the filter row above the table
3. Apply filter: `filtered = showTerminatingOnly ? instances.filter(isTerminating) : instances`
4. Update page title when filter active: `Instances (Terminating) — {RGDName} — kro-ui`

---

### Step 8 — Home Card Badge: FR-007

Modify `web/src/pages/Home.tsx` and `web/src/components/RGDCard.tsx`:

1. In `Home.tsx`: when computing `terminatingCount` for each RGD card, map instance objects through `isTerminating()` and count. This uses instance data already fetched.
2. Add `terminatingCount?: number` prop to `RGDCardProps`
3. In `RGDCard.tsx`: render `<span className="rgd-card__terminating-badge">⊗ {n}</span>` in `.rgd-card__meta` when `terminatingCount > 0`
4. Add CSS in `RGDCard.css`:
```css
.rgd-card__terminating-badge {
  padding: 2px 6px; border-radius: var(--radius-sm);
  font-size: 11px; font-weight: 600;
  color: var(--color-error);
  background: var(--node-error-bg);
  border: 1px solid var(--node-error-border);
  cursor: default;
}
```
5. Add `title="N instance(s) terminating"` on the badge element

---

## Verification

```bash
# TypeScript
cd web && bun run tsc --noEmit

# Go
go vet ./...

# Build
make web
make go

# E2E (optional, if kind cluster available)
make test-e2e
```

---

## Manual Test Scenarios

1. **Basic terminating**: `kubectl delete <instance>` with a finalizer-blocking controller stopped → open instance detail → see rose banner
2. **No finalizers**: instance with no finalizers deletes instantly; never shows banner
3. **Terminating takes precedence over Reconciling**: both conditions set → only rose banner shown
4. **Child terminating**: child resource stuck in terminating → `⊗` badge on DAG node
5. **Deletion event tagging**: trigger `FailedDelete` event → event row has red left border and `⊘` tag
6. **Terminating filter**: instances table, toggle "Terminating only" → non-terminating rows hidden
7. **Home card badge**: one instance terminating → `⊗ 1` badge on RGD home card; clears when deletion completes
