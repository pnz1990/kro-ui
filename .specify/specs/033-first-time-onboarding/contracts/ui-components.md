# UI Component Contracts: 033-first-time-onboarding

**Phase 1 output** | Branch: `033-first-time-onboarding`

---

## Overview

This feature adds one new UI component (`Footer`) and modifies two existing
components (`Layout`, `Home`). The contracts below define each component's
interface, rendered structure, CSS class conventions, and behavioral rules.

---

## Component: `Footer`

**File**: `web/src/components/Footer.tsx`

### Props

```ts
// No required props
interface FooterProps {}
```

### Internal state

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `version` | `string \| null` | `null` | Fetched from `GET /api/v1/version` on mount |

### Rendered structure

```html
<footer class="footer" role="contentinfo">
  <div class="footer__inner">
    <span class="footer__copy">© {year} kro-ui contributors</span>
    <nav class="footer__links" aria-label="External resources">
      <a href="https://kro.run" target="_blank" rel="noopener noreferrer"
         class="footer__link">kro.run</a>
      <a href="https://github.com/kubernetes-sigs/kro" target="_blank" rel="noopener noreferrer"
         class="footer__link">GitHub</a>
    </nav>
    <!-- rendered only when version is non-null -->
    <span class="footer__version">{version}</span>
  </div>
</footer>
```

### CSS classes

| Class | Purpose |
|-------|---------|
| `.footer` | Root element; `border-top: 1px solid var(--color-border-subtle)`; `background: var(--color-surface)` |
| `.footer__inner` | Flex row; `justify-content: space-between`; `align-items: center`; `padding: 12px 32px` |
| `.footer__copy` | Copyright text; `color: var(--color-text-faint)`; `font-size: var(--text-sm)` |
| `.footer__links` | Flex gap between links |
| `.footer__link` | External link style; `color: var(--color-text-muted)`; hover `var(--color-primary-text)` |
| `.footer__version` | Version badge; `color: var(--color-text-faint)`; `font-family: var(--font-mono)` |

**Token constraint**: No hex or `rgba()` literals in `Footer.css`. All color
values via `var(--token-name)` only.

### Behavioral rules

1. **Mounts in `Layout.tsx`** — below `<main class="layout__content">`, inside
   `.layout` flex container. Appears on every route.
2. **Version fetch is fire-and-forget** — failure is silent; version span
   is simply not rendered.
3. **External links** — all open in new tab with `rel="noopener noreferrer"`.
4. **Accessibility** — `<footer role="contentinfo">` for landmark semantics;
   nav `aria-label="External resources"`.
5. **Year** — computed at render time via `new Date().getFullYear()` to stay accurate.

---

## Component: `Layout` (modification)

**File**: `web/src/components/Layout.tsx`

### Change

Add `<Footer />` below the `<main>` element:

```tsx
// Before
return (
  <div className="layout">
    <TopBar ... />
    <main className="layout__content">
      <Outlet key={activeContext} />
    </main>
  </div>
)

// After
return (
  <div className="layout">
    <TopBar ... />
    <main className="layout__content">
      <Outlet key={activeContext} />
    </main>
    <Footer />
  </div>
)
```

### CSS change

`layout__content` must have `flex: 1` so the footer stays at the bottom. The
`.layout` root already has `min-height: 100vh` — confirm `flex-direction: column`
is set (check `Layout.css`).

---

## Component: `Home` (modification)

**File**: `web/src/pages/Home.tsx`

### Change: Enhanced empty state

The `emptyState` JSX block (the `items.length === 0` branch, line 64–70) is
replaced with a richer block:

```tsx
const emptyState =
  debouncedQuery.trim() !== '' ? (
    // unchanged — search no-results case
    <div className="home__empty">
      <p>No ResourceGraphDefinitions match &ldquo;{debouncedQuery}&rdquo;.</p>
      <button className="home__clear-search" onClick={() => setQuery('')}>
        Clear search
      </button>
    </div>
  ) : (
    // NEW — first-time / empty-cluster onboarding panel
    <div className="home__empty home__empty--onboarding">
      <h2 className="home__empty-title">No ResourceGraphDefinitions found</h2>
      <p className="home__empty-desc">
        kro-ui is a read-only observability dashboard for{' '}
        <a href="https://kro.run" target="_blank" rel="noopener noreferrer">kro</a>
        {' '}— the Kubernetes Resource Orchestrator.
        A ResourceGraphDefinition (RGD) is a kro custom resource that declares a
        graph of Kubernetes resources to manage together.
      </p>
      <div className="home__empty-actions">
        <a
          href="https://kro.run/docs/getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="home__empty-cta"
        >
          Get started with kro
        </a>
        <a
          href="https://github.com/kubernetes-sigs/kro"
          target="_blank"
          rel="noopener noreferrer"
          className="home__empty-cta home__empty-cta--secondary"
        >
          kro on GitHub
        </a>
      </div>
    </div>
  )
```

### CSS classes (additions to `Home.css`)

| Class | Purpose |
|-------|---------|
| `.home__empty--onboarding` | Modifier; increases padding; adds centered layout |
| `.home__empty-title` | `h2`; `color: var(--color-text)`; `font-size: var(--text-lg)` |
| `.home__empty-desc` | Description paragraph; `color: var(--color-text-muted)`; max-width for readability |
| `.home__empty-actions` | Flex row of CTA buttons; `gap: var(--space-3)` or equivalent |
| `.home__empty-cta` | Primary CTA link styled as button; `background: var(--color-primary)`; `color: var(--color-on-primary)` |
| `.home__empty-cta--secondary` | Secondary variant; `background: transparent`; `border: 1px solid var(--color-border)`; `color: var(--color-text-muted)` |

**Token constraint**: No hex or `rgba()` in `Home.css` additions.

### Behavioral rules

1. The search no-results branch is unchanged.
2. The empty-cluster branch is shown only when `items.length === 0` — same
   condition as before, just richer content.
3. External links open in new tab with `rel="noopener noreferrer"`.
4. No new state, no new API calls in `Home.tsx`.

---

## Non-goals (explicitly excluded)

- Persistent "seen" / "dismissed" onboarding state (no localStorage)
- Welcome modal or overlay
- Animated banners
- Backend changes of any kind
