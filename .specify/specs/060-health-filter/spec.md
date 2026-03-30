# Feature Specification: OverviewHealthBar Clickable Filter

**Feature Branch**: `060-namespace-overview-filter`
**Created**: 2026-03-28
**Status**: Merged (PR #329)

## Context

The OverviewHealthBar (spec 055) shows aggregate health counts (e.g. "3 reconciling").
When an operator sees "3 reconciling", they need to scroll 27 RGD cards to find which
3 RGDs have reconciling instances. The chips should be clickable to filter the grid.

## Design

Clicking a chip filters the card grid to show only RGDs with instances in that state.
Clicking the active chip clears the filter.
The count display shows "N of M" and a × clear button.

## Acceptance criteria

- [ ] OverviewHealthBar chips become buttons when onFilter is provided
- [ ] Active chip has --active modifier class (filled background)
- [ ] Clicking active chip clears filter
- [ ] Card grid shows only matching RGDs when filter active
- [ ] × button clears the filter
- [ ] `tsc --noEmit` clean
