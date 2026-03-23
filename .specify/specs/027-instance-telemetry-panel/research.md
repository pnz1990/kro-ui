# Research: Instance Telemetry Panel (027)

**Phase 0 output** — all NEEDS CLARIFICATION items resolved.

---

## R-001: Prop surface for TelemetryPanel

**Question**: What data should `TelemetryPanel` receive as props, and does it need
any new state or flags from `InstanceDetail`?

**Decision**: Accept `instance: K8sObject`, `nodeStateMap: NodeStateMap`,
and `events: K8sList` as props. **Do not accept a raw `children` array.**

**Rationale**:
- `nodeStateMap` is already computed in `InstanceDetail` (line 194–197) from
  `fastData.instance` + `children`. Passing it directly avoids recomputing it.
- `nodeStateMap` encodes "alive/reconciling/error" per kind — exactly what the
  "Children" cell needs for healthy vs errored counts.
- `events` (from `fastData.events`) provides the Warning count directly.
- `instance` provides `metadata.creationTimestamp` and `status.conditions` for
  the Age and Time-in-state cells.
- Total child count (`N` in `healthy/N`) = `Object.keys(nodeStateMap).length`
  (children present on cluster, mapped by kind).

**`childrenLoaded` boolean**: **Not needed.** `TelemetryPanel` is rendered inside
the `!isLoading && fastData &&` guard in `InstanceDetail` — by the time it renders,
`fastData` (instance + events) is non-null. Children load separately; when the map
is empty (`{}`), the Children cell shows `0/0` with neutral color. This is correct
per constitution §XII: absent data → "not reported" / `0/0`, never an error state.

**Alternatives considered**:
- Passing `children: K8sObject[]` and computing nodeStateMap inside TelemetryPanel:
  Rejected — TelemetryPanel would need `fastData.instance` to call
  `buildNodeStateMap`, duplicating already-computed state.
- A new `childrenLoaded` prop to show "—" during initial load: Rejected — the
  children polling interval fires immediately on mount alongside the fast poll;
  the `nodeStateMap` will be `{}` only briefly and `0/0` is a truthful state
  rather than a misleading loading placeholder.

---

## R-002: Healthy vs error counting from NodeStateMap

**Question**: How should the Children cell count healthy vs errored children given
that `buildNodeStateMap` assigns a single global state to all children based on
instance conditions?

**Decision**: Count entries in `nodeStateMap` by their `.state` field:
- `healthy = Object.values(nodeStateMap).filter(e => e.state === 'alive' || e.state === 'reconciling').length`
- `total = Object.keys(nodeStateMap).length`
- Color: `--color-error` if any entry has `state === 'error'`; `--color-alive` if
  `total > 0` and none errored; `--color-text-muted` if `total === 0`

**Rationale**: This is consistent with how `LiveDAG` uses the node state map.
`reconciling` is counted as "present" (healthy) because it means kro is actively
working on the resource — it exists, it's not errored. `not-found` nodes are not
in the map at all, so they are excluded from both numerator and denominator.

**Alternatives considered**:
- Using `children.length` as the denominator: This would include children kro has
  created that aren't in the DAG graph. The `nodeStateMap` already does the right
  thing: it only includes children that exist in the cluster, keyed by kind.

---

## R-003: Age ticking pattern

**Question**: Does a ticker hook exist? Should one be created?

**Decision**: Use the inline `setInterval` + `useState` ticker pattern that already
exists in `InstanceDetail.tsx` `RefreshIndicator` (lines 58–64) and `Fleet.tsx`.
**Do not create a new hook.**

**Rationale**: The ticker pattern is simple (3 lines inside a `useEffect`), well
understood, and already established as the project standard. A new `useInterval`
hook would be premature abstraction — there are only two existing usages and adding
a third does not justify extraction per constitution §V (Simplicity).

**Pattern**:
```ts
const [, setTick] = useState(0)
useEffect(() => {
  const id = setInterval(() => setTick((t) => t + 1), 1000)
  return () => clearInterval(id)
}, [])
```

---

## R-004: Visual layout — reuse MetricsStrip pattern

**Question**: Should `TelemetryPanel` share CSS with `MetricsStrip` or define its
own styles?

**Decision**: Define separate `TelemetryPanel.css` using the **same visual pattern**
(horizontal flex strip, equal-width cells, value + label stacked vertically,
border-between-cells). Share no CSS classes. Reference the same tokens.

**Rationale**:
- `MetricsStrip` is a controller-level component with slightly different
  informational context (global controller health). Keeping them separate avoids
  the anti-pattern of a shared stylesheet that becomes entangled with two different
  components' semantics.
- The `MetricsStrip.css` cell structure is simple and idiomatic enough to replicate
  cleanly in ~40 lines of new CSS.
- All color variance (value coloring by health state) must reference `tokens.css`
  properties: `--color-alive`, `--color-error`, `--color-status-warning`,
  `--color-text-muted`, `--color-text`, etc.

---

## R-005: Insertion point in InstanceDetail.tsx

**Decision**: Insert `TelemetryPanel` as the **first element inside the
`!isLoading && fastData &&` content block** (before the `instance-detail-content`
div at line 344), as a full-width strip above the two-column layout.

**Exact insertion**:
```tsx
{!isLoading && fastData && (
  <>
    <TelemetryPanel
      instance={fastData.instance}
      nodeStateMap={nodeStateMap}
      events={fastData.events}
    />
    <div className="instance-detail-content...">
      ...
    </div>
  </>
)}
```

**Rationale**: Same pattern as `MetricsStrip` on the Home page — a full-width
informational strip above the primary content grid. Placing it inside the
`fastData` guard ensures it only renders when instance + events are available.

---

## R-006: Pure function module location

**Decision**: Create `web/src/lib/telemetry.ts` for all metric derivation logic.
Use `NodeStateMap` from `@/lib/instanceNodeState` and `K8sObject`/`K8sList` from
`@/lib/api`. Reuse `formatAge` from `@/lib/format`.

**Functions**:
| Function | Input | Output |
|---|---|---|
| `extractInstanceAge(instance)` | `K8sObject` | `string` (`formatAge` or `'Not reported'`) |
| `extractTimeInState(instance)` | `K8sObject` | `string` (`formatAge` of `Ready.lastTransitionTime` or `'Not reported'`) |
| `countHealthyChildren(nodeStateMap)` | `NodeStateMap` | `{ healthy: number; total: number; hasError: boolean }` |
| `countWarningEvents(events)` | `K8sList` | `number` |

**Rationale**: Mirrors the `generator.ts` and `catalog.ts` pattern of isolating
pure derivation logic from the React component. Enables exhaustive unit testing
without rendering.

---

## R-007: spec.md amendment — prop surface update

The spec.md was written with `children: K8sObject[]` + `childrenLoaded: boolean`
props. Based on research R-001, the **correct prop surface is**:

```ts
interface TelemetryPanelProps {
  instance: K8sObject
  nodeStateMap: NodeStateMap
  events: K8sList
}
```

The `childrenLoaded` prop is eliminated. The spec FR-010 should be removed.
All references to `childrenLoaded` are superseded by this decision.

The `telemetry.ts` function `countHealthyChildren` takes `NodeStateMap`, not a raw
children array. This is documented in R-006.
