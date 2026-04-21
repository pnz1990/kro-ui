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

## Step 0 — Health dashboard (single-project mode, design doc 35 §Future → ✅)

Skip if `FLEET_MODE=true`. Prints a compact one-page health view readable in 30 seconds.

```bash
if [ "$FLEET_MODE" != "true" ]; then

REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')

git fetch origin _state --quiet 2>/dev/null || true
git show origin/_state:.otherness/state.json > .otherness/state.json 2>/dev/null || true

python3 - << 'DASHBOARD_EOF'
import json, re, os, subprocess, datetime, tempfile

REPO = os.environ.get('REPO', '')

print("=" * 60)
print("otherness STATUS")
print("=" * 60)

# ── 3-line quick glance (design doc 06 §Future → ✅) ─────────
# A human should answer (1) healthy? (2) last shipped? (3) moving? in one glance
try:
    ql_health = "UNKNOWN"
    ql_last = "(none)"
    ql_queue = "?"
    try:
        metrics_content = open('docs/aide/metrics.md').read()
        rows = []
        for line in metrics_content.splitlines():
            if '|' not in line: continue
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if len(cells) >= 10 and cells[0].startswith('20'):
                rows.append(cells[9] if len(cells) > 9 else '?')
        if rows:
            recent = rows[-3:]
            feat = sum(1 for o in recent if o in ('feature-rich', 'mixed'))
            ql_health = "ADVANCING" if feat >= 2 else "STALLING"
    except Exception: pass
    try:
        import subprocess as _sp
        r = _sp.run(['gh','pr','list','--repo',REPO,'--state','merged','--limit','5',
                     '--json','title,mergedAt',
                     '--jq','[.[] | select(.title | test("^feat|^fix|^refactor";"i"))][0].title'],
                    capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip() and r.stdout.strip() != 'null':
            ql_last = r.stdout.strip().strip('"')[:50]
    except Exception: pass
    try:
        with open('.otherness/state.json') as f: _s = json.load(f)
        ql_queue = str(len([d for d in _s.get('features',{}).values() if d.get('state')=='todo']))
    except Exception: pass
    print(f"Health: {ql_health} | Last: {ql_last} | Queue: {ql_queue} todo")
    print("-" * 60)
except Exception: pass

# ── Section 1: Health signal with trend ─────────────────────
print()
print("1. HEALTH SIGNAL")
health = "UNKNOWN"
trend = "UNKNOWN"
try:
    content = open('docs/aide/metrics.md').read()
    rows = []
    for line in content.splitlines():
        if '|' not in line: continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 11 and cells[0].startswith('20'):
            outcome = cells[9] if len(cells) > 9 else ''
            rows.append({'date': cells[0], 'outcome': outcome})
    if rows:
        last = rows[-1]
        recent = rows[-5:]
        feature_count = sum(1 for r in recent if r.get('outcome') in ('feature-rich', 'mixed'))
        if feature_count >= 3:
            trend = "ADVANCING"
        elif feature_count == 2:
            trend = "STEADY"
        else:
            trend = "STALLING"
        outcomes = [r.get('outcome','?') for r in recent]
        print(f"  Trend (last {len(recent)} batches): {trend}")
        print(f"  Outcomes: {' | '.join(outcomes)}")
    else:
        print("  Metrics: no batch rows yet")
        trend = "UNKNOWN"
except Exception as e:
    print(f"  Metrics: unavailable ({e})")

# ── Section 2: Skills ────────────────────────────────────────
print()
print("2. SKILLS")
try:
    skills_dir = os.path.expanduser('~/.otherness/agents/skills')
    skill_files = [f for f in os.listdir(skills_dir)
                   if f.endswith('.md') and f not in ('PROVENANCE.md', 'README.md')]
    print(f"  Count: {len(skill_files)} skills")
    try:
        provenance = open(os.path.join(skills_dir, 'PROVENANCE.md')).read()
        dates = re.findall(r'^## (\d{4}-\d{2}-\d{2})', provenance, re.MULTILINE)
        if dates:
            last_learn = datetime.date.fromisoformat(sorted(dates)[-1])
            days_since = (datetime.date.today() - last_learn).days
            flag = " ⚠️ OVERDUE" if days_since > 14 else ""
            print(f"  Last learn: {last_learn} ({days_since}d ago){flag}")
        else:
            print("  Last learn: never (PROVENANCE.md empty)")
    except:
        print("  Last learn: unavailable")
except Exception as e:
    print(f"  Skills: unavailable ({e})")

# ── Section 3: Queue ─────────────────────────────────────────
print()
print("3. QUEUE")
try:
    with open('.otherness/state.json') as f: s = json.load(f)
    features = s.get('features', {})
    todo = [(k, v) for k, v in features.items() if v.get('state') == 'todo']
    in_flight = [(k, v) for k, v in features.items()
                 if v.get('state') in ('assigned', 'in_review')]
    PRIORITY_MAP = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    todo.sort(key=lambda x: (PRIORITY_MAP.get(x[1].get('priority'), 4), x[0]))
    print(f"  Todo: {len(todo)} items | In-flight: {len(in_flight)}")
    if todo:
        next_item = todo[0]
        print(f"  Next: {next_item[0]} [{next_item[1].get('priority','?')}] {next_item[1].get('title','?')[:55]}")
    else:
        print("  Next: (queue empty — COORD will generate)")
except Exception as e:
    print(f"  Queue: unavailable ({e})")

# ── Section 4: Journey status ────────────────────────────────
print()
print("4. JOURNEYS")
try:
    dod = open('docs/aide/definition-of-done.md').read()
    journeys = re.findall(r'^## (Journey \d+[^\n]*)', dod, re.MULTILINE)
    done_count = len(re.findall(r'✅', dod))
    pending_count = len(re.findall(r'🔲', dod))
    print(f"  {len(journeys)} journeys | {done_count} ✅ done | {pending_count} 🔲 pending")
    for j in journeys[:5]:
        print(f"  - {j[:55]}")
    if len(journeys) > 5:
        print(f"  ... +{len(journeys)-5} more")
except Exception as e:
    print(f"  Journeys: unavailable ({e})")

# ── Section 5: Simulation ────────────────────────────────────
print()
print("5. SIMULATION")
state_wt = os.path.join(tempfile.gettempdir(), 'otherness-status-' + str(os.getpid()))
sim_shown = False
try:
    if os.path.exists(state_wt):
        subprocess.run(['git','worktree','remove',state_wt,'--force'], capture_output=True)
    subprocess.run(['git','worktree','add','--no-checkout',state_wt,'origin/_state'],
                   capture_output=True, check=True)
    pred_file = os.path.join(state_wt, '.otherness', 'sim-prediction.json')
    subprocess.run(['git','-C',state_wt,'checkout','_state','--','.otherness/sim-prediction.json'],
                   capture_output=True)
    if os.path.exists(pred_file):
        pred = json.load(open(pred_file))
        calib_at = pred.get('calibrated_at', '?')[:10]
        try:
            calib_date = datetime.date.fromisoformat(calib_at)
            calib_age = (datetime.date.today() - calib_date).days
            calib_flag = " ⚠️ STALE" if calib_age > 14 else ""
        except:
            calib_age = '?'
            calib_flag = ''
        arch_conv = float(pred.get('arch_convergence_score', 0))
        arch_flag = " ⚠️ AMBER" if arch_conv >= 0.7 else ""
        source = pred.get('source', '?')
        print(f"  Calibrated: {calib_at} ({calib_age}d ago){calib_flag}")
        print(f"  Source: {source}")
        print(f"  arch_convergence: {arch_conv:.3f}{arch_flag}")
        print(f"  Next batch floor: {pred.get('prs_next_batch_floor','?')} — ceiling: {pred.get('prs_next_batch_ceiling','?')}")
        sim_shown = True
    else:
        print("  sim-prediction.json not found on _state branch")
except Exception as e:
    print(f"  Simulation: unavailable ({e})")
finally:
    try:
        subprocess.run(['git','worktree','remove',state_wt,'--force'], capture_output=True)
    except: pass
subprocess.run(['git','worktree','prune'], capture_output=True)

# ── Section 6: Reference project health ─────────────────────
print()
print("6. REFERENCE PROJECT")
try:
    reference = None
    in_monitor = in_projects = False
    for line in open('otherness-config.yaml'):
        if re.match(r'^monitor:', line): in_monitor = True
        if in_monitor and re.match(r'\s+projects:', line): in_projects = True
        if in_projects:
            m = re.match(r'\s+- (.+)', line)
            if m:
                r = m.group(1).strip()
                if not r.endswith('/otherness'):
                    reference = r
                    break
    if reference:
        r = subprocess.run(['gh','api',f'repos/{reference}/branches/_state',
                            '--jq','.commit.commit.committer.date'],
                           capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            ts = datetime.datetime.fromisoformat(r.stdout.strip().replace('Z','+00:00'))
            hours = (datetime.datetime.now(datetime.timezone.utc) - ts).total_seconds() / 3600
            flag = " ⚠️ STALE" if hours > 72 else ""
            print(f"  {reference}: last activity {hours:.1f}h ago{flag}")
        else:
            print(f"  {reference}: no _state branch (not yet running?)")
    else:
        print("  No non-otherness project in monitor.projects")
except Exception as e:
    print(f"  Reference project: unavailable ({e})")

# ── Summary line ─────────────────────────────────────────────
print()
print(f"Health: {trend} | Run /otherness.run to advance.")
print("=" * 60)
DASHBOARD_EOF

fi
```



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
