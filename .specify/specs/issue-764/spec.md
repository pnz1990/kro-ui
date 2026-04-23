# Spec: issue-764 — Instance reconciliation timeline (29.1)

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: 29.1 — Instance reconciliation timeline (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: A `ReconciliationTimeline` component exists at
`web/src/components/ReconciliationTimeline.tsx` and renders the last ≤10
condition `lastTransitionTime` transitions for an instance.

**O2**: The timeline is visible on the Instance detail page, placed inside the
existing `ConditionsPanel` as a sub-section below the conditions list
(no new route, no new HTTP endpoint required).

**O3**: Each timeline entry shows: state label (e.g. "Reconciling", "Ready",
"Error"), the `lastTransitionTime` formatted as both an absolute date and a
relative age (using existing `formatAge()`), and the condition type that caused
the transition.

**O4**: Timeline entries are sorted newest-first (most recent transition at top).

**O5**: When fewer than 2 conditions have a `lastTransitionTime`, the timeline is
not rendered (insufficient data). The component returns `null` in this case.

**O6**: All new CSS uses `var(--token)` references only — no hardcoded colors
or `rgba()`/hex values.

**O7**: `ReconciliationTimeline.test.tsx` covers: renders nothing when <2
transitions, renders entries sorted newest-first, shows formatted timestamps,
handles missing `lastTransitionTime` fields gracefully.

---

## Zone 2 — Implementer's judgment

- Timeline visual style: a vertical timeline with a left-hand dot + line
  (similar to git log) is idiomatic and readable. No SVG required.
- The "last 10 transitions" window is computed from the conditions array:
  each condition with a `lastTransitionTime` contributes one entry. Duplicate
  timestamps (two conditions transitioning at the same second) are both shown.
- No backend change: all data comes from `instance.status.conditions`.
- State label mapping: derive from the condition's `type` + `status` using
  existing `isHealthyCondition()` logic — healthy → "Ready", unknown → "Unknown",
  unhealthy → "Error/Not Ready" (use the condition type for specificity).

---

## Zone 3 — Scoped out

- A full audit log of every state transition since instance creation (only the
  last transition per condition is available in the CR status).
- WebSocket/streaming timeline updates (5s polling is sufficient).
- Timeline for node-level conditions (this is instance-level only).
