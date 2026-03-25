# Fix: doc staleness + missing unit tests

**Issue(s)**: #214, #215, #216, #217, #218, #219
**Branch**: fix/issue-214-thru-219-tests-docs
**Labels**: documentation, enhancement

## Root Cause

- #214: design-system spec page-title table had stale "Home → kro-ui" entry; spec 037 changed it to "Overview — kro-ui" but the table wasn't updated.
- #215: spec 026-rgd-yaml-generator absent from AGENTS.md inventory despite being Implemented.
- #216: spec 041-error-states-ux-audit Status field still "In progress" after shipping in v0.4.2 (PR #208); also absent from AGENTS.md.
- #217/#218/#219: InstanceDetail, LiveDAG, Fleet, AuthorPage, NotFound had no unit tests — the most complex page (InstanceDetail) and highest-regression-risk component (LiveDAG) were unguarded.

## Files changed

- `.specify/specs/000-design-system/spec.md` — fix Home→Overview in page-title table
- `.specify/specs/041-error-states-ux-audit/spec.md` — Status: In progress → Merged (PR #208)
- `AGENTS.md` — add 026-rgd-yaml-generator and 041-error-states-ux-audit to spec inventory
- `web/src/pages/InstanceDetail.test.tsx` — new (issue #217)
- `web/src/components/LiveDAG.test.tsx` — new (issue #218)
- `web/src/pages/Fleet.test.tsx` — new (issue #219)
- `web/src/pages/AuthorPage.test.tsx` — new (issue #219)
- `web/src/pages/NotFound.test.tsx` — new (issue #219)

## Tasks

### Phase 1 — Doc fixes
- [x] spec 000 page-title table: Home → Overview
- [x] spec 041 status: In progress → Merged (PR #208)
- [x] AGENTS.md: add 026-rgd-yaml-generator row
- [x] AGENTS.md: add 041-error-states-ux-audit row

### Phase 2 — Tests
- [x] InstanceDetail.test.tsx: breadcrumb, title, loading, error, absent conditions, poll cleanup
- [x] LiveDAG.test.tsx: render, live-state classes, click, keyboard, hide-timer cleanup, edges
- [x] Fleet.test.tsx: title, loading, error, cluster rows, dedup, refresh button
- [x] AuthorPage.test.tsx: title, heading, form, DAG pane, YAML pane, hint
- [x] NotFound.test.tsx: title, heading, URL display, home link

### Phase 3 — Verify
- [x] bun run --cwd web tsc --noEmit
- [x] bun run --cwd web vitest run
