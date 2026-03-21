# Component Contracts: RGD List — Home Page

**Spec**: `002-rgd-list-home`
**Date**: 2026-03-20

---

## Layout Component

**File**: `web/src/components/Layout.tsx`
**Type**: Route wrapper (renders `<Outlet />`)

### Props

None (uses React Router context).

### Behavior

1. On mount: calls `listContexts()` from `api.ts`
2. Stores `active` context name in local state
3. Renders `<TopBar contextName={active} />` + `<Outlet />`
4. If context fetch fails: TopBar shows empty string (graceful degradation,
   not an error state — the context display is informational, not blocking)

### DOM Contract

```html
<div class="layout">
  <TopBar contextName="..." />
  <main class="layout__content">
    <Outlet />   <!-- child route renders here -->
  </main>
</div>
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.layout` | Full-height flex column |
| `.layout__content` | Flex-grow area for page content, with horizontal padding |

---

## TopBar Component

**File**: `web/src/components/TopBar.tsx`
**Type**: Presentational

### Props

```typescript
interface TopBarProps {
  contextName: string
}
```

### Behavior

1. Displays the kro-ui logo (24×24 img) + "kro-ui" text label
2. Displays the active context name
3. If context name is longer than 40 characters: truncates with `…` and sets
   `title` attribute to the full name
4. No interactive elements in v0.2.0 (theme toggle is display-only placeholder)

### DOM Contract

```html
<header class="top-bar">
  <div class="top-bar__brand">
    <img src="/logo.png" alt="kro-ui" width="24" height="24" />
    <span class="top-bar__title">kro-ui</span>
  </div>
  <div class="top-bar__context" data-testid="context-name" title="full-context-name">
    truncated-or-full-name
  </div>
</header>
```

### `data-testid` Attributes

| Attribute | Element | E2E usage |
|-----------|---------|-----------|
| `context-name` | Context name display | E2E journey step 1 |

---

## Home Page

**File**: `web/src/pages/Home.tsx`
**Type**: Page component (route: `/`)

### Props

None (fetches data internally).

### Behavior

1. On mount: calls `listRGDs()` from `api.ts`
2. Three states:
   - **Loading**: `isLoading === true` → renders 3 `SkeletonCard` instances
   - **Error**: `error !== null` → renders error state with message + Retry button
   - **Success**: `items.length > 0` → renders `RGDCard` grid
   - **Empty**: `items.length === 0` → renders empty state with kro docs link
3. Retry button re-triggers the fetch
4. Does NOT auto-refresh (FR-008)

### DOM Contract

**Loading state**:
```html
<div class="home">
  <h1 class="home__heading">ResourceGraphDefinitions</h1>
  <div class="home__grid">
    <SkeletonCard />  <!-- x3 -->
  </div>
</div>
```

**Success state**:
```html
<div class="home">
  <h1 class="home__heading">ResourceGraphDefinitions</h1>
  <div class="home__grid">
    <RGDCard rgd={item} />  <!-- one per item -->
  </div>
</div>
```

**Error state**:
```html
<div class="home">
  <h1 class="home__heading">ResourceGraphDefinitions</h1>
  <div class="home__error" role="alert">
    <p class="home__error-message">{error message}</p>
    <button class="home__retry-btn" onClick={retry}>Retry</button>
  </div>
</div>
```

**Empty state**:
```html
<div class="home">
  <h1 class="home__heading">ResourceGraphDefinitions</h1>
  <div class="home__empty">
    <p>No ResourceGraphDefinitions found in this cluster.</p>
    <a href="https://kro.run/docs" target="_blank" rel="noopener noreferrer">
      Learn about kro
    </a>
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.home` | Page container with padding |
| `.home__heading` | Page title (20px, weight 600) |
| `.home__grid` | CSS Grid: responsive auto-fill, min 320px columns, 16px gap |
| `.home__error` | Error state container, centered |
| `.home__error-message` | Error text in `--color-error` |
| `.home__retry-btn` | Primary-colored button |
| `.home__empty` | Empty state container, centered |

---

## RGDCard Component

**File**: `web/src/components/RGDCard.tsx`
**Type**: Presentational

### Props

```typescript
interface RGDCardProps {
  rgd: K8sObject
}
```

### Behavior

1. Extracts fields using `format.ts` helpers:
   - Name from `metadata.name`
   - Kind from `spec.schema.kind`
   - Resource count from `spec.resources.length`
   - Age from `metadata.creationTimestamp` via `formatAge()`
   - Status from `status.conditions` via `extractReadyStatus()`
2. Renders a card with name, kind badge, resource count, age, status dot
3. Provides "Graph" link → `/rgds/:name`
4. Provides "Instances" link → `/rgds/:name?tab=instances`
5. If kind is missing: omit kind badge entirely (edge case, spec line 103)

### DOM Contract

```html
<article class="rgd-card" data-testid="rgd-card-{name}">
  <div class="rgd-card__header">
    <StatusDot state={...} reason={...} message={...} />
    <h2 class="rgd-card__name" data-testid="rgd-name">{name}</h2>
  </div>
  <div class="rgd-card__meta">
    <!-- kind badge (omitted if kind is '') -->
    <span class="rgd-card__kind" data-testid="rgd-kind">{kind}</span>
    <span class="rgd-card__resources">{count} resources</span>
    <span class="rgd-card__age">{age}</span>
  </div>
  <div class="rgd-card__actions">
    <Link to="/rgds/{name}" class="rgd-card__btn" data-testid="btn-graph">Graph</Link>
    <Link to="/rgds/{name}?tab=instances" class="rgd-card__btn" data-testid="btn-instances">Instances</Link>
  </div>
</article>
```

### `data-testid` Attributes

| Attribute | Element | E2E usage |
|-----------|---------|-----------|
| `rgd-card-{name}` | Card root | E2E journey step 2 |
| `rgd-name` | Name heading | E2E journey step 2 |
| `rgd-kind` | Kind badge | E2E journey step 2 |
| `status-dot` | StatusDot wrapper | E2E journey step 2 |
| `btn-graph` | Graph link | E2E journey step 3 |
| `btn-instances` | Instances link | E2E journey step 4 |

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.rgd-card` | Card container: `--color-surface` bg, `--color-border` border, `--radius` corners |
| `.rgd-card__header` | Flex row: status dot + name |
| `.rgd-card__name` | 16px, weight 600, `--color-text` |
| `.rgd-card__meta` | 12px, `--color-text-muted`, flex row with gap |
| `.rgd-card__kind` | Kind badge: `--color-primary-muted` bg, `--color-primary-text` text, `--radius-sm` |
| `.rgd-card__resources` | Resource count text |
| `.rgd-card__age` | Age text |
| `.rgd-card__actions` | Flex row with gap for action links |
| `.rgd-card__btn` | Link styled as button: `--color-primary` text, hover effect |

---

## StatusDot Component

**File**: `web/src/components/StatusDot.tsx`
**Type**: Presentational

### Props

```typescript
interface StatusDotProps {
  state: ReadyState          // 'ready' | 'error' | 'unknown'
  reason?: string
  message?: string
}
```

### Behavior

1. Renders a small colored circle (10×10px)
2. Color determined by `state` → CSS class → CSS variable
3. Tooltip (`title`) shows `"{reason}: {message}"` if reason exists,
   or state label if no reason
4. Accessibility: `role="img"` + `aria-label` describing the state

### DOM Contract

```html
<span
  class="status-dot status-dot--{state}"
  data-testid="status-dot"
  role="img"
  aria-label="Status: {state label}"
  title="{tooltip text}"
/>
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.status-dot` | Base: 10×10 inline-block circle, `border-radius: 50%` |
| `.status-dot--ready` | `background-color: var(--color-status-ready)` |
| `.status-dot--error` | `background-color: var(--color-status-error)` |
| `.status-dot--unknown` | `background-color: var(--color-status-unknown)` |

---

## SkeletonCard Component

**File**: `web/src/components/SkeletonCard.tsx`
**Type**: Presentational

### Props

None.

### Behavior

1. Renders a card with the same dimensions as `RGDCard`
2. Gray placeholder bars where text would be
3. Animated shimmer effect (CSS-only `@keyframes`)

### DOM Contract

```html
<div class="skeleton-card" aria-hidden="true">
  <div class="skeleton-card__header">
    <div class="skeleton-card__dot"></div>
    <div class="skeleton-card__line skeleton-card__line--wide"></div>
  </div>
  <div class="skeleton-card__meta">
    <div class="skeleton-card__line skeleton-card__line--medium"></div>
    <div class="skeleton-card__line skeleton-card__line--short"></div>
  </div>
  <div class="skeleton-card__actions">
    <div class="skeleton-card__line skeleton-card__line--btn"></div>
    <div class="skeleton-card__line skeleton-card__line--btn"></div>
  </div>
</div>
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.skeleton-card` | Same size/border as `.rgd-card`, `overflow: hidden` |
| `.skeleton-card__line` | Gray bar with shimmer animation overlay |
| `.skeleton-card__line--wide` | 60% width (name placeholder) |
| `.skeleton-card__line--medium` | 40% width (kind/count placeholder) |
| `.skeleton-card__line--short` | 20% width (age placeholder) |
| `.skeleton-card__line--btn` | Button-sized placeholder |

### Animation

```css
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

Applied via `background: linear-gradient(...)` with `background-size: 200% 100%`.

---

## Utility Functions Contract

**File**: `web/src/lib/format.ts`

### `formatAge(isoTimestamp: string): string`

| Input | Output |
|-------|--------|
| `''` | `'Unknown'` |
| `'not-a-date'` | `'Unknown'` |
| 30 seconds ago | `'30s'` |
| 5 minutes ago | `'5m'` |
| 2 hours ago | `'2h'` |
| 3 days ago | `'3d'` |
| Future timestamp | `'0s'` |

### `extractReadyStatus(obj: K8sObject): ReadyStatus`

| Input conditions | Output state |
|-----------------|--------------|
| `status.conditions` has `Ready=True` | `'ready'` |
| `status.conditions` has `Ready=False` | `'error'` |
| `status.conditions` has `Ready=Unknown` | `'unknown'` |
| No `Ready` condition in array | `'unknown'` |
| No `conditions` array | `'unknown'` |
| No `status` field | `'unknown'` |
| Empty object `{}` | `'unknown'` |

### `extractRGDName(obj: K8sObject): string`

Returns `metadata.name` as string, or `''` if missing.

### `extractRGDKind(obj: K8sObject): string`

Returns `spec.schema.kind` as string, or `''` if missing.

### `extractResourceCount(obj: K8sObject): number`

Returns `spec.resources.length` as number, or `0` if missing/not-array.

### `extractCreationTimestamp(obj: K8sObject): string`

Returns `metadata.creationTimestamp` as string, or `''` if missing.

### `readyStateColor(state: ReadyState): string`

| Input | Output |
|-------|--------|
| `'ready'` | `'--color-status-ready'` |
| `'error'` | `'--color-status-error'` |
| `'unknown'` | `'--color-status-unknown'` |

### `readyStateLabel(state: ReadyState): string`

| Input | Output |
|-------|--------|
| `'ready'` | `'Ready'` |
| `'error'` | `'Not Ready'` |
| `'unknown'` | `'Unknown'` |
