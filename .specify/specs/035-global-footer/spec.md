# Feature Specification: Global Footer with Community Links

**Feature Branch**: `035-global-footer`
**Created**: 2026-03-23
**Status**: Draft
**Closes**: GitHub issue #127
**Input**: User description: "Global footer with community links — implement a persistent footer component rendered on all pages containing the kro-ui version, a link to kro.run, a link to the kro GitHub repository, and a link to file a bug. Use only existing design system tokens. Footer must be keyboard-navigable and not interfere with the SPA router."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Any user can reach kro documentation or file a bug from any page (Priority: P1)

A platform engineer is on the RGD detail page and encounters unfamiliar
behaviour. They want to check the kro documentation or file a bug report. They
scroll to the bottom of the page — or simply look down — and see a footer
containing links to kro.run, the kro GitHub repository, and a direct link to
open a new issue. They click the appropriate link, which opens in a new tab,
and continue their work in kro-ui without losing their place.

**Why this priority**: This is the complete deliverable for this spec. The footer
with three links and the version string is the entire feature. It is a pure
static content addition — no backend, no state, no interactivity beyond
external link navigation — and it resolves the absence of any community or help
anchor in the UI (GitHub issue #127).

**Independent Test**: Can be fully tested by opening any page in kro-ui, scrolling
to the bottom, and verifying: a footer is present, it contains a link to kro.run,
a link to the kro GitHub repository, a link to file a bug, and the current kro-ui
version string. All links open in a new tab.

**Acceptance Scenarios**:

1. **Given** a user is on any page of kro-ui (home, catalog, RGD detail, instance
   detail, fleet, events, 404), **When** they view the bottom of the page,
   **Then** a footer is present containing all required content.
2. **Given** the footer is present, **When** the user clicks the kro.run link,
   **Then** https://kro.run opens in a new browser tab and the user remains on
   the current kro-ui page.
3. **Given** the footer is present, **When** the user clicks the GitHub link,
   **Then** https://github.com/kubernetes-sigs/kro opens in a new browser tab.
4. **Given** the footer is present, **When** the user clicks the "File a bug" link,
   **Then** the kro-ui GitHub new issue page opens in a new browser tab.
5. **Given** the footer is present, **When** the user reads it, **Then** the
   current kro-ui version string (e.g. `v0.2.1`) is visible.
6. **Given** the user navigates between pages using the SPA router, **When** each
   new page loads, **Then** the footer is present on the new page without a full
   page reload — it persists across client-side navigation.

---

### User Story 2 — Keyboard-only user can reach all footer links via Tab navigation (Priority: P2)

A platform engineer navigating kro-ui without a mouse uses the Tab key to move
through the page. When they reach the footer, they can Tab through each link in
order (kro.run, GitHub, file a bug) and activate any of them with Enter. No
link is skipped, no focus trap is introduced, and after the last footer link the
Tab key moves focus to the browser chrome or back to the top of the page as
expected.

**Why this priority**: Keyboard navigation is a correctness requirement. The
feature description explicitly calls it out. It is P2 because P1 (the footer
existing with correct content) must be true before keyboard navigation can be
tested, but it is not optional — a footer that cannot be keyboard-navigated is
incomplete.

**Independent Test**: Can be tested independently by navigating to any kro-ui
page, tabbing through all focusable elements, reaching the footer links, and
verifying each link receives a visible focus ring and can be activated with Enter.

**Acceptance Scenarios**:

1. **Given** the user is tabbing through the page, **When** focus reaches the
   footer, **Then** each footer link receives a visible focus ring in turn.
2. **Given** a footer link has keyboard focus, **When** the user presses Enter,
   **Then** the link opens in a new tab — the same behaviour as a mouse click.
3. **Given** the user has tabbed past the last footer link, **When** they press
   Tab again, **Then** focus moves out of the footer naturally — no focus trap
   is introduced by the footer.
4. **Given** the footer is rendered on a page with other focusable elements,
   **When** the user tabs through the page, **Then** footer links appear in the
   natural document order — after all page content, before the browser chrome.

---

### User Story 3 — Version string in footer helps support identify the running release (Priority: P3)

A platform engineer files a bug report via the footer link. Before submitting, a
support engineer asks "what version of kro-ui are you running?" The user glances
at the footer — still visible in their kro-ui tab — and reads the version string
directly. They include it in the bug report without running any command or
navigating to a separate about page.

**Why this priority**: The version string is a trust signal and a support utility.
It is P3 because the footer links (P1) deliver the primary community value, and
the version string is a supplementary data point. It is still required — the
feature description specifies it — but its absence would not block any workflow
the way missing links would.

**Independent Test**: Can be tested by reading the footer version string and
verifying it matches the version reported by the kro-ui binary (e.g. via the
`/healthz` or version endpoint).

**Acceptance Scenarios**:

1. **Given** the footer is visible, **When** the user reads it, **Then** the
   kro-ui version string is present and matches the version the binary was built
   with (not `dev` or empty in a released build).
2. **Given** a development build where no version tag is set, **When** the user
   reads the footer, **Then** the version shows `dev` or equivalent — it does not
   show an empty string or crash.
3. **Given** a new kro-ui version is deployed, **When** the user reloads the page,
   **Then** the footer reflects the new version — it is not hardcoded in the
   frontend bundle but sourced from the server at runtime.

---

### Edge Cases

- What happens on pages where the main content is very short (e.g. the 404 page
  or a loading state)? The footer must appear at or near the bottom of the
  viewport, not float in the middle of the page below sparse content. If the
  page content is shorter than the viewport, the footer must be anchored to the
  bottom of the viewport.
- What happens on pages with very long content (e.g. an RGD with many resources)?
  The footer must be at the bottom of the document (after all content), not fixed
  to the viewport. Users should be able to scroll past the content to reach it.
- What happens on a narrow viewport (mobile/tablet)? Footer links must remain
  readable and tappable — they must not overflow or collapse to zero-width. The
  version string may be truncated if space is limited but must not cause overflow.
- What happens if the version endpoint is temporarily unavailable? The footer
  must still render with the remaining content. The version string shows `—` or
  a cached value — the footer does not disappear or error because the version
  could not be fetched.
- What happens when the user is on the 404 page (no matching route)? The footer
  must still appear — the 404 page is explicitly included in scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A footer component MUST be present at the bottom of every page
  rendered by the SPA router, including: home, catalog, RGD detail (all tabs),
  instance detail, fleet, events, and the 404 catch-all page.
- **FR-002**: The footer MUST contain a link to https://kro.run labelled "kro.run"
  or equivalent, opening in a new browser tab.
- **FR-003**: The footer MUST contain a link to https://github.com/kubernetes-sigs/kro
  labelled "GitHub" or equivalent, opening in a new browser tab.
- **FR-004**: The footer MUST contain a link to the kro-ui GitHub new issue page,
  labelled "File a bug" or equivalent, opening in a new browser tab.
- **FR-005**: The footer MUST display the current kro-ui version string sourced
  from the server at runtime — not hardcoded in the frontend.
- **FR-006**: When the version cannot be fetched, the footer MUST still render
  with the remaining content, showing `—` or `dev` for the version string —
  it MUST NOT fail to render or display an error state.
- **FR-007**: The footer MUST use only existing design system tokens for all
  colours, spacing, and typography — no new hardcoded CSS values.
- **FR-008**: On pages where the main content is shorter than the viewport height,
  the footer MUST be anchored to the bottom of the viewport.
- **FR-009**: On pages where the main content is taller than the viewport height,
  the footer MUST appear after all page content in the scroll flow — it MUST NOT
  be viewport-fixed on tall pages.
- **FR-010**: All footer links MUST be reachable and activatable via keyboard Tab
  navigation, with a visible focus ring on each link when focused.
- **FR-011**: The footer MUST NOT introduce a focus trap — keyboard focus must
  move naturally out of the footer after the last link.
- **FR-012**: The footer MUST persist across client-side SPA navigation — it MUST
  NOT cause a visible flash or full remount on route changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The footer is present on 100% of pages — zero pages in the SPA
  routing table are missing the footer after this change.
- **SC-002**: A user can navigate from any page to the kro.run website, the kro
  GitHub repository, or the kro-ui issue tracker in a single click from the footer.
- **SC-003**: All footer links are reachable via keyboard Tab navigation with a
  visible focus ring — verified by keyboard-only navigation through the complete
  page on at least three different routes.
- **SC-004**: The version string displayed in the footer matches the running
  binary version in 100% of cases — zero hardcoded version strings in the
  frontend bundle.
- **SC-005**: Zero new hardcoded CSS colour, spacing, or typography values are
  introduced by the footer — all styling uses existing design system tokens,
  verified by code review.

## Assumptions

- The version string is sourced from the existing version/healthz endpoint already
  implemented in `001-server-core`. No new backend endpoint is required.
- "Every page" means every route registered in the SPA router, including the 404
  catch-all. It does not mean every modal, drawer, or overlay panel.
- The "File a bug" link points to
  https://github.com/pnz1990/kro-ui/issues/new — the kro-ui repository issue
  tracker, not the upstream kro repository. This is the appropriate target for
  kro-ui-specific bugs.
- The footer is a minimal single-line (or two-line on narrow viewports) component.
  It is not a multi-column site footer. No additional sections (changelog, social
  links, etc.) are in scope for this spec.
- The footer is rendered as part of the app shell (outside the per-route page
  component) so it persists across SPA navigation without remounting. This is
  a layout decision, not a per-page addition.
- The "sticky bottom on short pages / scroll-to on tall pages" behaviour
  (FR-008/FR-009) is achieved through standard CSS layout (e.g. min-height on
  the page container) — not through JavaScript or position:fixed.
