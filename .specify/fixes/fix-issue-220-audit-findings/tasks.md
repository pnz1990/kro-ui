# Fix: spec-audit — 25 must-fix findings across specs 001–042

**Issue(s)**: #220
**Branch**: fix/issue-220-audit-findings
**Labels**: documentation

## Scope

Of the 25 findings tracked in #220, this PR addresses all that are safe in a
single pass. The two items requiring large refactors are explicitly deferred:

- **012-F4** (kro field accessors → `@/lib/kro.ts`): large dag.ts refactor, separate PR
- **020-F1** (ParsedType discriminated union): breaking change to schema.ts callers, separate PR

Items pre-verified as already correct (no fix needed):
- SC-01: ClientFactory already uses sync.RWMutex ✓
- 038-F2: getInstanceChildren already wired into 5s poll ✓
- 014-F1: summariseContext already has per-context 10s deadline ✓
- 011-F1: CollectionBadge already uses var(--token) fills ✓
- FF-02: capabilities probes multiple candidate names ✓
- 018-F1: SA discovery probes multiple namespaces/selectors ✓
- 019-F1: events filtered by label selector (no owner chain) ✓
- 018-F3: DiscoverPlural uses CachedServerGroupsAndResources ✓
- 028-F1: no duplicate tokens in tokens.css ✓
- 029-F2: buildNodeStateMap step 3 fills absent nodes ✓

## Tasks

### Pass 1 — Spec text fixes
- [x] 017-F1: tasks.md — absent conditions → "Not reported" + condition-item--absent (not "Pending")
- [x] 017-F2: spec.md — define all 4 CSS class names normatively
- [x] 041-F2: spec.md FR-031 — Unknown → display as-is (not "Pending")
- [x] 029-F1: tasks.md Phase 9 — mark T022–T027 as [x] (shipped in v0.3.4 PR #137)
- [x] 030-F2: spec.md — replace raw status=False filter with isHealthyCondition description
- [x] 033+035-F1: tasks.md — document Footer superseded note
- [x] 040-F1: spec.md — add justified §II exception comment for rest.HTTPClientFor
- [x] 012-F1: spec.md — add NFR-004 for foreignObject overflow="visible"

### Pass 2 — Code fixes
- [x] 011-F5: move isItemReady from CollectionPanel.tsx → web/src/lib/collection.ts; update imports in CollectionBadge.tsx, CollectionPanel.test.tsx
- [x] 018-F2: add 4s context.WithTimeout in FetchEffectiveRules (rbac.go) per §XI
- [x] 028-F3: extractInstanceHealth uses isHealthyCondition for negation-polarity conditions (format.ts); 3 new tests

### Deferred (separate PRs)
- 012-F4: kro field accessors → @/lib/kro.ts (large refactor touching dag.ts and all consumers)
- 020-F1: ParsedType discriminated union (breaking change to schema.ts and all callers)
