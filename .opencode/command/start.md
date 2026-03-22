---
description: "Create worktrees for one or more specs and generate tasks.md for each. Usage: /start 005  or  /start 011 017 019"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Split `$ARGUMENTS` on whitespace** to get a list of spec identifiers. Each can be:
   - A full spec directory name: `011-collection-explorer`
   - A numeric prefix only: `011` or `001b`
   - A partial match: `collection`

2. **Resolve each identifier** against `.specify/specs/`:
   ```bash
   ls .specify/specs/ | grep "$ARG"
   ```
   - Exactly one match → use it
   - Zero matches → report and skip
   - Multiple matches → show options and ask user to pick

3. **Store resolved list** as `$SPECS` (e.g., `[011-collection-explorer, 017-rgd-validation-linting]`). Remove duplicates.

---

## Pre-Flight Checks (run once, not per spec)

4. **Check current branch**:
   ```bash
   git branch --show-current
   ```
   - If not on `main`: warn and ask the user if they want to proceed

5. **Check for existing worktrees**:
   ```bash
   wt list
   ```
   For any spec that already has a worktree: report the path and skip that spec (don't recreate).

6. **Ensure main is up to date**:
   ```bash
   git fetch origin
   ```
   If `git status` shows uncommitted tracked file changes: `git stash --include-untracked` before creating worktrees, then `git stash pop` after.

---

## Worktree Creation (parallel for all specs)

7. For each spec in `$SPECS` (that doesn't already have a worktree):
   ```bash
   wt switch --create $SPEC_NAME --no-cd -y
   ```
   - If `wt` is not installed: fall back to `git checkout -b $SPEC_NAME`
   - If creation fails: report the error and skip that spec

---

## Context Loading (parallel for all specs)

8. For each spec, **in parallel**, read:
   - `.specify/specs/$SPEC_NAME/spec.md` — **REQUIRED** (stop that spec if missing)
   - `.specify/specs/$SPEC_NAME/tasks.md` — optional

9. **If tasks.md is missing** for any spec:
   - Generate it now using the spec.md content and knowledge of existing codebase assets
   - Write to `.specify/specs/$SPEC_NAME/tasks.md`
   - Tasks should be organized into phases, each with actionable checklist items
   - Reference pre-existing assets (hooks, API functions, components) to avoid duplication

10. **If tasks.md exists**: display a summary (total tasks, phase count, completed count).

---

## Handoff

11. **Display the setup summary** for all specs:

    ```
    ## Ready to implement — N specs

    | Spec | Worktree | Tasks | Complexity | Go backend? |
    |------|----------|-------|------------|-------------|
    | 011-collection-explorer | ../kro-ui.011-... | X tasks | Medium | Yes |
    ...

    ### To start working:
    cd ../kro-ui.<spec-name>
    # Open a new OpenCode session, then run /speckit.implement
    ```

12. Note any specs with conflicting file surface (e.g., both touch `RGDDetail.tsx` or `LiveDAG.tsx`) — recommend sequential ordering for those.

---

## Error Handling

- Spec directory not found → list available specs and skip
- Worktree already exists → show path, skip creation
- `wt` not installed → fall back to `git checkout -b`, warn about missing hooks
- `git fetch` fails → stop and report
- `spec.md` missing → skip that spec with message "Spec file not found — create the spec first"
- Dirty working tree → stash automatically, restore after worktree creation
