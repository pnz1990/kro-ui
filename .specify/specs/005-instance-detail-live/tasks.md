# Tasks: 005-instance-detail-live

**Spec**: `.specify/specs/005-instance-detail-live/spec.md`
**Branch**: `005-instance-detail-live`
**Depends on**: `004-instance-list` (merged), `003-rgd-detail-dag` (merged)

**Pre-existing assets** (no work needed):
- `web/src/hooks/usePolling.ts` — already implemented; just needs unit tests
- `web/src/lib/api.ts` — `getInstance`, `getInstanceEvents`, `getInstanceChildren`, `getResource`, `getRGD` all present
- `web/src/components/DAGGraph.tsx` — reused as-is inside `LiveDAG`
- `web/src/components/NodeDetailPanel.tsx` — extended with live state badge + YAML section

---

## Phase 1 — Pure library: node state mapping

- [ ] Create `web/src/lib/instanceNodeState.ts` — `buildNodeStateMap(children, instanceConditions)`:
  - Input: child resources array from `GET /children`, instance `status.conditions`
  - Output: `Map<nodeId, NodeState>` where `NodeState` = `'alive' | 'reconciling' | 'pending' | 'error' | 'not-found'`
  - Rules per FR-004: alive if child exists + Ready=True; reconciling if Progressing=True on instance; error if Ready=False; not-found if absent from children; pending if not-found and DAG node has `includeWhen`
  - Export type `NodeState`
- [ ] Create `web/src/lib/instanceNodeState.test.ts` — table-driven tests:
  - `returns alive when child present and Ready=True`
  - `returns reconciling when instance Progressing=True (overrides individual node state)`
  - `returns error when child present but Ready=False`
  - `returns not-found when resource absent from children list`
  - `returns not-found (not crash) when conditions array is missing entirely`

## Phase 2 — Pure library: resource name resolution

- [ ] Create `web/src/lib/resolveResourceName.ts` — `resolveResourceName(nodeId, instanceName, children)`:
  - First: find matching child by `nodeId` match on `id` field (canonical)
  - Fallback: strip `CR`/`CRs` suffix from `nodeId`, prepend `${instanceName}-`
  - Returns `{ name: string; namespace: string; found: boolean }`
- [ ] Create `web/src/lib/resolveResourceName.test.ts`:
  - `returns name from children list when present (exact match)`
  - `infers name by stripping CR suffix when not in children`
  - `infers name by stripping CRs suffix`
  - `handles nodeId with no CR suffix (no double-prepend)`

## Phase 3 — usePolling unit tests

- [ ] Create `web/src/hooks/usePolling.test.ts`:
  - `calls fetcher on mount`
  - `calls fetcher again after intervalMs (fake timers)`
  - `stops polling on unmount (clearInterval called)`
  - `sets error state on fetch failure without crashing`
  - `resets and re-polls when deps change`
- [ ] Run `bun run --cwd web vitest run` — zero failures

## Phase 4 — LiveDAG component

- [ ] Create `web/src/components/LiveDAG.tsx`:
  - Wraps `DAGGraph` — passes through `graph`, `onNodeClick`
  - Accepts `nodeStates: Map<string, NodeState>` prop
  - Injects state CSS classes onto each node via `DAGGraph`'s `nodeClassFn` prop (or equivalent mechanism — check `DAGGraph` API first)
  - Does NOT recompute layout on state changes (positions are stable — FR-005)
  - Shows `[data-testid="live-refresh-indicator"]` showing "refreshed Xs ago" using `lastRefresh` prop
  - Shows reconciling banner when any state is `reconciling` (FR-003)
- [ ] Create `web/src/components/LiveDAG.css` — tokens only, no hardcoded hex:
  - `.live-dag__banner` — amber reconciling banner using `var(--color-reconciling)`
  - `.live-dag__refresh` — muted "refreshed Xs ago" text
  - Node state class overrides injected into SVG nodes (via CSS class names matching DAGGraph's BEM structure or via `nodeClassFn`)

## Phase 5 — NodeDetailPanel extension

- [ ] Extend `web/src/components/NodeDetailPanel.tsx`:
  - Add `state?: NodeState` prop — render a live state badge (reuse `ReadinessBadge` pattern or a new `NodeStateBadge`)
  - Add `yaml?: string | null | 'loading' | 'not-found' | 'error'` prop — render YAML section:
    - `'loading'`: show `⟳ fetching from cluster…`
    - string: render syntax-highlighted YAML via `KroCodeBlock`
    - `'not-found'`: show "Resource not found in cluster."
    - `'error'`: show "Fetch timed out" + Retry button
  - Add `kubectlCommand?: string` prop — render the kubectl get command under YAML
  - Add `isForEachNode?: boolean` prop — when true show the guidance note instead of YAML (FR-010)
  - Panel MUST NOT close or re-mount when parent re-renders (FR-008) — verified by test
- [ ] Update `web/src/components/NodeDetailPanel.css` — add yaml section styles (tokens only)
- [ ] Update `web/src/components/NodeDetailPanel.test.tsx` — add tests for new props:
  - `shows loading placeholder when yaml="loading"`
  - `shows yaml content when yaml is a string`
  - `shows not-found message when yaml="not-found"`
  - `shows forEach guidance note when isForEachNode=true`
  - `state badge renders with correct class for each NodeState`

## Phase 6 — SpecPanel, ConditionsPanel, EventsPanel components

- [ ] Create `web/src/components/SpecPanel.tsx` — dynamic key-value rendering of `spec.*` fields:
  - Iterates all keys dynamically — no hardcoded field list (FR-009 / US3-SC1)
  - `data-testid="spec-panel"`
- [ ] Create `web/src/components/SpecPanel.css`
- [ ] Create `web/src/components/ConditionsPanel.tsx` — table: type, status, reason, message, lastTransitionTime:
  - `data-testid="conditions-panel"`
- [ ] Create `web/src/components/ConditionsPanel.css`
- [ ] Create `web/src/components/EventsPanel.tsx` — event list newest-first; "No events" empty state:
  - `data-testid="events-panel"`
- [ ] Create `web/src/components/EventsPanel.css`

## Phase 7 — InstanceDetail page

- [ ] Replace stub in `web/src/pages/InstanceDetail.tsx` with full implementation:
  - Route params: `rgdName`, `namespace`, `instanceName` (from `useParams`)
  - On mount, fetch in parallel (FR-001):
    1. `getRGD(rgdName)` — once only, for DAG structure
    2. `getInstance(namespace, instanceName, rgdName)` — polled
    3. `getInstanceEvents(namespace, instanceName)` — polled
    4. `getInstanceChildren(namespace, instanceName, rgdName)` — polled
  - Use `usePolling` for (2), (3), (4) with `intervalMs=5000`
  - Build `nodeStates` via `buildNodeStateMap` on every poll result
  - Handle poll error: show "Refresh paused — retrying in 10s" in top area; do NOT close panel (edge case)
  - Handle 404 on instance: show "Instance not found — it may have been deleted" and stop polling
  - On node click:
    1. If `isForEachNode` → open panel with guidance note, no YAML fetch
    2. Otherwise: open panel with `yaml="loading"`, call `resolveResourceName`, fetch `getResource(...)`, update panel YAML
    3. YAML fetch timeout: 15s via `AbortController`; on timeout set `yaml="error"`
  - Page layout: LiveDAG on top, then SpecPanel + ConditionsPanel + EventsPanel below
  - `data-testid="instance-detail-page"` preserved
- [ ] Create `web/src/pages/InstanceDetail.css` — page layout styles, tokens only

## Phase 8 — InstanceDetail unit tests

- [ ] Create `web/src/pages/InstanceDetail.test.tsx`:
  - `renders dag and live-refresh-indicator on successful load`
  - `shows reconciling banner when Progressing=True`
  - `opens NodeDetailPanel on node click`
  - `panel remains open after poll re-render`
  - `shows instance-not-found message on 404`
  - `shows spec, conditions, and events panels after load`
- [ ] Run `bun run --cwd web vitest run` — zero failures
- [ ] Run `bun run --cwd web tsc --noEmit` — zero errors

## Phase 9 — E2E journey

- [ ] Create `test/e2e/journeys/005-live-instance.spec.ts` — Steps 1–6 per spec.md
- [ ] Run `go vet ./...` — zero errors

## Phase 10 — PR

- [ ] Commit: `feat(web): implement spec 005-instance-detail-live — live DAG with polling and node inspection`
- [ ] Push branch and open PR against `main`
- [ ] Confirm CI (build + govulncheck + CodeQL) passes; monitor e2e
