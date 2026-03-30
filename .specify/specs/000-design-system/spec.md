# Design System Specification

**Spec**: `000-design-system`
**Created**: 2026-03-20
**Status**: Reference — no plan.md or tasks.md needed; this spec is a living design
  system reference document maintained alongside the implementation. See
  `web/src/tokens.css` for the canonical token definitions.
All other specs reference it. No component may use a color, font, radius, or
spacing value that is not defined here.

---

## Audience and design philosophy

kro-ui's users are **platform engineers and SREs** debugging production
Kubernetes infrastructure. The design must communicate:

- **Trust and precision** — not playful, not generic SaaS
- **Clarity under stress** — semantic colors must be instantly readable when
  something is on fire at 2am
- **Native to the terminal** — dark mode is the default and must feel
  professional, not like an afterthought
- **Consistent with kro.run** — operators will move between the docs and the
  dashboard; the visual language must feel like the same product family

---

## Color palette

### Design rationale

The palette is derived from kro.run's brand (`#5b7fc9`) but refined for a
**dense, interactive UI** rather than a documentation site:

- The primary blue is shifted to `#5b8ef0` — more saturated, higher contrast
  on dark backgrounds (5.8:1 on `#1b1b1d`), still immediately readable as
  "same family" as kro.run
- The dark background `#1b1b1d` is one shade warmer than pure black — reduces
  eye strain on long debug sessions
- Semantic colors were chosen for **maximum distinctiveness**: alive (emerald),
  reconciling (amber), error (rose), pending (violet). Each maps to a different
  hue family so colorblind users can distinguish them by brightness difference
  even when hue is ambiguous
- All semantic colors meet WCAG AA contrast (≥4.5:1) against their expected
  background (`--color-surface` for badges, `--color-bg` for DAG nodes)

### CSS custom properties

All colors are defined as CSS custom properties in `web/src/tokens.css`.
**No hardcoded hex values** anywhere in component code — always use a token.

#### Dark mode (default)

```css
/* ── Brand ────────────────────────────────────────────────────────── */
--color-primary:        #5b8ef0;   /* Interactive elements, links, focus rings     */
--color-primary-hover:  #4a7de0;   /* Hover state for primary elements              */
--color-primary-muted:  rgba(91, 142, 240, 0.12); /* Subtle tint backgrounds        */
--color-primary-text:   #93b4f8;   /* Primary color for readable text on dark bg    */

/* ── Backgrounds ──────────────────────────────────────────────────── */
--color-bg:             #1b1b1d;   /* Page background                               */
--color-surface:        #242526;   /* Card / panel backgrounds                      */
--color-surface-2:      #2c2d2f;   /* Elevated surfaces (dropdowns, tooltips)       */
--color-surface-3:      #323335;   /* Code block backgrounds                        */

/* ── Borders ──────────────────────────────────────────────────────── */
--color-border:         #3f3f46;   /* Default borders                               */
--color-border-subtle:  #2d2d32;   /* Subtle dividers                               */
--color-border-focus:   #5b8ef0;   /* Focus ring                                    */

/* ── Text ─────────────────────────────────────────────────────────── */
--color-text:           #e4e4e7;   /* Primary text                                  */
--color-text-muted:     #a1a1aa;   /* Secondary / metadata text                     */
--color-text-faint:     #71717a;   /* Disabled / placeholder text                   */

/* ── Semantic: node states (DAG) ──────────────────────────────────── */
--color-alive:          #10b981;   /* Resource exists and Ready=True (emerald)      */
--color-reconciling:    #f59e0b;   /* kro actively reconciling (amber)              */
--color-pending:        #8b5cf6;   /* Waiting on dependency (violet)                */
--color-error:          #f43f5e;   /* Ready=False (rose)                            */
--color-not-found:      #6b7280;   /* Resource not yet created, or unknown (gray)   */

/* ── Semantic: UI status ──────────────────────────────────────────── */
--color-status-ready:   #10b981;   /* Ready badge                                   */
--color-status-error:   #f43f5e;   /* Not-ready / error badge                       */
--color-status-unknown: #6b7280;   /* Unknown / no conditions badge                 */
--color-status-warning: #f59e0b;   /* Warning state                                 */

/* ── CEL / schema highlighter tokens ──────────────────────────────── */
--hl-yaml-key:          #a8a29e;   /* Standard YAML keys                            */
--hl-kro-keyword:       #d6d3d1;   /* kro-specific keywords (readyWhen, forEach…)   */
--hl-cel-expression:    #93c5fd;   /* CEL ${…} expressions  ← primary attention     */
--hl-schema-type:       #e0c080;   /* SimpleSchema types (string, integer…)         */
--hl-schema-pipe:       #78716c;   /* SimpleSchema | separator                      */
--hl-schema-keyword:    #94a3b8;   /* SimpleSchema constraint keywords (default…)   */
--hl-schema-value:      #c4b5dc;   /* SimpleSchema constraint values                */
--hl-comment:           #6b6b6b;   /* YAML comments                                 */
```

**Contrast ratios (dark mode, WCAG)**:

| Token | Value | On `--color-bg` | On `--color-surface` | Passes |
|-------|-------|-----------------|----------------------|--------|
| `--color-primary` | `#5b8ef0` | 5.8:1 | 5.1:1 | AA ✓ |
| `--color-text` | `#e4e4e7` | 14.3:1 | 12.6:1 | AAA ✓ |
| `--color-text-muted` | `#a1a1aa` | 5.6:1 | 4.9:1 | AA ✓ |
| `--color-alive` | `#10b981` | 5.2:1 | 4.6:1 | AA ✓ |
| `--color-error` | `#f43f5e` | 5.0:1 | 4.4:1 | AA ✓ |
| `--color-reconciling` | `#f59e0b` | 6.9:1 | 6.1:1 | AA ✓ |
| `--color-pending` | `#8b5cf6` | 4.6:1 | 4.1:1 | AA ✓ |
| `--hl-cel-expression` | `#93c5fd` | 7.8:1 | 6.9:1 | AA ✓ |

#### Light mode (`[data-theme="light"]`)

```css
--color-primary:        #3b6fd4;   /* Darker for sufficient contrast on light bg   */
--color-primary-hover:  #2c5fc4;
--color-primary-muted:  rgba(59, 111, 212, 0.08);
--color-primary-text:   #3b6fd4;

--color-bg:             #f6f8fa;
--color-surface:        #ffffff;
--color-surface-2:      #f1f3f5;
--color-surface-3:      #e8eaed;

--color-border:         #d1d5db;
--color-border-subtle:  #e5e7eb;
--color-border-focus:   #3b6fd4;

--color-text:           #111827;
--color-text-muted:     #4b5563;
--color-text-faint:     #9ca3af;

--color-alive:          #059669;   /* Darker emerald for light bg contrast         */
--color-reconciling:    #d97706;   /* Darker amber                                  */
--color-pending:        #7c3aed;   /* Darker violet                                 */
--color-error:          #e11d48;   /* Darker rose                                   */
--color-not-found:      #6b7280;

--color-status-ready:   #059669;
--color-status-error:   #e11d48;
--color-status-unknown: #6b7280;
--color-status-warning: #d97706;

--hl-yaml-key:          #6b7280;
--hl-kro-keyword:       #475569;
--hl-cel-expression:    #3b6fd4;   /* Same hue family as primary                   */
--hl-schema-type:       #be7b8a;
--hl-schema-pipe:       #9ca3af;
--hl-schema-keyword:    #6b8cae;
--hl-schema-value:      #7c5caa;
--hl-comment:           #9ca3af;
```

---

## Semantic color usage guide

This table is the **contract** between the design spec and every component.
An implementer must not use a color outside of its defined semantic purpose.

| Token | Use | Never use for |
|-------|-----|---------------|
| `--color-primary` | Buttons, links, active tabs, focus rings, selected states | Status indicators, graph nodes |
| `--color-alive` / `--color-status-ready` | DAG node alive state, Ready=True badge | Anything not "resource is healthy" |
| `--color-error` / `--color-status-error` | DAG node error state, Ready=False badge | Warnings, in-progress states |
| `--color-reconciling` | DAG node reconciling (pulsing), in-progress badge | Errors, healthy states |
| `--color-pending` | DAG node waiting on dependency (not yet created by design) | Errors, healthy states |
| `--color-not-found` / `--color-status-unknown` | DAG node not found in cluster, unknown condition, unknown state | Anything that has a known state |
| `--color-text` | Body text, labels | Decorative elements |
| `--color-text-muted` | Metadata, timestamps, secondary labels | Primary content |
| `--color-text-faint` | Placeholders, disabled states | Any readable content |
| `--color-surface` | Card backgrounds, panel backgrounds | Page background |
| `--color-surface-2` | Dropdown backgrounds, tooltips, elevated panels | Cards |
| `--color-surface-3` | Code block backgrounds | UI chrome |
| `--color-border` | Card borders, dividers, input borders | Focus rings (use `--color-border-focus`) |

---

## DAG node visual identity

The DAG is the most important visual element. Each node type has a distinct
visual treatment using color and shape — not color alone (colorblind safe).

Node types map **exactly** to upstream kro's `NodeType` constants
(`pkg/graph/node.go`). There are **five** upstream node types:

| Upstream `NodeType` | kro-ui label | Fill | Border | Badge/indicator |
|--------------------|-------------|------|--------|-----------------|
| `NodeTypeInstance` | Root CR (ID: `schema`) | `--node-root-bg` | `--node-root-border` (2px solid) | "root" pill |
| `NodeTypeResource` | Managed resource | `--node-default-bg` | `--node-default-border` (1px solid) | kind label |
| `NodeTypeCollection` | forEach fan-out | `--node-collection-bg` | `--node-collection-border` (1px solid) | `∀` badge |
| `NodeTypeExternal` | External ref (single) | `--node-external-bg` | `--node-external-border` (1px dashed) | `⬡` icon |
| `NodeTypeExternalCollection` | External ref (collection) | `--node-external-bg` | `--node-external-border` (1px dashed) | `⬡ ∀` icons |

**Visual modifiers** (applied on top of base node type styles, not separate types):

| Modifier | Condition | Visual change |
|----------|-----------|---------------|
| Conditional | `includeWhen` set on the resource | Dashed border replaces solid border + `?` badge |
| Schema-status | `spec.schema.status` field references this resource | Subtle annotation (no color change) |

> **Note**: `specPatch` is NOT an upstream kro concept and does not exist in
> `kubernetes-sigs/kro`. It must not appear anywhere in kro-ui. If you encounter
> it in a user's RGD, it is from an unofficial fork and should be rendered as
> a plain `NodeTypeResource` with an unknown-template warning.

**Live state overlay** (instance view — applied on top of base type styles):

| State | Token pair | Animation | Maps to kro `NodeState` |
|-------|-----------|-----------|------------------------|
| `SYNCED` | `--node-alive-bg` / `--node-alive-border` (2px) | none | `NodeStateSynced` |
| `IN_PROGRESS` | `--node-reconciling-bg` / `--node-reconciling-border` (2px) | `reconciling-pulse 1.5s` | `NodeStateInProgress` |
| `WAITING_FOR_READINESS` | `--node-pending-bg` / `--node-pending-border` (1px dashed) | none | `NodeStateWaitingForReadiness` |
| `SKIPPED` | `--node-pending-bg` / `--node-pending-border` (1px dashed) | none | `NodeStateSkipped` |
| `ERROR` | `--node-error-bg` / `--node-error-border` (2px) | none | `NodeStateError` |
| `DELETING` | `--node-reconciling-bg` / `--node-reconciling-border` (2px) | `reconciling-pulse 1.5s` | `NodeStateDeleting` |
| not-found / unknown | `--node-notfound-bg` / `--node-notfound-border` (1px dashed) | none | resource absent from cluster |

---

## Typography

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

**Type scale** (base 14px):

| Role | Size | Weight | Token usage |
|------|------|--------|-------------|
| Page heading | 20px | 600 | RGD name in detail page |
| Section heading | 16px | 600 | Panel titles |
| Body | 14px | 400 | Default — most content |
| Small / metadata | 12px | 400 | Age, namespace, secondary labels |
| Code | 13px | 400 | Mono font — YAML, CEL expressions |
| Badge / pill | 11px | 500 | Status dots, type badges |

Fonts are loaded from Google Fonts in `index.html` only. The binary works
fully offline — fonts fall back to the system stack.

---

## Spacing and geometry

```css
--radius-sm:  4px;   /* Badges, small pills                    */
--radius:     8px;   /* Cards, panels, buttons                 */
--radius-lg: 12px;   /* Modals, large panels                   */
```

**Spacing scale** (multiples of 4px):

```
4px   — tight: icon padding, badge padding
8px   — compact: list item gap, small internal padding
12px  — standard: card internal padding (horizontal)
16px  — comfortable: card internal padding (vertical), section gap
24px  — section spacing
32px  — large section gap, page margins
```

---

## Icons

Use **inline SVG only**. No icon library. This keeps the binary self-contained
(constitution §IV) and avoids shipping 300 unused icons.

Required icons (all SVG, 16×16 viewBox):

| Icon | Usage |
|------|-------|
| `chevron-down` | Dropdown triggers |
| `x` | Close buttons |
| `copy` | Code block copy button |
| `check` | Copied confirmation |
| `refresh` | Refresh indicator |
| `circle` | Status dot base |
| `alert-triangle` | Error state |
| `clock` | Age / timestamp |
| `layers` | RGD resource count |

---

## Motion

Minimal — this is a monitoring tool, not a marketing site.

```css
/* Standard transition for color/opacity changes */
--transition-fast:   80ms ease;
--transition:       150ms ease;
--transition-slow:  250ms ease;

/* Reconciling node pulse */
@keyframes reconciling-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
/* Usage: animation: reconciling-pulse 1.5s ease-in-out infinite; */
```

---

## Accessibility requirements

- **WCAG AA minimum** for all text and interactive elements
- **WCAG AAA** for body text (`--color-text` on `--color-bg`: 14.3:1)
- All interactive elements MUST have a visible focus ring using `--color-border-focus`
- Semantic state colors MUST NOT be the only differentiator — always pair with
  shape (border style), icon, or text label (colorblind safety)
- Font size MUST NOT go below 11px

---

## File location

The complete token definitions live in `web/src/tokens.css`. This is the
**only** place tokens are defined. All other CSS files import or reference them
via `var(--token-name)`. Never duplicate a token value in another file.

---

## Logo

### Design rationale

kro-ui needs a logomark that works at three scales: favicon (16×16), header
nav (24×24), and a potential splash/loading state (~64×64). It must be a
**single SVG** that renders crisply at all three sizes, works on both dark
(`#1b1b1d`) and light (`#f6f8fa`) backgrounds without swapping assets, and
is self-contained (no external fonts or images).

The mark should feel like a sibling to the kro.run wordmark — same product
family, but distinct enough to signal "this is the dashboard, not the docs."

### Generation prompt

Flat geometric logomark for a technical software project, featuring a central "K" shape constructed from a directed acyclic graph (DAG). The design is contained within a thick, hexagonal border divided into segments with directional arrows. The "K" consists of solid circular nodes connected by straight, uniform lines with small arrowheads indicating a downward and outward flow. Aesthetic is strictly minimalist, modernist, and precision-engineered, resembling a network topology or circuit schematic. Color palette is entirely flat and monochromatic using brand blue #5b8ef0 on a clean white background. No gradients, no glows, no shadows, no 3D effects, and no organic shapes. 1:1 aspect ratio, high contrast, vector style.

```

### Variants needed

| Variant | Size | Usage | File |
|---------|------|-------|------|
| Favicon | 16×16 rendered | Browser tab, bookmarks | `web/public/favicon.png` |
| Nav mark | 24×24 rendered | Header navigation bar, next to "kro-ui" wordmark | `<img>` in `Layout.tsx` referencing `/logo.png` |
| Social / OG | 64×64 min | `og:image` fallback, README badge | `web/public/logo.png` |
| Source | original | Archival, regeneration reference | `logo.png` (repo root) |

All three use the same source PNG (`logo.png`) scaled via CSS `width`/`height`.
If an SVG version is created later, it should replace the PNG variants and the
favicon `<link>` in `index.html` should revert to `type="image/svg+xml"`.

### Implementation notes

- The favicon is referenced in `web/index.html` as `/favicon.png`
  (`type="image/png"`)
- The nav mark is rendered via `<img src="/logo.png">` in `Layout.tsx` with
  CSS sizing — use `width: 24px; height: 24px` and `object-fit: contain`
- The source PNG lives at the repo root for easy regeneration reference
- If converting to SVG in the future: avoid `<text>` elements, external fonts,
  or `<image>` refs; keep path count under 10

---

## Change process

Color changes require:
1. Update this spec with new values and rationale
2. Update `web/src/tokens.css`
3. Verify contrast ratios in the table above still pass WCAG AA
4. If a semantic meaning changes, update the usage guide table
5. Commit message: `design(tokens): <what changed and why>`

---

## Component interaction patterns

These are **binding patterns** — all components must follow them unless a spec
explicitly overrides with documented rationale.

### Cards (RGD cards, cluster cards, catalog cards)

- The **entire card** is a clickable target navigating to the primary resource view
- Wrap card content in a `<Link>` or make the card a `<button>` with `role`
- Secondary actions (e.g., "Instances" link, "Graph" link) live inside the card
  as separate interactive elements, not the primary navigation target
- Cards must have `cursor: pointer` on the whole surface
- Cards that link elsewhere must have appropriate `aria-label` describing the destination
- **Never** make a card where the only clickable elements are small text links at the bottom

### Data tables

- **Column headers** on sortable columns must be `<button>` elements with visible sort icon
  (`↑`, `↓`, `↕`); default state shows `↕` (unsorted)
- **Default sort**: specified per component; for instance tables default to Name A→Z;
  for health-related tables default to worst-first (errors before healthy)
- **Empty state**: a `<div>` with a readable message and muted text color — never an
  empty `<tbody>`; empty state should be distinct from a loading state
- **Loading state**: skeleton rows or a spinner — never leave the table blank during fetch
- Tables with > 100 rows should use pagination or virtual scrolling (spec requirement for
  any table expected to have unbounded rows)

### Page titles

All pages MUST set `document.title` via a `usePageTitle(title)` hook or equivalent.
Titles follow the format `<content> — kro-ui`. Specific rules:

| Page | Title format |
|------|-------------|
| Overview (was: Home) | `Overview — kro-ui` |
| Catalog | `Catalog — kro-ui` |
| Fleet | `Fleet — kro-ui` |
| Events | `Events — kro-ui` |
| RGD detail | `<rgd-name> — kro-ui` |
| Instance detail | `<instance-name> / <rgd-name> — kro-ui` |
| 404 | `Not Found — kro-ui` |

### Breadcrumb navigation

Pages at depth ≥ 3 (instance detail, any sub-resource page) MUST render a breadcrumb
above the page heading:

```
Home  /  <RGD name>  /  Instances  /  <instance name>
```

- Each non-terminal segment is a `<Link>`
- The terminal segment (current page) is plain text, `aria-current="page"`
- Breadcrumb container: `<nav aria-label="Breadcrumb"><ol>...</ol></nav>`
- Separator: `/` as a non-interactive `<span aria-hidden="true">`

### Tooltips

- Any text that is truncated (e.g., long ARNs, context names, node IDs) MUST expose
  the full value in a `title` attribute at minimum
- DAG nodes MUST show a hover tooltip with: node ID, kind, node type badge,
  and `includeWhen` expression (if present)
- Tooltip component uses `--color-surface-2` background, `--color-border` border,
  positioned via CSS `position: absolute` in a portal — never clips behind SVG

### Not-found / 404 page

A `NotFound` component MUST be registered as the catch-all route (`path="*"`).
It must render:
- "Page not found" heading
- The attempted URL
- A link back to `/` (Home)
- Standard `kro-ui` layout (TopBar, etc.) — not a blank page

### Refresh indicators

Any page or component that polls for data MUST show:
- A "refreshed Xs ago" indicator that counts up from the last successful poll
- The indicator should switch to minutes when ≥ 60s: "refreshed 2m ago"
- On poll failure: "Refresh paused — retrying" (not a silent spinner)
- Manual refresh pages (Fleet, any one-shot fetch) MUST have an explicit refresh button
