# Research: 042-rgd-designer-nav

**Date**: 2026-03-25  
**Branch**: `042-rgd-designer-nav`

## Overview

This spec has no major unknowns — the codebase is well understood and all building blocks exist. This document records the key decisions made during research.

---

## Decision 1: TopBar — NavLink placement and CSS

**Decision**: Move `+ New RGD` from a `<Link>` button outside `<nav>` to a `<NavLink>` inside `<nav className="top-bar__nav">` alongside Overview, Catalog, Fleet, Events. Remove the `.top-bar__new-rgd-btn` CSS class.

**Rationale**: The button is currently rendered after `</nav>` with a distinct pill style (`--color-primary` background), which treats it as a secondary CTA rather than a primary nav destination. Placing it inside `<nav>` with the standard `.top-bar__nav-link` + `.top-bar__nav-link--active` classes makes it a first-class section. The `isActive` state will highlight it when the user is on `/author`.

**Label**: `RGD Designer` (was `+ New RGD`). Communicates a persistent tool, not a one-time creation wizard.

**data-testid**: `topbar-rgd-designer` (was `topbar-new-rgd`). Updated to match the E2E journey update.

**Alternatives considered**:
- Keep it as a button but restyled — rejected because visually it would still be outside the nav flow, inconsistent with other nav items.
- Keep it outside `<nav>` but as a NavLink — rejected because the `<nav>` element is the semantic landmark for navigation.

---

## Decision 2: GenerateTab — Remove 'rgd' mode

**Decision**: Remove the `'rgd'` mode from `GenerateTab.tsx` entirely. Delete:
- `type GenerateMode = 'form' | 'batch'` (drop `'rgd'`)
- The "New RGD" mode button (`data-testid="mode-btn-rgd"`)
- The `rgdState`, `setRgdState`, `rgdYaml` state
- The `{mode === 'rgd' && <RGDAuthoringForm>}` and `{mode === 'rgd' && <YAMLPreview>}` branches
- The `generateRGDYAML` and `STARTER_RGD_STATE` and `RGDAuthoringState` imports (if unused after removal)
- `RGDAuthoringForm` import

**Rationale**: The authoring scaffolder has nothing to do with the current RGD — it is not contextual. It duplicates `/author`. Users seeing it in the context of an existing RGD's detail page are confused about whether it scaffolds a child RGD or something else.

**Optional text link at bottom**: Per issue #196, a subtle link "Open RGD Designer →" pointing to `/author` may optionally be added at the bottom of the Generate tab. This is a low-effort affordance for discovery without reinstating the full mode.

**Alternatives considered**:
- Keep mode but disable it — rejected, still confusing.
- Add a redirect from the mode button to `/author` — rejected, violates the tab model (users don't expect tab buttons to navigate away from the page).

---

## Decision 3: AuthorPage — Live DAG Preview

**Decision**: Add a live DAG preview panel to `AuthorPage.tsx`. Layout changes from two-column (form | YAML) to three-section:
- Left column: form (existing `RGDAuthoringForm`)
- Right column, upper: live DAG preview (new `DAGPreview` component or inline render)
- Right column, lower: YAML preview (existing `YAMLPreview`)

The DAG preview uses `buildDAGGraph(spec, [])` where `spec` is derived from `RGDAuthoringState` via a new helper `rgdAuthoringStateToSpec`. `buildDAGGraph` already accepts an optional `rgds` argument — passing `[]` means no chain detection, which is correct (the authoring page has no cluster context).

**Update**: Rather than a separate `DAGPreview` component, use `StaticChainDAG` directly. `StaticChainDAG` requires `rgds: K8sObject[]` but it can be passed as `[]`. The `rgdName` prop is derived from `state.rgdName || 'my-rgd'`.

**Debouncing**: Use the existing `useDebounce(state, 300)` hook on the `rgdState` so the DAG only recomputes 300ms after the user stops typing.

**Empty state hint**: When `state.resources.length === 0`, the root `schema` node alone is shown. Below the DAG, render a subtle hint: *"Add resources to see the dependency graph"*. This is not an error state — the DAG with only the schema node is valid and renders correctly.

**`document.title`**: Update from `"New RGD — kro-ui"` to `"RGD Designer — kro-ui"` (via `usePageTitle('RGD Designer')`).

**Page header**: Update `<h1>` from `"New RGD"` to `"RGD Designer"`, subtitle from *"Scaffold a ResourceGraphDefinition YAML"* unchanged.

**Alternatives considered**:
- Replace YAML preview with DAG preview — rejected, users need the YAML output to copy/paste.
- Stack all three vertically — rejected per issue #196 layout diagram (form | DAG+YAML side-by-side).
- Custom lightweight DAG renderer — rejected, `buildDAGGraph` + `StaticChainDAG` are the established pipeline; duplicating them would introduce divergence.

---

## Decision 4: `rgdAuthoringStateToSpec` helper

**Decision**: Add `rgdAuthoringStateToSpec(state: RGDAuthoringState): Record<string, unknown>` to `web/src/lib/generator.ts`. This converts authoring state into the `spec` shape that `buildDAGGraph` expects:

```ts
{
  schema: {
    kind: state.kind,
    apiVersion: state.apiVersion,
    spec: Object.fromEntries(state.specFields.map(f => [f.name, f.type])),
  },
  resources: state.resources.map(r => ({
    id: r.id,
    template: {
      apiVersion: r.apiVersion,
      kind: r.kind,
      metadata: { name: '' },
      spec: {},
    },
  })),
}
```

**Rationale**: Keeps the DAG computation pure (no YAML parsing) and reuses the existing `buildDAGGraph` contract. `generator.ts` already knows the `RGDAuthoringState` shape, so placing this helper there collocates all state-transformation logic.

---

## Decision 5: Empty-state CTA copy updates

**Decision**:
- `Home.tsx` line 137: Change `"New RGD"` link text to `"Open RGD Designer"`. `data-testid` stays `"home-new-rgd-link"`.
- `Catalog.tsx` line 224: Change link text from `"in-app authoring tool"` to `"RGD Designer"`. `data-testid` stays `"catalog-new-rgd-link"`.

**Rationale**: Consistent branding with the nav rename.

---

## Decision 6: E2E test updates

**Decision**: Update `test/e2e/journeys/039-rgd-authoring-entrypoint.spec.ts`:

| Step | Old assertion | New assertion |
|------|--------------|--------------|
| Step 1 | `getByTestId('topbar-new-rgd')` visible, text contains `'New RGD'` | `getByTestId('topbar-rgd-designer')` visible, text contains `'RGD Designer'` |
| Step 2 | `getByTestId('topbar-new-rgd')` click → `/author`, title `/New RGD/` | `getByTestId('topbar-rgd-designer')` click → `/author`, title `/RGD Designer/` |
| Step 3 | `getByTestId('topbar-new-rgd')` (now `topbar-rgd-designer`) | same update |
| Step 4 | `mode-btn-rgd` click — **step 4 is DELETED** since the mode no longer exists | Step 4 replaced with: navigate to `/author`, verify DAG preview renders |

**Note on Step 4**: The regression guard for the old `'rgd'` mode no longer applies. The new Step 4 (optional, if added) verifies the DAG preview panel is present on `/author`.

---

## Decision 7: CSS for AuthorPage three-section layout

**Decision**: Update `AuthorPage.css` to add a right-column split:

```css
.author-page__right-pane {
  flex: 1 1 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.author-page__dag-pane {
  flex: 0 0 auto;
  min-height: 200px;
  max-height: 340px;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.author-page__dag-hint {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 8px 0 0;
}
```

All colors reference tokens. No hardcoded hex/rgba.

---

## Resolved unknowns

| Unknown | Resolution |
|---------|-----------|
| Can `StaticChainDAG` be used with empty `rgds`? | Yes — `rgds=[]` disables chain detection, all nodes render with `isChainable=false` |
| Does `buildDAGGraph` work with `RGDAuthoringState.resources`? | Yes — needs `rgdAuthoringStateToSpec` adapter; shape matches the `spec` parameter |
| Is a debounce hook already available? | Yes — `web/src/hooks/useDebounce.ts` (used in Home and Catalog) |
| Will removing `mode-btn-rgd` break E2E? | Yes — Step 4 in 039 spec must be updated or replaced |
| Does `GenerateTab.css` have `mode-btn--rgd` styles? | Unknown — check during implementation; remove if present |
