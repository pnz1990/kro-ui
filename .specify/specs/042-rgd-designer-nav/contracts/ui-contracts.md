# UI Contracts: RGD Designer Nav (042)

## Route Contract

| Route | Method | Description |
|-------|--------|-------------|
| `/author` | GET (SPA) | Renders RGD Designer page (unchanged route, updated content) |

No new backend API endpoints. No changes to the Go server.

---

## Component Interface Contracts

### `AuthorPage` — changed behavior

```typescript
// No props — page-level component (unchanged signature)
export default function AuthorPage(): JSX.Element
```

**Changed behavior** (vs spec 039):
- `document.title` → `"RGD Designer — kro-ui"` (was `"New RGD — kro-ui"`)
- `<h1>` text → `"RGD Designer"` (was `"New RGD"`)
- Layout: three-section — form | [DAG preview + YAML preview stacked]
- DAG preview panel renders `<StaticChainDAG>` from debounced form state

**Stable behavior** (unchanged):
- No API calls
- Initial state: `STARTER_RGD_STATE`
- YAML preview still present

---

### `TopBar` — changed DOM contract

```typescript
// Interface unchanged
export default function TopBar(props: TopBarProps): JSX.Element
```

**Old DOM** (spec 039):
```html
<!-- Outside <nav>, styled as a pill button -->
<a data-testid="topbar-new-rgd" href="/author" class="top-bar__new-rgd-btn">
  + New RGD
</a>
```

**New DOM** (spec 042):
```html
<!-- Inside <nav class="top-bar__nav">, same style as other nav links -->
<a data-testid="topbar-rgd-designer" href="/author"
   class="top-bar__nav-link [top-bar__nav-link--active when on /author]">
  RGD Designer
</a>
```

---

### `GenerateTab` — changed mode contract

```typescript
// No interface change — still accepts { rgd: K8sObject }
export default function GenerateTab({ rgd }: GenerateTabProps): JSX.Element
```

**Old modes**: `'form' | 'batch' | 'rgd'`  
**New modes**: `'form' | 'batch'`

**Removed DOM**:
```html
<!-- REMOVED -->
<button data-testid="mode-btn-rgd" ...>New RGD</button>
<!-- REMOVED -->
{mode === 'rgd' && <RGDAuthoringForm ...>}
{mode === 'rgd' && <YAMLPreview ...>}
```

**Optional addition** (subtle text link):
```html
<!-- Optional, at bottom of generate-tab__input-pane -->
<p class="generate-tab__designer-hint">
  Authoring a new RGD?
  <a href="/author">Open RGD Designer →</a>
</p>
```

---

### `rgdAuthoringStateToSpec` — new function contract

```typescript
// Location: web/src/lib/generator.ts
export function rgdAuthoringStateToSpec(
  state: RGDAuthoringState,
): Record<string, unknown>
```

**Input**: `RGDAuthoringState` (in-memory authoring form state)  
**Output**: `{ schema: {...}, resources: [...] }` — the `spec` shape accepted by `buildDAGGraph`  
**Side effects**: None (pure function)  
**Error behavior**: Never throws; filters incomplete resources silently

---

## Preserved Contracts (no change)

- `GET /author` route — already exists in React Router
- `GET /api/v1/rgds`, etc. — no backend changes
- `GenerateTab` Instance Form and Batch modes — unchanged
- `RGDAuthoringForm` component interface — unchanged
- `YAMLPreview` component interface — unchanged
- `STARTER_RGD_STATE` and `generateRGDYAML` — unchanged (still used by AuthorPage)

---

## Testid Migration Table

| Old `data-testid` | New `data-testid` | Component |
|-------------------|-------------------|-----------|
| `topbar-new-rgd` | `topbar-rgd-designer` | TopBar.tsx |
| `home-new-rgd-link` | `home-new-rgd-link` | Home.tsx (unchanged) |
| `catalog-new-rgd-link` | `catalog-new-rgd-link` | Catalog.tsx (unchanged) |
| `mode-btn-rgd` | *(removed)* | GenerateTab.tsx |

---

## E2E Journey 039 — updated assertions

| Step | Old assertion | New assertion |
|------|--------------|--------------|
| Step 1 — topbar testid | `topbar-new-rgd` visible, text `'New RGD'` | `topbar-rgd-designer` visible, text `'RGD Designer'` |
| Step 2 — click and navigate | `topbar-new-rgd` click | `topbar-rgd-designer` click; title `/RGD Designer — kro-ui/` |
| Step 3 — no-match empty state | uses `topbar-new-rgd` | uses `topbar-rgd-designer` |
| Step 4 — mode-btn-rgd guard | clicks `mode-btn-rgd`, asserts form visible | **Replace**: verify DAG preview on `/author` renders |
