# Fix: Multi-issue polish batch (14 bugs + enhancements)

**Issue(s)**: #114, #116, #117, #119, #122, #123, #124, #125, #126, #128, #129, #131, #132, #133
**Branch**: fix/issue-114-116-117-119-122-123-124-125-126-128-129-131-132-133
**Labels**: bug (114, 116, 117, 119, 122, 123, 128, 131), enhancement (124, 125, 126, 129, 132, 133)

## Root Causes

- **#114**: `parseSimpleSchema` stores string defaults with JSON quoting intact (`'"normal"'`); YAML serializer double-encodes them.
- **#116**: Catalog instance counts are fetched asynchronously but card renders `—` before the fetch resolves and never shows a loading indicator.
- **#117**: `truncateContextName` in ContextSwitcher uses 6-char account prefix (ambiguous); `abbreviateContext` in format.ts shows full account ID (also ambiguous for long IDs).
- **#119**: `InstanceTable` rows are plain `<tr>` elements with no click handler — only the `Open` link navigates.
- **#122**: `SpecPanel.extractSpecFields` converts empty strings to `String(value)` which is `""` — renders as blank cell.
- **#123**: `FleetMatrix` uses `abbreviateContext` (full account/cluster) while `ClusterCard` uses `abbreviateContext` too — both are consistent but issue #117 requests last-3-digits disambiguation.
- **#124**: `ClusterCard` renders "Auth failed" with no explanation or remediation hint.
- **#125**: Events page empty state has no context, hint, or polling indicator note.
- **#126**: `ConditionItem` "Not emitted by the connected kro version" message has no version guidance or docs link.
- **#128**: Fleet `<p className="fleet__subheading">` has default browser margin (`margin: 0` is set in CSS but `<p>` inside a `<div>` still might inherit spacing — issue is in `Fleet.tsx` using `<p>` inside a plain `<div>` which inherits `margin-bottom`).
- **#129**: Static RGD Graph tab (`RGDDetail.tsx`) has no "refreshed X ago" indicator — the RGD is loaded once on mount, not polled.
- **#131**: Events page filter label uses `Instance` (already correct in Events.tsx line 215 as "Instance") — need to verify.
- **#132**: `favicon.png` exists in `web/public/` and `index.html` references it — verify the file is a proper PNG (4MB suggests it may be a duplicate of logo.png at wrong size).
- **#133**: `AccessTab` SA banner shows `kro/kro` with no explanation of the `namespace/name` format.

## Files to Change

- `web/src/lib/schema.ts` — #114: strip JSON quotes from string defaults
- `web/src/lib/generator.ts` — #114: defensive strip in generateInstanceYAML (already passes through value)
- `web/src/components/CatalogCard.tsx` — #116: show loading spinner when instanceCount is `undefined` (not yet fetched vs `null` = failed)
- `web/src/pages/Catalog.tsx` — #116: distinguish "not yet fetched" (undefined) from "failed" (null)
- `web/src/lib/format.ts` — #117/#123: `abbreviateContext` show last 3 digits of account ID for disambiguation
- `web/src/components/ContextSwitcher.tsx` — #117: align `truncateContextName` with updated `abbreviateContext` pattern
- `web/src/components/InstanceTable.tsx` — #119: add `onClick` + `cursor: pointer` to `<tr>`
- `web/src/components/InstanceTable.css` — #119: `.instance-table__row--clickable` cursor
- `web/src/components/SpecPanel.tsx` — #122: render `—` for empty strings
- `web/src/components/ClusterCard.tsx` — #124: add hint text for auth-failed state
- `web/src/pages/Events.tsx` — #125: improve empty state with context + polling hint
- `web/src/components/ConditionItem.tsx` — #126: add kro version context to "Not emitted" message
- `web/src/pages/Fleet.tsx` — #128: fix extra whitespace around subtitle
- `web/src/pages/Fleet.css` — #128: ensure no margin leaks
- `web/src/pages/RGDDetail.tsx` — #129: add "refreshed X ago" indicator to Graph tab
- `web/src/components/AccessTab.tsx` — #133: expand SA format explanation
- `web/public/favicon.png` — #132: verify correct favicon (already exists, may need replacing)

## Tasks

### Phase 1 — Critical bugs (#114, #119, #122)

- [x] **#114** `web/src/lib/schema.ts:151`: In `parseSimpleSchema`, after extracting `raw = trimmed.slice('default='.length)`, strip surrounding JSON double-quotes from the value if it starts and ends with `"`. This fixes `'"normal"'` → `'normal'`.
- [x] **#119** `web/src/components/InstanceTable.tsx:155`: Add `onClick` handler to `<tr>` that calls `useNavigate()` to the instance detail URL. Add `cursor: pointer` via CSS class.
- [x] **#119** `web/src/components/InstanceTable.css`: Add `.instance-table__row { cursor: pointer; }` and hover background.
- [x] **#122** `web/src/components/SpecPanel.tsx:17-22`: Change empty-string value to render as `—` (em-dash) instead of blank.

### Phase 2 — UX/data bugs (#116, #117, #123, #128)

- [x] **#116** `web/src/pages/Catalog.tsx:43`: Change `instanceCounts` map value type to `number | null | undefined` where `undefined` = "not yet fetched", `null` = "fetch failed", `number` = actual count.
- [x] **#116** `web/src/components/CatalogCard.tsx:39`: Show loading skeleton (spinner or `…`) when count is `undefined`, `—` when `null`, number when resolved.
- [x] **#117** `web/src/lib/format.ts:199-201`: Update `abbreviateContext` for EKS ARNs to show `{first6}…{last3}/{clusterName}` format for unambiguous display.
- [x] **#117** `web/src/components/ContextSwitcher.tsx:30-35`: Align `truncateContextName` to use same `{accountPrefix}…{accountSuffix}/{clusterName}` format (last 3 digits).
- [x] **#128** `web/src/pages/Fleet.tsx:136`: Change `<p>` to `<span>` for the subtitle to avoid `<p>` block margin inflation inside `<div>`.

### Phase 3 — Enhancement / empty states (#124, #125, #126, #129, #131, #133)

- [x] **#124** `web/src/components/ClusterCard.tsx:65-69`: Add inline hint text for `auth-failed` health state with kubectl diagnostic command.
- [x] **#125** `web/src/pages/Events.tsx:293-296`: Expand empty state with context message, hint text, and note about polling.
- [x] **#126** `web/src/components/ConditionItem.tsx:125-128`: Update "Not emitted" message with guidance to check kro version.
- [x] **#129** `web/src/pages/RGDDetail.tsx`: Track `lastFetched` timestamp in the RGD fetch effect; display "refreshed X ago" in the Graph tab header area.
- [x] **#131** `web/src/pages/Events.tsx:215`: Verify/fix the Instance filter label — change from `INSTANCE` to `Instance` if needed.
- [x] **#133** `web/src/components/AccessTab.tsx:104`: Add tooltip/explanation of `namespace/name` format for the SA banner.

### Phase 4 — Favicon verification (#132)

- [x] **#132** Verify `favicon.png` in `web/public/` is a proper browser favicon (small, square); the current file is 4MB which suggests it's the full logo. Create a proper 32×32 SVG favicon or use the existing logo at an appropriate size.

### Phase 5 — Tests

- [x] Update `web/src/lib/schema.test.ts` with test case for double-quoted string defaults (#114)
- [x] Update `web/src/lib/format.test.ts` with test case for updated `abbreviateContext` (#117)
- [x] Run `bun run --cwd web vitest run` to verify all tests pass

### Phase 6 — Verify

- [x] Run `bun run --cwd web tsc --noEmit`
- [x] Run `bun run --cwd web vitest run`
- [x] Self-QA against constitution §XII, §XIII

### Phase 7 — PR

- [ ] Commit: `fix(web): address 14 UX/bug issues (#114 #116 #117 #119 #122 #123 #124 #125 #126 #128 #129 #131 #132 #133)`
- [ ] Push: `git push -u origin fix/issue-114-116-117-119-122-123-124-125-126-128-129-131-132-133`
- [ ] Open PR targeting `main`
