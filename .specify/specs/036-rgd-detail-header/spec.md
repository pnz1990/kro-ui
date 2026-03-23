# Spec 036 — RGD Detail Page Header: Kind Label + Status Badge

**GitHub Issue**: #130  
**Branch**: `036-rgd-detail-header`  
**Category**: UX Enhancement  
**Severity**: Low  

---

## Problem

The home page RGD card (`RGDCard`) shows three pieces of information in its header:

1. **RGD name** (e.g. `dungeon-graph`) — as `<h2>`
2. **Kind label** (e.g. `Dungeon`) — in a muted blue pill badge
3. **Status dot** — a green/red/gray circle indicating Ready / Not Ready / Unknown

When a user navigates to the RGD detail page (`/rgds/:name`), the `<h1>` shows **only the RGD name**. The Kind label and status badge are **dropped entirely**.

A user who navigates directly to an RGD detail URL (e.g. via a bookmark or deep link) loses important contextual information that was visible on the home card.

---

## Requirements

### FR-001 — Kind Label in Detail Header

The RGD detail page header MUST display the `spec.schema.kind` value as a secondary
label below (or beside) the RGD name. If `spec.schema.kind` is absent or empty,
the label MUST be omitted (not rendered as empty or `?`). The visual treatment
MUST match the Kind badge on the home card (muted blue pill: `--color-primary-muted`
background, `--color-primary-text` foreground).

### FR-002 — Status Dot in Detail Header

The RGD detail page header MUST display the same `StatusDot` component that the
home card uses, positioned to the left of or above the RGD name. The dot MUST
reflect the current `status.conditions[type=Ready]` value. Absent conditions
render as `unknown` state (gray dot) — never as "Pending" or an error.

### FR-003 — Consistency with Home Card

The three data elements (name, kind, status) MUST be sourced from the same
extraction functions (`extractRGDName`, `extractRGDKind`, `extractReadyStatus`)
used by `RGDCard`. No new extraction logic.

### FR-004 — No New API Calls

The Kind and status information MUST be derived from the RGD object already
fetched by the detail page (`GET /api/v1/rgds/{name}`). No additional API
requests.

### FR-005 — Document Title Unchanged

The `document.title` format (`<rgdName> — kro-ui`) MUST remain unchanged.
The title should not include the Kind.

---

## Acceptance Criteria

- [ ] RGD detail header shows RGD name + Kind badge (when Kind is available)
- [ ] RGD detail header shows StatusDot with correct ready state
- [ ] Kind badge is omitted when `extractRGDKind` returns empty string
- [ ] StatusDot shows `unknown` (gray) when `status.conditions` is absent
- [ ] Layout is visually consistent with the home card header
- [ ] All colors use tokens from `tokens.css` (no hardcoded hex)
- [ ] Page title remains `<rgdName> — kro-ui`
- [ ] TypeScript typecheck passes (`bun run typecheck`)
- [ ] No new CSS rules use hardcoded `rgba()` or hex values

---

## Out of Scope

- Adding the resource count or age to the detail header
- Changing the tab bar or breadcrumb
- Adding tooltips or hover states beyond what `StatusDot` already provides
- Polling / live-updating the status in the header (the page already polls for graph data)
