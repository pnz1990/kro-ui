# Feature Specification: Overview Page Revamp — Single-Cluster SRE Executive Dashboard

**Feature Branch**: `062-overview-sre-dashboard`
**Created**: 2026-04-01
**Status**: Draft
**GH Issue**: #397

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Instant Cluster Health Assessment (Priority: P1)

An SRE opens the Overview page first thing in the morning or when an on-call alert fires. Within seconds they can see whether the cluster is healthy, how many instances are in error or stuck reconciling, and whether any RGDs have compile problems — without navigating to multiple pages or running kubectl commands.

**Why this priority**: This is the primary reason the page exists. All other widgets support this core use case. Without this, the page delivers no value.

**Independent Test**: Load Overview against a cluster with a mix of healthy, erroring, and reconciling instances. Verify the Instance Health widget shows correct counts and the page answers "is this cluster OK?" without further navigation.

**Acceptance Scenarios**:

1. **Given** a cluster with 50 instances (40 ready, 5 error, 3 reconciling, 2 unknown), **When** the SRE opens Overview, **Then** the Instance Health widget displays all four counts correctly within one page load.
2. **Given** a fresh page load, **When** data is still fetching, **Then** each widget shows a shimmer skeleton so the page never appears blank.
3. **Given** a cluster where all instances are healthy, **When** the SRE opens Overview, **Then** no error or warning indicators are visible and the page communicates "all clear" unambiguously.

---

### User Story 2 — Manual Refresh to Get Current State (Priority: P1)

An SRE sees stale data (e.g. "Updated 8m ago") and wants the current cluster state after a deployment. They click Refresh and all widgets update in parallel.

**Why this priority**: Without a working refresh, the snapshot model is broken and users must navigate away and back — worse than background polling.

**Independent Test**: Click Refresh; verify "Updated X ago" resets to "just now" and all widgets re-render with fresh data.

**Acceptance Scenarios**:

1. **Given** data loaded 5 minutes ago, **When** the SRE clicks ↻ Refresh, **Then** all widgets enter loading state simultaneously, re-fetch in parallel, and "Updated X ago" resets to "Updated just now" on completion.
2. **Given** the SRE clicks Refresh, **When** one data source fails (e.g. events endpoint), **Then** the failed widget shows an inline "⚠ Could not load" error with a Retry link while all other widgets update successfully.
3. **Given** a Refresh is already in flight, **When** the SRE clicks Refresh again, **Then** the button is disabled (spinner shown) and no second fetch is started.

---

### User Story 3 — Identify and Navigate to Problem RGDs (Priority: P2)

An SRE sees 7 instances in error. They use the Top Erroring RGDs widget to identify which RGD has the most failing instances, then click through to that RGD's Instances tab.

**Why this priority**: The health summary tells you *that* something is wrong; this story tells you *where*. It makes the dashboard actionable, not just informational.

**Independent Test**: With 3 RGDs having different numbers of error instances, verify Top Erroring RGDs ranks them correctly and each row links to the correct RGD instances tab.

**Acceptance Scenarios**:

1. **Given** RGDs with 5, 2, and 1 error instances, **When** the SRE views the Top Erroring RGDs widget, **Then** the list is sorted descending (5 first) with a proportional bar relative to the maximum.
2. **Given** the SRE clicks an RGD name in the widget, **When** the navigation completes, **Then** they land on `/rgds/{name}?tab=instances`.
3. **Given** all instances are healthy, **When** the widget renders, **Then** it shows "No instance errors" empty state.

---

### User Story 4 — Spot Stuck Reconciliations (Priority: P2)

A DevOps engineer notices a high reconciling count. They check the Reconciling Queue widget to see how many have been in-progress for over 5 minutes, and the Recent Activity "May Be Stuck" panel to identify specific instances.

**Why this priority**: Stuck reconciliations are a common kro operational issue. Proactive surfacing reduces MTTR.

**Independent Test**: With 3 IN_PROGRESS instances — one created 1 minute ago, two created 10 minutes ago — verify the queue widget shows "2 may be stuck > 5 min" in amber and the Recent Activity panel lists the two older instances first.

**Acceptance Scenarios**:

1. **Given** 5 reconciling instances, 2 created > 5 min ago, **When** the SRE views W-4, **Then** the large count shows 5 and the secondary line shows "2 may be stuck > 5 min" in amber.
2. **Given** 0 reconciling instances, **When** the SRE views W-4, **Then** the widget shows "✓ No instances reconciling" in green with no amber secondary line.
3. **Given** stuck reconciling instances in W-7's "May Be Stuck" panel, **When** the SRE clicks a row, **Then** they navigate to the instance detail page.

---

### User Story 5 — Switch Between Grid and Bento Layouts (Priority: P3)

A DevOps engineer prefers a layout where the health donut is dominant. They switch to Bento mode and the layout remembers their preference on subsequent page loads.

**Why this priority**: Layout preference is quality-of-life. The dashboard is fully functional in either mode.

**Independent Test**: Switch to Bento, navigate away, return — verify Bento is still active. Switch to Grid, navigate away, return — verify Grid is active.

**Acceptance Scenarios**:

1. **Given** default Grid mode, **When** the SRE clicks "Bento", **Then** the layout immediately changes to the asymmetric bento grid with W-1 spanning the left 60%.
2. **Given** Bento mode is active, **When** the SRE navigates to Catalog and back to Overview, **Then** Bento mode is still active.
3. **Given** no stored preference, **When** the SRE opens Overview for the first time, **Then** Grid mode is active.

---

### User Story 6 — Switch Health Chart Between Bar and Donut (Priority: P3)

An SRE prefers visual proportion over numbers and switches the health visualization to donut mode. Their preference persists across page navigations.

**Why this priority**: Chart type preference is quality-of-life, orthogonal to the core health data.

**Independent Test**: Toggle to donut, navigate away, return — verify donut is shown. Toggle to bar, navigate away, return — verify bar is shown.

**Acceptance Scenarios**:

1. **Given** bar mode (default), **When** the SRE clicks the donut toggle, **Then** the segmented bar is replaced by an SVG donut chart showing the same state proportions.
2. **Given** the donut chart renders, **When** the SRE inspects the visualization, **Then** no external chart library is used and all colors use design tokens.
3. **Given** donut mode is active, **When** the SRE navigates away and returns, **Then** donut mode is still active.

---

### Edge Cases

- What happens when the cluster has zero RGDs? — W-1, W-3, W-5 show empty states; W-2, W-6 still render from their independent data sources. An onboarding-friendly note links to RGD Designer.
- What happens when the kro metrics endpoint is unreachable? — W-2 shows an inline error; all other widgets are unaffected.
- What happens when the events endpoint returns an empty list? — W-6 shows "No recent kro events" empty state (not an error).
- What happens when `creationTimestamp` is missing from an instance? — That instance is excluded from the "may be stuck" heuristic but still counted in the health distribution.
- What happens on a very narrow viewport (< 768px)? — Grid mode collapses to 1 column; Bento mode collapses to a single vertical stack; the layout toggle remains accessible.
- What happens if `localStorage` is unavailable? — Layout defaults to Grid and chart defaults to Bar; no error is surfaced to the user.
- What happens if Refresh is triggered while data is already loading? — Refresh button is disabled; no concurrent fetch is started.
- What happens with 0 instances and 0 RGDs (brand-new cluster)? — An onboarding empty state is shown with a link to RGD Designer.

---

## Requirements *(mandatory)*

### Functional Requirements

**Page-level**

- **FR-001**: The Overview page MUST replace the current RGD card grid with a dashboard of 7 widgets focused on cluster health observability.
- **FR-002**: The page MUST NOT render the `VirtualGrid` of `RGDCard` components anywhere.
- **FR-003**: The page MUST NOT render the `MetricsStrip` component at the top of the page; controller metrics data MUST be displayed inside W-2 instead.
- **FR-004**: The page MUST fetch all data sources once on mount and expose a manual Refresh button that re-fetches all sources in parallel.
- **FR-005**: The page MUST display an "Updated X ago" staleness label that reflects time since the last successful fetch.
- **FR-006**: The Refresh button MUST be disabled and show a loading indicator while any fetch is in progress.
- **FR-007**: When a Refresh attempt includes at least one failed data source, the staleness label MUST read "Last attempt failed — data may be stale".

**Layout**

- **FR-008**: The page MUST support two layout modes: Grid (3-column responsive, default) and Bento (asymmetric, W-1 dominant).
- **FR-009**: The active layout mode MUST be persisted across page navigations and restored on return.
- **FR-010**: When preference storage is unavailable, the page MUST default to Grid mode without surfacing an error.
- **FR-011**: In Grid mode, W-1 MUST span 2 columns on viewports wide enough to display 3 columns.

**W-1 — Instance Health**

- **FR-012**: W-1 MUST aggregate health state from all CR instances across all namespaces using the existing instances endpoint.
- **FR-013**: W-1 MUST apply this health mapping: `IN_PROGRESS` state → reconciling; ready condition True → ready; ready condition False → error; otherwise → unknown.
- **FR-014**: W-1 MUST display the total instance count prominently alongside per-state counts for every non-zero state.
- **FR-015**: W-1 MUST support two chart modes — segmented horizontal bar and SVG donut — toggled by a control within the widget.
- **FR-016**: The active chart mode MUST be persisted across page navigations and restored on return.
- **FR-017**: The SVG donut MUST be implemented without any external chart or visualization library.
- **FR-018**: All donut segment colors MUST use design token CSS custom properties — no hardcoded color values.
- **FR-019**: Donut segments MUST be ordered worst-first starting at 12 o'clock: error → degraded → reconciling → pending → unknown → ready.
- **FR-020**: When total instances = 0, W-1 MUST display "No instances found" as a neutral empty state.

**W-2 — Controller Metrics**

- **FR-021**: W-2 MUST display the 4 controller metrics: active watches, GVRs served, kro queue depth, client-go queue depth.
- **FR-022**: W-2 MUST display the kro version as a secondary footer line within the widget.
- **FR-023**: W-2 MUST NOT reuse the existing MetricsStrip component.

**W-3 — RGD Compile Errors**

- **FR-024**: W-3 MUST count RGDs in error state from the RGD list.
- **FR-025**: When error count > 0, W-3 MUST show a scrollable list of erroring RGD names with truncated error messages, each linking to that RGD's detail page.
- **FR-026**: When error count = 0, W-3 MUST show a positive confirmation message in green.

**W-4 — Reconciling Queue**

- **FR-027**: W-4 MUST show the total count of actively reconciling instances using data already fetched for W-1.
- **FR-028**: W-4 MUST show a secondary count of instances that may be stuck, defined as IN_PROGRESS with a creation timestamp more than 5 minutes in the past.
- **FR-029**: The "may be stuck" count MUST be styled in amber only when greater than zero.
- **FR-030**: The label MUST use "may be stuck" (not "stuck") to communicate the heuristic nature of the threshold.

**W-5 — Top Erroring RGDs**

- **FR-031**: W-5 MUST group error-state instances by RGD, sort by error count descending, and display the top 5.
- **FR-032**: Each row MUST include a relative bar proportional to the highest error count in the list.
- **FR-033**: Each row MUST link to that RGD's instances tab.
- **FR-034**: When no error instances exist, W-5 MUST display "No instance errors" as an empty state.

**W-6 — Recent Events**

- **FR-035**: W-6 MUST fetch the 10 most recent kro events cluster-wide with no namespace or RGD filter.
- **FR-036**: Events MUST be displayed newest-first.
- **FR-037**: Each row MUST show: relative timestamp, reason, involved object name (truncated to 40 characters with full text on hover), and message (truncated to 80 characters with full text on hover).
- **FR-038**: Each row MUST carry a visual badge: Warning → amber; condition-transition (reason matches `/condition/i`) → green; Normal → muted.
- **FR-039**: W-6 MUST include a "View all events →" footer link to the Events page.

**W-7 — Recent Activity**

- **FR-040**: W-7 MUST display two side-by-side panels using instance data already fetched for W-1.
- **FR-041**: "Recently Created" MUST show the 5 most recently created instances sorted newest-first, each linking to the instance detail page.
- **FR-042**: "May Be Stuck" MUST show the 5 oldest IN_PROGRESS instances sorted oldest-first, each linking to the instance detail page.
- **FR-043**: When no IN_PROGRESS instances exist, the "May Be Stuck" panel MUST show a positive empty state.

**Loading and error states**

- **FR-044**: Every widget MUST independently show a shimmer skeleton while its data source is fetching.
- **FR-045**: Every widget MUST show an inline error with a Retry action when its data source fails, without triggering a full-page error.
- **FR-046**: A full-page error panel MUST be shown only when both the RGD list AND the instances list fail simultaneously.

**Unchanged pages**

- **FR-047**: The Catalog page MUST remain completely unchanged by this feature.

### Key Entities

- **Instance Summary**: a live CR instance with name, namespace, kind, RGD name, kro state string, ready condition value, optional error message, and creation timestamp.
- **Health State**: one of six values — ready, degraded, reconciling, error, pending, unknown — derived from an Instance Summary's state and ready fields.
- **Health Distribution**: aggregate counts per Health State across all instances in the selected cluster.
- **Widget**: a self-contained dashboard card with a title, independent loading state, independent error state, and content area.
- **Layout Mode**: Grid or Bento — controls spatial arrangement of the 7 widgets on the page.
- **Chart Mode**: Bar or Donut — controls how W-1 visualizes the Health Distribution.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An SRE can determine whether the cluster has any errors, reconciling instances, or compile problems without scrolling on a standard 1440px-wide screen — all critical indicators are visible in the initial viewport.
- **SC-002**: The full page loads and all 7 widgets are populated within the same time budget as the current Overview page, given no new backend endpoints are introduced.
- **SC-003**: Clicking Refresh causes all widgets to display updated data within the same time as a fresh page load.
- **SC-004**: An SRE can navigate from the Overview health summary to the specific erroring RGD's instances tab in at most 2 clicks.
- **SC-005**: Layout mode and chart type preferences survive at least 10 round-trip navigations away from and back to the Overview page.
- **SC-006**: The Overview and Catalog pages are clearly distinct in purpose — one is an operational health dashboard, the other a browsable RGD directory — eliminating the current confusion where both pages display an RGD card grid.
- **SC-007**: All existing automated tests continue to pass; new test coverage for the Overview page includes at minimum the health state mapping logic and per-widget loading/error states.

---

## Assumptions

- The existing instances endpoint returns all instances across all namespaces with sufficient data (state, ready, creationTimestamp, rgdName) to compute health states without new backend changes.
- `buildErrorHint` is exported from `RGDCard.tsx` and importable directly in W-3.
- The 5-minute "may be stuck" threshold uses `creationTimestamp` as a proxy for reconcile start time. This is a heuristic: a brand-new instance created 6 minutes ago but reconciling normally will appear in the "may be stuck" count. The label communicates this intentionally.
- Preference storage failure (private browsing, quota exceeded) is handled silently by falling back to defaults — Grid layout and Bar chart.
- The SVG donut does not require entry animation for v1; a static rendering is sufficient.
- "Degraded" instances (CR ready but a child resource has errors) cannot be detected from InstanceSummary alone, since child-resource-level data requires a separate per-instance fetch. Instances that would be degraded at full fidelity appear as "ready" in W-1. This known limitation is documented in the widget footer.
- W-6 shows the 10 most recent events as returned by the API; no client-side pagination is required for v1.

---

## Out of Scope

- No new backend API endpoints
- No multi-cluster or fleet-level aggregation (Fleet page handles that)
- No URL parameter persistence for layout or chart type
- No real-time streaming or background polling (snapshot + manual refresh only)
- No RGD card grid on the Overview page (Catalog owns that)
- No entry animation on SVG donut segments (v1)
- Degraded-state detection at child-resource granularity from Overview (deferred — requires per-instance children fetch)
- #395 C-01 kro field path refactor (separate issue)
