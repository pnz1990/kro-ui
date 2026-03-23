# Research: 028-instance-health-rollup

**Generated**: 2026-03-23  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Health State Enumeration (5 states)

**Decision**: Define a new `InstanceHealthState` type with 5 values:
`'ready' | 'reconciling' | 'error' | 'pending' | 'unknown'`

**Rationale**: The existing `ReadyState` (`'ready' | 'error' | 'unknown'`) is insufficient.
The InstanceTable sort comparator already includes `reconciling`, `pending`, and `alive` slots
(InstanceTable.tsx:46–52) but `extractReadyStatus` only returns 3 states, so those slots never
match. Adding `reconciling` (Progressing=True) and `pending` (all conditions Unknown) as first-class
states resolves this.

**Alternatives considered**:
- Extend `ReadyState` in place — rejected: `ReadyState` is used by `RGDCard`/`StatusDot` for
  the RGD's own health (not instances); conflating them would break RGD-level StatusDot rendering
- Add a separate `extractInstanceHealth` function — **chosen**: keeps backward compatibility,
  lets `extractReadyStatus` continue serving RGD-level needs unchanged

**Implementation**: Add `extractInstanceHealth(obj: K8sObject): InstanceHealth` to `format.ts`.
`InstanceHealth` mirrors `ReadyStatus` but with `state: InstanceHealthState`.

---

## Decision 2: RGDCard Async Pattern

**Decision**: Add `useState` + `useEffect` inside `RGDCard` for a per-card instance health fetch.
The card renders immediately with its existing synchronous data; the `HealthChip` renders a
skeleton until the fetch resolves.

**Rationale**: `RGDCard` is currently a pure synchronous component (no `useEffect`/`useState`).
Adding async state is the minimal change — no new hooks, no context. The fetch is:
`listInstances(name)` → iterate `items` → count by `extractInstanceHealth` state.
A timeout of 5s is enforced via `AbortController`. On error or timeout, chip is simply absent
(constitution §XII graceful degradation).

**Alternatives considered**:
- Lift fetch to `Home.tsx` and pass counts as props — rejected: would require `Home` to
  sequentially or concurrently fetch instances for all N RGDs, ballooning the home page
  loading time. Per-card lazy fetch is better for incremental rendering.
- New backend endpoint `/rgds/{name}/health` — rejected: no backend changes needed; the
  existing `/rgds/{name}/instances` endpoint already returns full objects including conditions.
  Adding a backend endpoint would require Go changes for no gain.

---

## Decision 3: New CSS Tokens Required

**Decision**: Add `--color-status-reconciling` and `--color-status-pending` tokens to `tokens.css`.

**Rationale**: `ReadinessBadge` uses `--color-status-*` pattern (not `--color-*` or
`--node-*`). The design system has `--color-reconciling` (#f59e0b / amber) and
`--color-pending` (#8b5cf6 / violet) as DAG semantic colors, and `--color-status-warning`
(#f59e0b) but no `--color-status-reconciling` or `--color-status-pending`.

Per constitution §IX: "if a color value is needed, it must first be defined as a named token
in tokens.css". Two new tokens are required:
- `--color-status-reconciling`: alias of `--color-reconciling` (#f59e0b, amber)
- `--color-status-pending`: alias of `--color-pending` (#8b5cf6, violet)

**Light mode equivalents** must also be added to the `[data-theme="light"]` block.

---

## Decision 4: HealthChip vs. StatusDot for RGDCard

**Decision**: New `HealthChip` component (text-based: "3 / 5 ready") rather than extending
`StatusDot` (dot only).

**Rationale**: A dot alone cannot convey "3 of 5 ready" — the count is essential for the home
page use case. `HealthChip` is a compact text pill with a semantic color: `{ready}/{total} ready`,
or `{total} ready` (all healthy), or `no instances`. This is distinct from `StatusDot` which
is used for binary ready/not-ready on RGD cards.

---

## Decision 5: HealthPill for InstanceDetail Header

**Decision**: New `HealthPill` component inserted in the `instance-detail-header` div, after
the `<h1>` name. It accepts `state: InstanceHealthState | 'loading'` and renders a colored pill.

**Rationale**: The instance detail header currently has no health indicator (only a plain-text
reconciling banner below). A pill in the header gives immediate orientation. The `HealthPill`
is slightly larger than `ReadinessBadge` (header context) but uses the same color tokens.

The existing reconciling banner is **kept** — it has aria-live="polite" and is semantically
different (contextual explanation vs. header indicator).

---

## Decision 6: ConditionsPanel Empty State

**Decision**: Change `ConditionsPanel` empty state from `"No conditions."` to `"Not reported"`.
Add summary header `"{trueCount} / {total} conditions healthy"`. Omit absent optional fields.

**Rationale**: Direct constitution §XII compliance:
> "Show 'Not reported' for expected-but-absent conditions — never 'Pending'"

"No conditions." implies the data was checked and found empty; "Not reported" accurately
describes the cluster not having emitted this data.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Does `ReadinessBadge` have `data-testid`? | Yes: `data-testid="readiness-badge"` (ReadinessBadge.tsx:30) |
| Are `--color-status-reconciling`/`--color-status-pending` tokens defined? | No — must be added to tokens.css |
| Does `RGDCard` already do async loading? | No — pure sync component; adding `useState`+`useEffect` is the approach |
| Does a per-RGD health endpoint exist on the backend? | No — client-side aggregation via existing `listInstances` |
| Exact location of header in InstanceDetail? | `instance-detail-header` div at lines 297–304 (InstanceDetail.tsx) |
| Do `HealthChip`/`HealthPill` already exist? | No — both are new components |
| What does `listInstances` return? | `Promise<K8sList>` — `items: K8sObject[]` with full objects including `status.conditions` |
| InstanceTable sort: does it already handle 5 states? | Sort comparator has 5 slots but `extractReadyStatus` only returns 3; extending `extractInstanceHealth` completes the loop |

---

## Best Practices: Async Data in React Card Components

**Pattern**: Load secondary async data inside the card with `useEffect` + `useState`, not
from the parent. Abort the fetch on unmount via `AbortController`. Show a skeleton/loading
state for the chip only — never block the card render.

```tsx
// Inside RGDCard
const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null)
useEffect(() => {
  const ac = new AbortController()
  listInstances(name, undefined, ac.signal)
    .then(list => setHealthSummary(aggregateHealth(list.items)))
    .catch(() => {}) // silent — chip simply absent
  return () => ac.abort()
}, [name])
```

This pattern is already used in other React single-page apps with card grids (e.g., GitHub's
commit status cards). The key constraint: the `listInstances` call in `api.ts` must accept an
optional `AbortSignal`; check whether the current `get()` helper supports it.

**Finding**: `web/src/lib/api.ts` `get()` helper does NOT currently accept an `AbortSignal`.
It uses `fetch()` internally. The helper signature is:
```ts
function get<T>(path: string): Promise<T>
```
**Resolution**: Either (a) extend `get()` to accept an optional `options: {signal?: AbortSignal}`
parameter, or (b) call `fetch(...)` directly in `RGDCard` for the chip load. Option (a) is
cleaner — one small addition to `api.ts`.
