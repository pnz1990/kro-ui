# Spec: issue-768

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: 28.2 — Catalog RGD complexity score (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

- **O1**: `computeComplexityScore(rgd, chainingCount)` pure function exported from `@/lib/catalog.ts`. Formula: `resources.length + (chainingCount × 2) + (forEach_count × 3)` where `forEach_count = resources that have a non-empty forEach field`. Falsifiable: unit test with known input → expected score.
- **O2**: Each CatalogCard shows a numeric complexity score badge when score > 0 (`data-testid="complexity-badge"`). Score = 0 → badge hidden. Falsifiable: render with score 0 → badge absent; score 5 → badge shows "5".
- **O3**: A new sort option `complexity` (label "Most complex") is added to `SORT_OPTIONS` in `Catalog.tsx`. Catalog is sorted by complexity descending when selected. Falsifiable: select "Most complex" → cards ordered highest score first.
- **O4**: The default sort option changes from `name` to `complexity`. Falsifiable: initial render → `sortOption` state equals `'complexity'`.
- **O5**: Complexity badge uses token-based colors only — no hardcoded hex/rgba. Falsifiable: grep new CSS for `#[0-9a-fA-F]` or `rgba(` → empty.
- **O6**: `computeComplexityScore` is unit-tested with ≥5 test cases in `catalog.test.ts`. Falsifiable: test file contains `computeComplexityScore` assertions.

---

## Zone 2 — Implementer's judgment

- `chainingCount` = number of distinct RGDs that this RGD references via its template kinds (forward references, not reverse "used by"). Computed by checking this RGD's template kinds against the `kindToRGDName` map from `buildChainingMap`. Simpler: derive from `buildChainingReferenceCount(rgd, rgds)`.
- Badge appearance: a small monospace pill to the right of the kind badge in the card header. Color: `--color-text-muted` text on `--color-surface-2` background. Score shows as plain number — no icon.
- Sort: CatalogCard receives the computed score as a prop to avoid recomputing in the sort function.

---

## Zone 3 — Scoped out

- Per-RGD complexity history / trend tracking
- Configurable formula weights
- Complexity filter chips (just sorting, no filtering)
