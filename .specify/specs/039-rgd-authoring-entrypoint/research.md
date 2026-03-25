# Research: RGD Authoring Global Entrypoint (039)

All research items were resolved by reading the existing codebase. No external
unknowns.

---

## Decision 1: Route for the standalone authoring page

**Decision**: `/author`

**Rationale**:
- Short, unambiguous, imperative — matches "I want to author an RGD"
- Does not conflict with any existing route (`/`, `/catalog`, `/fleet`,
  `/events`, `/rgds/:name`, `/rgds/:rgdName/instances/:namespace/:instanceName`)
- GH issue #162 proposed `/author` or `/new-rgd`; `/author` is shorter and more
  aligned with the action (authoring the definition, not just creating an
  instance)

**Alternatives considered**:
- `/new-rgd` — more explicit but verbose; `/author` is sufficient
- `/rgds/new` — implies a CRUD operation on the rgds resource collection; kro-ui
  is read-only and the authoring is for scaffold YAML, not a k8s write

---

## Decision 2: Top bar placement of "New RGD" action

**Decision**: A styled `<Link>` button placed between the nav links and the
`ContextSwitcher` in `TopBar`.

**Rationale**:
- The current `top-bar__nav` flex container holds only `NavLink` items (Home,
  Catalog, Fleet, Events). Adding a CTA button of different visual weight there
  would conflict with the nav semantics.
- Placing it to the right of nav (before `ContextSwitcher`) gives it prominence
  without conflating navigation with actions.
- Styled as `top-bar__new-rgd-btn` — distinct from `top-bar__nav-link` so it
  can get primary-colored styling (matches `--color-primary`).

**Alternatives considered**:
- Adding it as a fifth `NavLink` alongside Home/Catalog/Fleet/Events — rejected
  because authoring is an action, not a page you passively visit; conflating it
  with navigation links reduces clarity
- Floating action button (FAB) — rejected; too much visual noise for a
  dashboard-oriented UI; also inconsistent with existing design language

---

## Decision 3: AuthorPage component structure

**Decision**: `AuthorPage` owns `RGDAuthoringState` locally and renders
`RGDAuthoringForm` + `YAMLPreview` side-by-side, mirroring the layout
already used in `GenerateTab` for the "rgd" mode.

**Rationale**:
- `RGDAuthoringForm` and `YAMLPreview` already exist and are tested
- `generateRGDYAML` from `generator.ts` is already tested (33 unit tests)
- `STARTER_RGD_STATE` constant in `GenerateTab.tsx` should be extracted to a
  shared location (`lib/generator.ts`) so both `AuthorPage` and `GenerateTab`
  use the same default

**Alternatives considered**:
- Extract a shared `RGDAuthoringPanel` component wrapping both form and preview —
  would reduce duplication but adds an extra abstraction layer for only two
  call sites; premature abstraction
- Embed the panel via iframe or lazy route — overly complex; all assets are
  already in-bundle

---

## Decision 4: STARTER_RGD_STATE sharing

**Decision**: Export `STARTER_RGD_STATE` from `web/src/lib/generator.ts`.

**Rationale**:
- Currently defined as a `const` inside `GenerateTab.tsx` (module-private)
- `AuthorPage` needs the same starter state
- The generator lib already owns all authoring types (`RGDAuthoringState`,
  `AuthoringField`, `AuthoringResource`) — adding `STARTER_RGD_STATE` there
  is cohesive; it is a pure data constant with no React dependency

**Alternatives considered**:
- Copy the constant into `AuthorPage.tsx` — rejected; leads to divergence if
  the starter state is updated in the future (anti-pattern per AGENTS.md anti-patterns table)
- Create a new `lib/authoring.ts` — unnecessary for one constant; generator.ts
  is the right home

---

## Decision 5: Home and Catalog empty state modifications

**Decision**:
- Home: Add a `<Link to="/author">` styled as `home__empty-cta` in the
  onboarding empty state (items.length === 0, no search query), alongside the
  existing "Get started with kro" and "kro on GitHub" CTAs.
- Catalog: Add a `<Link to="/author">` in the zero-items empty state only
  (items.length === 0, not the "no search results" variant).

**Rationale**:
- The Home onboarding empty state already has a well-styled CTA row; adding a
  third action requires no structural change to the markup
- The "no search results" variant (debouncedQuery != '') should NOT show "New
  RGD" — the user is actively filtering and a "create" affordance would be
  confusing; they likely want to clear the search, not author a new RGD
- Catalog zero-items state currently says `"Create one with kubectl apply -f
  your-rgd.yaml"` — adding "or use the in-app authoring tool" is the natural
  complement

---

## Decision 6: Per-RGD Generate tab preservation

**Decision**: No change to `GenerateTab.tsx` mode-switching logic. The "New RGD"
button inside `GenerateTab` remains a mode switch (not a navigation link).

**Rationale**:
- Issue #162 explicitly requires the context-aware shortcut to be preserved
- The per-RGD generate tab opens knowing the parent RGD's schema, which could
  be used in future to pre-fill fields — navigating away to `/author` would lose
  that context
- No regression introduced

---

## Resolved questions from GH issue #162

| Question | Resolution |
|----------|-----------|
| Route: `/author` vs `/rgds/:name?tab=generate` | Standalone `/author` route; per-RGD tab preserved |
| Nav placement | Right of nav links, before ContextSwitcher; styled as CTA button |
| Empty-state integration | Home onboarding empty state + Catalog zero-items state only |
| Context-aware shortcut preservation | No change to GenerateTab; mode switch stays local |

---

## No NEEDS CLARIFICATION items

All technical decisions are fully resolved from codebase reading. No external
dependencies or unknowns.
