# Implementation Plan: RGD List Virtualization

**Branch**: `024-rgd-list-virtualization` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-rgd-list-virtualization/spec.md`

## Summary

Replace the flat `Array.map()` card render on the Home page and Catalog page
with a scroll-windowed virtual grid that keeps the DOM node count bounded
regardless of total RGD count (target: 5,000+). Add a reusable `useDebounce`
hook and wire it into the Catalog search input (and a new search input on the
Home page if desired). Update the constitution's §XIII scale requirement from
100+ to 5,000+ RGDs.

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19, Go 1.25 (backend unchanged)
**Primary Dependencies**: React 19, React Router v7, Vite 8 — no new npm packages
**Storage**: N/A — client-side in-memory list derived from a single API call
**Testing**: Vitest (unit: pure functions, hook behaviour); Playwright E2E (journey test for Home and Catalog at large list sizes)
**Target Platform**: Modern browser (Chrome, Firefox, Safari); dark-mode default; works offline (embedded binary)
**Project Type**: Web application (React SPA embedded in Go binary)
**Performance Goals**: Page interactive ≤ 2 s after API response; filter result visible ≤ 100 ms after debounce fires; scroll frame rate ≥ 30 fps on 5,000-item list
**Constraints**: No external virtual-scroll libraries (constitution §V); no CSS frameworks; plain CSS with tokens; cards wrap in CSS Grid (`auto-fill, minmax(320px, 1fr)`) — grid layout means rows contain multiple cards, so virtualization must be row-aware
**Scale/Scope**: 5,000+ RGDs; affects 2 pages (Home, Catalog); 1 new hook; 1 new component (`VirtualGrid`); constitution amendment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Applies? | Status | Notes |
|------|----------|--------|-------|
| §I Iterative-First | Yes | **PASS** — all prior specs merged; this is additive | |
| §II Cluster Adaptability | Partial | **PASS** — no backend changes; frontend reads `K8sObject[]` unchanged | |
| §III Read-Only | No | **N/A** — no Kubernetes mutations | |
| §IV Single Binary | Yes | **PASS** — no new CDN deps; virtual grid is pure in-repo code | |
| §V Simplicity — no external virtual-scroll lib | Yes | **PASS** — implementing a purpose-built `VirtualGrid` in plain React + CSS; no `react-window`, `react-virtual`, or similar | |
| §V Simplicity — no state management lib | Yes | **PASS** — plain React state + hooks | |
| §V Simplicity — no CSS framework | Yes | **PASS** — extending `tokens.css` and scoped CSS only | |
| §IX / §XIII No hardcoded hex or `rgba()` | Yes | **PASS** — all new styles reference tokens | |
| §XIII Scale requirement update | Yes | **REQUIRED** — FR-010 mandates updating §XIII from 100+ to 5,000+ | |
| §XIII Interactive card — fully clickable | Yes | **PASS** — card click behavior untouched; wrapping div logic unchanged | |
| §XIII Filter UI — actual input controls, not URL-params only | Yes | **PASS** — FR-011 explicitly guards regression | |
| §XIII Tooltip viewport clamping | No | **N/A** — no new tooltips in this feature | |
| §XIII Shared helpers — no copy-paste | Yes | **PASS** — `VirtualGrid` is a single shared component imported by both pages | |
| Anti-pattern: filter UI URL-params only | Yes | **PASS (guard)** — existing Catalog `SearchBar` is a controlled `<input>`; must stay that way | |

**Gate result: PASS. No violations. Proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/024-rgd-list-virtualization/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── virtual-grid-api.md  ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
web/src/
├── tokens.css                      ← (amended) new --virtual-* tokens if needed
├── hooks/
│   ├── useDebounce.ts              ← NEW: pure debounce hook (setTimeout / clearTimeout)
│   ├── useDebounce.test.ts         ← NEW: Vitest unit tests
│   ├── useVirtualGrid.ts           ← NEW: row-aware windowing logic (scroll pos → visible slice)
│   ├── useVirtualGrid.test.ts      ← NEW: Vitest unit tests
│   ├── usePageTitle.ts             ← (unchanged)
│   └── usePolling.ts               ← (unchanged)
├── components/
│   ├── VirtualGrid.tsx             ← NEW: generic windowed grid component
│   ├── VirtualGrid.css             ← NEW: scoped styles (spacer divs for scroll height)
│   ├── RGDCard.tsx / .css          ← (unchanged)
│   ├── CatalogCard.tsx / .css      ← (unchanged)
│   └── SearchBar.tsx / .css        ← (unchanged — debounce wired at call-site in pages)
├── pages/
│   ├── Home.tsx                    ← AMENDED: replace items.map() with <VirtualGrid>; add search state + useDebounce
│   ├── Home.css                    ← AMENDED: remove .home__grid (moved to VirtualGrid); add search bar styles if Home gets one
│   ├── Catalog.tsx                 ← AMENDED: replace sorted.map() with <VirtualGrid>; wire useDebounce into searchQuery
│   └── Catalog.css                 ← AMENDED: remove .catalog__grid (moved to VirtualGrid)
└── lib/
    └── (no changes)

.specify/memory/constitution.md      ← AMENDED: §XIII scale 100+ → 5,000+ RGDs
```

**Structure Decision**: Single-project web-app layout. All changes are confined to
`web/src/`. No backend changes required — the API already returns the full list
and the client holds it in memory. The new `VirtualGrid` component + two hooks
(`useDebounce`, `useVirtualGrid`) are the sole new source files.

## Complexity Tracking

No constitution violations. No complexity justification required.
