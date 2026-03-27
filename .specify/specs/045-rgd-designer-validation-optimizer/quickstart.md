# Quickstart: 045 — RGD Designer Validation & Optimizer

**Branch**: `045-rgd-designer-validation-optimizer`
**Depends on**: `044-rgd-designer-full-features` (merged)

---

## What this spec adds

A pure validation layer + two UX improvements for the RGD Designer (`/author`):

1. **Inline validation messages** — `validateRGDState()` pure function detects:
   - Empty / bad-format `rgdName` and `kind`
   - Duplicate resource IDs, duplicate spec/status field names
   - forEach resources with no iterator
   - Spec field `minimum > maximum`
2. **Summary badge** — "N warning(s)" at the top of the form when issues exist
3. **`React.memo` on `YAMLPreview`** — avoids redundant reconciliation when the
   YAML string hasn't changed

---

## Files changed

| File | Change |
|------|--------|
| `web/src/tokens.css` | Add `--color-warning` token (dark + light) |
| `web/src/lib/generator.ts` | Add `ValidationIssue`, `ValidationState`, `validateRGDState` |
| `web/src/lib/generator.test.ts` | Add `validateRGDState` test suite (100% branch coverage) |
| `web/src/components/RGDAuthoringForm.tsx` | Consume `ValidationState`, render inline messages + summary badge |
| `web/src/components/RGDAuthoringForm.css` | Add `.rgd-authoring-form__field-msg`, `.--warn`, `.validation-summary`; fix `--color-warning` fallbacks |
| `web/src/components/RGDAuthoringForm.test.tsx` | Add inline validation rendering tests |
| `web/src/components/YAMLPreview.tsx` | Wrap with `React.memo` |
| `web/src/components/YAMLPreview.test.tsx` | Add memo render-count test (if file exists) |

**No Go changes. No new npm dependencies.**

---

## Implementation order

1. `tokens.css` — add `--color-warning` token first (all downstream CSS depends on it)
2. `generator.ts` — add types + `validateRGDState` pure function
3. `generator.test.ts` — add full test suite for `validateRGDState`
4. `YAMLPreview.tsx` — wrap with `React.memo`
5. `RGDAuthoringForm.css` — add validation message classes; fix `--color-warning` fallbacks
6. `RGDAuthoringForm.tsx` — import + call `validateRGDState`, render messages
7. `RGDAuthoringForm.test.tsx` — add validation rendering tests

---

## Dev workflow

```bash
# From the worktree directory
bun run dev          # start dev server at http://localhost:5173

# Typecheck
bun run typecheck    # or: npx tsc --noEmit

# Unit tests
bun test             # vitest

# Full CI check (before push)
make build           # go vet + go test + go build + bun typecheck
```

---

## Manual smoke test (after implementation)

1. Open `http://localhost:40107/author`
2. Clear the **Kind** field → "Kind is required" appears beneath it
3. Type `webApp` → "Kind should be PascalCase" warning appears
4. Type `WebApp` → warning disappears
5. Add two resources both with `id = deployment` → "Duplicate resource ID" on
   both rows; rename one → warnings clear
6. Add an integer spec field, expand constraints, set `min=10 max=5` → warning
   "minimum must be ≤ maximum" appears
7. Switch a resource to forEach mode, leave iterators empty → "forEach resources
   require at least one iterator" on that card
8. Verify YAML preview still updates (not blocked by validation)
9. Verify summary badge shows the correct count
