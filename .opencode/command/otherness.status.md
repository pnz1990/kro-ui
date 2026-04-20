---
description: "Show current agent state: what's in progress, queue position, CI status, and board health. Pass --fleet to see all monitored projects."
---

You are showing the current status of the autonomous team.

Parse arguments:
```bash
ARGS="${ARGUMENTS:-}"
FLEET_MODE=false
echo "$ARGS" | grep -q "\-\-fleet" && FLEET_MODE=true
```

## Step 1 — Read state (single-project mode)

Skip if `FLEET_MODE=true`.

```bash
if [ "$FLEET_MODE" != "true" ]; then
# Always read from _state branch first — local file may be stale or empty
git fetch origin _state --quiet 2>/dev/null || true
git show origin/_state:.otherness/state.json > .otherness/state.json 2>/dev/null || true
python3 - << 'EOF'
import json, datetime, os

try:
    s = json.load(open('.otherness/state.json'))
except:
    print("No .otherness/state.json found. Run /otherness.setup first.")
    exit(0)

print(f"Mode: {s.get('mode','?')} | Queue: {s.get('current_queue','none')}")
print()

# In-flight items
in_flight = [(id, d) for id, d in s.get('features', {}).items()
             if d.get('state') in ('assigned','in_progress','in_review')]
if in_flight:
    print("In flight:")
    for id, d in in_flight:
        print(f"  {id}: {d.get('state')} (PR #{d.get('pr_number','?')})")
else:
    print("In flight: none")

print()

# Bounded sessions
bounded = [(k, v) for k, v in s.get('bounded_sessions', {}).items()
           if v.get('last_seen')]
if bounded:
    print("Bounded sessions:")
    for k, v in bounded:
        last = v.get('last_seen','?')
        item = v.get('current_item','idle')
        print(f"  {k}: {item} (last seen {last})")

print()

# Heartbeats
for role, h in s.get('session_heartbeats', {}).items():
    last = h.get('last_seen')
    if last:
        ts = datetime.datetime.strptime(last, '%Y-%m-%dT%H:%M:%SZ')
        age = (datetime.datetime.utcnow() - ts).seconds // 60
        print(f"Heartbeat {role}: {age}m ago (cycle {h.get('cycle',0)})")
EOF

fi
```

## Step 2 — CI status on main (single-project mode)

Skip if `FLEET_MODE=true`.

```bash
if [ "$FLEET_MODE" != "true" ]; then
  REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')
  echo "CI (main):"
  gh run list --repo "$REPO" --branch main --limit 5 \
    --json status,conclusion,name,createdAt \
    --jq '.[] | "\(.conclusion // .status) \(.name) \(.createdAt[:10])"' 2>/dev/null || echo "  (gh not configured)"
fi
```

## Step 3 — Open needs-human and blocked issues (single-project mode)

Skip if `FLEET_MODE=true`.

```bash
if [ "$FLEET_MODE" != "true" ]; then
  echo ""
  echo "Needs human:"
  gh issue list --repo "$REPO" --label "needs-human" --state open \
    --json number,title --jq '.[] | "  #\(.number) \(.title[:70])"' 2>/dev/null || echo "  none"

  echo ""
  echo "Blocked:"
  gh issue list --repo "$REPO" --label "blocked" --state open \
    --json number,title --jq '.[] | "  #\(.number) \(.title[:70])"' 2>/dev/null || echo "  none"
fi
```

## Step 4 — Fleet health table (--fleet mode)

Only run if `FLEET_MODE=true`. Reads project list from `otherness-config.yaml` under `monitor.projects`.

```bash
if [ "$FLEET_MODE" = "true" ]; then

python3 - << 'EOF'
import subprocess, json, datetime, re, os, base64

# Resolve config path: prefer project root, fall back to ~/.otherness
config_path = 'otherness-config.yaml'
if not os.path.exists(config_path):
    config_path = os.path.expanduser('~/.otherness/otherness-config.yaml')

repos = []
in_monitor = in_projects = False
try:
    for line in open(config_path):
        if re.match(r'^monitor:', line): in_monitor = True
        if in_monitor and re.match(r'\s+projects:', line): in_projects = True
        if in_projects:
            m = re.match(r'\s+- (.+)', line)
            if m: repos.append(m.group(1).strip().strip('"\''))
except Exception as e:
    print(f"Could not parse monitor.projects from {config_path}: {e}")
    exit(1)

if not repos:
    print("No projects configured under monitor.projects in otherness-config.yaml")
    exit(0)

print(f"{'PROJECT':<28} {'_STATE':<14} {'CI':<10} {'OPEN_PRS':<10} {'NEEDS_HUMAN':<13} {'TODO'}")
print("-" * 85)

flags = []
for repo in repos:
    name = repo.split('/')[-1]

    # _state last commit
    r = subprocess.run(['gh','api',f'repos/{repo}/branches/_state',
                        '--jq','.commit.commit.committer.date'],
                       capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        ts = datetime.datetime.fromisoformat(r.stdout.strip().replace('Z','+00:00'))
        hours = (datetime.datetime.now(datetime.timezone.utc) - ts).total_seconds() / 3600
        state_str = f"{hours:.0f}h ago" if hours < 72 else f"⚠ STALE {hours:.0f}h"
    else:
        state_str = "NO _STATE"

    # CI status
    ci = subprocess.run(['gh','run','list','--repo',repo,'--branch','main','--limit','1',
                         '--json','conclusion','--jq','.[0].conclusion'],
                        capture_output=True, text=True)
    ci_raw = (ci.stdout.strip() or "?")
    ci_str = ("🔴 " if ci_raw == "failure" else "✅ " if ci_raw == "success" else "") + ci_raw[:7]

    # Open PRs
    prs = subprocess.run(['gh','pr','list','--repo',repo,'--state','open',
                          '--json','number','--jq','length'],
                         capture_output=True, text=True)
    pr_count = prs.stdout.strip() or "0"

    # Needs-human
    nh = subprocess.run(['gh','issue','list','--repo',repo,'--state','open',
                         '--label','needs-human','--json','number','--jq','length'],
                        capture_output=True, text=True)
    nh_count = nh.stdout.strip() or "0"
    nh_flag = "⚠ " + nh_count if int(nh_count or 0) > 0 else nh_count

    # TODO items in state.json
    sr = subprocess.run(['gh','api',
                         f'repos/{repo}/contents/.otherness%2Fstate.json?ref=_state',
                         '--jq','.content'],
                        capture_output=True, text=True)
    todo_count = "?"
    if sr.returncode == 0:
        try:
            s = json.loads(base64.b64decode(sr.stdout.strip()))
            todo_count = str(len([d for d in s.get('features',{}).values()
                                  if d.get('state') == 'todo']))
        except: pass

    print(f"{name:<28} {state_str:<14} {ci_str:<10} {pr_count:<10} {nh_flag:<13} {todo_count}")

    if "STALE" in state_str or "failure" in ci_str or int(nh_count or 0) > 0:
        flags.append(repo)

if flags:
    print()
    print(f"⚠  Flagged ({len(flags)}): {', '.join(f.split('/')[-1] for f in flags)}")
    print("   Run /otherness.cross-agent-monitor for details.")
else:
    print()
    print("✅ All projects healthy.")
EOF

fi
```
