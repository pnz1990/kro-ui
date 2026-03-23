# Data Model: 033-first-time-onboarding

**Phase 1 output** | Branch: `033-first-time-onboarding`

---

## Overview

This feature is purely presentational — it introduces no new data entities,
no new API calls (other than the existing `/api/v1/version` read), and no
persistent state. The "data" in scope is:

1. **App version string** — fetched from `/api/v1/version`, displayed in footer
2. **RGD list emptiness** — already available from the existing `items` state in `Home.tsx`

---

## Entities

### 1. `Footer` component state

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `version` | `string \| null` | `GET /api/v1/version` | `null` if request fails; display omitted gracefully |

**State transitions**: `null` (initial) → fetching → `string` (resolved) | `null` (on error, stays null).

**Validation**: None. Version is display-only; no user input.

### 2. `Home.tsx` empty-state (no new state)

The empty state condition is already derived from existing state:
```ts
// Already in Home.tsx
const isEmpty = !isLoading && error === null && items.length === 0
const isSearchEmpty = debouncedQuery.trim() !== '' && filteredItems.length === 0
```

No new state fields are introduced in `Home.tsx`.

---

## API Types (existing, referenced)

### `GET /api/v1/version` response

```ts
// Already defined in web/src/lib/api.ts (or equivalent)
interface VersionResponse {
  version: string   // e.g. "v0.2.1"
  commit?: string   // optional git SHA
  buildDate?: string
}
```

This type is read-only (consumed by `Footer`). If not yet exported from
`@/lib/api`, it will be added there.

---

## Component Props Contracts

### `Footer` component

```ts
// web/src/components/Footer.tsx
// No required props — Footer fetches version internally
interface FooterProps {}
```

Internally fetches version on mount. Renders unconditionally (static links
are always shown; version is shown only when resolved).

### `Home.tsx` empty-state JSX (inline, not a component)

The empty-state JSX block receives no props — it closes over `debouncedQuery`
and `setQuery` from the parent component scope, identical to the current pattern.

---

## File Inventory

| File | Status | Purpose |
|------|--------|---------|
| `web/src/components/Footer.tsx` | NEW | Site-wide footer component |
| `web/src/components/Footer.css` | NEW | Footer styles (tokens only) |
| `web/src/components/Layout.tsx` | MODIFIED | Mount `<Footer />` below `<main>` |
| `web/src/pages/Home.tsx` | MODIFIED | Richer empty-state + home tagline |
| `web/src/pages/Home.css` | MODIFIED | Empty-state styles (if not already adequate) |
| `web/src/tokens.css` | POSSIBLY MODIFIED | Only if a new token is needed (research says unlikely) |
| `web/src/lib/api.ts` | POSSIBLY MODIFIED | Export `VersionResponse` type + `getVersion()` if not present |

---

## Rendering Logic

### Footer rendering decision tree

```
Footer mounts
  → fetch GET /api/v1/version
    ├── success → display "v{version}" in footer
    └── error   → omit version display (no error state shown)
  → always render:
      © {year} kro-ui contributors
      [kro.run] [GitHub] links
```

### Home empty-state decision tree

```
Home renders
  ├── isLoading=true      → skeleton grid (unchanged)
  ├── error !== null      → error + Retry (unchanged)
  └── else
      ├── items.length > 0
      │   └── filteredItems.length > 0  → VirtualGrid with cards (unchanged)
      │   └── filteredItems.length = 0  → "No results for query" + Clear (unchanged)
      └── items.length = 0
          └── ENHANCED empty-state:
                "kro-ui — observability dashboard for kro"
                description of kro + RGDs
                kubectl install snippet
                CTA links: [kro docs] [kro on GitHub]
```

### Home tagline placement

A `<p class="home__tagline">` element is added in the `home__header` block,
visible only when `items.length === 0 && !isLoading && error === null`, OR
always (to orient returning users too). Research decision: show tagline only
in the empty state (as part of the empty-state block) to avoid cluttering the
header when the grid has content.
