---
description: "Audit the kro-ui codebase for bugs, performance issues, inconsistencies, documentation gaps, spec/implementation divergence, and test gaps. Surfaces findings as GitHub issues. Usage: /audit-codebase  or  /audit-codebase --scope frontend  or  /audit-codebase --scope backend  or  /audit-codebase --scope specs"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Extract `--scope`** from `$ARGUMENTS` if present.
   - Valid values: `frontend`, `backend`, `specs`, `all` (default: `all`)
   - Store as `$SCOPE`.

2. **Extract `--focus`** from `$ARGUMENTS` if present (e.g. `--focus performance`).
   - Valid values: `bugs`, `performance`, `inconsistencies`, `docs`, `specs`, `tests`, `all` (default: `all`)
   - Store as `$FOCUS`. Multiple values may be comma-separated: `--focus bugs,performance`.

---

## Load Context (run once)

3. **Load project standards** — read these files before auditing anything:
   - `.specify/memory/constitution.md` — non-negotiable rules; violations are always bugs
   - `AGENTS.md` — spec status table and known anti-patterns (anything in the anti-pattern table that still exists in the code is a confirmed bug)
   - `.specify/specs/000-design-system/spec.md` — token and visual rules for frontend audits

4. **Load the existing issue list** to avoid duplicates:
   ```bash
   gh issue list --state open --limit 100 --json number,title,labels
   ```
   Keep in memory. Before filing any new issue, cross-check against this list.

5. **Internalize the audit lenses.** Keep in memory — do NOT output them. Apply all
   relevant lenses based on `$SCOPE` and `$FOCUS`.

---

## Audit Lenses

### Lens A — Bugs & Logic Errors

- Does any code path produce `undefined`, `null`, `?`, or `[object Object]` in user-visible output?
- Are there unhandled error branches (missing `.catch`, unguarded array access, unchecked nil pointers)?
- Does any frontend component assume data is always present when the API may omit it? (Constitution §XII)
- Are there race conditions: polling intervals that fire after component unmount, concurrent writes to shared state without locking?
- Does any Go handler lack a context deadline? (Constitution §XI — 5s budget per handler)
- Is `ServerGroupsAndResources()` or any discovery call made per-request without caching? (AGENTS.md anti-pattern)
- Are there any sequential loops over all API resource types that could hang on large clusters? (AGENTS.md anti-pattern)
- Does any DAG node fall back to `?` for kind/label instead of the raw kind string or nodeId? (AGENTS.md #58)
- Are resource cards navigable only via a small text link rather than the full card body? (AGENTS.md #65)
- Do filter controls rely solely on URL params with no actual input elements? (AGENTS.md #66)
- Are portal tooltips rendered without viewport boundary clamping? (AGENTS.md #77 review)
- Is `default !== undefined` used instead of `'default' in obj` for checking falsy defaults? (AGENTS.md #61)
- Are `nodeTypeLabel` / `tokenClass` / graph helpers copy-pasted across files? (AGENTS.md #77 review)

### Lens B — Performance Issues

- Are there Go handlers that could call discovery, list resources, or fan out without a timeout or concurrency limit? (Constitution §XI)
- Are there React components that re-render on every polling tick when only a subset of data changed?
- Is the RGD list / catalog page using virtualized rendering for large lists, as required by spec `024`? (Constitution §XIII scale requirements)
- Are there `useEffect` dependencies arrays missing keys that cause stale closures or infinite loops?
- Are there unbounded lists (no pagination, no virtual scroll, no cap) on routes that could receive 500+ items?
- Are large YAML blobs / long strings rendered into the DOM without truncation or lazy loading?
- Are polling intervals cleared on component unmount to prevent memory leaks?
- Is the discovery cache respected (≥30s TTL) or is it being bypassed anywhere?

### Lens C — Inconsistencies

- Do different pages use different terminology for the same concept (e.g. "Instance" vs "CR" vs "Custom Resource")?
- Are there duplicate helper functions (same logic in multiple files) that should be in a shared `@/lib/` module? (Constitution §IX)
- Do error messages follow a consistent format and level of detail across pages?
- Are loading states represented consistently (spinner vs skeleton vs empty)?
- Are CSS values (colors, radii, spacing, shadows) hardcoded in component files instead of referencing tokens? (Constitution §IX — any `rgba()`, hex literal, or magic number in component CSS is a violation)
- Are page titles consistently formatted as `<content> — kro-ui`? (Constitution §XIII)
- Are breadcrumbs present on all pages deeper than 2 levels in the hierarchy? (Constitution §XIII)
- Do all resource cards follow the same fully-clickable pattern? (Constitution §XIII)
- Are Go error messages wrapped with context (`fmt.Errorf("context: %w", err)`)? (Constitution §VI)
- Do all `.go` files have the Apache 2.0 copyright header? (Constitution §VI)
- Is zerolog used consistently for all logging, with structured fields? (Constitution §VI)

### Lens D — Documentation Gaps

- Are there exported Go functions, types, or interfaces with no doc comment?
- Are there non-obvious algorithms or heuristics (e.g. Converter field-promotion logic) without an inline explanation of the approach?
- Does the `README.md` accurately reflect the current feature set, or is it outdated relative to merged specs?
- Are there spec files in `.specify/specs/` whose status field still says `Draft` but whose code is fully merged?
- Is there a `CONTRIBUTING.md` that references the spec-driven workflow and worktrunk? (Constitution §X)
- Are CEL expressions in YAML templates or test fixtures unexplained?
- Are there environment variables, CLI flags, or Helm values that are undocumented?

### Lens E — Spec / Implementation Divergence

- For each merged spec in AGENTS.md, does the implementation match the functional requirements?
  - Check acceptance criteria in the spec against what the code actually does.
  - Look for features that were specified but silently dropped, or implemented differently.
- Are there UI routes, components, or API endpoints that exist in code but have no corresponding spec?
- Do the API response shapes in `internal/api/types/response.go` match what the specs describe?
- Are there feature-flag checks in the frontend that reference capabilities not described in spec `008`?
- Do the E2E test journeys in `test/e2e/journeys/` cover all the user stories from merged specs, or are some journeys missing?
- Does the Helm chart RBAC (`ClusterRole`) match the verbs the backend actually uses? (Constitution §III — get/list/watch only)

### Lens F — Test Gaps

- Are there Go handlers with no corresponding unit test?
- Are there pure functions (CEL tokenizer, DAG layout, YAML parser) without unit tests?
- Are table-driven tests following the `build`/`check` pattern required by Constitution §VII?
- Are tests using `assert` where `require` should be used (test continues after a fatal failure)?
- Are there test helpers missing `t.Helper()` calls?
- Are there E2E journey files in `test/e2e/journeys/` for each merged spec? Cross-reference AGENTS.md spec table.
- Are there critical user flows (e.g. Converter field-promotion, Generator YAML output) that have no automated test coverage at any layer?
- Does `go test -race ./...` pass cleanly? Run it and capture any data race reports.
- Does `bun run typecheck` pass cleanly? Run it and capture any type errors.

---

## Audit Protocol

6. **Run static checks first** (collect raw signals before reading code):

   ```bash
   # Type errors
   cd web && bun run typecheck 2>&1 | head -100

   # Go vet
   GOPROXY=direct GONOSUMDB="*" go vet ./... 2>&1

   # Missing copyright headers
   grep -rL "Apache License" --include="*.go" .

   # Hardcoded hex / rgba in component CSS
   grep -rn "rgba\|#[0-9a-fA-F]\{3,6\}" web/src --include="*.css" | grep -v "tokens.css"

   # Copy-pasted graph helpers
   grep -rn "nodeTypeLabel\|tokenClass" web/src --include="*.ts" --include="*.tsx"

   # discovery calls (check for per-request pattern)
   grep -rn "ServerGroupsAndResources\|ServerResourcesForGroupVersion" internal/

   # Unbounded list renders (no virtualization check)
   grep -rn "\.map(" web/src/pages --include="*.tsx" | grep -v "// virtualized"
   ```

   Record all raw findings. Do not stop on errors — collect everything first.

7. **Read spec/implementation cross-reference**:

   For each spec marked **Merged** in AGENTS.md:
   - Read the spec's functional requirements (FR-NNN entries).
   - Locate the corresponding implementation files.
   - Verify the key requirements are met.
   - Flag any FR that has no obvious implementation or whose implementation contradicts the spec.

8. **Read test coverage**:

   - List all `*_test.go` files: `find . -name "*_test.go" -not -path "*/vendor/*"`
   - List all E2E journey files: `ls test/e2e/journeys/`
   - Cross-reference handlers in `internal/api/handlers/` against test files.
   - Cross-reference merged spec user stories against E2E journeys.

9. **For each finding**, record it internally using this format:

   ```
   Finding #{N}
   Lens: A-Bug | B-Performance | C-Inconsistency | D-Docs | E-Spec-Divergence | F-Test-Gap
   Severity: Critical | High | Medium | Low
   Location: <file:line or route or spec name>
   Title: <concise 1-line title>
   Description: <what was observed>
   Expected: <what should happen per constitution / spec / standard>
   Evidence: <file path, line number, or command output>
   Duplicate of: <existing issue number if already filed, else "new">
   ```

10. **Deduplication pass** — remove findings that are exact duplicates of each other or
    of open GitHub issues loaded in step 4.

---

## Present Findings

11. **Display all findings** grouped by lens, then by severity within each lens:

    ```
    ## Codebase Audit Findings

    Scope:   $SCOPE
    Focus:   $FOCUS
    Total findings: N (N new, N duplicates of open issues)

    ### A — Bugs & Logic Errors (N)
    | # | Location | Severity | Title |
    |---|----------|----------|-------|
    | 1 | internal/api/handlers/rgds.go:142 | High | Discovery called per-request without cache |

    ### B — Performance Issues (N)
    ...

    ### C — Inconsistencies (N)
    ...

    ### D — Documentation Gaps (N)
    ...

    ### E — Spec / Implementation Divergence (N)
    ...

    ### F — Test Gaps (N)
    ...

    ### Skipped — already open (N)
    | # | Existing issue | Title |
    |---|---------------|-------|
    ```

    After the full table, write a one-paragraph **Audit Narrative** summarising the
    dominant patterns: what areas of the codebase are healthy, what categories need
    the most attention, and whether any findings suggest a systemic gap in the
    development process.

---

## Issue Creation (interactive, per finding)

12. **For each new finding**, present it and ask:

    ```
    ## Finding #{N}: [title]

    Lens:     [A–F]
    Severity: [Critical/High/Medium/Low]
    Location: [file:line or area]

    [2-3 sentence description]

    Open a GitHub issue for this finding?
      Y) Yes — open issue now
      N) No — skip
      E) Edit the title/description first
    ```

    Wait for the user's choice.

    **If Y**: create the issue:
    ```bash
    gh issue create \
      --title "[lens-label]: [title]" \
      --body "$(cat <<'EOF'
    ## Observed
    [what was found — include file:line where relevant]

    ## Expected
    [correct behaviour per constitution / spec / standard — cite the rule]

    ## Steps to reproduce / verify
    1. [action or command]
    2. Observe: [result]

    ## Context
    - Location: [file:line or area]
    - Lens: [lens name]
    - Severity: [severity]
    - Found during: codebase audit (/audit-codebase)
    EOF
    )" \
      --label "[appropriate label]"
    ```

    Lens-to-label mapping (use the closest available label):
    - A-Bug → `bug`
    - B-Performance → `performance`
    - C-Inconsistency → `refactor` or `bug` depending on severity
    - D-Docs → `documentation`
    - E-Spec-Divergence → `spec` or `bug` depending on severity
    - F-Test-Gap → `testing`

    **If E**: show the current title and body, ask the user to type their revision,
    then create with the revised content.

    **If N**: skip without recording.

13. **After all findings are processed**, display the session summary:

    ```
    ## Audit Complete

    Scope:           $SCOPE
    Findings total:  N
    Issues opened:   N
    Skipped:         N
    Already tracked: N

    ### Opened issues
    | # | Lens | Severity | Title | URL |
    |---|------|----------|-------|-----|
    ```

---

## Audit Principles

- **Evidence first, opinion second**: every finding must cite a specific file, line, or
  command output. General impressions are not findings.
- **Constitution violations are always at least High severity**: the constitution is
  non-negotiable. Any deviation is a confirmed defect, not a style preference.
- **AGENTS.md anti-patterns are confirmed bugs**: if the anti-pattern table lists it and
  the code still does it, file it as a bug without qualification.
- **Spec divergence is not always a bug**: if the implementation is clearly better than
  the spec, note it as a docs gap (the spec needs updating) rather than a code bug.
- **Test gaps are not all equal**: a missing test for a pure utility function is Low;
  a missing test for a security-relevant handler or a data-race-prone polling loop is High.
- **Don't audit what's blocked**: spec `009-rgd-graph-diff` is blocked upstream — don't
  file spec-divergence findings against it.
- **Performance findings need evidence**: "this could be slow" is not a finding.
  "This handler calls `ServerGroupsAndResources()` on every request with no cache
  (internal/k8s/discover.go:47)" is a finding.
- **Scope the work honestly**: if `$SCOPE` is `frontend`, do not audit Go files.
  If `$SCOPE` is `specs`, focus on `.specify/specs/` and cross-reference only.
- **Never fabricate findings**: if a check passes cleanly, say so. A clean audit is a
  valid and valuable result.
