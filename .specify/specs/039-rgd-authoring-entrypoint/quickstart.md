# Quickstart: Implementing RGD Authoring Global Entrypoint (039)

## Prerequisites

- Worktree created: `wt switch --create 039-rgd-authoring-entrypoint`
- All deps installed (post-create hook runs `bun install`)
- Read: `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`
- Constitution: `.specify/memory/constitution.md`

## Implementation Order

### Step 1 — Export `STARTER_RGD_STATE` from generator.ts

Edit `web/src/lib/generator.ts`:
- Add `export` to the `STARTER_RGD_STATE` constant (currently it doesn't
  exist there — it lives in `GenerateTab.tsx`; move it to generator.ts)
- Update `GenerateTab.tsx` to import `STARTER_RGD_STATE` from `@/lib/generator`

```typescript
// web/src/lib/generator.ts — add near the RGDAuthoringState type definitions
export const STARTER_RGD_STATE: RGDAuthoringState = {
  rgdName: 'my-app',
  kind: 'MyApp',
  group: 'kro.run',
  apiVersion: 'v1alpha1',
  specFields: [],
  resources: [{ _key: 'starter-web', id: 'web', apiVersion: 'apps/v1', kind: 'Deployment' }],
}
```

### Step 2 — Create `AuthorPage`

New file: `web/src/pages/AuthorPage.tsx`

```typescript
import { useState, useMemo } from 'react'
import { STARTER_RGD_STATE, generateRGDYAML } from '@/lib/generator'
import type { RGDAuthoringState } from '@/lib/generator'
import RGDAuthoringForm from '@/components/RGDAuthoringForm'
import YAMLPreview from '@/components/YAMLPreview'
import { usePageTitle } from '@/hooks/usePageTitle'
import './AuthorPage.css'

export default function AuthorPage() {
  usePageTitle('New RGD')
  const [rgdState, setRgdState] = useState<RGDAuthoringState>(STARTER_RGD_STATE)
  const rgdYaml = useMemo(() => generateRGDYAML(rgdState), [rgdState])

  return (
    <div className="author-page">
      <div className="author-page__header">
        <h1 className="author-page__title">New RGD</h1>
        <p className="author-page__subtitle">
          Scaffold a ResourceGraphDefinition YAML
        </p>
      </div>
      <div className="author-page__body">
        <div className="author-page__form-pane">
          <RGDAuthoringForm state={rgdState} onChange={setRgdState} />
        </div>
        <div className="author-page__preview-pane">
          <YAMLPreview yaml={rgdYaml} title="ResourceGraphDefinition" />
        </div>
      </div>
    </div>
  )
}
```

New file: `web/src/pages/AuthorPage.css` — use tokens only, mirror
`GenerateTab.css` two-column layout.

### Step 3 — Register `/author` route in `main.tsx`

```tsx
import AuthorPage from './pages/AuthorPage'

// Inside <Routes>:
<Route path="/author" element={<AuthorPage />} />
// Before the catch-all:
<Route path="*" element={<NotFound />} />
```

### Step 4 — Add "New RGD" button to `TopBar`

Edit `web/src/components/TopBar.tsx`:

```tsx
import { NavLink, Link } from 'react-router-dom'

// Inside the <header>, after the <nav>:
<Link to="/author" className="top-bar__new-rgd-btn" data-testid="topbar-new-rgd">
  + New RGD
</Link>
```

Edit `web/src/components/TopBar.css`:

```css
.top-bar__new-rgd-btn {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-bg);
  background: var(--color-primary);
  text-decoration: none;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: background var(--transition), opacity var(--transition);
}

.top-bar__new-rgd-btn:hover {
  opacity: 0.85;
}

.top-bar__new-rgd-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

### Step 5 — Add "New RGD" to Home empty state

Edit `web/src/pages/Home.tsx` — in the `home__empty--onboarding` block, add:

```tsx
<Link
  to="/author"
  className="home__empty-cta"
  data-testid="home-new-rgd-link"
>
  New RGD
</Link>
```

Add `import { Link } from 'react-router-dom'` if not already imported.

### Step 6 — Add "New RGD" to Catalog empty state

Edit `web/src/pages/Catalog.tsx` — in the zero-items branch of the empty state:

```tsx
<p className="catalog__empty-hint">
  Create one with <code>kubectl apply -f your-rgd.yaml</code>
  {' '}or use the{' '}
  <Link to="/author" data-testid="catalog-new-rgd-link">
    in-app authoring tool
  </Link>.
</p>
```

Add `import { Link } from 'react-router-dom'` if not already imported.

### Step 7 — Add E2E journey

New file: `test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts`

Four steps:
1. Top bar has visible `data-testid="topbar-new-rgd"` element
2. Clicking it navigates to `/author`; `RGDAuthoringForm` renders
3. Home/Catalog empty state link test (search-filter path for CI cluster)
4. Per-RGD Generate tab "New RGD" mode still works (regression guard)

## Verify

```bash
# TypeScript strict check
bun run typecheck

# Unit tests
bun run test

# Dev server (manual smoke test)
bun run dev
# Visit http://localhost:5173/author
# Confirm: form renders, YAML updates, title is "New RGD — kro-ui"
# Visit http://localhost:5173
# Confirm: top bar shows "+ New RGD" button
```

## Token reference (tokens.css)

Key tokens for the new button:
- `--color-primary` — primary blue for button background
- `--color-bg` — button text (dark background → light text)
- `--color-border-focus` — focus ring
- `--radius-sm` — border radius
- `--transition` — hover transition
- `--font-sans` — button font family
