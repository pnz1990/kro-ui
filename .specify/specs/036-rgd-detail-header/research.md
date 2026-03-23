# Research: 036 — RGD Detail Header Kind Label + Status Badge

**Phase 0 output** for `.specify/specs/036-rgd-detail-header/plan.md`

---

## Research Task 1: Where is Kind extracted and how is it rendered on the home card?

**Decision**: Use `extractRGDKind(rgd)` from `@/lib/format` (walks `spec.schema.kind`)
and render with the same `.rgd-card__kind` CSS class pattern: a `<span>` with
`background: var(--color-primary-muted)` and `color: var(--color-primary-text)`.

**Rationale**: `extractRGDKind` is already the canonical extraction path. The home
card uses it with a conditional guard (`{kind && <span>...`). Reusing the same
guard in the detail header ensures graceful degradation when `spec.schema.kind`
is absent.

**Alternatives considered**:
- Reading `spec.schema.kind` directly in the component — rejected: would duplicate
  field path knowledge outside of `format.ts`, violating constitution §II.
- Showing the raw `kind` from `metadata.labels["kro.run/kind"]` — rejected: label
  may not exist; `spec.schema.kind` is the authoritative source.

---

## Research Task 2: How is the ReadyStatus extracted and what component renders it?

**Decision**: Use `extractReadyStatus(rgd)` from `@/lib/format` and render the
existing `StatusDot` component (`web/src/components/StatusDot.tsx`).

**Rationale**: `extractReadyStatus` walks `status.conditions[]`, finds the entry
with `type === 'Ready'`, and returns `{ state: ReadyState; reason: string; message: string }`.
When conditions are absent it returns `{ state: 'unknown', reason: '', message: '' }`.
This matches the graceful-degradation requirement (§XII). `StatusDot` already
accepts exactly this shape and renders with `role="img"`, `aria-label`, and a
`title` tooltip — no additional accessibility work needed.

**Alternatives considered**:
- Using `ReadinessBadge` (text pill with "Ready" / "Not Ready") instead of `StatusDot`
  (dot) — rejected: the spec says the detail header should match what the home
  card shows, which uses `StatusDot`.
- Adding a new combined component — rejected: constitution §V (simplicity) and
  §IX (shared helpers) both prefer reusing existing components over creating new ones.

---

## Research Task 3: What CSS tokens are needed for the Kind badge?

**Decision**: Reuse the same token set already used by `.rgd-card__kind`:

| CSS property | Token | Value (dark) |
|---|---|---|
| `background-color` | `--color-primary-muted` | `rgba(91,142,240,0.12)` |
| `color` | `--color-primary-text` | `#93b4f8` |
| `border-radius` | `--radius-sm` | (defined in tokens.css) |

A new CSS class `.rgd-detail-kind` will be added to `RGDDetail.css` rather than
reusing `.rgd-card__kind` from `RGDCard.css` — the classes live in separate
component scopes and cross-importing would create coupling.

**No new tokens needed.** All required tokens already exist in `tokens.css`.

**Alternatives considered**:
- Sharing `.rgd-card__kind` across both components — rejected: CSS is scoped
  per component; sharing would require moving the rule to a global scope or
  creating a shared stylesheet, adding unnecessary complexity.

---

## Research Task 4: What is the correct header layout for name + status + kind?

**Decision**: The header will use a two-row layout:

```
Row 1: [StatusDot] [RGD name h1]
Row 2:             [Kind badge]  (conditional)
```

This matches the home card layout exactly (StatusDot + h2 on one line, Kind badge
in `.rgd-card__meta` below).

A `.rgd-detail-header-row` flexbox wrapper will be added for the first row
(dot + name), keeping the existing `.rgd-detail-name` `<h1>` in place.

**Rationale**: Placing the Kind below the name matches the information hierarchy
of the home card (name is primary, kind is secondary). Placing StatusDot inline
with the name follows the same visual grammar.

**Alternatives considered**:
- Side-by-side on one line (name → kind badge → status dot) — rejected: the
  name can be long; crowding additional elements on the same line risks overflow.
- Kind badge to the right of the name on the same line — acceptable but less
  consistent with the home card's two-row treatment.

---

## Research Task 5: Does the header need polling / live updates?

**Decision**: No polling needed for the header. The detail page already fetches
the RGD object once on mount. The status dot will reflect the status at page load
time, consistent with the rest of the header.

**Rationale**: The spec does not require live-updating the header status. The
existing page already polls for DAG/instance data in other parts; adding
independent header polling would increase complexity with minimal user value.

**Alternatives considered**:
- Deriving status from the already-polled DAG data — not applicable: the detail
  page fetches a single RGD object, and the status is available directly from it.

---

## All NEEDS CLARIFICATION items resolved

| Item | Resolution |
|---|---|
| Which component renders the status in the header? | `StatusDot` — already imported in `RGDCard.tsx`, will be imported in `RGDDetail.tsx` |
| Which extraction function for Kind? | `extractRGDKind` from `@/lib/format` |
| Which extraction function for status? | `extractReadyStatus` from `@/lib/format` |
| New CSS tokens needed? | None — all tokens already in `tokens.css` |
| New API calls needed? | None — uses the RGD object already fetched |
| New components needed? | None — `StatusDot` reused |
| Files to touch? | `RGDDetail.tsx` (lines 198–201 header block), `RGDDetail.css` |
