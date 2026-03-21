---
description: "Create a worktree for a spec and set up everything needed to start implementing. Usage: /start 001b-rgd-api"
---

## User Input

```text
$ARGUMENTS
```

## Spec Identification

1. **Parse the argument**: The user provides a spec identifier (e.g., `001b-rgd-api`, `002`, `002-rgd-list-home`). This can be:
   - A full spec directory name: `001b-rgd-api`
   - A numeric prefix only: `001b` or `002`
   - A partial match: `rgd-api`

2. **Resolve the spec directory**: Find the matching directory in `.specify/specs/`:
   ```bash
   ls .specify/specs/ | grep "$ARGUMENTS"
   ```
   - If exactly one match: use it
   - If zero matches: show available specs and ask the user to pick one
   - If multiple matches: show matches and ask the user to pick one

3. **Store the resolved spec name** as `$SPEC_NAME` (e.g., `001b-rgd-api`)

## Pre-Flight Checks

4. **Check current branch**: Run `git branch --show-current`
   - If already on `$SPEC_NAME` branch: skip worktree creation, go to step 8
   - If on `main`: proceed to step 5
   - If on another spec branch: warn the user and ask if they want to proceed

5. **Check if worktree already exists**: Run `wt list`
   - If a worktree for `$SPEC_NAME` already exists: inform the user and tell them to `cd` into it. Show the path. Stop.
   - If no worktree exists: proceed to step 6

6. **Ensure main is up to date**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
   - If rebase fails: stop and report the conflict

## Worktree Creation

7. **Create the worktree**:
   ```bash
   wt switch --create $SPEC_NAME --no-cd -y
   ```
   - If `wt` is not installed: fall back to `git checkout -b $SPEC_NAME`
   - If creation fails: report the error and stop

## Context Loading

8. **Read the spec and required context files** (in parallel):
   - `.specify/specs/$SPEC_NAME/spec.md` — **REQUIRED** (stop if missing)
   - `.specify/specs/$SPEC_NAME/tasks.md` — optional (generate if missing)
   - `.specify/memory/constitution.md` — **REQUIRED**

9. **If tasks.md is missing**:
   - Inform the user: "No tasks.md found for $SPEC_NAME. Generating one now..."
   - Execute the `/speckit.tasks` command flow to generate it
   - Read the generated tasks.md

10. **If tasks.md exists**: Display a summary:
    - Total task count
    - Phase breakdown (number of tasks per phase)
    - Which phases are already completed (count `[x]` vs `[ ]`)

## Handoff

11. **Display the setup summary**:
    ```
    ## Ready to implement: $SPEC_NAME

    **Worktree**: ../kro-ui.$SPEC_NAME/
    **Branch**: $SPEC_NAME
    **Spec**: .specify/specs/$SPEC_NAME/spec.md
    **Tasks**: .specify/specs/$SPEC_NAME/tasks.md (N tasks, M completed)

    ### To start working:
    cd ../kro-ui.$SPEC_NAME

    Open a new OpenCode session from that directory, then run:
    /speckit.implement
    ```

12. **If the user is ALREADY in the worktree** (detected in step 4):
    - Skip the "cd" instruction
    - Instead, ask: "You're already in the worktree. Want me to start implementing now? (Run `/speckit.implement` to begin)"

## Error Handling

- If the spec directory doesn't exist: list all available specs and stop
- If the worktree already exists: show the path and stop (don't create a duplicate)
- If `wt` is not installed: fall back to `git checkout -b`, warn about missing hooks
- If `git fetch` or `rebase` fails: stop and report, suggest `git stash` if dirty
- If spec.md is missing: stop with "Spec file not found. Create the spec first."
