# Data Model: 037-ia-home-catalog-merge

This spec introduces no new data entities, no new API types, and no new state
structures. It is a UI copy and labeling change only.

---

## Entities (unchanged)

All existing entities are unchanged. This spec does not add, remove, or modify
any data structures.

| Entity | Owner | Changed? |
|--------|-------|---------|
| `K8sObject` (`lib/api.ts`) | api layer | No |
| `HealthSummary` (`lib/format.ts`) | format lib | No |
| `SortOption` (`lib/catalog.ts`) | catalog lib | No |
| `KubeContext` (`lib/api.ts`) | api layer | No |

---

## Component Props (unchanged)

No component interfaces are modified.

| Component | Props interface | Changed? |
|-----------|----------------|---------|
| `RGDCard` | `{ rgd, terminatingCount? }` | No |
| `CatalogCard` | `{ rgd, instanceCount, usedBy, onLabelClick }` | No |
| `TopBar` | `{ contexts, activeContext, onSwitch }` | No |
| `MetricsStrip` | none | No |

---

## Page State (unchanged)

No new React state is introduced on any page.

---

## UI Copy Changes (the actual "model" for this spec)

These are the only changes in this spec.

| Location | Property | Old Value | New Value |
|----------|----------|-----------|-----------|
| `Home.tsx` | `usePageTitle()` arg | `'RGDs'` | `'Overview'` |
| `Home.tsx` | `<h1>` text | `RGDs` | `Overview` |
| `Home.tsx` | `.home__tagline` text | `"ResourceGraphDefinitions — kro observability dashboard"` | `"Controller and RGD health at a glance"` |
| `TopBar.tsx` | NavLink label for `/` | `Home` | `Overview` |
| `Catalog.tsx` | subtitle `<p>` (new element) | *(absent)* | `"Browse, filter, and discover all ResourceGraphDefinitions"` |

---

## CSS Classes (additions only)

| File | Class | Purpose |
|------|-------|---------|
| `Catalog.css` | `.catalog__subtitle` (new) | Styles the new subtitle `<p>` on the Catalog page |

No existing CSS classes are renamed or removed.
The `.home__tagline` class in `Home.css` requires no structural change —
only the text content inside it changes (in `Home.tsx`).

---

## E2E Assertion Strings

| File | Assertion | Old string | New string |
|------|-----------|-----------|-----------|
| `002-home-page.spec.ts` | heading | `"RGDs"` | `"Overview"` |
| `002-home-page.spec.ts` | page title | `"RGDs — kro-ui"` | `"Overview — kro-ui"` |
| `002-home-page.spec.ts` | nav link | `"Home"` | `"Overview"` |
| `015-rgd-catalog.spec.ts` | nav link | `"Home"` (if present) | `"Overview"` |
