# Quickstart: Generate Form Polish + DAG Legend + Overlay Fixes (034)

**Branch**: `034-generate-form-polish`
**Updated**: 2026-03-23

---

## Prerequisites

- kro-ui running locally: `make go` + `make web` (or `bun run --cwd web dev` for hot-reload)
- A live kro cluster connected with at least one RGD containing conditional, forEach, and
  external-ref nodes (e.g. `dungeon-graph`)

---

## Manual Validation Steps

### Area 1 — Generate tab required-field legend (issue #121)

1. Navigate to any RGD → **Generate** tab → **Instance Form**
2. **Verify**: A legend row appears **above** the field rows showing
   `● required` (in error/red color) and `● optional` (in muted color)
3. Hover a `●` next to a required field → tooltip reads **"Required field"**
4. Hover a `●` next to an optional field → tooltip reads **"Optional field"**
5. Open DevTools → Elements → click a required text input → verify `aria-required="true"`
6. Click an optional input → verify `aria-required` is absent or `"false"`
7. Click the `metadata.name` input → verify `aria-required="true"`

### Area 2 — RGD Authoring form label (issue #121)

1. Navigate to **Generate** tab → **New RGD** mode → click **+ Add Field**
2. **Verify**: The required-checkbox label reads **`Required`** (not `req`)

### Area 3 — DAG legend (issue #118)

1. Navigate to any RGD → **Graph** tab
2. **Verify**: A legend row appears **below** the DAG SVG showing:
   - `?` with label "conditional (includeWhen)"
   - `∀` with label "forEach collection"
   - `⬡` with label "external reference"
3. Badge chars should match the colors of those badges on DAG nodes
4. Navigate to a nested subgraph (expand a chainable node) → **Verify**: the
   legend does NOT appear inside the nested subgraph (depth 0 only)

### Area 4 — Overlay crash fix

1. Navigate to `dungeon-graph` → **Graph** tab
2. Select an overlay instance from the dropdown (e.g. `default/asdasda`)
3. **Verify**: No "Overlay failed: t is not iterable" error message appears
4. **Verify**: The DAG nodes show live-state colors (or `not-found` gray dashed
   rings if no children are returned)

### Area 5 — Expand accordion behavior

1. Navigate to `dungeon-graph` → **Graph** tab
2. Click `▸` on `monsterCRs` → subgraph expands below
3. Click `▸` on `bossCR` → **Verify**: `monsterCRs` subgraph collapses,
   `bossCR` subgraph opens (no overlap)
4. Click `▾` on `bossCR` → **Verify**: subgraph collapses, DAG returns to normal

---

## Automated Validation

```bash
# TypeScript check
bun run --cwd web tsc --noEmit

# Unit tests
bun run --cwd web test

# All tests must pass with 0 errors and 0 type errors
```
