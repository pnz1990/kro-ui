---
description: "Fix one or more GitHub issues. Creates a worktree branch, fetches issue context, generates a tasks.md, and implements the fix. Usage: /fix-issue 57  or  /fix-issue 57 58 59"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Split `$ARGUMENTS` on whitespace** to get a list of issue numbers.
   - Strip any `#` prefix (`#57` → `57`)
   - If any argument is not a number: report and skip
   - If no arguments: run `gh issue list --state open --limit 20` and ask which to fix

2. **Store resolved list** as `$ISSUES` (e.g. `[57, 58]`). Remove duplicates.

---

## Pre-Flight Checks

3. **Ensure on main**:
   ```bash
   git branch --show-current
   ```
   If not on `main`: warn and ask if they want to proceed.

4. **Ensure main is up to date**:
   ```bash
   git fetch origin && git status
   ```
   If uncommitted tracked changes exist: `git stash --include-untracked`, restore after worktree creation.

5. **Determine branch name**:
   - Single issue: `fix/issue-<N>-<slug>` where slug is the first 4 words of the issue title,
     lowercased, spaces replaced with `-`, non-alphanumeric stripped
     (e.g. issue #57 "events page hangs indefinitely" → `fix/issue-57-events-page-hangs`)
   - Multiple issues: `fix/issue-<N1>-<N2>-...` with slug from the first issue's title
   - Store as `$BRANCH`

6. **Check worktree doesn't already exist**:
   ```bash
   wt list
   ```
   If `$BRANCH` already exists: show path and stop.

---

## Fetch Issue Context

7. **For each issue in `$ISSUES`**, fetch in parallel:
   ```bash
   gh issue view $N --json number,title,body,labels,comments
   ```
   Read:
   - **Title** — the problem in one line
   - **Body** — root cause, steps to reproduce, proposed fix
   - **Labels** — `bug` vs `enhancement` affects implementation approach
   - **Comments** — any additional context or decided approach

8. **Read project standards** (these inform the fix):
   - `AGENTS.md` — architecture rules and known anti-patterns table
   - `.specify/memory/constitution.md` — non-negotiable rules
   - Relevant spec for the affected area if identifiable (e.g. issue about events → read `019-smart-event-stream` spec)

---

## Create Worktree

9. **Create the worktree**:
   ```bash
   wt switch --create $BRANCH --no-cd -y
   ```
   If `wt` not installed: `git checkout -b $BRANCH`

---

## Generate Tasks

10. **Write `.specify/fixes/$BRANCH/tasks.md`** — lightweight fix task list.
    Do NOT create a `plan.md` (not needed for fixes; speckit.implement is not used here).

    Structure:
    ```markdown
    # Fix: <issue title(s)>

    **Issue(s)**: #N, #M
    **Branch**: $BRANCH
    **Labels**: bug / enhancement

    ## Root Cause
    <1-3 sentences from issue body>

    ## Files to change
    <list the specific files that need to change, derived from issue body and codebase>

    ## Tasks

    ### Phase 1 — Fix
    - [ ] <specific code change with file path and line reference>
    - [ ] <any related file that needs updating>

    ### Phase 2 — Tests
    - [ ] <add/update unit test covering the fix>
    - [ ] <run existing test suite to verify no regression>

    ### Phase 3 — Verify
    - [ ] Run `go vet ./...` (if Go files changed)
    - [ ] Run `GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...` (if Go files changed)
    - [ ] Run `bun run --cwd web tsc --noEmit` (if TS files changed)
    - [ ] Run `bun run --cwd web vitest run` (if TS files changed)
    - [ ] Verify against kro-ui self-QA checklist (constitution §XII, §XIII)

    ### Phase 4 — PR
    - [ ] Commit: `fix(<scope>): <short description> — closes #N`
    - [ ] Push branch: `git push -u origin $BRANCH`
    - [ ] Open PR: `gh pr create --base main --head $BRANCH --title "fix: ..." --body "Closes #N"`
    ```

    **Task generation rules**:
    - Be specific: name the exact file, function, and line range from the issue's proposed fix
    - For backend fixes: include the discovery cache check, errgroup pattern, or whatever the constitution §XI requires
    - For frontend fixes: include the graceful degradation check, title update, or whatever §XII/§XIII requires
    - Do not over-engineer: a bug fix should be 3-8 tasks, not 20
    - If multiple issues are grouped: one phase per issue

---

## Implement

11. **Work through each task in order**, marking `[x]` as each is completed.
    Follow the same discipline as speckit.implement:
    - Phase-by-phase execution
    - Tests before or alongside the fix (not after)
    - Self-QA checklist from `speckit.implement` step 9 before marking done

12. **After all tasks complete**, run the full verify phase:
    ```bash
    go vet ./...
    GOPROXY=direct GONOSUMDB="*" go test -race ./internal/...  # if Go changed
    cd web && bun run tsc --noEmit && bun run vitest run        # if TS changed
    ```
    Fix any failures before proceeding.

---

## PR

13. **Commit** with a message referencing the issue:
    ```bash
    git commit -m "fix(<scope>): <description> — closes #N"
    ```
    For multiple issues: `closes #N, closes #M`

14. **Push and open PR**:
    ```bash
    git push -u origin $BRANCH
    gh pr create --base main --head $BRANCH \
      --title "fix: <description>" \
      --body "$(cat <<'EOF'
    ## Summary
    <1-2 sentences>

    ## Root Cause
    <from issue>

    ## Fix
    <what changed and why>

    Closes #N
    EOF
    )"
    ```

15. **Report the PR URL**.

---

## Summary Output

```
## Fix ready: $BRANCH

Issues: #N — <title>
PR: <url>

Files changed: <list>
Tests: passing
```

---

## Error Handling

- **Issue not found**: skip it, report, continue with others
- **Worktree already exists**: show path, stop
- **Tests fail after fix**: do NOT open PR — fix the test failures first, report what's failing
- **Fix is larger than expected** (>15 tasks): warn — "This fix is substantial. Consider opening a spec instead with `/start`"
- **Dirty working tree**: stash automatically before creating worktree, restore after
