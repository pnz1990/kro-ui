---
description: "Continuous PDCA improvement loop: systematic browser + cluster audit → find bugs and gaps → implement fixes → build → verify in browser against live cluster → commit (with spec/issue refs) → push → PR → watch CI → merge → repeat. Runs indefinitely until manually stopped. Usage: /pdca-improvements  or  /pdca-improvements --focus ux  or  /pdca-improvements --focus bugs  or  /pdca-improvements --focus features"
---

## User Input

```text
$ARGUMENTS
```

## Parse Arguments

1. **Extract `--focus`** from `$ARGUMENTS` if present.
   - Valid values: `ux`, `bugs`, `features`, `docs`, `all` (default: `all`)
   - `ux` — tooltips, labels, empty states, help text, accessibility, constitution §XIII
   - `bugs` — logic errors, wrong data, mismatched cluster state, state-map issues
   - `features` — items from GH issue backlog, new capabilities, quality-of-life additions
   - `docs` — AGENTS.md, spec inventory, README, inline comments
   - `all` — everything, prioritised: bugs first, then ux, then features, then docs
   - Store as `$FOCUS`.

---

## Prime Directive

You are running a continuous PDCA (Plan → Do → Check → Act) improvement loop on
this codebase. You do not stop between cycles. You do not ask permission to start
the next cycle. You do not ask whether to proceed. You keep going until the user
interrupts you.

Each cycle is self-contained:
  - Plan: audit the live application and codebase for issues
  - Do: implement the fix or feature in a worktree
  - Check: build locally, verify in browser against the live kind cluster
  - Act: commit (correctly), push, open PR, wait for CI, merge, pull main, clean up

The only acceptable stopping conditions are:
  - The user explicitly asks you to stop
  - You cannot find any more meaningful improvements after a full audit

---

## Invariants (read before every cycle, never skip)

Before any cycle begins, verify these are true. If any are false, fix them first:

```bash
# 1. On main, clean, up to date
git branch --show-current          # must be main
git status                         # must be clean (no tracked modifications)
git fetch origin && git status     # must not be behind origin/main

# 2. Server is running against the kind cluster
curl -s http://localhost:40107/api/v1/healthz

# 3. Browser is accessible (claim the tab if not already claimed)
# Use browser_get_tabs, then browser_claim_tab

# 4. Cluster is healthy
kubectl --kubeconfig=.demo-kubeconfig.yaml get nodes
```

If the server is not running, rebuild and start it:
```bash
make web && GOPROXY=direct GONOSUMDB="*" go build -o bin/kro-ui ./cmd/kro-ui/
nohup bin/kro-ui serve --port 40107 \
  --kubeconfig .demo-kubeconfig.yaml \
  --context kind-kro-ui-demo > /tmp/kro-ui-demo.log 2>&1 &
```

---

## PLAN Phase — Systematic Audit

Every audit cycle runs ALL of the following checks. Never skip a check because
"it was fine last cycle" — each cycle is a fresh audit.

### P-1. Load project context

Read these files at the start of every cycle (not just the first):
- `.specify/memory/constitution.md` — non-negotiable rules
- `AGENTS.md` — spec inventory, anti-pattern table, Recent Changes
- Open GitHub issues: `gh issue list --state open --json number,title,labels`

### P-2. Run static checks (always)

```bash
# TypeScript — zero errors required
cd web && bun run typecheck 2>&1

# Go vet — zero warnings required
GOPROXY=direct GONOSUMDB="*" go vet ./... 2>&1

# Hardcoded colors in component CSS (constitution §IX anti-pattern)
grep -rn "rgba\|#[0-9a-fA-F]\{3,6\}" web/src --include="*.css" | grep -v "tokens.css"

# Emoji violations (constitution §IX — no emojis by default)
grep -rn "💡\|🔴\|🟢\|🟡\|⚠️\|✅\|❌\|🚀\|👀\|🎉" web/src --include="*.tsx" --include="*.ts"

# items:null pattern in Go (must always be [] not null)
grep -rn "var.*\[\].*map\[string\]any$" internal/

# Copy-pasted graph helpers (constitution §IX)
grep -rn "nodeTypeLabel\|tokenClass" web/src --include="*.ts" --include="*.tsx"
```

### P-3. Navigate the live application in browser

Open these pages in sequence and capture the accessibility tree snapshot for each.
Look for anything that does not match what the cluster actually has.

```
http://localhost:40107/
http://localhost:40107/catalog
http://localhost:40107/fleet
http://localhost:40107/events
http://localhost:40107/author
http://localhost:40107/rgds/test-app?tab=graph
http://localhost:40107/rgds/test-app?tab=instances
http://localhost:40107/rgds/test-app?tab=validation
http://localhost:40107/rgds/test-app?tab=errors
http://localhost:40107/rgds/test-app?tab=access
http://localhost:40107/rgds/crashloop-app/instances/kro-ui-demo/crashloop-demo
http://localhost:40107/rgds/never-ready/instances/kro-ui-demo/never-ready-prod
http://localhost:40107/rgds/upstream-contagious-include-when/instances/kro-ui-demo/contagious-api-disabled
http://localhost:40107/rgds/upstream-collection-chain/instances/kro-ui-demo/chain-empty
http://localhost:40107/rgds/multi-resource/instances/kro-ui-demo/autoscaled-proxy
http://localhost:40107/rgds/never-ready?tab=errors
http://localhost:40107/rgds/optimization-candidate?tab=graph
```

For each page, check:

**Data accuracy** — cross-check every number, state badge, and label against
the live cluster. If the UI says "3 ready" but `kubectl get <kind> -A` shows
something different, that is a bug.

```bash
# Cross-check instance states for key RGDs
kubectl --kubeconfig=.demo-kubeconfig.yaml get \
  autoscaledapp,neverreadyapp,crashloopapp,tripleconfigapp \
  -A --no-headers 2>/dev/null
```

**Node state accuracy** — for every instance detail page, cross-check the
live DAG node colors against actual child resource conditions:

```bash
curl -s "http://localhost:40107/api/v1/instances/<ns>/<name>/children?rgd=<rgd>" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for c in d.get('items',[]):
    nid=c.get('metadata',{}).get('labels',{}).get('kro.run/node-id','NO-LABEL')
    conds={x['type']:x['status'] for x in c.get('status',{}).get('conditions',[])}
    print(f'  {c[\"kind\"]:20} node-id={nid:20} conds={conds}')
"
```

Expected mapping (buildNodeStateMap logic):
- child has `Available=False` or `Ready=False` → red ring (`error`)
- child has `Progressing=True` (and globalState is alive) → amber pulse (`reconciling`)
- no node-id label (EndpointSlice etc.) → silently skipped (not in map)
- includeWhen=false → violet (`pending` / "Excluded" in legend)
- resource missing from cluster + no includeWhen → grey (`not-found`)

**Text and label accuracy** — check every abbreviation, tooltip, empty state
message, and legend entry for accuracy. Cross-reference:
- Constitution §XII: absent data → "Not reported", never `?`, `undefined`, `null`
- Constitution §XIII: `<abbr>` around RGD/CRD/CEL on first use; all interactive
  cards fully clickable; breadcrumbs on pages > 2 levels deep; page titles set
- Constitution §IX: no hardcoded rgba/hex; no copy-pasted helpers

**Namespace sentinel** — verify `_` never renders as literal `_` anywhere.
Search for it in rendered text via browser_query.

### P-4. Check the GH issue backlog

```bash
gh issue list --state open --repo pnz1990/kro-ui \
  --json number,title,labels --limit 20
```

For each open issue:
- Can it be implemented in one clean worktree-PR cycle?
- Does it have a spec? (check `.specify/specs/`)
- Is it blocked by anything?

Prioritize: correctness bugs > constitution violations > UX gaps > features > docs.

### P-5. Synthesise findings into a ranked list

After completing P-1 through P-4, compile a prioritised list of improvements.
For each item record:
- **Category**: bug | ux | feature | docs | test
- **Severity**: critical | high | medium | low
- **Source**: browser-audit | static-check | cluster-crosscheck | gh-issue | self-use
- **Description**: one sentence, specific (file:line or page + element)
- **Expected**: what correct behaviour looks like
- **Effort**: tiny (< 30 min) | small (< 2h) | medium (< 4h) | large (> 4h)

Group into batches by logical cohesion. One PR per batch.
Pick the highest-priority batch that fits in a single worktree-PR cycle.

---

## DO Phase — Implementation

For each batch:

### D-1. Create a worktree

```bash
wt switch --create <branch-name> --no-cd
```

Branch naming convention:
- Bug fix: `fix/<short-description>` (e.g. `fix/node-state-map`)
- Feature: `NNN-<short-description>` (e.g. `047-ux-improvements`)
- Docs: `docs/<short-description>`

Work exclusively inside the worktree directory:
`/Users/rrroizma/Projects/kro-ui.<branch-name>/`

### D-2. Read before you write

**Always** read the files you are about to change using the Read tool before
editing them. Never edit a file you have not read in this session.

Before implementing any change:
1. Read `.specify/memory/constitution.md` — does your change comply?
2. Read the affected source files
3. Read the corresponding test files (if any)

### D-3. Implement the batch

Apply every fix in the batch. Follow these rules unconditionally:

**Code quality**
- Every `.go` file: Apache 2.0 copyright header (constitution §VI)
- Go errors: `fmt.Errorf("context: %w", err)` (constitution §VI)
- CSS: use `var(--token-name)` only — no hardcoded `rgba()` or hex (constitution §IX)
- No copy-pasted helpers across files — add to `@/lib/` and import (constitution §IX)
- No emojis unless the user explicitly requested them (constitution §IX)

**State map key discipline** (anti-pattern #278)
- `buildNodeStateMap` keys by `kro.run/node-id` label, not by `kind`
- Children without `kro.run/node-id` (EndpointSlice, ReplicaSet) are silently skipped
- `nodeStateForNode` looks up `stateMap[node.id]` first, then kind fallback

**Health state derivation** (anti-patterns D-1/D-2 from stress-test session)
- `extractInstanceHealth`: check `status.state === 'IN_PROGRESS'` BEFORE conditions
- `isReconciling()`: check `status.state === 'IN_PROGRESS'` as first branch
- `buildNodeStateMap`: check `kroState === 'IN_PROGRESS'` before conditions

**API responses**
- Never return `{"items":null}` — coerce nil slices to `[]` before responding
- `listWithLabelSelector` must init `results = make([]map[string]any, 0)`

**Namespace display**
- Always call `displayNamespace(ns)` before rendering any namespace string
- `displayNamespace('_')` → `'cluster-scoped'`, `displayNamespace('')` → `'cluster-scoped'`

**Tooltips and help text** (constitution §XIII)
- Every jargon term (RGD, CRD, CEL, GVR, forEach) gets an `<abbr title="...">` or `title` attribute on first use per page
- Every metric cell in TelemetryPanel has a `title` attribute
- Every legend entry has a `title` attribute
- Every status badge has a fallback `title` when `reason` is absent

### D-4. Write or update tests

For every behaviour change:
- Add unit tests for the new/fixed logic
- Update existing tests that assert the old (incorrect) behaviour
- For new utilities (e.g. `displayNamespace`): add positive + negative + edge cases
- Tests must follow the `build`/`check` table-driven pattern (constitution §VII)
- Run `go test -race ./...` for Go; run `bun run test` for TypeScript

---

## CHECK Phase — Build and Verify

### C-1. Build

```bash
# From inside the worktree directory:
cd web && bun run typecheck         # must pass with 0 errors
cd web && bun run test              # must pass with 0 failures
GOPROXY=direct GONOSUMDB="*" go vet ./...
GOPROXY=direct GONOSUMDB="*" go test ./internal/... -count=1 -race -timeout 60s
make web
GOPROXY=direct GONOSUMDB="*" go build -o bin/kro-ui ./cmd/kro-ui/
```

All of these must pass before proceeding. Fix failures before moving on —
do not skip to the PR step with a failing build.

### C-2. Run the new binary against the kind cluster

```bash
pkill -f "kro-ui serve" 2>/dev/null; sleep 1
nohup /Users/rrroizma/Projects/kro-ui.<branch>/bin/kro-ui serve \
  --port 40107 \
  --kubeconfig /Users/rrroizma/Projects/kro-ui/.demo-kubeconfig.yaml \
  --context kind-kro-ui-demo \
  > /tmp/kro-ui-demo.log 2>&1 &
sleep 3 && curl -s http://localhost:40107/api/v1/healthz
```

### C-3. Verify every fix in the browser

For each fix in the batch, navigate to the relevant page and confirm:

1. The bug no longer reproduces
2. No regression on adjacent features (check the pages listed in P-3)
3. The data matches the cluster

Use `browser_snapshot` to get the full accessibility tree. Cross-check:
- All DAG node state classes match expected states from cluster conditions
- No `_` rendered as literal text anywhere (grep the snapshot text)
- All health chips show correct state and counts
- Tooltips are present on elements that should have them
- Console errors: use `browser_errors` to check for JS exceptions

```bash
# Spot-check key scenarios that have caused bugs in the past:
# 1. Two nodes of the same kind (crashloop-app: goodDeploy + badDeploy)
# 2. Instance with includeWhen=false (webapp-no-config-1: appConfig node)
# 3. Instance with kro IN_PROGRESS (never-ready-prod: reconciling banner)
# 4. Contagious includeWhen (contagious-api-disabled: both nodes absent/pending)
# 5. Empty forEach collection (chain-empty: 0 items in CollectionPanel)
# 6. Multi-namespace instances (multi-ns-app: two namespaces in dropdown)
```

If any verification step fails, fix the issue and return to C-1.

---

## ACT Phase — Commit, PR, CI, Merge

### A-1. Commit

Commit message format (constitution §VIII — Conventional Commits):

```
type(scope): short summary in imperative mood, ≤72 chars

Optional body: explain WHY the change is needed.
Reference specs: "Implements spec 005-instance-detail-live FR-002 enhancement."
Reference issues: "Partially addresses GH #274."
Reference anti-patterns: "Fixes AGENTS.md anti-pattern #77 (hardcoded rgba)."

Test coverage: N new unit tests / 1084 total.
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
Scopes: `api`, `k8s`, `server`, `web`, `dag`, `highlighter`

**Commit message quality checklist** (must pass before committing):
- [ ] Summary line ≤ 72 chars
- [ ] Type is one of the approved types
- [ ] Body explains WHY, not just WHAT
- [ ] Spec/issue references present when applicable
- [ ] No `--no-verify` flags — pre-commit hook must run

```bash
cd /Users/rrroizma/Projects/kro-ui.<branch>
git add -A
git commit -m "<message>"
```

### A-2. Update AGENTS.md spec inventory

Before pushing, update `AGENTS.md` in the worktree:
- Mark `In progress` entries as `Merged (PR #NNN)` for anything just merged
- Add the new branch/spec to the inventory table with `In progress`
- Update the `Recent Changes` section: one concise bullet per version

### A-3. Push and open PR

```bash
git push -u origin <branch-name>

gh pr create \
  --base main \
  --head <branch-name> \
  --title "<type>(<scope>): <summary>" \
  --body "$(cat <<'EOF'
## Summary

<1-3 bullet points describing what changed and why>

### <Fix/Feature 1>
<specific description, what was wrong, what is correct now>

### <Fix/Feature N>
...

## Tests
<N> unit tests passing. TypeScript strict: 0 errors.

## Verified on cluster
- <scenario>: <expected behaviour> ✓
- <scenario>: <expected behaviour> ✓
EOF
)"
```

### A-4. Monitor CI

Poll until completion. CI must pass before merging.

```bash
for i in $(seq 1 40); do
  result=$(gh run list --workflow=ci.yml --branch=<branch> --limit 1 \
    --json status,conclusion -q '.[0] | "\(.status):\(.conclusion // "")"' 2>/dev/null)
  echo "[$i] $result"
  case "$result" in completed:*) break;; esac
  sleep 20
done
```

**If CI fails**:
1. `gh run view <run-id> --log` — find the specific failure
2. Fix the failure locally (go back to D-3)
3. Commit the fix: `git commit -m "fix(<scope>): address CI failure — <what>"`
4. `git push` — CI re-runs automatically
5. Do NOT merge until CI is green

Common CI failure patterns and fixes:
- `go vet` failure → fix the vet error, don't suppress it
- TypeScript error → fix the type error, don't use `as any`
- Test failure → fix the code or the test, don't delete the test
- `items:null` in Go handler → init slice with `make([]T, 0)`
- Hardcoded rgba/hex in CSS → move to `tokens.css` as a named token
- **E2E `SyntaxError: Unexpected token` at line N** → missing `})` closing a `test.describe` block. Verify all `.spec.ts` files have brace depth = 0. Crashes the entire runner before any test runs.
- **E2E test navigates to nonexistent SPA route then times out** → `page.goto()` always returns HTTP 200 on a SPA. Use `page.request.get(apiUrl)` to check if the resource exists, then `test.skip()` + `return` if not OK, then `page.goto()` to navigate. See constitution §XIV.
- **E2E `locator.or().toBeVisible()` throws "strict mode violation"** → both elements in the `.or()` are visible simultaneously. Replace with `page.waitForFunction(() => document.querySelector(...) !== null || ...)`.
- **E2E journey file silently skipped** → the file's number prefix (e.g. `047-`) doesn't match any `testMatch` in `playwright.config.ts`. Add a new chunk or extend an existing one.

### A-5. Merge

```bash
gh pr merge <pr-number> --squash --admin 2>&1
```

If the merge fails because the branch is stale (CI ran on a different base),
update the branch first:
```bash
git fetch origin && git rebase origin/main
git push --force-with-lease
```

### A-6. Pull main and clean up

```bash
# Pull from the MAIN worktree (not the feature worktree)
cd /Users/rrroizma/Projects/kro-ui
git pull origin main

# Remove the feature worktree
wt remove -D <branch-name>
```

If `git pull` has conflicts (e.g. local spec.md was written during the session):
```bash
git stash
git pull origin main
git stash drop
```

### A-7. Rebuild from main and verify once more

```bash
pkill -f "kro-ui serve" 2>/dev/null; sleep 1
cd /Users/rrroizma/Projects/kro-ui
make web && GOPROXY=direct GONOSUMDB="*" go build -o bin/kro-ui ./cmd/kro-ui/
nohup bin/kro-ui serve --port 40107 \
  --kubeconfig .demo-kubeconfig.yaml \
  --context kind-kro-ui-demo \
  > /tmp/kro-ui-demo.log 2>&1 &
sleep 3 && curl -s http://localhost:40107/api/v1/healthz
```

Navigate to the pages you changed one more time. The final binary is what
the user will actually use. Confirm every fix is still present.

---

## REPEAT — Start the next PDCA cycle immediately

After A-7 completes successfully, **immediately start the next cycle at P-1**.

Do not pause. Do not ask "shall I continue?". Do not summarise and wait.
Just go back to the top and run the full audit again. The audit will find
new things because:
- The previous fixes may have revealed new issues
- The cluster may have changed state
- You are looking with fresh eyes each cycle

The only exception: if after a complete P-1 through P-5 cycle you genuinely
cannot find any meaningful improvement, output this message and stop:

```
## PDCA Loop — No Further Improvements Found

All audit lenses passed clean. No bugs, constitution violations, UX gaps,
or meaningful feature opportunities identified in this cycle.

Cycles completed: N
Total PRs merged: N
```

---

## Self-Use Heuristics — Finding Ideas as the Product's Own User

When navigating the application, ask yourself these questions from the
perspective of a platform engineer using kro-ui to debug a production incident:

**Debugging a broken instance**
- Can I immediately see WHICH child resource is broken, not just that something is wrong?
- Can I get the YAML for that broken resource in one click?
- Is there a clear indication of HOW LONG it has been broken?
- Are there kubectl commands I could run to fix it, shown inline?

**Understanding why something is stuck reconciling**
- Does the reconciling banner tell me what to check next?
- Can I trigger an immediate re-check without waiting 5 seconds?
- Are the readyWhen expressions shown alongside the current values they're evaluating?

**Navigating across many instances**
- Can I sort by "most broken first"?
- Can I filter to only show degraded/error instances across all RGDs at once?
- Is the namespace always clearly displayed (never shows `_`)?

**Comparing instances**
- If I have prod and staging instances, can I diff their specs?
- Can I copy an instance's YAML to recreate it in another namespace?

**Understanding a new RGD**
- Does the DAG legend tell me what each symbol means?
- Are CEL expressions explained with examples?
- Does the Docs tab have enough to create an instance without reading the source?

**Noticing these gaps is finding future features.** Every time you navigate
and think "it would be useful if...", file it as a GH issue rather than
implementing it immediately (unless it's tiny). This keeps the PR cycle clean
while building the backlog.

```bash
# Park a product idea as a GH issue:
gh issue create \
  --repo pnz1990/kro-ui \
  --title "UX: <short description>" \
  --label "enhancement" \
  --body "<what, why, which page/component, example scenario>"
```

---

## Batch Sizing Rules

One PR should contain:

**DO combine** in one PR:
- Multiple fixes of the same kind (e.g. 6 missing tooltips → one "UI polish" PR)
- A bug and its test
- A feature and its documentation update to AGENTS.md
- Constitution violations in the same file/component

**DO NOT combine** in one PR:
- A bug fix and an unrelated feature (makes revert harder)
- Backend changes and unrelated frontend changes
- Multiple features that each touch different pages (harder to review)
- Anything that would make `git revert <pr>` complex

Ideal PR size: 3–10 files changed, < 300 lines net. If a batch is larger,
split it.

---

## Project-Specific Knowledge (always in context)

These facts are the output of previous PDCA cycles. Apply them in every cycle
without re-learning them:

**State map** (`instanceNodeState.ts`):
- Keyed by `kro.run/node-id` label (NOT by `kind`)
- Children without this label are silently skipped
- `nodeStateForNode` looks up `stateMap[node.id]` first, then `stateMap[kindKey]`
- `IN_PROGRESS` kro state → `reconciling` (checked before conditions)
- `GraphProgressing=True` → `reconciling` (kro v0.8.x compat)

**Health states** (`format.ts`):
- 6 states: `ready`, `degraded`, `reconciling`, `error`, `pending`, `unknown`
- `degraded` = CR `Ready=True` but a child has `Available=False`
- Applied via `applyDegradedState(extractInstanceHealth(instance), hasChildError)`
- Card-level chip (`HealthChip`) cannot show `degraded` — no children fetch at that level

**Namespace sentinel** (`format.ts`):
- `displayNamespace('_')` → `'cluster-scoped'`
- Must be called before rendering any namespace string in any component

**Demo cluster fixtures** (on `kind-kro-ui-demo`):
- `crashloop-demo`: `badDeploy` has `Available=False` → red ring; `goodDeploy` has `Progressing=True` → amber; overall chip = Degraded
- `never-ready-prod/staging/dev`: `IN_PROGRESS` state (readyWhen never true) → Reconciling chip + banner
- `contagious-api-disabled`: 0 children (`items:[]`), both `parentDeploy` and `childConfig` absent
- `chain-empty`: `baseConfig` present, `chainedConfigs` has 0 items (empty forEach)
- `webapp-no-config-1`: `appConfig` absent (includeWhen=false) → violet Excluded node
- `webapp-catalog`: same (enableConfig=false)

**API invariants**:
- `GET /api/v1/instances/<ns>/<name>/children` → always `{"items":[]}` not `{"items":null}` for zero children
- `kro.run/node-id` label is set on all kro-managed children; EndpointSlice/ReplicaSet have no label
- `displayNamespace` must translate `_` before any render — URL sentinel must never appear in UI text

**Constitution anti-patterns to watch for** (from AGENTS.md):
- `rgba()` or hex literals in component `.css` files → move to `tokens.css`
- Copy-pasted `nodeTypeLabel` / `tokenClass` across component files → move to `@/lib/dag.ts`
- Portal tooltips without `getBoundingClientRect()` viewport clamping
- Resource cards with only a small text link as navigation target
- `items:null` in JSON API responses (Go nil slice)
- `_` rendered as namespace in any UI text
