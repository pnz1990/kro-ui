# Quickstart: 037-ia-home-catalog-merge

## What this spec changes

A targeted UI copy + labeling change that differentiates the Home and Catalog
pages with clear, distinct purposes.

**3 source file changes + 2 E2E test assertion updates.**

---

## Prerequisites

- Node.js / Bun installed (for `bun run typecheck` and frontend build)
- Go 1.25 installed (for `go vet`, `go test -race`)
- Working kro-ui dev environment

---

## Step-by-step implementation

### 1. Update Home page copy (`web/src/pages/Home.tsx`)

Three changes in one file:

```diff
- usePageTitle('RGDs')
+ usePageTitle('Overview')

- <h1 className="home__heading">RGDs</h1>
+ <h1 className="home__heading">Overview</h1>

- <p className="home__tagline">
-   ResourceGraphDefinitions — kro observability dashboard
- </p>
+ <p className="home__tagline">
+   Controller and RGD health at a glance
+ </p>
```

### 2. Update TopBar nav label (`web/src/components/TopBar.tsx`)

One string change:

```diff
- <NavLink to="/" end ...>Home</NavLink>
+ <NavLink to="/" end ...>Overview</NavLink>
```

### 3. Add Catalog subtitle (`web/src/pages/Catalog.tsx`)

Add a `<p>` subtitle element below the `<h1>`:

```diff
  <h1 className="catalog__heading">RGD Catalog</h1>
+ <p className="catalog__subtitle">
+   Browse, filter, and discover all ResourceGraphDefinitions
+ </p>
```

### 4. Style the Catalog subtitle (`web/src/pages/Catalog.css`)

Add the `.catalog__subtitle` rule using existing tokens:

```css
.catalog__subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
```

### 5. Update E2E assertions

In `test/e2e/journeys/002-home-page.spec.ts`:
- Change heading assertion from `"RGDs"` to `"Overview"`
- Change page title assertion from `"RGDs — kro-ui"` to `"Overview — kro-ui"`
- Change nav link text assertion from `"Home"` to `"Overview"` (if present)

In `test/e2e/journeys/015-rgd-catalog.spec.ts`:
- Change nav link text assertion from `"Home"` to `"Overview"` (if present)

---

## Verification

```bash
# TypeScript check
bun run typecheck

# Go check (no Go changes, but run anyway for CI parity)
GOPROXY=direct GONOSUMDB="*" go vet ./...

# Unit tests
GOPROXY=direct GONOSUMDB="*" go test -race ./...

# Frontend dev server (manual visual check)
bun run dev
```

Navigate to `http://localhost:5173`:
1. TopBar nav shows "Overview" (not "Home")
2. Home page `<h1>` reads "Overview"
3. Home page subtitle reads "Controller and RGD health at a glance"
4. MetricsStrip still renders at top of home page
5. Navigate to `/catalog` — heading still reads "RGD Catalog"
6. Catalog subtitle reads "Browse, filter, and discover all ResourceGraphDefinitions"
7. Catalog sort, label filter, and chaining features all still work

---

## Risk Assessment

**Risk**: Low. This is a copy-only change.

- No new components
- No new API calls
- No routing changes
- No data model changes
- No backend changes
- Rollback: trivially revert the 2 source files + 2 test files
