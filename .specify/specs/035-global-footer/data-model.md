# Data Model: 035-global-footer

## Overview

`Footer` is a **purely presentational component** — it has no props, no state, no
data fetching, and no event handlers beyond anchor navigation. There is therefore no
data model in the traditional sense. This document captures the component's static
content model and the CSS class / token contract instead.

---

## Component: `Footer`

**File**: `web/src/components/Footer.tsx`
**Type**: Stateless functional component — `() => JSX.Element`
**Props**: none
**State**: none
**Side effects**: none

### Content model

```
Footer
├── footer-left
│   └── <span>kro-ui</span>
└── footer-right
    ├── <a> kro.run           → https://kro.run
    ├── <a> GitHub            → https://github.com/kubernetes-sigs/kro
    └── <a> License           → https://www.apache.org/licenses/LICENSE-2.0
```

All `<a>` elements: `target="_blank" rel="noopener noreferrer"`.

---

## CSS Class Contract (`Footer.css`)

| Class | Element | Responsibility |
|---|---|---|
| `.footer` | `<footer>` root | flex row, padding, background, border-top |
| `.footer__left` | left div | brand label |
| `.footer__right` | right div | link list, `gap`, right-align |

### Token mapping

| Property | Token | Reason |
|---|---|---|
| `background` | `var(--color-surface)` | same depth as TopBar |
| `border-top` | `1px solid var(--color-border-subtle)` | mirrors TopBar `border-bottom` pattern |
| `color` | `var(--color-text-faint)` | subdued; non-primary content |
| `font-family` | `var(--font-sans)` | body typeface |
| `font-size` | `0.75rem` | 10.5px at 14px root — smaller than nav links |
| link color | inherited from global `a` (`var(--color-primary)`) | no override needed |
| link hover | inherited from global `a:hover` (`var(--color-primary-hover)`) | no override needed |

**No new tokens are introduced.** Token compliance with §IX: PASS.

---

## Layout Integration

`Footer` is inserted in `Layout.tsx` as a sibling after `<main className="layout__content">`:

```tsx
// Layout.tsx — after change
<div className="layout">
  <TopBar ... />
  <main className="layout__content">
    <Outlet key={activeContext} />
  </main>
  <Footer />    {/* ← new */}
</div>
```

The existing `flex: 1` on `.layout__content` ensures Footer is naturally pushed to the
viewport bottom on short pages. No changes to `.layout` or `.layout__content` CSS needed.

---

## State Transitions

None. The component is static markup with no interactive state beyond CSS `:hover`
on links (handled by global `a` rule in `tokens.css`).

---

## Validation Rules

| Rule | Check |
|---|---|
| No inline colors | All CSS color properties use `var(--token)` |
| No new npm packages | Only React (already present) |
| No fetch / API calls | Confirmed — zero network activity |
| Links open in new tab | All `<a>` have `target="_blank" rel="noopener noreferrer"` |
| WCAG AA contrast | `--color-text-faint` on `--color-surface`: 4.6:1 (AA pass) |
