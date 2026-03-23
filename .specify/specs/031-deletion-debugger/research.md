# Research: 031-deletion-debugger

## 1. Kubernetes Deletion Lifecycle

### Decision
Surface `metadata.deletionTimestamp` as the canonical "is terminating" signal, and `metadata.finalizers[]` as the canonical "what is blocking deletion" signal. No other fields are needed for the v1 scope.

### Rationale
`deletionTimestamp` is set by the API server the moment a DELETE request is accepted and the object has at least one finalizer. It is the only reliable indicator of "deletion has been requested but is blocked." It persists until all finalizers are removed. `finalizers` is the definitive list of strings that must be cleared before the object disappears.

`ownerReferences` and `deletionGracePeriodSeconds` are noted but out of scope for v1 — they add complexity without covering the primary stuck-deletion pattern (finalizer blocking).

### Alternatives considered
- **Using status conditions to detect deletion**: kro's instance conditions do not have a standardised "Deleting" condition type. Some controllers emit one; most do not. `deletionTimestamp` is universal.
- **Using events as the primary signal**: Events are ephemeral and can be absent. They supplement but cannot replace the metadata fields.

---

## 2. kro Finalizer Behavior

### Decision
Treat `kro.run/instance-cleanup` as the primary kro finalizer to highlight in the UI, but display all finalizers generically. Do not hardcode special handling for only this one string — display all finalizer strings as plain text.

### Rationale
kro adds `kro.run/instance-cleanup` to every CR instance it manages. If this finalizer is present alongside `deletionTimestamp`, deletion is blocked by the kro controller (either still cleaning up children, or the controller is down). However, third-party controllers may add their own finalizers. The UI should show all of them, with any `kro.run/*` prefixed finalizer visually annotated as "kro-managed" (via a small badge or colour).

### Alternatives considered
- **Only showing kro.run/* finalizers**: hides other blocking finalizers that users would need to debug manually.
- **Explaining each finalizer with a tooltip**: out of scope for v1; requires mapping finalizer strings to documentation which doesn't exist in a machine-readable form.

### kro deletion event reasons
kro emits events with reason values including `Deleted`, `FailedDelete`, `ResourceDeleted`. These are controller-defined. The full set of reason values to tag as "deletion-related" is:
```
Killing, Deleted, FailedDelete, SuccessfulDelete, DeletionFailed,
FailedKillPod, ResourceDeleted, FinalizerRemoved, DeletionBlocked, Terminating, PreStopHookFailed
```

---

## 3. Data Availability (No Backend Changes)

### Decision
All features in this spec are implemented as frontend-only changes. No new API endpoints. No Go changes.

### Rationale
Every required field (`deletionTimestamp`, `finalizers`) is already present in existing API responses because the backend returns raw unstructured Kubernetes objects:

| Field | API response where present |
|---|---|
| `instance.metadata.deletionTimestamp` | `GET /api/v1/instances/{ns}/{name}` |
| `instance.metadata.finalizers` | `GET /api/v1/instances/{ns}/{name}` |
| `child.metadata.deletionTimestamp` | `GET /api/v1/instances/{ns}/{name}/children` (each item is full unstructured) |
| `child.metadata.finalizers` | same |
| Deletion events | `GET /api/v1/instances/{ns}/{name}/events` (all events returned) |
| Instance `deletionTimestamp` in list | `GET /api/v1/rgds/{name}/instances` (raw unstructured list) |

### Alternatives considered
- **Adding a dedicated `/terminating` endpoint**: unnecessary overhead; adds backend complexity for zero benefit.
- **Adding a `isTerminating: bool` field to API responses**: would require backend changes and is trivially computable client-side.

---

## 4. TypeScript Type Safety Strategy

### Decision
Create `web/src/lib/k8s.ts` as a new module with a typed `KubernetesMetadata` interface and a single `extractMetadata(obj: K8sObject): KubernetesMetadata` accessor. All deletion helper functions (`isTerminating`, `getFinalizers`, etc.) are defined here and imported by components.

### Rationale
The codebase anti-pattern list (AGENTS.md) explicitly prohibits copy-pasting shared helpers across component files. A single `k8s.ts` lib module is the correct home for k8s object accessors — analogous to how `dag.ts` owns all graph-related helpers.

The accessor pattern with `typeof` narrowing is the only safe approach for `Record<string, unknown>` k8s objects. TypeScript's `as` casting without narrowing would bypass type checking.

### Key patterns
```typescript
// Correct: type-narrowed accessor
export function isTerminating(obj: K8sObject): boolean {
  const meta = obj.metadata;
  if (!meta || typeof meta !== 'object') return false;
  return typeof (meta as Record<string, unknown>).deletionTimestamp === 'string';
}

// Correct: presence check (not undefined check — covers falsy values)
export function getFinalizers(obj: K8sObject): string[] {
  const meta = obj.metadata;
  if (!meta || typeof meta !== 'object') return [];
  const fins = (meta as Record<string, unknown>).finalizers;
  if (!Array.isArray(fins)) return [];
  return fins.filter((f): f is string => typeof f === 'string');
}
```

### Alternatives considered
- **Extending `K8sObject = Record<string, unknown>` to include typed metadata**: would require changing the type across the whole codebase and doesn't work for `Record<string, unknown>` without a full typed k8s model.
- **Using `k8s.io/client-go` TypeScript types**: no such package exists; the backend uses dynamic client, not typed client.

---

## 5. Relative Time Display

### Decision
Use **poll-tick-based memoization** (Option B from research): pass the `tick` counter from `usePolling` as a `useMemo` dependency for time labels. No additional timers.

### Rationale
kro-ui already polls every 5s. Time labels only need to update when data refreshes. This eliminates all extra timers, aligns display refresh with data refresh, and adds zero re-renders beyond what polling already causes.

For the Terminating banner specifically, where the time shown is "how long ago was deletionTimestamp set" (not how stale is the data), the 5s poll cadence is acceptable precision — showing "3m 5s ago" vs "3m 10s ago" is not meaningful to operators.

### Format
```
< 60s  → "${n}s ago"
< 60m  → "${n}m ago"
< 24h  → "${n}h ago"
≥ 24h  → "${n}d ago"
```
Full ISO timestamp shown on hover via `title` attribute (accessible, no custom tooltip needed).

### Alternatives considered
- **Per-component `setInterval`**: too many timers; creates render pressure.
- **Shared-subscriber hook with 10s interval**: valid but adds complexity when poll-tick alignment is simpler and sufficient here.
- **`Intl.RelativeTimeFormat`**: correct locale-aware approach, but locale variance is not a requirement here and the simple format above is more predictable.

---

## 6. DAG Overlay Badge for Terminating Nodes

### Decision
Add a new SVG text badge `⊗` at the **top-left** of the node (mirroring the existing top-right badge position for `?`/`∀`/`⬡`), coloured with `--color-error`. This is data-driven: any child in `children` with `isTerminating()` true will have `terminating: true` on the derived `ChildState`. DeepDAG will read this from the live state map and render the overlay.

### Rationale
Top-left placement avoids collision with the existing top-right `nodeBadge()` position. The `⊗` (U+2297 CIRCLED TIMES) character is semantically appropriate (negation/deletion) and renders correctly in all target browsers without icon fonts.

The badge is added via the same SVG `<text>` pattern as existing badges in DeepDAG.tsx — consistent with the codebase convention and avoids requiring a new DOM element type.

### Alternatives considered
- **Adding a CSS overlay `::after` pseudo-element**: doesn't work for SVG `<g>` nodes — CSS pseudo-elements are not valid on SVG elements.
- **Using an SVG `<circle>` + `<text>` element**: more accurate to a "circled" look but more complex to position and size than a single Unicode character.
- **Node ring colour only (no badge)**: the error ring colour from `liveStateClass()` already applies to child nodes in error state. Terminating is a distinct state that should be distinguishable from "error (reconcile failed)" — a dedicated badge makes this unambiguous.

---

## 7. Home Card Terminating Badge

### Decision
Add an optional `terminating` count to the `RGDCard` props. When `count > 0`, render a small rose-coloured pill badge `⊗ N` in the `rgd-card__meta` row, between the kind pill and the resources count.

### Rationale
The terminating count must be computed from the instance list, which is already fetched by the Home page for each RGD card (since `listInstances` is called for the instance count). Reading `deletionTimestamp` on the same objects adds no extra API calls.

The `RGDCard` component already receives data from the Home page. A new optional `terminatingCount?: number` prop is the minimal change.

### Alternatives considered
- **Fetching terminating data separately**: would double the number of list calls; unnecessary.
- **Showing terminating instances on hover only**: lower visibility; operators need to see at a glance which RGDs have stuck instances.

---

## 8. Visual Token Strategy

### Decision
Use the existing `--color-error` (`#f43f5e`, rose) and its derived tokens (`--node-error-bg`, `--node-error-border`) for all Terminating state indicators. No new colour tokens needed. If the visual distinction between "error" (reconcile failure) and "terminating" (deletion in progress) becomes unclear, a `--color-terminating` alias can be added in a follow-up.

### Rationale
- Terminating is an error-adjacent state (something is stuck/wrong with deletion) — rose is semantically correct.
- Adding a new colour for Terminating would mean 6 semantic state colours, potentially confusing users with no legend yet (issue #118 is still open). The badge character `⊗` provides the type distinction; colour alone is not the differentiator.
- Per constitution §IX, any new colour must first be defined in `tokens.css` as a named token. Rose is already there.

### Alternatives considered
- **Orange/amber for Terminating**: amber is already used for "Reconciling" — reusing it would blur the semantic.
- **New `--color-terminating: #ff7043` (deep orange)**: valid but premature without a DAG legend; adds visual complexity for v1.

---

## Summary: Resolved Decisions

| Question | Decision |
|---|---|
| Primary deletion signal | `metadata.deletionTimestamp` |
| Blocking signal | `metadata.finalizers[]` |
| kro finalizer display | All finalizers shown generically; `kro.run/*` annotated |
| Backend changes | None — all data already in existing responses |
| TypeScript strategy | New `web/src/lib/k8s.ts` with `extractMetadata()` + helpers |
| Relative time | Poll-tick `useMemo` dependency, no extra timers |
| DAG badge char | `⊗` at top-left of node, `--color-error` |
| Home card | `terminatingCount` prop on `RGDCard` |
| Token strategy | Reuse `--color-error` + existing node error tokens |
| Deletion event reasons | `Killing, Deleted, FailedDelete, SuccessfulDelete, DeletionFailed, FailedKillPod, ResourceDeleted, FinalizerRemoved, DeletionBlocked, Terminating, PreStopHookFailed` |
