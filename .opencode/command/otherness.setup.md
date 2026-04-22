---
description: "One-time setup: creates otherness-config.yaml and deploys the otherness command files. Run once per project."
---

You are setting up otherness for this project.

## Step 1 — Create otherness-config.yaml if missing

```bash
if [ ! -f "otherness-config.yaml" ]; then
  AGENTS_PATH=$(ls ~/.otherness/otherness-config-template.yaml 2>/dev/null \
    && echo ~/.otherness/otherness-config-template.yaml \
    || echo "")

  if [ -n "$AGENTS_PATH" ]; then
    cp "$AGENTS_PATH" otherness-config.yaml
    echo "Created otherness-config.yaml from template."
  else
    cat > otherness-config.yaml << 'EOF'
project:
  name: my-project
  repo: owner/repo
  report_issue: 1
  board_url: ""
  pr_label: ""

maqa:
  mode: standalone
  agents_path: ~/.otherness/agents
  status_update_cycles: 5
  product_validation_cycles: 3
  autonomous_mode: true

ci:
  provider: github-actions
  github_actions:
    workflow: ci.yml
  wait_timeout_seconds: 1200
  block_on_red: true

monitor:
  projects: []

github_projects:
  project_id: ""
  project_number: ""
  linked_repo: owner/repo
EOF
    echo "Created otherness-config.yaml (minimal template — no ~/.otherness found)."
  fi
fi
```

## Step 2 — Auto-fill project identity from git remote

```bash
REMOTE=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')
if [ -n "$REMOTE" ]; then
  python3 - "$REMOTE" << 'EOF'
import re, sys
repo = sys.argv[1]
name = repo.split('/')[-1]
content = open('otherness-config.yaml').read()
content = re.sub(r'(  repo:\s*)owner/repo', f'\\g<1>{repo}', content)
content = re.sub(r'(  name:\s*)my-project', f'\\g<1>{name}', content)
content = re.sub(r'(  linked_repo:\s*)owner/repo', f'\\g<1>{repo}', content)
open('otherness-config.yaml', 'w').write(content)
print(f"Set project.repo = {repo}, project.name = {name}")
EOF
fi
```

## Step 3 — Ensure ~/.otherness is cloned

```bash
if [ ! -d ~/.otherness ]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]\([^/]*\)/.*|\1|')
  git clone --quiet "git@github.com:${REMOTE_URL}/otherness.git" ~/.otherness 2>/dev/null || \
  git clone --quiet "https://github.com/${REMOTE_URL}/otherness.git" ~/.otherness 2>/dev/null || \
  echo "Could not auto-clone otherness. Clone manually: git clone git@github.com:<owner>/otherness.git ~/.otherness"
fi
```

## Step 4 — Deploy otherness command files into this project

OpenCode reads slash commands from `.opencode/command/` in the current project directory.
Sync the command files from `~/.otherness` — two-way: add new commands, remove stale ones.
Non-`otherness.*` files are never touched (project-custom commands stay intact).

```bash
if [ -d ~/.otherness/.opencode/command ]; then
  mkdir -p .opencode/command
  _SYNCED=0

  # Add or update all otherness.* commands
  for src in ~/.otherness/.opencode/command/otherness.*.md; do
    [ -f "$src" ] || continue
    fname=$(basename "$src"); dest=".opencode/command/$fname"
    if ! cmp -s "$src" "$dest" 2>/dev/null; then
      cp "$src" "$dest"
      echo "  Synced: $fname"
      _SYNCED=1
    fi
  done

  # Remove stale otherness.* commands no longer in ~/.otherness
  for dest in .opencode/command/otherness.*.md; do
    [ -f "$dest" ] || continue
    fname=$(basename "$dest")
    if [ ! -f ~/.otherness/.opencode/command/"$fname" ]; then
      rm "$dest"
      echo "  Removed stale: $fname"
      _SYNCED=1
    fi
  done

  [ $_SYNCED -eq 1 ] && echo "Commands synced in .opencode/command/" || echo "Commands already up to date."
else
  echo "WARNING: ~/.otherness/.opencode/command not found. Clone otherness first (Step 3)."
fi
```

## Step 5 — Ensure .otherness/state.json exists

```bash
mkdir -p .otherness
if [ ! -f .otherness/state.json ]; then
  REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')
  python3 - "$REPO" << 'EOF'
import json, sys, datetime
repo = sys.argv[1]
state = {
  "version": "1.3",
  "mode": "standalone",
  "repo": repo,
  "current_queue": None,
  "features": {},
  "engineer_slots": {"ENGINEER-1": None, "ENGINEER-2": None, "ENGINEER-3": None},
  "bounded_sessions": {},
  "session_heartbeats": {
    "STANDALONE": {"last_seen": None, "cycle": 0}
  },
  "handoff": None
}
with open('.otherness/state.json', 'w') as f:
     json.dump(state, f, indent=2)
print("Created .otherness/state.json")
EOF
fi
```

## Step 6 — Create _state branch for state persistence

The `_state` branch is where otherness stores its persistent memory across sessions.
It must exist on the remote before `/otherness.run` can write state.

```bash
if ! git ls-remote --heads origin _state | grep -q '_state'; then
  echo "Creating _state branch for state persistence..."
  CURRENT_BRANCH=$(git branch --show-current)
  REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')

  # Create an orphan branch (no shared history with main)
  git checkout --orphan _state
  git rm -rf . --quiet 2>/dev/null || true   # clear index — orphan starts empty

  # Write initial state.json
  mkdir -p .otherness
  python3 - "$REPO" << 'EOF'
import json, sys
repo = sys.argv[1]
state = {
  "version": "1.3",
  "mode": "standalone",
  "repo": repo,
  "current_queue": None,
  "features": {},
  "engineer_slots": {"ENGINEER-1": None, "ENGINEER-2": None, "ENGINEER-3": None},
  "bounded_sessions": {},
  "session_heartbeats": {"STANDALONE": {"last_seen": None, "cycle": 0}},
  "handoff": None
}
with open('.otherness/state.json', 'w') as f:
    json.dump(state, f, indent=2)
print("Wrote .otherness/state.json")
EOF

  git add .otherness/state.json
  git commit -m "state: initialize _state branch"
  git push origin _state
  git checkout "$CURRENT_BRANCH" --quiet
  echo "_state branch created and pushed."
else
  echo "_state branch already exists — skipping."
fi
```

## Step 7 — Initialize D4 artifacts (vision and roadmap stubs)

The autonomous team reads `docs/aide/vision.md` and `docs/aide/roadmap.md` at every
startup. Create stubs now if they don't exist so the project is D4-ready from the start.

```bash
mkdir -p docs/aide

if [ ! -f docs/aide/vision.md ]; then
  cat > docs/aide/vision.md << 'STUB'
# Vision

> Fill this in before running /otherness.run.
> What is this project? What problem does it solve? Who is it for?
> Write 2–4 sentences. This is the north star for everything that gets built.
STUB
  echo "Created docs/aide/vision.md (stub — edit before running /otherness.run)"
else
  echo "docs/aide/vision.md already exists — skipping."
fi

if [ ! -f docs/aide/roadmap.md ]; then
  cat > docs/aide/roadmap.md << 'STUB'
# Roadmap

## Stage 1: Foundation
> Describe your first delivery milestone here.
> What should be working at the end of Stage 1?
STUB
  echo "Created docs/aide/roadmap.md (stub — edit before running /otherness.run)"
else
  echo "docs/aide/roadmap.md already exists — skipping."
fi
```

## Done

Edit `otherness-config.yaml` to set your `BUILD_COMMAND`, `TEST_COMMAND`, `LINT_COMMAND`, and other project-specific values. If your project has a UI, add `project.job_family: FEE`; for platform/infrastructure projects use `SysDE`; backend-only projects can omit the field (defaults to `SDE`).

**Before running `/otherness.run`**: edit `docs/aide/vision.md` to describe your project. This is the most important thing — the autonomous team reads it on every startup.

**To activate the scheduled loop (optional but recommended):**
The loop can run automatically every 6 hours via GitHub Actions — no human needed.
1. Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret
2. Add `ANTHROPIC_API_KEY` (or your LLM provider key) as a secret name
3. In `otherness-config.yaml`, uncomment the `schedule:` section and set your cron
4. `.github/workflows/otherness-scheduled.yml` is already present and will fire on schedule

See `docs/design/19-scheduled-execution.md` for full details.

Then run `/otherness.run` to start the autonomous team.
