# Feature Specification: First-Time User Onboarding

**Feature Branch**: `033-first-time-onboarding`
**Created**: 2026-03-23
**Status**: Draft
**Closes**: GitHub issue #120
**Input**: User description: "First-time user onboarding — add a tagline and brief description to the home page header, a footer component on all pages linking to kro.run and the kro GitHub repo, and a zero-RGD empty state on the home page that explains what kro is and provides a kubectl snippet to install kro and apply a first RGD."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — First-time visitor understands what kro-ui is in under 10 seconds (Priority: P1)

A platform engineer receives a link to a kro-ui instance from a colleague.
They have never used kro before. They open the URL and immediately read a
tagline in the home page header: something like _"kro-ui — Kubernetes
ResourceGraphDefinition dashboard"_ followed by a one-sentence description of
what kro-ui does. Within seconds, without clicking anything or consulting external
documentation, they understand the tool's purpose and the ecosystem it belongs to.

**Why this priority**: This is the single highest-impact gap in the current UI.
A tool with zero self-description fails every first-time visitor. The tagline and
description are pure content additions that require no backend changes and deliver
immediate trust and clarity. They are the fastest possible path from "proof of
concept" to "product."

**Independent Test**: Can be fully tested by opening the home page as a user with
no prior kro knowledge and verifying: a tagline is visible without scrolling, a
brief plain-language description of kro-ui is present, and no prior knowledge of
kro is needed to understand what the tool does.

**Acceptance Scenarios**:

1. **Given** a user opens kro-ui for the first time, **When** the home page loads,
   **Then** a tagline identifying kro-ui and its purpose is visible in the header
   area without any scrolling.
2. **Given** the tagline is visible, **When** the user reads the home page header,
   **Then** a brief plain-language description (1–2 sentences) of what kro-ui does
   is present alongside or below the tagline.
3. **Given** an existing user with RGDs already loaded, **When** they view the home
   page, **Then** the tagline and description are still present but do not obscure
   or displace the RGD card grid — they coexist with the existing content.
4. **Given** the home page is rendered on a narrow viewport (tablet/mobile width),
   **When** the user views it, **Then** the tagline and description remain readable
   and do not overflow or overlap other elements.

---

### User Story 2 — Empty cluster visitor knows how to get started with kro (Priority: P2)

A new platform engineer has just been given access to kro-ui. Their cluster has
kro installed but no RGDs have been created yet. They land on the home page and
instead of a blank grid with no explanation, they see a purposeful empty state:
a brief explanation of what a ResourceGraphDefinition is, a copyable `kubectl`
snippet to install kro if not already present, and a copyable snippet to apply a
sample RGD so they can see the tool in action. The empty state gives them a
complete "getting started" path without leaving kro-ui.

**Why this priority**: An empty state with no guidance is a dead end. This story
converts the worst first-time experience (blank page, no context) into an
onboarding opportunity. It is P2 rather than P1 because it only applies when zero
RGDs exist — experienced users with populated clusters never see it.

**Independent Test**: Can be tested by connecting kro-ui to a cluster with no
RGDs and verifying: the home page shows the empty state (not a blank grid), it
contains a plain-language explanation of RGDs, and at least one copyable command
snippet is present.

**Acceptance Scenarios**:

1. **Given** kro is connected to a cluster with zero RGDs, **When** the home page
   loads, **Then** an empty state replaces the blank card grid, containing a
   description of what an RGD is and what kro does.
2. **Given** the empty state is displayed, **When** the user reads it, **Then** at
   least one copyable `kubectl` command snippet is shown — either for installing
   kro or for applying a first RGD — with a one-click copy affordance.
3. **Given** the empty state is displayed, **When** the user clicks the copy button
   on a snippet, **Then** the command is copied to their clipboard with visual
   confirmation (e.g. the button label changes to "Copied!" briefly).
4. **Given** an RGD is subsequently applied to the cluster, **When** the home page
   polls and detects the new RGD, **Then** the empty state is replaced by the RGD
   card grid automatically — no manual refresh required.
5. **Given** the cluster is unreachable (connection error on load), **When** the
   home page renders, **Then** the connection error state is shown — not the
   zero-RGD empty state. The two states are visually and semantically distinct.

---

### User Story 3 — Any visitor can find kro documentation and community links (Priority: P3)

An engineer using kro-ui hits an unfamiliar concept (e.g. "forEach collection")
and wants to read the kro documentation. They look for a help link and find it
in a footer that appears at the bottom of every page. The footer contains links to
kro.run (the kro project website) and the kro GitHub repository. The links open in
a new browser tab. From any page in kro-ui, the engineer can reach official kro
resources in a single click.

**Why this priority**: The footer is a persistent navigation element and a trust
signal — it signals that kro-ui is a real project connected to a real community.
It is P3 because it is a static content addition with no interactivity beyond
external links, and its absence does not block any primary workflow.

**Independent Test**: Can be tested independently by verifying that a footer is
present on every page of the app (home, RGD detail, instance detail, catalog,
fleet, events, 404) and that it contains working links to kro.run and the kro
GitHub repo.

**Acceptance Scenarios**:

1. **Given** the user is on any page of kro-ui, **When** they scroll to the bottom,
   **Then** a footer is visible containing at least a link to kro.run and a link
   to the kro GitHub repository.
2. **Given** the user clicks a footer link, **When** the link opens, **Then** it
   opens in a new browser tab — the user is not navigated away from kro-ui.
3. **Given** the user is on a page with very little content (e.g. the 404 page),
   **When** they view the page, **Then** the footer is still visible without
   requiring scrolling — it is at the bottom of the viewport, not the bottom of
   a long document.
4. **Given** the footer is rendered on a narrow viewport, **When** the user views
   it, **Then** links remain readable and tappable — they do not overflow or
   collapse into an unusable state.

---

### Edge Cases

- What happens when the cluster has RGDs but all of them are still loading? The
  home page must show a loading state (skeleton cards or spinner) — not the
  zero-RGD empty state. The empty state must only appear when the API has
  confirmed zero RGDs, not during a pending load.
- What happens when the clipboard API is unavailable (browser permission denied)?
  The copy button on the kubectl snippets must fall back to selecting the text
  in a text area for manual copying — never a silent failure.
- What happens on the 404 page — should the tagline appear there too? The 404
  page should show the footer (consistent with all pages) but need not repeat
  the home page tagline. The 404 page already has its own purpose.
- What happens if the kro GitHub URL or kro.run URL changes? The footer links
  are static content — they will need a code change to update. This is acceptable;
  no dynamic link resolution is required.
- What happens when the kubectl snippet in the empty state becomes outdated (kro
  install command changes between versions)? The snippet is static content and
  links to the official kro docs for the latest install instructions — it does not
  hardcode a specific Helm chart version or tag that would rot quickly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page header MUST display a tagline that identifies kro-ui
  and its purpose, visible without scrolling on a standard desktop viewport.
- **FR-002**: The home page header MUST display a brief description (1–2 sentences)
  of what kro-ui does in plain language, alongside or below the tagline.
- **FR-003**: The tagline and description MUST coexist with the existing RGD card
  grid on populated clusters — they MUST NOT replace or hide the card grid.
- **FR-004**: When the home page loads and the API returns zero RGDs, the home page
  MUST display a zero-RGD empty state instead of a blank card grid.
- **FR-005**: The zero-RGD empty state MUST contain a plain-language explanation
  of what a ResourceGraphDefinition is and what kro does.
- **FR-006**: The zero-RGD empty state MUST contain at least one copyable `kubectl`
  command snippet (install kro or apply a first RGD), with a one-click copy affordance.
- **FR-007**: The copy affordance on kubectl snippets MUST provide visual confirmation
  that the copy succeeded (e.g. button label change) — and MUST fall back to a
  selectable text area when clipboard access is unavailable.
- **FR-008**: The zero-RGD empty state MUST be replaced automatically by the RGD
  card grid when RGDs are detected on a subsequent poll — no manual refresh required.
- **FR-009**: The zero-RGD empty state MUST NOT be shown while the RGD list is
  still loading — only after the API has confirmed zero results.
- **FR-010**: A footer component MUST be present on every page of the application
  (home, catalog, RGD detail, instance detail, fleet, events, 404, and any future pages).
- **FR-011**: The footer MUST contain a link to https://kro.run and a link to the
  kro GitHub repository (https://github.com/kubernetes-sigs/kro), both opening in
  a new browser tab.
- **FR-012**: The footer MUST be visible at the bottom of the viewport on pages
  with little content (e.g. 404) — it must not require scrolling to reach on
  short pages.
- **FR-013**: All new elements (tagline, description, empty state, footer) MUST use
  only existing design system tokens — no new hardcoded colour, spacing, or
  typography values.

### Key Entities

- **Tagline**: A short identifying phrase displayed in the home page header that
  names kro-ui and its purpose — static content, never dynamic.
- **Zero-RGD empty state**: The content shown on the home page when the connected
  cluster has no ResourceGraphDefinitions — contains explanation text and copyable
  kubectl snippets. Replaces the blank card grid. Disappears when RGDs are detected.
- **Footer**: A persistent component rendered at the bottom of every page —
  contains external links to kro.run and the kro GitHub repository. No interactive
  state beyond link navigation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor with no prior kro knowledge can identify the
  purpose of kro-ui within 10 seconds of opening the home page, without clicking
  any links or reading external documentation.
- **SC-002**: A user landing on an empty cluster can find and copy a getting-started
  `kubectl` command within 30 seconds of opening the home page.
- **SC-003**: The footer is present and contains working links to kro.run and the
  kro GitHub repo on 100% of pages — zero pages are missing the footer.
- **SC-004**: The zero-RGD empty state correctly distinguishes between "loading"
  and "confirmed zero" in 100% of cases — zero instances of the empty state
  appearing during an active data load.
- **SC-005**: All new UI elements pass visual consistency checks — zero new
  hardcoded colour or spacing values outside the design system tokens.

## Assumptions

- The tagline copy is: _"kro-ui — Kubernetes ResourceGraphDefinition dashboard"_
  and the description is: _"Visualise, debug, and manage kro ResourceGraphDefinitions
  and their instances across your clusters."_ These are starting defaults; copy
  can be refined without a spec change.
- The zero-RGD empty state kubectl snippets link to the official kro documentation
  for install instructions rather than embedding a specific Helm chart version —
  this prevents the snippet from becoming stale as kro releases new versions.
- The footer contains the kro-ui version string (already available via the version
  endpoint) alongside the external links, so users and support can quickly identify
  which version is running.
- The footer is a minimal, low-profile component — not a full site footer with
  multiple columns. A single line with 2–3 links and the version string is
  sufficient for this spec.
- The tagline and description are displayed on the home page header only, not
  repeated on every page. The footer serves as the persistent cross-page identity
  signal.
- "Every page" in FR-010 means every route rendered by the SPA router, including
  the 404 catch-all. It does not mean every modal or drawer.
