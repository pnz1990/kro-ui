# Fix: Multi-issue UX/bug fixes — conditions, schema, catalog, home, fleet

**Issue(s)**: #159, #164, #168, #169, #170, #172
**Branch**: fix/issue-159-164-168-169-170-172-multi-ux-fixes
**Labels**: bug (159, 164), enhancement (168, 169, 170, 172)

> Note: Issue #160 (LiveDAG state nodes render ID twice) was already fixed in PR #157.

---

## Root Causes

- **#159**: `ConditionsPanel` counts `ReconciliationSuspended=False` as unhealthy. Kubernetes convention: for suspension-type conditions, `False` = healthy (not suspended). `ErrorsTab.groupErrorPatterns` also aggregates `False` conditions unconditionally, including this inversion case.
- **#164**: `schema.ts` `parseSimpleSchema` only handles `default=X` (equals) syntax. kro may emit `default: X` (colon-space) for some RGDs. Unrecognized modifier → no `default` key in ParsedType → `hasDefault=false` → field shows as REQUIRED. Also, `FieldTable.tsx:106` has inverted logic: `!field.parsedType?.required` makes `| required` fields appear optional.
- **#168**: `CatalogCard` shows literal `…` for loading counts — no shimmer, indistinguishable from broken.
- **#169**: `Home.tsx` heading is `ResourceGraphDefinitions` (internal K8s name) — should say `RGDs`.
- **#170**: `FleetMatrix` leaves absent-RGD cells blank — indistinguishable from still-loading or error cells.
- **#172**: Home page has no tagline or description for first-time users in the non-empty state.

---

## Files to change

- `web/src/lib/schema.ts` — parseSimpleSchema: handle `default: X` colon syntax
- `web/src/components/FieldTable.tsx:106` — fix inverted required logic
- `web/src/components/ConditionsPanel.tsx:79` — use isHealthyCondition() for trueCount
- `web/src/components/ErrorsTab.tsx:73` — skip inverted-semantics conditions in groupErrorPatterns
- `web/src/components/CatalogCard.tsx` + `CatalogCard.css` — shimmer for undefined count
- `web/src/components/FleetMatrix.tsx` — render `–` for absent cells
- `web/src/components/FleetMatrix.css` — style for absent dash
- `web/src/pages/Home.tsx:139` — heading text + tagline for non-empty state

---

## Tasks

### Phase 1 — Fix #159: ReconciliationSuspended inversion

- [x] Add `INVERTED_CONDITIONS` allowlist in `ConditionsPanel.tsx`: `{ ReconciliationSuspended: 'False' }` — conditions where `False` is the healthy value
- [x] Fix `trueCount` in `ConditionsPanel.tsx` to use `isHealthyCondition()` helper that respects inversion
- [x] Fix `statusClass()` in `ConditionsPanel.tsx` to render inverted conditions with `--true` style when value matches the healthy value
- [x] Fix `groupErrorPatterns` in `ErrorsTab.tsx` to skip conditions where `False` is the healthy value (the condition is not actually an error)
- [x] Add unit test for `groupErrorPatterns` covering the ReconciliationSuspended=False exclusion

### Phase 2 — Fix #164: Schema required/default parsing

- [x] Fix `parseSimpleSchema` in `schema.ts` to also recognise `default: X` (colon-space) modifier (in addition to `default=X`)
- [x] Fix `FieldTable.tsx:106` inverted `required` logic: `const required = !hasDefault || field.parsedType?.required === true` — wait, re-examine: `!hasDefault` alone → required when no default; `field.parsedType?.required === true` → required when explicitly required. Correct: `const required = !hasDefault`… actually the existing logic IS correct for the normal case but inverted for `| required`. Fix: `const required = field.parsedType?.required === true || !hasDefault`... but then `hasDefault=true && required=true` → shows required=true. Is that correct? Yes — if explicitly `| required` and has default, it's still required. Fix: `const required = field.parsedType?.required === true || !hasDefault`.
- [x] Add schema.ts unit tests for `default:` colon syntax

### Phase 3 — Fix #168: Catalog loading shimmer

- [x] Replace `…` text with a `<span className="catalog-card__count-skeleton">` element in `CatalogCard.tsx`
- [x] Add shimmer CSS for `.catalog-card__count-skeleton` in `CatalogCard.css`
- [x] Add `--color-skeleton-bg` and `--color-skeleton-shine` tokens to `tokens.css` if not already present

### Phase 4 — Fix #169: Home heading

- [x] Change heading in `Home.tsx:139` from `ResourceGraphDefinitions` to `RGDs`
- [x] Update page title: add subtitle `kro-ui — RGDs` (currently just `kro-ui`)

### Phase 5 — Fix #170: Fleet matrix absent cells

- [x] Render `–` (en-dash) in `FleetMatrix.tsx` for `absent` cells
- [x] Add CSS for `.fleet-matrix__cell--absent` muted dash indicator
- [x] For `unknown` cells (auth failure), add distinct indicator or keep blank with aria-label already covering it

### Phase 6 — Fix #172: Home page tagline

- [x] Add a subtitle/tagline below `<h1>` in `Home.tsx` for the non-empty state
- [x] Add CSS for tagline element

### Phase 7 — Verify

- [ ] Run `bun run --cwd web tsc --noEmit`
- [ ] Run `bun run --cwd web vitest run`
- [ ] Self-QA: absent data renders gracefully, no `?`, no `undefined`

### Phase 8 — PR

- [ ] Commit: `fix(web): ReconciliationSuspended inversion, schema defaults, catalog shimmer, home/fleet UX — closes #159, closes #164, closes #168, closes #169, closes #170, closes #172`
- [ ] Push branch and open PR
