# Spec 037 — IA: Home & Catalog Differentiation

**Branch**: `037-ia-home-catalog-merge`
**GH Issue**: #163
**Created**: 2026-03-24
**Status**: Draft

---

## Problem Statement

Both the Home (`/`) and Catalog (`/catalog`) pages display the same list of
ResourceGraphDefinitions in a card grid with a search bar. Despite having
meaningfully different data and use-cases, they are visually indistinguishable
at first glance. A first-time user has no mental model for why both pages exist,
and an experienced user has to remember which page has sort, label filter,
instance counts, or health chips.

**Observed duplication:**
- Both pages call `listRGDs()` + `listInstances()` fan-out on mount
- Both use `SearchBar` + `VirtualGrid` + `matchesSearch()`
- Both show an RGD card grid with name, kind, resource count, age

**Hidden differentiation (invisible without reading docs):**

| Feature | Home (`/`) | Catalog (`/catalog`) |
|---|---|---|
| Controller metrics strip | ✓ | ✗ |
| Instance health chips (HealthChip) | ✓ | ✗ |
| Terminating instance badge | ✓ | ✗ |
| Label filter (multi-select AND) | ✗ | ✓ |
| Sort controls (5 options) | ✗ | ✓ |
| Instance count per card | ✗ | ✓ |
| "Used by" chaining rows | ✗ | ✓ |

---

## IA Decision: Option A — Distinguish Clearly

Two options were evaluated. Option A is chosen.

### Option B (Merge — REJECTED)

Merge both pages into one, with a tab/toggle between "Overview" and "Catalog"
views.

**Rejected because:**
- The two views have fundamentally different primary jobs: operational health
  monitoring vs. browsing/discovery. Tabs imply equivalence.
- Merging requires reconciling `RGDCard` (130 px, health chip, terminating
  badge, abort-safe health fetch) with `CatalogCard` (160 px, label pills,
  "Used by", instance count prop), either creating a bloated mega-card or losing
  capabilities.
- Violates the constitution §I (Iterative-First): a merge is a larger, riskier
  change than a rename + subtitle.
- Adds state complexity: a tab toggle on a URL-addressable resource listing is
  not bookmarkable without URL params, which creates hidden coupling.

### Option A (Distinguish — CHOSEN)

Keep both pages. Rename/reframe them with clear, distinct purposes.

- **Home** (`/`) → rename to **"Overview"** in heading and page title
  - Primary job: operational health dashboard
  - Lead with `MetricsStrip` (controller health)
  - Show instance health chips and terminating badges on cards
  - Add a subtitle: "Controller and RGD health at a glance"
  - No sort controls, no label filter — this is a status board, not a directory

- **Catalog** (`/catalog`) → keep as **"RGD Catalog"**
  - Primary job: browsing and discovery
  - Full search, label filter, sort
  - Instance counts, "Used by" chaining
  - Add a subtitle: "Browse, filter, and discover all ResourceGraphDefinitions"

- **Navigation**: rename the "Home" nav link to "Overview" in `TopBar.tsx`
  - The nav label change anchors the mental model in the navigation bar
  - "Home" (generic) → "Overview" (functional label)

---

## Functional Requirements

### FR-001 — Home page heading and title
The Home page (`/`) MUST:
- Display `<h1>Overview</h1>` (replaces "RGDs")
- Display `document.title = "Overview — kro-ui"` (replaces "RGDs — kro-ui")
- Display a subtitle below the heading: "Controller and RGD health at a glance"

### FR-002 — Home page tagline
The existing `.home__tagline` element MUST be updated to:
`"Controller and RGD health at a glance"` (replaces the current tagline
`"ResourceGraphDefinitions — kro observability dashboard"`).

### FR-003 — Home empty state
The onboarding empty state heading MUST remain "No ResourceGraphDefinitions
found". The descriptive text and CTA links are unchanged.

### FR-004 — Catalog heading (unchanged)
The Catalog page (`/catalog`) heading remains `RGD Catalog`. No change to its
title, subtitle, or toolbar. A descriptive subtitle SHOULD be added below the
heading: "Browse, filter, and discover all ResourceGraphDefinitions".

### FR-005 — TopBar nav label
The navigation link pointing to `/` in `TopBar.tsx` MUST be relabeled from
`Home` to `Overview`.

### FR-006 — Document title for Overview
`usePageTitle('Overview')` replaces `usePageTitle('RGDs')` in `Home.tsx`.

### FR-007 — E2E journey update
The E2E test for the Home page (`test/e2e/journeys/002-home-page.spec.ts`)
MUST be updated to assert the new heading text "Overview" and page title
"Overview — kro-ui". The nav link assertion MUST look for "Overview" not "Home".

### FR-008 — Catalog E2E journey update
The Catalog E2E test (`test/e2e/journeys/015-rgd-catalog.spec.ts`) MUST be
updated if it references the "Home" nav link or navigates via it.

### FR-009 — Catalog subtitle (optional)
The Catalog page MAY add a subtitle `<p>` below the `<h1>` with the text
"Browse, filter, and discover all ResourceGraphDefinitions" to match the
Overview subtitle treatment. This is a SHOULD, not a MUST.

---

## Non-Functional Requirements

### NFR-001 — No regressions
All existing functionality on both pages MUST continue to work identically.
No RGDCard, CatalogCard, MetricsStrip, HealthChip, LabelFilter, VirtualGrid,
or SearchBar code changes.

### NFR-002 — No new dependencies
No new npm packages or Go modules.

### NFR-003 — CSS tokens only
Any new CSS MUST use only tokens from `web/src/tokens.css`. No hardcoded hex,
rgba, or shadow values.

### NFR-004 — Accessibility
The new subtitle element MUST be a `<p>` tag (not a `<div>`) for correct
document structure. WCAG AA contrast is maintained via existing token colors.

### NFR-005 — No route changes
The URL `/` for Home and `/catalog` for Catalog MUST NOT change. The rename
is a label/copy change only, not a routing change. Existing bookmarks continue
to work.

---

## Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | Home page `<h1>` reads "Overview" |
| AC-002 | Home page `document.title` is "Overview — kro-ui" |
| AC-003 | Home page has a visible subtitle "Controller and RGD health at a glance" |
| AC-004 | TopBar nav link for `/` reads "Overview" (not "Home") |
| AC-005 | Catalog page `<h1>` still reads "RGD Catalog" |
| AC-006 | Catalog page has a visible subtitle below the heading |
| AC-007 | E2E test `002-home-page.spec.ts` passes with updated assertions |
| AC-008 | E2E test `015-rgd-catalog.spec.ts` passes unchanged (or updated for nav) |
| AC-009 | `go test -race ./...` passes |
| AC-010 | `bun run typecheck` passes |
| AC-011 | All MetricsStrip, HealthChip, and terminating badge features still render on `/` |
| AC-012 | All LabelFilter, sort, instance count, and "Used by" features still render on `/catalog` |

---

## Affected Files

| File | Change |
|------|--------|
| `web/src/pages/Home.tsx` | Heading text, tagline text, `usePageTitle` arg |
| `web/src/components/TopBar.tsx` | Nav link label: "Home" → "Overview" |
| `web/src/pages/Catalog.tsx` | Add subtitle `<p>` below `<h1>` |
| `web/src/pages/Catalog.css` | Add `.catalog__subtitle` style (if needed) |
| `web/src/pages/Home.css` | `.home__tagline` may need update (copy only) |
| `test/e2e/journeys/002-home-page.spec.ts` | Update heading/title/nav assertions |
| `test/e2e/journeys/015-rgd-catalog.spec.ts` | Update nav link assertion if present |

**Explicitly NOT changed:**
- `web/src/main.tsx` (routes stay the same)
- `web/src/components/RGDCard.tsx`
- `web/src/components/CatalogCard.tsx`
- `web/src/components/MetricsStrip.tsx`
- `web/src/components/HealthChip.tsx`
- `web/src/components/LabelFilter.tsx`
- `web/src/components/VirtualGrid.tsx`
- `web/src/components/SearchBar.tsx`
- All backend Go files

---

## Supersedes

Spec `002-rgd-list-home` FR-001 heading text is superseded by FR-001 above.
Spec `015-rgd-catalog` is unchanged and still in effect. The catalog subtitle
(FR-009) is an additive enhancement.
