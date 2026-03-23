# Spec 030: Error Patterns Tab

**Status**: Draft  
**Branch**: `030-error-patterns-tab`  
**Depends on**: `026-rgd-yaml-generator` (merged)

---

## Background

kro operators frequently need to diagnose why an RGD or its instances are not
healthy. Currently error-related information is scattered across three surfaces:

- **Validation tab** — shows `status.conditions` on the RGD itself (4 known
  condition types), with human-readable rewrites for three known Go error strings.
- **Instance detail page** — shows a live DAG with amber/rose overlays, and a
  `ConditionsPanel` with raw `status.conditions` strings.
- **Events page** — global stream of Kubernetes events with anomaly detection.

There is no single tab that answers the question: *"Why are instances of this
RGD failing?"* with enough detail to act on. The Validation tab covers only the
RGD-level lifecycle; the Instance detail requires navigating to individual
instances; the Events page requires knowing which instance to filter on.

---

## Goal

Add an **Errors** tab to the RGD detail page (`/rgds/:name`) that aggregates
instance-level error signals for all instances of the RGD and presents them
in a pattern-oriented view: grouped by error kind, sorted worst-first, with
actionable guidance and deep-link navigation to individual instances.

This is a **frontend-only** spec. No new backend endpoints are required — all
data comes from existing APIs (`listInstances`, `getInstanceEvents`).

---

## Functional Requirements

### FR-001 — Errors Tab Location

An **Errors** tab button is added to the existing 7-tab bar on `RGDDetail`.
- `data-testid="tab-errors"`
- URL query param: `?tab=errors`
- Position: between the **Validation** tab and the **Access** tab (4th position)
- No badge or count indicator on the tab button itself (count changes too
  frequently during reconciliation; per §XIII it would need real-time polling
  that this spec does not introduce)

### FR-002 — Error Tab Data Sources

The Errors tab:
1. Fetches all instances of this RGD: `GET /api/v1/rgds/{name}/instances`
2. For each instance that has at least one `status.conditions[]` entry with
   `status=False`, extracts the failing condition(s).
3. No event fetching — `getInstanceEvents` requires per-instance calls, which
   would be an unbounded fan-out at scale. Condition data from the already-
   available instance list is sufficient.

If the instance list is empty (no instances), the tab shows a "no instances
yet" empty state — not an error state.

If the API call fails, the tab shows an inline error banner with a Retry button
(matching the existing Instances tab error pattern).

### FR-003 — Error Grouping by Pattern

Failing conditions are grouped by `(conditionType, reason)` pair:

```
Group key = conditionType + "/" + reason
Example:   "Ready/CELExpressionError"
```

Each group shows:
- **Group header**: condition type label + reason string
- **Count badge**: number of instances in this group
- **Instance list**: name + namespace + first-seen timestamp, up to 10 items
  (with "and N more" overflow when > 10 instances share the same pattern)
- **Error message**: the canonical message for this group (most recent
  `lastTransitionTime` wins if messages differ)
- **Human-readable rewrite**: if the `(reason, message)` pair matches one of
  the existing patterns in `rewriteConditionMessage()` from `ConditionItem.tsx`,
  the rewritten summary is shown. A "Show raw error" toggle reveals the raw message.

### FR-004 — Sort Order

Groups are sorted worst-first, then alphabetically within the same count:
1. Primary: group count descending (most-affected instances first)
2. Secondary: `conditionType` ascending (alphabetical)
3. Tertiary: `reason` ascending (alphabetical)

### FR-005 — Instance Navigation

Each instance item in a group is a link:
```
<Link to={`/rgds/${rgdName}/instances/${ns}/${instanceName}`}>
  {instanceName} ({ns})
</Link>
```
Clicking it navigates to the instance's live detail page.

### FR-006 — "All Clear" State

When all instances are healthy (no `status=False` conditions), the tab renders:
- A green checkmark icon (accessible: no color alone — pair with text)
- Text: "All instances are healthy" (or "No instances yet" if count is 0)
- Do NOT show a blank container

### FR-007 — Loading State

While the instances fetch is in flight:
- Show a skeleton/loading indicator
- The tab button itself is not disabled during loading

### FR-008 — Namespace Filter Integration

The Errors tab respects the `?namespace=` URL query param already used by the
Instances tab. If `?namespace=` is present in the URL when switching to the
Errors tab, the instance fetch uses that namespace filter.

A namespace filter control is NOT rendered inside the Errors tab itself — the
user sets namespace via the Instances tab or URL. This avoids duplicating filter
state management and keeps the tab focused.

### FR-009 — Page Title

When the Errors tab is active, `document.title` follows the existing pattern:
`<rgdName> — kro-ui` (no change to title format — the tab name is redundant
with the visible tab selection).

---

## Non-Functional Requirements

### NFR-001 — Performance

The Errors tab makes exactly **one** API call: `listInstances(rgdName, namespace)`.
It MUST NOT call `getInstanceEvents()` per instance (unbounded fan-out).
The existing `listInstances` response already contains `status.conditions` on
each instance — no additional calls are needed.

### NFR-002 — Scale

The component must handle 500+ instances without layout breakage. Groups with
more than 10 instances show overflow prose. The full instance list is not
virtualized (groups collapse the items naturally), but the component must not
render 500+ `<Link>` elements unconditionally — the 10-item cap per group
enforces this.

### NFR-003 — Graceful Degradation

- If `status.conditions` is absent on an instance: skip that instance silently
  (do not render it as errored or as healthy)
- If `conditionType` is empty: skip the condition
- If `reason` is empty string: use `"(no reason)"` as the group key suffix
- If `message` is absent: show `"(no message)"` in the raw message area; do
  not attempt to rewrite an absent message

### NFR-004 — Tokens Only

All colors used in the ErrorsTab component MUST reference `tokens.css` custom
properties. No hardcoded hex, no inline `rgba()`.

### NFR-005 — Accessibility

- Group headers use `<h3>` (within a section using `<h2>` for the tab content
  title, which is absent here — use `<h3>` directly as section titles)
- Error icon must be paired with text (no color-only status)
- All links have meaningful accessible labels (instance name + namespace)
- All-clear checkmark: use `aria-label="All instances healthy"` on the icon

---

## Component Architecture

### New files

```
web/src/components/ErrorsTab.tsx      # The tab component
web/src/components/ErrorsTab.css      # Styles using tokens.css vars only
```

### Modified files

```
web/src/pages/RGDDetail.tsx           # Add "errors" to TabId, add tab button, add tab content dispatch
```

### Shared utility reuse

`rewriteConditionMessage(reason, message)` is already defined in
`web/src/components/ConditionItem.tsx`. The ErrorsTab imports and reuses it
directly — no duplication.

---

## Data Flow

```
RGDDetail (activeTab === "errors")
  └── ErrorsTab
        ├── useEffect: listInstances(rgdName, namespace?)
        │     on success → setInstances(items)
        │     on error   → setError(message)
        └── useMemo: groupErrorPatterns(instances)
              ├── For each instance, extract status.conditions where status=False
              ├── Group by (conditionType, reason)
              └── Sort: count desc, then type asc, then reason asc
```

`groupErrorPatterns(instances: K8sObject[]): ErrorGroup[]` is a pure function
defined in `ErrorsTab.tsx` (not in `@/lib/` — it is not shared by other
components currently; promote to `@/lib/` only if a second consumer appears).

---

## Error Group Type (Frontend Internal)

```typescript
interface InstanceRef {
  name: string
  namespace: string
  lastTransitionTime?: string // ISO string from condition.lastTransitionTime
}

interface ErrorGroup {
  conditionType: string
  reason: string             // "" maps to display label "(no reason)"
  message: string            // canonical message (latest lastTransitionTime)
  count: number
  instances: InstanceRef[]   // full list (length === count)
}
```

---

## UI Layout

```
[ Errors tab content ]
  ┌─────────────────────────────────────────┐
  │  ⚠  3 error patterns across 7 instances │  ← summary line (rose text)
  ├─────────────────────────────────────────┤
  │  Ready / CELExpressionError    [5]       │  ← group header + count badge
  │  ┌──────────────────────────────────────┤
  │  │  Human-readable rewrite of message   │
  │  │  [Show raw error]                    │
  │  ├──────────────────────────────────────┤
  │  │  • my-instance-1 (default)           │  ← instance link
  │  │  • my-instance-2 (default)           │
  │  │  • my-instance-3 (staging)           │
  │  │  • my-instance-4 (staging)           │
  │  │  • my-instance-5 (production)        │
  │  └──────────────────────────────────────┤
  │                                          │
  │  GraphVerified / UnknownIdentifier  [2]  │
  │  ...                                     │
  └─────────────────────────────────────────┘
```

When all instances are healthy:
```
  ┌─────────────────────────────────────────┐
  │  ✓  All instances are healthy            │  ← emerald text + icon
  └─────────────────────────────────────────┘
```

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | Errors tab button is visible between Validation and Access tabs; clicking sets `?tab=errors` in URL |
| AC-02 | Loading spinner shown while `listInstances` is in flight |
| AC-03 | API error renders rose banner with error message and Retry button |
| AC-04 | With zero instances, shows "No instances yet" message |
| AC-05 | With all-healthy instances (no `status=False`), shows green "All instances are healthy" |
| AC-06 | Failing conditions grouped by `conditionType/reason`; groups sorted by count desc |
| AC-07 | Each group shows condition type, reason, count badge, message (with rewrite when applicable), instance links |
| AC-08 | Rewrite toggle ("Show raw error" / "Show summary") works correctly |
| AC-09 | Groups with >10 instances show first 10 links + "and N more" prose |
| AC-10 | Each instance item navigates to `/rgds/:rgdName/instances/:namespace/:name` |
| AC-11 | If `?namespace=` is set in URL, instance fetch is filtered to that namespace |
| AC-12 | No hardcoded colors; all CSS uses `var(--token)` references |
| AC-13 | `document.title` remains `<rgdName> — kro-ui` when Errors tab is active |
| AC-14 | Zero additional API calls beyond `listInstances` |
| AC-15 | Absent `status.conditions` on an instance does not cause an error or blank UI |

---

## Out of Scope

- Per-instance event fetching (would violate NFR-001 and §XI)
- Namespace filter UI within the Errors tab (filter is set via Instances tab or URL)
- Error history / trend over time (no time-series data available)
- Backend endpoint changes
- Notification or badge count on the tab button
