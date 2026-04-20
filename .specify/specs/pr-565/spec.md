# spec pr-565 — Condition detail drill-down

## Design reference
- **Design doc**: `docs/design/30-health-system.md`
- **Section**: `§ Future`
- **Implements**: Condition detail drill-down — expand each condition with message, last transition time, reason (🔲 → ✅)

---

## Zone 1 — Obligations

**O1**: Each condition row in `ConditionsPanel` MUST default to collapsed state, showing only the condition type and status badge.

**O2**: Clicking a collapsed condition row MUST expand it in-place to reveal message, reason, and lastTransitionTime (when present).

**O3**: Clicking an expanded condition row MUST collapse it back.

**O4**: Unhealthy conditions (status≠True, or negation-polarity False-is-healthy) MUST default to **expanded** so operators immediately see the error detail without a click.

**O5**: The expand/collapse toggle MUST be keyboard accessible (Enter/Space activates it; the row carries `role="button"` and `tabIndex={0}`).

**O6**: Absent optional fields (message, reason, lastTransitionTime) MUST NOT render their labels/containers when empty or missing.

**O7**: The existing `data-testid="conditions-panel"`, `data-testid="conditions-panel-empty"`, and `data-testid="conditions-summary"` MUST remain for backward compatibility.

**O8**: Each expandable row MUST carry `data-testid="condition-row-{type}"` and `data-testid="condition-row-{type}-detail"` for the expanded detail section.

---

## Zone 2 — Implementer's judgment

- Use a `Set<string>` of expanded condition types in local React state.
- The toggle chevron (▼/▶) is a reasonable affordance — or inline CSS rotation.
- Whether to auto-expand ALL conditions when there is only 1 condition is left to judgment.
- CSS transitions for expand/collapse are optional (prefer simplicity).

---

## Zone 3 — Scoped out

- Persisting the expand/collapse state across page navigations.
- Expanding conditions in other panels (ConditionItem, ValidationTab).
- Any server-side changes.
