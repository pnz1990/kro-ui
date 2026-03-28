# Feature Specification: RGD Card Error Hint

**Feature Branch**: `056-rgd-status-tooltip`
**Created**: 2026-03-28
**Status**: In Progress

---

## Context

The Overview page shows RGD cards with a status dot (green = ready, red = error,
grey = unknown). When the dot is red, users currently have no way to know WHY
without clicking through to the RGD detail page's Validation tab.

During PDCA sweep: `cel-functions` (red dot, `InvalidResourceGraph: references
unknown identifiers: [j]`), `chain-cycle-a/b` (red dot, cycle detection errors),
`invalid-cel-rgd` (red dot, CEL parse error) all show identical red dots with
no actionable information on the card.

The `StatusDot` component has a `title` attribute tooltip, but HTML `title`
tooltips are: invisible on mobile, not keyboard-accessible, and give no visual
affordance that there's more information.

## Design

For RGD cards in `error` state, add a one-line error hint directly on the card
between the meta row and the health chip. The hint shows:
- The `reason` value (e.g., "InvalidResourceGraph")
- Truncated `message` (first 80 chars, with ellipsis if truncated)

This is a **read-only, informational display** — no mutation, no expansion.
Full error details are still in the Validation tab.

## Requirements

### FR-001: Error hint on error-state cards

When `state === 'error'` and `reason` is non-empty, render a `<p>` element with
class `rgd-card__error-hint` and `data-testid="rgd-card-error-hint"`.

Content format: `{reason}: {message}` — truncated to 80 characters with `…` suffix.
If only `reason` exists (empty message), show just the reason.

### FR-002: Style

The error hint:
- font-size: 11px
- color: `var(--color-status-error)`
- Truncated with `text-overflow: ellipsis; overflow: hidden; white-space: nowrap`
- Max-width: 100% of card width
- No additional padding beyond the existing card padding

### FR-003: No rendering for ready/unknown state

Only rendered when `state === 'error'`. Ready and unknown state cards are
unchanged.

### FR-004: title attribute preserves full message

The hint `<p>` MUST have a `title` attribute with the full (untruncated) error
message for accessibility and desktop hover.

---

## Acceptance Criteria

- [ ] Error-state RGD cards show a one-line error hint
- [ ] Hint is truncated at 80 chars with ellipsis
- [ ] Ready/unknown cards have no hint
- [ ] `title` attribute carries full message
- [ ] No hardcoded colors (uses `--color-status-error`)
- [ ] RGDCard unit tests updated
- [ ] `tsc --noEmit` and `go vet` pass
