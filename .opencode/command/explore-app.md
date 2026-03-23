---
description: "Take control of the browser, explore the running kro-ui app end-to-end, and surface bugs, UX issues, and enhancement ideas as a senior PM / core committer / community manager would. Opens GitHub issues for all approved findings. Usage: /explore-app  or  /explore-app --url http://localhost:40107"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Extract `--url`** from `$ARGUMENTS` if present (e.g., `--url http://localhost:40107`).
   - If not provided, default to `http://localhost:40107` (kro-ui default port — D=4, A=01, G=07 → DAG).

2. **Store the resolved URL** as `$APP_URL`.

---

## Load Context (run once)

3. **Load project standards** — read these files to ground the exploration:
   - `.specify/memory/constitution.md` — non-negotiable UX and architecture rules
   - `AGENTS.md` — known anti-patterns table (critical — these are proven bugs)
   - `.specify/specs/000-design-system/spec.md` — visual design rules (tokens, colors, motion)

4. **Load the existing issue list** to avoid duplicates:
   ```bash
   gh issue list --state open --limit 50 --json number,title,labels
   ```
   Keep this in memory. Before filing any new issue, cross-check that no open issue
   already covers the same finding.

5. **Internalize the exploration lens**. Keep in memory — do NOT output it. The explorer
   wears three hats simultaneously:

   **Senior Product Manager**:
   - Does the feature solve the stated user need? Is the happy path obvious?
   - Are loading / error / empty states handled and informative (not silent)?
   - Is terminology consistent and aligned with upstream kro vocabulary?
   - Is the information hierarchy correct — most important data first?
   - Are there dead ends (features that navigate to a page with no data and no explanation)?
   - Polling features: is there a "refreshed X ago" timestamp? Is the interval reasonable?
   - Tables: are sortable columns indicated? Is the default sort sensible?
   - Forms / filters: do inputs have clear labels? Is debounce applied? Does URL state persist?

   **Core Committer**:
   - Known anti-patterns from AGENTS.md still present anywhere in the live UI?
   - `?` appearing where a kind/label should be → bug per issue #58
   - Resource cards not fully clickable → bug per issue #65
   - Filter inputs missing (URL param only) → bug per issue #66
   - Portal tooltips without viewport clamping → bug per constitution §XIII
   - Absent data rendered as `undefined`, `null`, or `?` → bug per issue #58 / §XII
   - SVG viewBox not fitted → DAG nodes clipped → bug per issue #64
   - Context names truncated ambiguously → bug per issue #63
   - Dark/light mode: token violations visible as wrong colors
   - Keyboard navigation: can interactive elements be reached and activated without a mouse?
   - Console errors visible during normal navigation?

   **Community Manager**:
   - Is it obvious what kro-ui *is* to a first-time visitor?
   - Is the language welcoming and plain (not jargon-heavy)?
   - Does the empty state for "no RGDs" explain next steps?
   - Are error messages actionable or just "something went wrong"?
   - Is there any mention of the kro community, docs, or how to get help?
   - Is the onboarding flow discoverable when connected to an empty cluster?

---

## Exploration Protocol

6. **Connect to the browser**:
   - Use `browser_get_tabs` to find an existing tab or open a new one.
   - Claim the tab with `browser_claim_tab`.
   - Navigate to `$APP_URL`.

7. **Take an initial screenshot** to confirm the app is reachable.
   - If the app is not reachable (connection refused, error page): stop and report
     "App not reachable at $APP_URL — ensure `kro-ui serve` is running."

8. **Systematic page tour** — visit each route and assess it. For each page:

   a. Take a screenshot.
   b. Check the browser console for errors: `browser_errors` and `browser_console`.
   c. Check the page title: `document.title` should follow `<content> — kro-ui` format.
   d. Check every interactive element for keyboard focus ring visibility.
   e. Check all text rendering: no raw `undefined`, `null`, `?`, `[object Object]`.
   f. Check loading, error, and empty states — trigger them if possible.
   g. Check that data-heavy areas (card grids, tables) handle 0-item lists gracefully.
   h. Check light mode by toggling `data-theme="light"` on `<html>` via JS injection.

   **Pages to visit** (in order):

   | Route | What to check |
   |-------|---------------|
   | `/` | Home page: RGD card grid, MetricsStrip (if present), search bar, empty state |
   | `/catalog` | Catalog: search + label filters, card grid, empty state, sort order |
   | `/rgds/:name` | RGD detail: all tabs (Graph, Instances, Schema/Docs, Validation, Access, Events) |
   | `/rgds/:name` Graph tab | DAG: node tooltips on hover, forEach annotation, chain detection, readyWhen badge |
   | `/rgds/:name/instances` | Instance list: namespace filter, sort, empty state |
   | `/rgds/:name/instances/:namespace/:name` | Instance detail: live DAG, event stream, breadcrumb |
   | `/fleet` | Multi-cluster overview: refresh button, per-context health |
   | `/404-not-found` | NotFound page must render — not a blank page |

9. **For each page**, record all findings using this structured format internally:

   ```
   Finding #{N}
   Page: <route>
   Category: Bug | UX | Enhancement | PM | Community
   Severity: Critical | High | Medium | Low
   Title: <concise 1-line title>
   Description: <what was observed>
   Expected: <what should happen>
   Evidence: <screenshot reference or console output>
   Duplicate of: <existing issue number if already filed, else "new">
   ```

10. **Deduplication pass** — after the full tour, remove any findings that are exact
    duplicates of each other or of open GitHub issues loaded in step 4.

---

## Present Findings

11. **Display all findings** grouped by severity:

    ```
    ## App Exploration Findings

    Explored: $APP_URL
    Pages visited: N
    Console errors: N
    Total findings: N (N new, N duplicates of open issues)

    ### Critical (N)
    | # | Page | Category | Title |
    |---|------|----------|-------|
    | 1 | /    | Bug      | MetricsStrip renders "undefined" when scrapedAt is null |

    ### High (N)
    ...

    ### Medium (N)
    ...

    ### Low (N)
    ...

    ### Skipped — already open (N)
    | # | Existing issue | Title |
    |---|---------------|-------|
    | - | #57 | children endpoint hangs on large clusters |
    ```

    After each group, include a one-paragraph narrative from the PM / committer /
    community manager perspective summarising the pattern of issues found.

---

## Issue Creation (interactive, per finding)

12. **For each new finding** (not a duplicate), ask:

    ```
    ## Finding #{N}: [title]

    Severity: [Critical/High/Medium/Low]
    Category: [Bug/UX/Enhancement/PM/Community]
    Page: [route]

    [2-3 sentence description of the issue]

    Open a GitHub issue for this finding?
      Y) Yes — open issue now
      N) No — skip
      E) Edit the title/description first
    ```

    Wait for the user's choice.

    **If Y**: create the issue:
    ```bash
    gh issue create \
      --title "[category]: [title]" \
      --body "$(cat <<'EOF'
    ## Observed
    [description of what was seen]

    ## Expected
    [description of correct behaviour]

    ## Steps to reproduce
    1. Navigate to [route]
    2. [action]
    3. Observe: [result]

    ## Context
    - Page: [route]
    - Severity: [severity]
    - Found during: automated app exploration
    EOF
    )" \
      --label "[appropriate label]"
    ```

    **If E**: show the current title and body, ask the user to type their revision,
    then create with the revised content.

    **If N**: skip without recording.

13. **After all findings are processed**, display the session summary:

    ```
    ## Exploration Complete

    Pages visited:   N
    Findings total:  N
    Issues opened:   N
    Skipped:         N
    Already tracked: N

    ### Opened issues
    | # | Severity | Title | URL |
    |---|----------|-------|-----|
    | 1 | High | MetricsStrip renders "undefined" ... | https://github.com/.../issues/NNN |
    ```

---

## Exploration Principles

- **Be a real user first**: navigate the way a platform engineer discovering kro-ui for the
  first time would. Click things that look clickable. Try to accomplish a real task.
- **Screenshot everything notable**: visual evidence makes issues actionable.
- **Don't skip empty states**: navigate to a context with no RGDs if possible, or test
  by filtering until zero results — the empty state is as important as the happy path.
- **Check both themes**: light mode is not an afterthought — token violations appear there.
- **Console errors are always bugs**: any JS error during normal navigation is Critical.
- **Check the browser title tab**: every page must have a meaningful title per §XIII.
- **Contrast the three lenses**: a finding might be "Low" as a bug but "High" as a PM
  concern because it blocks the first-time user experience. Use the higher severity.
- **Never fabricate findings**: only report what is actually observed in the running app.
  If a page is not reachable (no cluster, no data), record that fact and move on.
- **Cross-reference AGENTS.md anti-patterns**: the known anti-pattern table is a checklist
  of bugs that have been found before — look for them specifically in the live UI.
- **Report specifics, not generalities**: "the tooltip overflows the right edge when the
  node is the rightmost in the graph" not "tooltips have positioning issues".
