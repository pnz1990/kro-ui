---
description: "Show current agent state: what's in progress, queue position, CI status, and open blockers."
---

You are showing the current status of the autonomous team.

## Step 1 — Read state

```bash
python3 - << 'EOF'
import json, datetime, os

try:
    s = json.load(open('.otherness/state.json'))
except:
    print("No .otherness/state.json found. Run /otherness.onboard first.")
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
```

## Step 2 — CI status on main

```bash
REPO=$(git remote get-url origin 2>/dev/null | sed 's|.*github.com[:/]||;s|\.git$||')
echo "CI (main):"
gh run list --repo "$REPO" --branch main --limit 5 \
  --json status,conclusion,name,createdAt \
  --jq '.[] | "\(.conclusion // .status) \(.name) \(.createdAt[:10])"' 2>/dev/null || echo "  (gh not configured)"
```

## Step 3 — Open needs-human and blocked issues

```bash
echo ""
echo "Needs human:"
gh issue list --repo "$REPO" --label "needs-human" --state open \
  --json number,title --jq '.[] | "  #\(.number) \(.title[:70])"' 2>/dev/null || echo "  none"

echo ""
echo "Blocked:"
gh issue list --repo "$REPO" --label "blocked" --state open \
  --json number,title --jq '.[] | "  #\(.number) \(.title[:70])"' 2>/dev/null || echo "  none"
```
