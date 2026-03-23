# UI Contracts: RGD Optimization Advisor (023)

This feature is purely frontend and introduces no new API endpoints or backend
changes. The contracts defined here are UI component contracts (props interfaces
and test-id surface).

---

## `OptimizationAdvisor` Component Contract

```typescript
interface OptimizationAdvisorProps {
  /** Candidate groups produced by detectCollapseGroups(rgd.spec). */
  groups: CollapseGroup[]
}
```

**Renders nothing** (`null`) when `groups` is empty or all groups are dismissed.

**`data-testid` surface**:

| Selector | Element | Purpose |
|---|---|---|
| `[data-testid="optimization-advisor"]` | Root container | Present only when ≥ 1 undismissed group |
| `[data-testid="advisor-item-${kind}"]` | Per-group item | One per undismissed group |
| `[data-testid="advisor-item-${kind}-expand"]` | Expand/collapse toggle | Click to expand explanation |
| `[data-testid="advisor-item-${kind}-dismiss"]` | Dismiss (×) button | Click to hide this item |
| `[data-testid="advisor-item-${kind}-explanation"]` | Explanation panel | Visible when expanded |
| `[data-testid="advisor-item-${kind}-docs-link"]` | forEach docs link | `<a>` with href to kro docs |

---

## `detectCollapseGroups` Function Contract

```typescript
// Export from web/src/lib/dag.ts
export function detectCollapseGroups(spec: unknown): CollapseGroup[]
```

**Guarantees**:
- Pure function (no side effects, no I/O)
- Never throws for any input, including `null`, `undefined`, arrays, primitives
- Returns `[]` for any input that is not a valid RGD spec with resources
- Result is deterministic: same input → same output

---

## No New API Endpoints

This feature makes no backend changes. The RGD spec data is already served by
`GET /api/v1/rgds/:name` (spec `001b-rgd-api`). No new endpoints, no new
response fields, no schema changes.
