# Research: 033-first-time-onboarding

**Phase 0 output** | Branch: `033-first-time-onboarding`

---

## 1. Where to add a tagline / descriptor for kro-ui

**Decision**: Add a subtitle below the `kro-ui` brand in the `TopBar`, or as a
sub-heading on the Home page hero. Based on visual hierarchy review, the
simplest, lowest-risk approach is a short `<span>` tagline added to the
`top-bar__brand` div — visible on every page without requiring a new component.
Alternatively (and more visually prominent) it can live as a sub-heading in
`Home.tsx` only, beneath the existing `<h1>ResourceGraphDefinitions</h1>`.

**Rationale**: The issue asks for "a brief tagline in the header or home hero".
Both options satisfy this. Adding it to the header makes it globally visible;
adding it to the home hero keeps the header compact and focused on navigation.
The home-hero placement is preferred because:
- The header is already crowded (brand + 4 nav links + ContextSwitcher)
- A tagline on the home hero is more prominent for first-time visitors
- It does not affect deep-link pages where context is already clear

**Alternatives considered**:
- Separate hero banner component — rejected; too much complexity for a one-liner
- Tooltip on the brand mark — rejected; invisible without hover

---

## 2. Footer: content and structure

**Decision**: Add a `Footer` component mounted in `Layout.tsx`. Content:
- Left: copyright line `© 2025 kro-ui contributors` (or similar)
- Center/right: links to `https://kro.run` and `https://github.com/kubernetes-sigs/kro`
- Optional: app version from `window.__KRO_UI_VERSION__` or fetched from `/api/v1/version`

**Rationale**: The issue explicitly requests a footer with links to the kro
website and GitHub repository. Mounting it in `Layout.tsx` (below `<Outlet>`)
ensures it appears on every page consistently. Using `Layout.tsx` is preferred
over adding it to individual pages.

**Alternatives considered**:
- Per-page footer — rejected; duplication, inconsistency risk
- Footer only on Home — rejected; the issue implies it should be universal
- Version number from API — accepted as optional enhancement; the
  `/api/v1/version` endpoint already exists (confirmed in `internal/api/handlers/`)

---

## 3. Empty state: content and design

**Decision**: Replace the current minimal empty state in `Home.tsx` (a single
`<p>` + `<a>`) with a richer panel that includes:
1. A kro-ui description: "A read-only observability dashboard for kro — the
   Kubernetes Resource Orchestrator."
2. A "Get started" section with a `kubectl` snippet or two installation steps
3. Two CTA links: "kro docs" and "kro on GitHub"
4. The existing "No ResourceGraphDefinitions found in this cluster." message

The implementation reuses the existing `VirtualGrid`'s `emptyState: ReactNode`
prop — no new component required; the empty-state is an inline JSX block in
`Home.tsx`.

**Rationale**: The `VirtualGrid` already accepts `emptyState` prop. An inline
JSX block (as already used) is the simplest approach — consistent with the
existing pattern. A new `EmptyState` component is not warranted here because
the home empty state is unique (kro-specific copy and CTAs not reusable
elsewhere).

**Alternatives considered**:
- Reusable `EmptyState` component — rejected; the content is kro-specific and
  not reused elsewhere
- Full-page onboarding overlay — rejected; too disruptive for returning users
  who have temporarily empty clusters

---

## 4. Token compliance for new styles

**Decision**: All colors in `Footer.css` and updated `Home.css` MUST use
`var(--token)` only. No inline hex or `rgba()`. If a new shadow is needed for
the footer (e.g., top border only — no shadow), use `border-top` with
`var(--color-border-subtle)` — no new shadow token required.

**Rationale**: Constitution §IX explicitly prohibits hardcoded hex or `rgba()`
in component CSS. All necessary color tokens already exist in `tokens.css`.
A footer separator is best implemented as a `border-top` (no new token
required) rather than a `box-shadow`.

**Alternatives considered**:
- Adding `--shadow-footer` token — rejected; a simple `border-top` is
  semantically more correct and token-free

---

## 5. External links — URL correctness

**Decision**:
- kro website: `https://kro.run`
- kro GitHub: `https://github.com/kubernetes-sigs/kro`
- kro docs: `https://kro.run/docs`
- All external links: `target="_blank" rel="noopener noreferrer"`

**Rationale**: These are the official URLs. The `noopener noreferrer` attribute
is required for security (prevents the opened page from accessing `window.opener`).

---

## 6. Version display in footer

**Decision**: Fetch version from `/api/v1/version` (endpoint already exists) and
display in footer as `v{version}`. If the request fails, omit silently (graceful
degradation per §XII).

**Rationale**: Displaying the version helps users identify what release they're
running. The endpoint is already implemented (`internal/api/handlers/handler.go`
or equivalent), so no backend changes are needed.

**Alternatives considered**:
- Inject via Vite `define` at build time — rejected; the Go binary wraps the
  frontend, so the version is runtime, not build-time
- `window.__KRO_UI_VERSION__` injection — rejected; would require backend
  template rendering of `index.html`, breaking the static embed model

---

## 7. No backend changes required

All changes are purely frontend:
- No new API endpoints
- No changes to Go handlers
- No changes to the Go embed setup

The `/api/v1/version` endpoint is already available for the optional footer
version display.

---

## Resolved unknowns

| Unknown | Resolution |
|---------|-----------|
| Where to add tagline | Home hero (sub-heading on `Home.tsx`, not in TopBar) |
| Footer structure | `Layout.tsx`-mounted component with kro links + version |
| Empty-state design | Inline JSX in `Home.tsx` via `VirtualGrid.emptyState` prop |
| New CSS tokens needed | None — existing tokens sufficient |
| Backend changes | None required |
| External URLs | `https://kro.run`, `https://github.com/kubernetes-sigs/kro`, `https://kro.run/docs` |
