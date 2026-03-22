# Fix: events hang / DAG '?' / validation pending / docs constraints / required dot

**Issues**: #57, #58, #59, #60, #61
**Branch**: fix/issue-57-58-59-60-61-events-dag-docs
**Labels**: bug (all)

---

## Issue #57 — events page hangs indefinitely

### Root Cause
`addChildUIDs` calls `ServerGroupsAndResources()` then sequentially lists every
namespaced resource type (200+ on EKS) to find kro-labelled children. This is
the anti-pattern from constitution §XI. The fix: remove `addChildUIDs` and
`listChildResourcesByLabel` entirely. RGD + instance UIDs (steps 1-3) already
capture the most important events.

### Files
- `internal/api/handlers/events.go` — remove steps 4 / `addChildUIDs` / `listChildResourcesByLabel` / `isSkippedResource`
- `internal/api/handlers/events_test.go` — remove any test that relies on child UID discovery

---

## Issue #58 — DAG nodes show '?' kind label

### Root Cause
`buildDAGGraph` in `web/src/lib/dag.ts` does `asString(template.kind)` which
returns `''` for absent / CEL-expression kinds. The empty string renders as `?`
in the DAG node subtitle.

### Files
- `web/src/lib/dag.ts:441-447` — fallback chain: `template.kind` → raw string → `externalRef.kind` → `id`
- `web/src/lib/dag.test.ts` — add test for CEL-valued kind falling back to nodeId

---

## Issue #59 — Validation tab shows Pending for absent conditions

### Root Cause
`buildDisplayConditions` in `ValidationTab.tsx` fabricates entries for all four
known condition types even when they are absent from `status.conditions`. Absent
conditions display as "Pending / Awaiting controller processing" — misleading
when kro simply doesn't emit those conditions on this version.

### Files
- `web/src/components/ValidationTab.tsx:42-70` — only include known types that are
  actually present; don't fabricate absent ones
- `web/src/components/ValidationTab.test.tsx` — update test asserting absent conditions
  show "Not reported" instead of "Pending"

---

## Issue #60 — Docs tab mixes constraints into Default column

### Root Cause
`parseSimpleSchema` doesn't recognise `enum=`, `minimum=`, `maximum=` modifiers
and silently ignores them (forward-compatible). But kro emits e.g.
`"normal" enum=easy,normal,hard` as the full type string — the whole string
becomes the `default` value because the base type IS the quoted literal.

Actually the strings look like: `string | default=normal | enum=easy,normal,hard`
or `integer | default=3 | minimum=1 | maximum=10`. We need to parse those extra
modifiers and store them as `constraints` on `ParsedType`.

### Files
- `web/src/lib/schema.ts` — add `enum`, `minimum`, `maximum` fields to `ParsedType`;
  parse them in `parseSimpleSchema`
- `web/src/components/FieldTable.tsx` — render constraints below the default value
  as small muted badges
- `web/src/lib/schema.test.ts` — add tests for enum/min/max parsing

---

## Issue #61 — Docs tab marks all fields as required

### Root Cause
`FieldTable.tsx:101` uses `field.parsedType?.default !== undefined` to detect a
default. For `default=0`, `default=false`, `default=""` the value is a falsy
primitive BUT it's stored as a string in `ParsedType.default` — so `'0' !==
undefined` is `true` and this should work. The real bug: check must be
`'default' in parsedType` (key existence) to handle the edge case where a future
refactor might store `undefined` explicitly.

### Files
- `web/src/components/FieldTable.tsx:101` — change `!== undefined` to `'default' in (field.parsedType ?? {})`
- `web/src/lib/schema.test.ts` — add test asserting `default=0` and `default=false` parse correctly

---

## Tasks

### Phase 1 — #57: Fix events hang
- [x] Remove `addChildUIDs`, `listChildResourcesByLabel`, `isSkippedResource` from `events.go`
- [x] Remove step 4 call in `buildRelevantUIDs`
- [x] Update `events_test.go` (remove tests that relied on child discovery; existing tests should still pass)

### Phase 2 — #58: Fix DAG '?' kind
- [x] In `dag.ts` after extracting `kind`, add fallback: if empty, use `id` as kind
- [x] Add test in `dag.test.ts` for CEL-valued kind

### Phase 3 — #59: Fix validation Pending for absent conditions
- [x] Change `buildDisplayConditions` to only include known types that are present in actual conditions
- [x] Update tests accordingly

### Phase 4 — #60: Fix docs constraints in Default column
- [x] Add `enum?`, `minimum?`, `maximum?` to `ParsedType`
- [x] Parse them in `parseSimpleSchema`
- [x] Render constraints in `FieldTable` as muted badges
- [x] Add schema tests

### Phase 5 — #61: Fix required dot
- [x] Change `field.parsedType?.default !== undefined` → `'default' in (field.parsedType ?? {})`
- [x] Add schema test for falsy defaults

### Phase 6 — Verify
- [ ] `go vet ./...`
- [ ] `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...`
- [ ] `bun run --cwd web tsc --noEmit`
- [ ] `bun run --cwd web vitest run`

### Phase 7 — PR
- [ ] Commit: `fix(events,dag,docs): fix 5 bugs — closes #57, #58, #59, #60, #61`
- [ ] Push branch
- [ ] Open PR
