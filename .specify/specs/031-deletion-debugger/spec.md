# Spec 031: Deletion Debugger

**Issue**: TBD  
**Status**: Planning  
**Dependencies**: 005-instance-detail-live (merged PR #48), 004-instance-list (merged PR #46)

---

## Problem Statement

When a kro instance or its managed child resources get stuck in a `Terminating` state, operators have no in-app way to understand why. They must `kubectl describe` every resource, grep for finalizers, and manually cross-reference events. kro-ui currently:

- Does not surface `metadata.deletionTimestamp` on any resource
- Does not surface `metadata.finalizers` on instances or child resources
- Shows a simple "Instance not found — it may have been deleted" banner when polling returns 404, but gives no diagnostic context before that point
- Shows no indicator at all while an instance is in `Terminating` (after `kubectl delete` but before the record disappears)
- Has no way to visualize which child resources are blocking deletion

This spec adds a **Deletion Debugger** — a multi-surface feature that answers the question *"Why won't this delete?"* at a glance, covering three scopes:

1. **Instance-level**: show `deletionTimestamp`, blocking finalizers, a cascading delete timeline (events annotated with deletion lifecycle)
2. **Child-resource level**: highlight which managed children are still `Terminating` on the live DAG, with per-node finalizer badges
3. **Global scan**: a new "Terminating" filter on the Instances table that lets operators find all stuck instances across namespaces

---

## Requirements

### FR-001 — Instance Terminating Banner
When `instance.metadata.deletionTimestamp` is set and the instance still exists (not yet 404), display a prominent `Terminating` banner in the instance detail page above the DAG.

- Banner text: `Terminating since <relative-time> (<ISO timestamp on hover)>`
- Banner style: uses `--color-error` semantic token (rose), visually distinct from the existing amber "Reconciling" banner
- Banner is dismissed automatically when the instance disappears (404 path already handled)
- Must not interfere with the existing "Reconciling" banner — if both `deletionTimestamp` and `Progressing=True` are present simultaneously, the `Terminating` banner takes precedence (shown instead)

### FR-002 — Finalizer List on Instance
When `instance.metadata.finalizers` is non-empty, display a collapsible `Finalizers` section below the `ConditionsPanel` on the instance detail page.

- Shows each finalizer string as a badge/pill
- Section is collapsed by default if the instance is healthy; expanded by default if `deletionTimestamp` is set
- Empty (`[]` or absent) finalizer list does not render the section
- Section label: "Finalizers" with a count badge when collapsed (e.g. `Finalizers (2)`)

### FR-003 — DAG Node Terminating Indicator
On the live instance detail DAG (DeepDAG / LiveNodeDetailPanel), any child resource that has `metadata.deletionTimestamp` set (visible in the children response — field is already present in the raw objects returned by the children endpoint) should show a visual indicator:

- A small `⊗` (circled X) overlay badge on the DAG node, in `--color-error` (rose)
- The node state is treated as `'error'` for ring color purposes (overrides the existing healthy green ring)
- The LiveNodeDetailPanel slide-in for that node shows a `Terminating since <time>` row and a `Finalizers` list (same as FR-002 but for child resources)

### FR-004 — Deletion Event Timeline
In the `EventsPanel` on the instance detail page, annotate deletion-related events:

- Events with `reason` matching `Killing`, `Deleted`, `DeletionFailed`, `FailedDelete`, `SuccessfulDelete`, `Terminating`, `PreStopHookFailed` are tagged with a `deletion` category label/icon (a small trash icon or ⊘ symbol)
- Events with `type=Warning` and deletion-related reasons are visually promoted (bold or colored) to draw attention

### FR-005 — Instances Table "Terminating" Filter
On the Instances page (`/instances` or the Instances tab of RGD detail), add a `Terminating` filter toggle:

- A toggle/checkbox labeled "Terminating only"
- When enabled, filters the instance list to only show instances where `metadata.deletionTimestamp` is non-empty
- The instances list API response already includes full metadata (raw unstructured); `deletionTimestamp` is already available in the objects returned by `GET /api/v1/rgds/{name}/instances`
- The filter is frontend-only (no backend change required)
- The Instances page title reflects the filter: `{RGDName} — Instances (Terminating) — kro-ui`

### FR-006 — Child Resource Finalizer in Slide-in Panel
In `LiveNodeDetailPanel`, when viewing a non-instance node:

- If `metadata.finalizers` is non-empty, add a `Finalizers` section showing each finalizer as a badge (same visual treatment as FR-002)
- If `metadata.deletionTimestamp` is set, show a `Terminating since <time>` row at the top of the panel (above the state badge section), using `--color-error` text

### FR-007 — Global Terminating Indicator on Home Card
On the RGD home cards (Home page), if any instance of that RGD is currently `Terminating`, add a small `⊗` badge to the card's instance count or status area.

- This requires reading `deletionTimestamp` from instance list objects returned by `/api/v1/rgds/{name}/instances`, which are already full unstructured objects
- Badge is removed when no instances are Terminating
- Hover tooltip on badge: `N instance(s) terminating`

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | When `kubectl delete` is issued against a kro instance and the instance enters `Terminating`, the instance detail page shows the Terminating banner within one polling cycle (≤5s) |
| AC-002 | The Terminating banner shows the elapsed time since `deletionTimestamp` and the full ISO timestamp on hover |
| AC-003 | When the instance's finalizer list is non-empty, the Finalizers section renders all finalizer strings |
| AC-004 | The Finalizers section is absent when `metadata.finalizers` is empty or not present |
| AC-005 | A child resource with `deletionTimestamp` set shows the `⊗` overlay badge on its DAG node |
| AC-006 | Clicking the `⊗`-badged DAG node opens LiveNodeDetailPanel showing `Terminating since <time>` and the child's finalizers |
| AC-007 | Deletion-category events in EventsPanel are tagged with the deletion icon/label |
| AC-008 | The "Terminating only" toggle on the Instances table correctly filters to only terminating instances |
| AC-009 | The "Terminating only" toggle shows `0` results (empty state with message) when no instances are terminating — not an error |
| AC-010 | All new CSS values use named tokens from `tokens.css`; no raw hex/rgba in component CSS |
| AC-011 | No new npm dependencies; no new Go dependencies |
| AC-012 | TypeScript typechecks clean (`tsc --noEmit`) |
| AC-013 | `go vet ./...` passes clean |
| AC-014 | All new shared helpers (e.g. `isDeletionTimestampSet`, `isTerminating`) are defined in `@/lib/` modules and imported — not duplicated across components |
| AC-015 | The Home card terminating badge shows correct count and disappears when 0 instances are terminating |

---

## Non-Goals

- **Mutations**: kro-ui is read-only (constitution §III). This spec does NOT add any ability to remove finalizers, force-delete, or issue any `kubectl delete` equivalent. The UI is diagnostic only.
- **Backend changes**: all data needed (finalizers, deletionTimestamp, child resource metadata) is already present in existing API responses. No new API endpoints are required.
- **Finalizer deep-link**: no integration with external docs or kro controller source to explain what a specific finalizer string means. Plain display only.
- **Cascade order graph**: no new DAG visualization of deletion order (the existing live DAG with node indicators is sufficient for v1).
- **Historical deletion data**: no persistence, no replay. Live polling only.

---

## Design Notes

### Data availability (no backend changes needed)

| Data | Source | Already returned? |
|------|--------|-----------------|
| `instance.metadata.deletionTimestamp` | `GET /api/v1/instances/{ns}/{name}` | Yes — raw unstructured |
| `instance.metadata.finalizers` | same | Yes |
| `child.metadata.deletionTimestamp` | `GET /api/v1/instances/{ns}/{name}/children` | Yes — each item is full unstructured |
| `child.metadata.finalizers` | same | Yes |
| Deletion-related events | `GET /api/v1/instances/{ns}/{name}/events` | Yes — all events returned, just needs client-side tagging |
| Instance `deletionTimestamp` in list | `GET /api/v1/rgds/{name}/instances` | Yes — raw unstructured list |

All features in this spec are frontend-only changes. No new API endpoints. No Go changes.

### Token additions needed in `tokens.css`

No new tokens needed — `--color-error` already exists and covers all Terminating/deletion semantic color usage. If a specific `--color-terminating` is desired for distinction from general errors, it can be added as an alias in `tokens.css`.

### Shared utilities to add in `@/lib/`

- `isTerminating(obj: K8sObject): boolean` — returns `true` if `metadata.deletionTimestamp` is set
- `getFinalizers(obj: K8sObject): string[]` — returns `metadata.finalizers ?? []`
- `getDeletionTimestamp(obj: K8sObject): string | undefined` — returns raw ISO string or `undefined`
- `isDeletionEvent(event: K8sObject): boolean` — returns `true` if `reason` matches deletion category keywords
- Add to `web/src/lib/k8s.ts` (new file) or extend `web/src/lib/dag.ts` if deletion helpers are graph-related

### Polling behavior

No change to polling. Instance detail already polls every 5s; children every 5s. The `deletionTimestamp` and `finalizers` fields will be picked up automatically on the next poll cycle.
