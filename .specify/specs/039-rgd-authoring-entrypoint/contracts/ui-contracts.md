# UI Contracts: RGD Authoring Global Entrypoint (039)

## Route Contract

| Route | Method | Description |
|-------|--------|-------------|
| `/author` | GET (SPA) | Renders standalone RGD authoring page |

No new backend API endpoints. The `/author` route is a client-side SPA route
handled entirely by React Router. The Go server already returns `index.html`
for all non-API paths via the SPA fallback in `internal/server/server.go`.

---

## Component Interface Contracts

### `AuthorPage` (`web/src/pages/AuthorPage.tsx`)

```typescript
// No props — page-level component
export default function AuthorPage(): JSX.Element
```

**Behavior**:
- Sets `document.title` to `"New RGD — kro-ui"` on mount (via `usePageTitle`)
- Renders `RGDAuthoringForm` + `YAMLPreview` side-by-side
- Initial state: `STARTER_RGD_STATE` (imported from `@/lib/generator`)
- No API calls

---

### `TopBar` — changed signature

```typescript
// No interface changes — TopBar already receives contexts/activeContext/onSwitch
// Internal change: adds a <Link to="/author"> button
export default function TopBar(props: TopBarProps): JSX.Element
```

**New DOM contract**:
```html
<a data-testid="topbar-new-rgd" href="/author" class="top-bar__new-rgd-btn">
  + New RGD
</a>
```
(rendered as React Router `<Link>`, emits `<a>` in the DOM)

---

### Home empty state — changed output

When `items.length === 0` AND `debouncedQuery === ''`:

```html
<div class="home__empty home__empty--onboarding">
  <h2 class="home__empty-title">No ResourceGraphDefinitions found</h2>
  <p class="home__empty-desc">...</p>
  <div class="home__empty-actions">
    <a href="https://kro.run/docs/getting-started" ...>Get started with kro</a>
    <a href="https://github.com/kubernetes-sigs/kro" ...>kro on GitHub</a>
    <!-- NEW -->
    <a data-testid="home-new-rgd-link" href="/author" class="home__empty-cta">
      New RGD
    </a>
  </div>
</div>
```

---

### Catalog zero-items empty state — changed output

When `items.length === 0` (no search/filter active):

```html
<div class="catalog__empty" data-testid="catalog-empty">
  <p>No ResourceGraphDefinitions found in this cluster.</p>
  <p class="catalog__empty-hint">
    Create one with <code>kubectl apply -f your-rgd.yaml</code>
    or use the <a data-testid="catalog-new-rgd-link" href="/author">in-app authoring tool</a>.
  </p>
</div>
```

---

## Preserved Contracts (no change)

- `GenerateTab` — mode switching, "New RGD" button behavior, YAML output
- All existing routes — no changes to existing route handlers
- All existing API endpoints — no changes
