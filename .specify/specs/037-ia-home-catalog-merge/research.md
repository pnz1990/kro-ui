# Research: 037-ia-home-catalog-merge

**Phase 0 research — all unknowns resolved**

---

## Question 1: Merge vs Distinguish (Option A vs B)?

**Decision**: Option A — Distinguish (rename/reframe with subtitles)

**Rationale**:
- The two pages already have meaningfully different data and workflows.
  Home is operational (MetricsStrip, HealthChip, terminating badges, abort-safe
  health fetch per card). Catalog is exploratory (sort, label filter, instance
  counts as prop, chaining map, "Used by" rows).
- Merging them into a tab pattern would either (a) require a bloated mega-card
  that conditionally shows or hides health chip / instance count / label pills,
  or (b) require two separate card components rendered inside the same page with
  a tab toggle — recreating the current problem with more complexity.
- The constitution (§I Iterative-First, §V Simplicity Over Cleverness) favors
  the minimal change: rename + subtitle addition.
- Tab-based single-page patterns create URL addressability problems (tab state
  must be in the URL or it is not bookmarkable). Adding a `?view=` param is
  technically workable but adds incidental complexity that this spec explicitly
  does not need.

**Alternatives considered**:
- Option B (merge + tab): rejected (see above and spec.md)
- Option C (remove Catalog, merge its features into Home): rejected — Catalog
  has richer discovery features (sort, label filter, chaining) that belong in
  a separate browsing surface. Home is a status board.
- Option D (remove Home, keep only Catalog): rejected — the MetricsStrip and
  HealthChip features serve a fundamentally different use case (incident
  response / operational health) than browsing.

---

## Question 2: What label/heading for the Home page?

**Decision**: "Overview"

**Rationale**:
- "Overview" is the standard label for operational health dashboards in
  infrastructure tooling (Grafana, ArgoCD, Flux all use "Overview" for their
  primary health surface).
- "Dashboard" is overloaded and often implies configurable widgets.
- "Home" is generic and conveys no functional meaning. The nav link saying
  "Home" gives users no signal about what they'll find there.
- "Status" is accurate but implies a secondary/auxiliary page.

**Alternatives considered**:
- "Dashboard": too generic, implies customization widgets
- "Status": accurate but sounds secondary
- "Health": accurate but narrows scope too early (also shows RGD list)
- Keeping "Home": no information value; confirms the problem that prompted this spec

---

## Question 3: What subtitle text for each page?

**Decision**:
- Overview: `"Controller and RGD health at a glance"`
- Catalog: `"Browse, filter, and discover all ResourceGraphDefinitions"`

**Rationale**:
- Overview subtitle anchors the operational-health mental model; reinforces
  why MetricsStrip is shown first.
- Catalog subtitle explicitly names the browsing/discovery purpose; reinforces
  why sort + label filter are present.
- Both subtitles are factually accurate and scannable in one line.

**Alternatives considered**:
- Longer explanatory text: unnecessary — the page content is self-explanatory.
- No subtitle: less bad than the current state (just "RGDs" heading) but still
  doesn't differentiate the pages.

---

## Question 4: Should the URL `/` change?

**Decision**: No. URL stays `/`. The rename is a copy-only change.

**Rationale**:
- Changing the URL would break existing bookmarks, curl scripts, and any
  infrastructure tooling that links directly to `/`.
- The mental model fix is in the nav label and heading, not the URL.
- React Router's `NavLink` with `end` prop already handles active-state
  correctly for `/`.

---

## Question 5: Does this require any backend changes?

**Decision**: No backend changes.

**Rationale**:
- This spec is purely a UI copy/label change. The backend API is unchanged.
- No new endpoints, no new Go files, no changes to handler or k8s layer.

---

## Question 6: Which E2E tests are affected?

**Decision**: Two E2E journey files need assertion updates.

**Files**:
1. `test/e2e/journeys/002-home-page.spec.ts` — asserts heading, page title,
   and (likely) nav link text. All three assertions change.
2. `test/e2e/journeys/015-rgd-catalog.spec.ts` — if it navigates to Catalog
   via the "Catalog" nav link, it is unaffected. If it first checks or clicks
   the "Home"/"Overview" nav link, it needs updating.

**Approach**: Read each test file and update only the specific assertion strings,
not the test structure or selectors.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| Merge or distinguish? | Distinguish (Option A) |
| New home label | "Overview" |
| Subtitle text (home) | "Controller and RGD health at a glance" |
| Subtitle text (catalog) | "Browse, filter, and discover all ResourceGraphDefinitions" |
| URL changes? | None |
| Backend changes? | None |
| Affected E2E tests | 002-home-page.spec.ts, possibly 015-rgd-catalog.spec.ts |
| New CSS tokens needed? | No — existing `--color-text-muted` + `--font-sans` cover subtitles |
| New components? | No |
| New dependencies? | None |
