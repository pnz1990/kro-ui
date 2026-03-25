# Feature Specification: RGD Authoring Global Entrypoint

**Feature Branch**: `039-rgd-authoring-entrypoint`
**Created**: 2026-03-24
**Status**: In progress
**Depends on**: `026-rgd-yaml-generator` (merged), `033-first-time-onboarding` (merged)
**Closes**: GH issue #162
**Constitution ref**: §III (Read-Only), §V (Simplicity), §IX (Theme), §XIII (UX Standards)

---

## Context

The RGD authoring form ("New RGD" mode inside `GenerateTab`) is currently only
reachable via:

1. Navigate to any existing RGD detail page
2. Click the "Generate" tab
3. Click "New RGD"

This is a buried, context-dependent entry point for a top-level workflow. A user
who wants to define a new ResourceGraphDefinition from scratch has no discoverable
path to this feature. GH issue #162 classifies this as severity High.

This spec adds a **global authoring entrypoint** with three surfaces:

1. **Top bar "New RGD" button** — always visible, navigates to `/author`
2. **`/author` route** — a standalone page that renders `RGDAuthoringForm` +
   `YAMLPreview` side-by-side (the "New RGD" mode extracted from `GenerateTab`)
3. **Home / Catalog empty-state link** — when zero RGDs exist, the empty state
   includes a direct link to `/author`

The per-RGD Generate tab's "New RGD" mode is **preserved** as a context-aware
shortcut. When navigating to `GenerateTab` from an existing RGD, switching to
"New RGD" mode still works exactly as before.

---

## User Scenarios & Testing

### User Story 1 — New user discovers authoring from the top bar (Priority: P1)

A "New RGD" button is visible in the top bar on all pages. Clicking it navigates
to `/author`, which renders the full RGD authoring form immediately.

**Acceptance Scenarios**:

1. **Given** any page in the app, **When** the user looks at the top bar,
   **Then** a "New RGD" button (or `+ New RGD` label) is visible

2. **Given** the user clicks the "New RGD" button, **Then** they land on `/author`
   with the `RGDAuthoringForm` pre-populated with the starter state (kind=MyApp,
   one Deployment resource) and `YAMLPreview` showing the generated RGD YAML

3. **Given** the user is on `/author`, **Then** `document.title` is
   `"New RGD — kro-ui"`

---

### User Story 2 — Home empty state surfaces authoring (Priority: P1)

When the Home page has zero RGDs (no `debouncedQuery` match and no items at all),
the existing onboarding empty state gains a third action: "New RGD".

**Acceptance Scenarios**:

1. **Given** the Home page shows the onboarding empty state (items.length === 0,
   no active search), **When** it renders, **Then** a "New RGD" link/button is
   visible alongside "Get started with kro" and "kro on GitHub"

2. **Given** the user clicks "New RGD" in the Home empty state, **Then** they
   navigate to `/author`

---

### User Story 3 — Catalog empty state surfaces authoring (Priority: P1)

When the Catalog page has zero RGDs (items.length === 0, no active filter), the
empty state gains a "New RGD" link.

**Acceptance Scenarios**:

1. **Given** the Catalog shows its empty state for zero cluster RGDs,
   **Then** a "New RGD" link navigates to `/author`

---

### User Story 4 — Context-aware shortcut preserved (Priority: P1, regression guard)

The per-RGD `GenerateTab` "New RGD" button still works and retains its context
(switching to the authoring sub-mode within the Generate tab, not navigating away).

**Acceptance Scenarios**:

1. **Given** the user is on `/rgds/test-app?tab=generate`, **When** they click
   "New RGD" mode, **Then** the `RGDAuthoringForm` renders **within the Generate
   tab** (not navigating to `/author`)

---

### Edge Cases

- `/author` with no cluster connection → `RGDAuthoringForm` still renders (it is
  purely client-side; no API call needed for the authoring form itself)
- Top bar "New RGD" button must not displace navigation links — placed to the
  right of the nav links, before `ContextSwitcher`
- "New RGD" text in `TopBar` must be a `<Link>` (React Router), not an anchor,
  so navigation is client-side

---

## Requirements

### Functional Requirements

- **FR-001**: A new route `/author` renders `AuthorPage` (standalone authoring page)
- **FR-002**: `AuthorPage` renders `RGDAuthoringForm` + `YAMLPreview` side-by-side,
  pre-populated with the same `STARTER_RGD_STATE` as `GenerateTab`
- **FR-003**: `AuthorPage` sets `document.title` to `"New RGD — kro-ui"`
- **FR-004**: `TopBar` includes a "New RGD" action (styled as a primary CTA button,
  not a nav link) visible on all pages
- **FR-005**: Clicking the "New RGD" top bar action navigates to `/author`
- **FR-006**: Home page onboarding empty state (items.length === 0, no search)
  includes a "New RGD" `<Link to="/author">` alongside existing CTAs
- **FR-007**: Catalog page zero-items empty state includes a "New RGD" `<Link to="/author">`
- **FR-008**: Per-RGD `GenerateTab` "New RGD" mode button continues to work as a
  within-tab mode switch (no navigation change)
- **FR-009**: The "New RGD" route is registered in the router before the `*`
  catch-all (no 404 regression)

### Non-Functional Requirements

- **NFR-001**: No new npm or Go dependencies
- **NFR-002**: TypeScript strict mode — 0 errors
- **NFR-003**: All CSS uses `tokens.css` custom properties — no inline hex/rgba
- **NFR-004**: `AuthorPage` is purely client-side — no new backend endpoints
- **NFR-005**: The "New RGD" top bar button must be `data-testid="topbar-new-rgd"`
  for E2E targeting

### Key Components / Files Changed

- **`web/src/pages/AuthorPage.tsx`** (new): standalone authoring page
- **`web/src/pages/AuthorPage.css`** (new): layout styles
- **`web/src/components/TopBar.tsx`** (edit): add "New RGD" button
- **`web/src/components/TopBar.css`** (edit): style the button
- **`web/src/pages/Home.tsx`** (edit): add `/author` link in onboarding empty state
- **`web/src/pages/Catalog.tsx`** (edit): add `/author` link in zero-items empty state
- **`web/src/main.tsx`** (edit): register `/author` route

---

## Testing Requirements

### E2E Journeys

`test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts`:

- **Step 1**: Top bar has visible "New RGD" entrypoint
- **Step 2**: Navigating to it opens the authoring form (`/author`)
- **Step 3**: Home/Catalog empty state links to authoring (validated via
  search-filter empty path since CI cluster always has RGDs)
- **Step 4**: Per-RGD "New RGD" shortcut still works (regression guard)

---

## Success Criteria

- **SC-001**: `+ New RGD` is visible in top bar on Home, Catalog, Fleet, Events
- **SC-002**: `/author` renders `RGDAuthoringForm` with starter state
- **SC-003**: `document.title` at `/author` is `"New RGD — kro-ui"`
- **SC-004**: Home onboarding empty state includes "New RGD" link to `/author`
- **SC-005**: Catalog zero-items empty state includes "New RGD" link to `/author`
- **SC-006**: Per-RGD Generate tab "New RGD" mode still functions (no regression)
- **SC-007**: TypeScript strict mode passes with 0 errors
- **SC-008**: No inline hex or `rgba()` in any new or edited CSS
