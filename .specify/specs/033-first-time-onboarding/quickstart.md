# Quickstart: 033-first-time-onboarding

**Phase 1 output** | Branch: `033-first-time-onboarding`

---

## What this feature adds

Three improvements for first-time kro-ui visitors (issue #120):

1. **Footer** — site-wide footer on every page with links to `kro.run`,
   `github.com/kubernetes-sigs/kro`, and the current kro-ui version.
2. **Richer home empty state** — when no RGDs exist in the cluster, the home
   page now shows a description of kro and kro-ui, with CTA links to the docs
   and GitHub.
3. **Layout update** — `Layout.tsx` mounts the new `Footer` below `<main>` so
   it appears on all routes.

No backend changes. No new npm dependencies.

---

## Implementation steps (in order)

### Step 1 — Verify `GET /api/v1/version` exists

Check that `web/src/lib/api.ts` exports a `getVersion()` function (or equivalent).
If not, add it:

```ts
// web/src/lib/api.ts
export interface VersionResponse {
  version: string
  commit?: string
  buildDate?: string
}

export async function getVersion(): Promise<VersionResponse> {
  const res = await fetch('/api/v1/version')
  if (!res.ok) throw new Error(`version: ${res.status}`)
  return res.json() as Promise<VersionResponse>
}
```

### Step 2 — Create `Footer.tsx`

```tsx
// web/src/components/Footer.tsx
import { useEffect, useState } from 'react'
import { getVersion } from '@/lib/api'
import './Footer.css'

export default function Footer() {
  const [version, setVersion] = useState<string | null>(null)
  const year = new Date().getFullYear()

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v.version))
      .catch(() => {/* silent — version is informational */})
  }, [])

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <span className="footer__copy">© {year} kro-ui contributors</span>
        <nav className="footer__links" aria-label="External resources">
          <a href="https://kro.run" target="_blank" rel="noopener noreferrer"
             className="footer__link">kro.run</a>
          <a href="https://github.com/kubernetes-sigs/kro" target="_blank"
             rel="noopener noreferrer" className="footer__link">GitHub</a>
        </nav>
        {version && (
          <span className="footer__version">{version}</span>
        )}
      </div>
    </footer>
  )
}
```

### Step 3 — Create `Footer.css`

All colors must use `var(--token)` — no hex literals.

```css
/* web/src/components/Footer.css */
.footer {
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-surface);
  flex-shrink: 0;
}

.footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 32px;
  gap: 16px;
  flex-wrap: wrap;
}

.footer__copy {
  color: var(--color-text-faint);
  font-size: 0.75rem;
}

.footer__links {
  display: flex;
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.footer__link {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.75rem;
  transition: color var(--transition-fast);
}

.footer__link:hover {
  color: var(--color-primary-text);
}

.footer__version {
  color: var(--color-text-faint);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
```

### Step 4 — Mount `Footer` in `Layout.tsx`

```tsx
// Diff: web/src/components/Layout.tsx
import Footer from './Footer'   // ADD

// In JSX:
<div className="layout">
  <TopBar ... />
  <main className="layout__content">
    <Outlet key={activeContext} />
  </main>
  <Footer />   {/* ADD */}
</div>
```

Verify `Layout.css` has `.layout { display: flex; flex-direction: column; min-height: 100vh; }` and `.layout__content { flex: 1; }` so the footer is pushed to the bottom.

### Step 5 — Enhance home empty state in `Home.tsx`

Replace lines 64–70 (the `items.length === 0` empty-state JSX) with:

```tsx
) : (
  <div className="home__empty home__empty--onboarding">
    <h2 className="home__empty-title">No ResourceGraphDefinitions found</h2>
    <p className="home__empty-desc">
      <strong>kro-ui</strong> is a read-only observability dashboard for{' '}
      <a href="https://kro.run" target="_blank" rel="noopener noreferrer">kro</a>
      {' '}— the Kubernetes Resource Orchestrator. A ResourceGraphDefinition (RGD)
      declares a graph of Kubernetes resources to manage as a unit.
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

### Step 6 — Add CSS to `Home.css`

Append to `web/src/pages/Home.css`:

```css
/* Enhanced empty state — onboarding variant */
.home__empty--onboarding {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  gap: 16px;
  max-width: 540px;
  margin: 0 auto;
}

.home__empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.home__empty-desc {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
}

.home__empty-desc a {
  color: var(--color-primary-text);
  text-decoration: none;
}

.home__empty-desc a:hover {
  text-decoration: underline;
}

.home__empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.home__empty-cta {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.home__empty-cta:hover {
  background: var(--color-primary-hover);
}

.home__empty-cta--secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.home__empty-cta--secondary:hover {
  border-color: var(--color-border-focus);
  color: var(--color-text);
}
```

---

## Verification checklist

- [ ] `bun typecheck` passes with no new errors
- [ ] `go vet ./...` passes (no backend changes, but sanity check)
- [ ] Footer visible on `/`, `/catalog`, `/fleet`, `/events`, `/rgds/*` routes
- [ ] Footer version shows when cluster is reachable; absent otherwise
- [ ] External links open in new tab
- [ ] Home empty-state shows the onboarding panel when cluster has 0 RGDs
- [ ] Home search no-results still shows the compact "Clear search" variant
- [ ] No hex literals in new CSS files (grep: `#[0-9a-fA-F]` should return 0 results in Footer.css, new Home.css additions)
- [ ] Light mode (`data-theme="light"`) renders correctly via existing token overrides
- [ ] `document.title` unchanged (still "kro-ui" on home)
