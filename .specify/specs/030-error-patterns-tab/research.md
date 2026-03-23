# Research: 030-error-patterns-tab

**Date**: 2026-03-23  
**Branch**: `030-error-patterns-tab`  
**Status**: Complete — all unknowns resolved

---

## Research Questions Addressed

### RQ-1: Do instance objects returned by `listInstances` already include `status.conditions`?

**Decision**: Yes, they do.  
**Rationale**: `listInstances` calls
`h.factory.Dynamic().Resource(gvr).Namespace(ns).List(...)` which returns
full unstructured objects from the Kubernetes API. kro sets
`status.conditions` on every CR instance it manages. The existing
`ConditionsPanel` on the Instance Detail page reads these conditions from the
same unstructured object (cast to `(item.status as …).conditions`), confirming
the data is present in the list response without any additional API call.  
**Alternatives considered**: Fetching per-instance detail (`getInstance`)
would guarantee freshness but requires one call per instance — an O(N) fan-out
that violates §XI and NFR-001. Using `getInstanceEvents` per instance is also
O(N) and explicitly prohibited.

---

### RQ-2: Is `rewriteConditionMessage()` from `ConditionItem.tsx` safe to import externally?

**Decision**: Yes — import directly from `ConditionItem.tsx`.  
**Rationale**: The function is already exported (`export function
rewriteConditionMessage`). It is a pure function with no side effects, no DOM
access, and no React hooks. There are no circular imports between
`ConditionItem.tsx` and `ErrorsTab.tsx`.  
**Alternatives considered**: Extracting `rewriteConditionMessage` to
`@/lib/conditions.ts` and having both `ConditionItem` and `ErrorsTab` import
from there is the cleanest long-term solution, but premature today (only two
consumers). The constitution §IX says: "Define once in an appropriate `@/lib/`
module and import where needed." With a second consumer, promotion to `@/lib/`
is now justified. We will extract it to `@/lib/conditions.ts` as part of this
spec to avoid the anti-pattern.  
**Final decision**: Extract `rewriteConditionMessage` to `web/src/lib/conditions.ts`
and update both `ConditionItem.tsx` and `ErrorsTab.tsx` to import from there.

---

### RQ-3: What is the exact shape of `status.conditions` on instance objects?

**Decision**: Use the same `K8sCondition` interface already defined in
`ConditionsPanel.tsx`.  
**Rationale**: `ConditionsPanel.tsx` defines:
```typescript
interface K8sCondition {
  type?: string
  status?: string      // "True" | "False" | "Unknown"
  reason?: string
  message?: string
  lastTransitionTime?: string
}
```
This is the correct shape. `ErrorsTab` should use the same locally-inlined
interface (or import it if promoted to a shared type).  
**Alternatives considered**: Typing via the raw `K8sObject` without an
interface — works but loses IntelliSense and makes condition access verbose.

---

### RQ-4: How do existing tabs handle the no-data / loading / error trifecta?

**Decision**: Follow the Instances tab pattern exactly.  
**Rationale**: `RGDDetail.tsx` lines 321–369 show a clean three-state pattern:
1. `instancesLoading` → show a loading message
2. `!instancesLoading && instancesError` → show `<div class="…-error">` + Retry
3. `!instancesLoading && !instancesError && data` → render content (or empty state)

This pattern is established, tested (E2E: `data-testid="instance-error-state"`
and `data-testid="btn-retry"`), and users expect consistent behavior across tabs.  
**Alternatives considered**: Suspense + ErrorBoundary — heavier, introduces
component boundaries that complicate data flow; not used anywhere else in the
codebase.

---

### RQ-5: Where should the Errors tab sit in tab order?

**Decision**: Between Validation and Access (position 5 of 8).  
**Rationale**: The Errors tab complements the Validation tab (both diagnose
health) and is more critical than Access (which is about permissions, not
immediate errors). Placing it immediately after Validation keeps health-related
tabs adjacent. This matches the spec FR-001.  
**Alternatives considered**: After Generate (last) — would be easy to miss for
diagnostic use cases. Before Instances — too prominent; users explore instances
first, then diagnose errors.

---

### RQ-6: Does the spec need a new backend API endpoint?

**Decision**: No.  
**Rationale**: `GET /api/v1/rgds/{name}/instances` returns full instance
objects including `status.conditions`. The grouping, rewriting, and presentation
logic is purely client-side. Adding a backend endpoint would add latency, a
new Go handler, tests, and complexity without providing data that isn't already
available.  
**Alternatives considered**: `GET /api/v1/rgds/{name}/error-patterns` —
aggregating server-side would allow pagination and reduce payload size for
large instance counts, but the existing instance list is already bounded by
namespace filter, and the 500-instance scale target (NFR-002) is achievable
client-side.

---

### RQ-7: Should `groupErrorPatterns` live in `@/lib/` or inside `ErrorsTab.tsx`?

**Decision**: Define in `ErrorsTab.tsx` for now.  
**Rationale**: The function is only used by `ErrorsTab`. Constitution §IX says
to promote to `@/lib/` only when there is a second consumer. A comment in the
file will note the promotion path.  
**Alternatives considered**: Proactive promotion to `@/lib/errors.ts` — over-
engineering; adds a module with a single importer.

---

### RQ-8: What tokens are available for the all-clear (healthy) state?

**Decision**: Use `--color-alive` (emerald) for the checkmark icon and text.  
**Rationale**: `tokens.css` defines `--color-alive: #10b981` (dark mode) as
the semantic color for healthy/alive state. This is already used by the live
DAG and status badges for the same semantic meaning.  
**Alternatives considered**: `--color-status-success` does not exist as a
separate token — `--color-alive` is the correct semantic choice for a "healthy"
message.

---

### RQ-9: How should the instance list be capped at 10 per group?

**Decision**: Store the full `InstanceRef[]` in `ErrorGroup`, cap display in
the render path with a `showMore` toggle per group.  
**Rationale**: Storing the full list allows the "and N more" prose to show the
exact count (`instances.length - 10`). A `useState<Set<string>>` holding
expanded group keys allows per-group "show all" expansion.  
**Alternatives considered**: Slicing the data model to 10 — loses the total
count, making it impossible to show "and N more" accurately without an
additional counter field.

---

## Resolution Summary

| ID | Question | Resolution |
|----|----------|------------|
| RQ-1 | Conditions in list response? | Yes — included in full unstructured objects |
| RQ-2 | Import `rewriteConditionMessage` safely? | Yes — extract to `@/lib/conditions.ts` |
| RQ-3 | Condition shape? | Reuse `K8sCondition` from `ConditionsPanel.tsx` |
| RQ-4 | Loading/error pattern? | Follow Instances tab pattern |
| RQ-5 | Tab order? | 5th (after Validation, before Access) |
| RQ-6 | New backend endpoint? | Not needed |
| RQ-7 | `groupErrorPatterns` location? | `ErrorsTab.tsx` (single consumer) |
| RQ-8 | Healthy state token? | `--color-alive` |
| RQ-9 | 10-item cap? | Full list in model; per-group expand toggle in UI |

**No NEEDS CLARIFICATION items remain.**

---

## Impact on Spec / Plan

One spec update required from RQ-2:

> Add `web/src/lib/conditions.ts` to the modified-files list in `plan.md`.
> Update `ConditionItem.tsx` import to use `@/lib/conditions`.

This extraction is beneficial (constitution §IX compliance) and low-risk
(pure function, no DOM dependency). It is captured in tasks.md as a
prerequisite step before writing `ErrorsTab.tsx`.
