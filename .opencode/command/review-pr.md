---
description: "Review one or more PRs as core maintainer. Checks code, UX, security, architecture, and product quality. Usage: /review-pr 12  or  /review-pr 12 15 18"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Split arguments**: Split `$ARGUMENTS` on whitespace to get a list of PR numbers.
   Each argument must be a numeric PR number (e.g., `12`, `15`, `18`).
   - Strip any `#` prefix (e.g., `#12` becomes `12`)
   - If no arguments provided: run `gh pr list --state open --limit 20` and ask the user
     which PRs to review
   - If any argument is not a valid number after stripping `#`: report it and skip

2. **Store the resolved list** as `$PRS` (e.g., `[12, 15, 18]`). Remove duplicates.

---

## Load Review Context (run once)

3. **Load project standards** — read these files to inform the review:
   - `.specify/memory/constitution.md` — non-negotiable rules (read-only, dynamic client, no fork concepts, etc.)
   - `AGENTS.md` — repo layout, architecture decisions, code standards
   - `.specify/specs/000-design-system/spec.md` — design tokens and UI rules (if the PR touches frontend)

4. **Summarize the review checklist** derived from the constitution and AGENTS.md.
   Keep this in memory — do NOT output it. The checklist is:

   **Architecture & Code Quality**:
   - [ ] All Go files have Apache 2.0 copyright header
   - [ ] Error wrapping uses `fmt.Errorf("context: %w", err)` — no silenced errors
   - [ ] Logging uses `zerolog.Ctx(ctx)` with structured fields
   - [ ] No `util.go`, `helpers.go`, or `common.go` files
   - [ ] Interfaces defined at consumption site, not implementation site
   - [ ] Tests are table-driven with `build`/`check` pattern, use `testify/assert` + `require`
   - [ ] Commits follow Conventional Commits: `type(scope): message`

   **kro-Specific Rules (NON-NEGOTIABLE)**:
   - [ ] All cluster access uses `k8s.io/client-go/dynamic` — no typed clients for kro resources
   - [ ] Resource kind resolution uses discovery, not naive pluralization
   - [ ] kro field paths (`spec.resources[].id`, etc.) only in `internal/k8s/rgd.go`
   - [ ] No fork-only concepts: `specPatch`, `stateFields` must not appear anywhere
   - [ ] Read-only: no mutating K8s API calls (`create`, `update`, `patch`, `delete`, `apply`)
   - [ ] Only upstream `kubernetes-sigs/kro` features enabled by default

   **Frontend Rules**:
   - [ ] No CSS frameworks (Tailwind, Bootstrap, MUI) — plain CSS with `tokens.css`
   - [ ] No state management libraries (Redux, Zustand, etc.)
   - [ ] No external highlighting libraries (highlight.js, Prism, shiki)
   - [ ] No component libraries (shadcn, Radix, etc.)
   - [ ] All colors use CSS custom properties from `tokens.css` — no hardcoded hex or `rgba()` in components
   - [ ] `color-mix()` is acceptable but the combination should be added as a named token in `tokens.css` first (not inlined in component CSS)
   - [ ] TypeScript strict mode — no `any` in production files; `as any` in test files is acceptable
   - [ ] No `@ts-ignore` anywhere

   **Security**:
   - [ ] No secrets, credentials, or `.env` files in the diff
   - [ ] No `panic` in production code paths
   - [ ] No new dependencies that are unnecessary (constitution §V)
   - [ ] RBAC changes still enforce read-only (if Helm chart touched)
   - [ ] No XSS vectors in frontend (raw HTML injection, dangerouslySetInnerHTML without sanitization)

   **Product & UX**:
   - [ ] User-facing text and labels match kro terminology (not fork terminology)
   - [ ] Loading states, error states, and empty states are handled (not just happy path)
   - [ ] Keyboard navigation works for interactive elements
   - [ ] Dark and light mode both work (if UI changed)
   - [ ] Semantic state colors used correctly per design system

---

## Review Each PR (sequentially)

For each PR number in `$PRS`:

5. **Fetch PR metadata**:
   ```bash
   gh pr view $PR_NUM --json title,body,author,baseRefName,headRefName,state,labels,files,additions,deletions,commits
   ```
   - If the PR doesn't exist or is not open: report and skip to next PR
   - Note the branch name — map it to a spec if it matches `NNN-*` pattern
     (e.g., branch `002-rgd-list-home` → spec `002-rgd-list-home`)

6. **Load the spec** (if branch maps to one):
   - Read `.specify/specs/$SPEC_NAME/spec.md` for acceptance criteria
   - Read `.specify/specs/$SPEC_NAME/tasks.md` for task completion status
   - This gives context for whether the PR delivers what the spec requires

7. **Fetch the full diff**:
   ```bash
   gh pr diff $PR_NUM
   ```
   Read the full diff carefully. For large PRs (>2000 lines), use the Task tool to
   split the review into chunks by file group (backend Go, frontend TS/CSS, tests,
   config/CI).

8. **Check CI status**:
   ```bash
   gh pr checks $PR_NUM
   ```
   Note any failing checks — these are blockers. **Exception**: if `trivy` fails, check the
   job log before treating it as a blocker:
   - If the failure is `go mod download: exec: "git": executable file not found` → infrastructure
     issue with the Docker build stage (missing `git` in `golang:alpine`), NOT a CVE. Flag as
     a known infra issue, not a code problem.
   - If the failure shows `CRITICAL` or `HIGH` CVE names → genuine blocker, request changes.

9. **Perform the review** against the checklist from step 4. For each category,
   evaluate every changed file in the diff:

   a. **Architecture & Code Quality**: scan every Go file for headers, error handling,
      logging patterns, file naming, interface placement. Scan TS files for strict mode
      violations.

   b. **kro-Specific Rules**: grep the diff for `specPatch`, `stateFields`, typed client
      imports, mutating verbs, hardcoded kro field paths outside `rgd.go`.

   c. **Frontend Rules**: grep for CSS framework imports, state library imports,
      highlighting library imports, component library imports, hardcoded hex values
      and `rgba()` literals in component files (not `tokens.css`). Also grep for
      `color-mix(` in component CSS — acceptable if the combination is also added
      as a named token in `tokens.css`; flag as nit if not.

   d. **Security**: check for secrets, panics in non-test files, unnecessary new deps
      in `go.mod` or `package.json`, RBAC changes, XSS vectors. Also check that
      `web/dist/` is not tracked by git (it is a build artifact and must not be committed).

   e. **Product & UX**: check that the PR handles error/loading/empty states if it adds
      UI. Check that labels use upstream kro terminology. Check keyboard accessibility
      if interactive elements are added.

   f. **Spec Compliance** (if spec was loaded): verify the PR implements the acceptance
      scenarios from the spec. Note any spec requirements that are missing.

   g. **Commit Hygiene**: check that commits follow Conventional Commits format.
      Flag any commits with vague messages like "fix", "update", "wip".

10. **Decide the verdict** for each PR:

    - **LGTM**: No issues found. All checks pass. Code is clean, follows standards,
      and delivers what the spec requires.
    - **Approve with nits**: Minor style/naming suggestions that don't block merge.
      Leave comments but approve.
    - **Request changes**: Constitution violations, security issues, missing error
      handling, broken UX, or spec requirements not met. Leave detailed comments
      explaining what needs to change and why.

   **Note on self-review**: GitHub prevents approving or requesting changes on your own PRs.
   In that case, post the review as `--comment` instead. The verdict and findings stand
   regardless of the review mechanism.

11. **Post the review**:

    - **If LGTM**:
      ```bash
      gh pr review $PR_NUM --approve --body "LGTM — [1-2 sentence summary of what was reviewed and why it's good]"
      ```

    - **If approve with nits**:
      First post individual comments on specific lines/files using:
      ```bash
      gh pr review $PR_NUM --comment --body "$(cat <<'EOF'
      Approving with minor nits (non-blocking):

      [list of nits with file:line references]

      Overall: [summary of what's good about the PR]
      EOF
      )"
      ```
      Then approve:
      ```bash
      gh pr review $PR_NUM --approve --body "Approved with nits noted above."
      ```

    - **If requesting changes**:
      ```bash
      gh pr review $PR_NUM --request-changes --body "$(cat <<'EOF'
      ## Changes Requested

      [numbered list of required changes, each with:]
      - What: [the issue]
      - Where: [file:line or file range]
      - Why: [which constitution rule, spec requirement, or standard it violates]
      - Fix: [specific suggestion for how to fix it]

      ## What's Good
      [acknowledge what the PR does well — be fair]
      EOF
      )"
      ```

---

## Summary

12. **After all PRs are reviewed**, display a summary table:

    ```
    ## PR Review Summary

    | PR | Title | Branch | Verdict | Notes |
    |----|-------|--------|---------|-------|
    | #12 | feat(web): home page card grid | 002-rgd-list-home | LGTM | Clean implementation |
    | #15 | feat(api): capabilities endpoint | 008-feature-flags | Changes requested | Missing error handling (2 items) |
    | #18 | feat(web): CEL highlighter | 006-cel-highlighter | Approved w/ nits | Minor naming suggestions |
    ```

---

## Review Principles

- **Be thorough but fair**: catch real issues, don't nitpick formatting that linters handle
- **Constitution violations are always blockers**: read-only, dynamic client, no fork concepts
- **Security issues are always blockers**: secrets in code, XSS, panic in prod paths
- **Missing error/loading/empty states are blockers**: these are core UX requirements
- **Spec compliance matters**: if a PR claims to implement a spec, it must cover the acceptance scenarios
- **Acknowledge good work**: when code is well-written, say so specifically
- **Be specific**: "error handling is missing in `handlers/rgds.go:45`" not "needs better error handling"
- **Suggest fixes**: don't just point out problems, show the solution
- **Distinguish infra from code failures**: a Trivy failure due to missing `git` in the Docker image is not a CVE — check the log before escalating
- **`as any` in test files is acceptable**: strict mode applies to production code only; test helpers commonly need it for mock fixture construction
- **`color-mix()` in CSS is a nit, not a blocker**: it's valid CSS with wide browser support, but ideally the combination should live as a named token in `tokens.css`
