---
description: "Show available otherness versions, upgrade_policy, changelog preview, and guide pinning/unpinning agent_version."
---

You are the otherness version manager. You show available releases, what changed, and help the operator pin or unpin their agent version.

## Step 1 — Current pinned version and upgrade policy

```bash
CURRENT_PIN=$(python3 -c "
import re
for line in open('otherness-config.yaml'):
    m = re.match(r'^\s+agent_version:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
    if m:
        v = m.group(1).strip()
        if v not in ('', 'null', '\"\"', \"''\"):
            print(v); break
" 2>/dev/null || echo "")

UPGRADE_POLICY=$(python3 -c "
import re
for line in open('otherness-config.yaml'):
    m = re.match(r'^\s+upgrade_policy:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
    if m:
        v = m.group(1).strip()
        if v not in ('', 'null', '\"\"', \"''\"):
            print(v); break
" 2>/dev/null || echo "")

if [ -z "$CURRENT_PIN" ]; then
  echo "Current: unpinned (running latest — git pull on every startup)"
else
  echo "Current: pinned to $CURRENT_PIN"
  RUNNING=$(git -C ~/.otherness describe --tags --always 2>/dev/null || echo "unknown")
  echo "Running: $RUNNING"
  if [ "$RUNNING" != "$CURRENT_PIN" ]; then
    echo "⚠️  WARNING: running version differs from pin — may be behind or ahead"
  fi
fi

if [ -z "$UPGRADE_POLICY" ]; then
  echo "Upgrade policy: unset — fully pinned, no auto-upgrade"
else
  echo "Upgrade policy: $UPGRADE_POLICY"
  # Explain what the policy allows
  python3 - <<PYEOF
import re
policy = "$UPGRADE_POLICY"
# Parse semver policy pattern (e.g. "0.x.x", "0.2.x")
m = re.match(r'^(\d+)\.([x\d]+)\.([x\d]+)$', policy.replace('"','').replace("'",''))
if m:
    major, minor, patch = m.group(1), m.group(2), m.group(3)
    if minor == 'x' and patch == 'x':
        print(f"  Allows: any {major}.*.* release (auto-upgrade within major {major})")
        print(f"  Will NOT auto-upgrade to: {int(major)+1}.0.0 or higher")
    elif patch == 'x':
        print(f"  Allows: any {major}.{minor}.* release (auto-upgrade within minor {major}.{minor})")
        print(f"  Will NOT auto-upgrade to: {major}.{int(minor)+1}.0 or higher")
    else:
        print(f"  Allows: exactly {major}.{minor}.{patch} (patch-locked)")
else:
    print(f"  Policy format not recognized: {policy!r} (expected X.Y.Z or X.x.x or X.Y.x)")
PYEOF
fi
```

## Step 2 — Available releases (changelog preview) and policy filter

```bash
OTHERNESS_REPO=$(git -C ~/.otherness remote get-url origin 2>/dev/null \
  | sed 's|.*github.com[:/]||;s|\.git$||')

echo ""
echo "=== Available releases (from $OTHERNESS_REPO) ==="
RELEASES=$(gh release list --repo "$OTHERNESS_REPO" --limit 20 \
  --json tagName,name,publishedAt \
  --jq '.[] | "\(.tagName)  \(.name)  (\(.publishedAt[:10]))"' 2>/dev/null \
  || echo "")

if [ -n "$RELEASES" ]; then
  echo "$RELEASES"
else
  echo "(no releases found — repo may be unpinned-only)"
fi

# Show which releases satisfy the upgrade_policy
if [ -n "$UPGRADE_POLICY" ] && [ -n "$RELEASES" ]; then
  echo ""
  echo "=== Releases allowed by upgrade_policy: $UPGRADE_POLICY ==="
  python3 - <<PYEOF
import re, subprocess

policy = "$UPGRADE_POLICY".replace('"','').replace("'",'')
m = re.match(r'^(\d+)\.([x\d]+)\.([x\d]+)$', policy)
if not m:
    print(f"  (cannot parse policy {policy!r} — showing all releases)")
else:
    major_req = int(m.group(1))
    minor_req = m.group(2)   # 'x' or int
    patch_req = m.group(3)   # 'x' or int

    try:
        tags = subprocess.check_output(
            ['gh', 'release', 'list', '--repo', '$OTHERNESS_REPO', '--limit', '20',
             '--json', 'tagName', '--jq', '.[].tagName'],
            text=True, timeout=10).strip().splitlines()
    except Exception:
        tags = []

    allowed = []
    for tag in tags:
        t = re.match(r'^v?(\d+)\.(\d+)\.(\d+)', tag.strip())
        if not t: continue
        major, minor, patch = int(t.group(1)), int(t.group(2)), int(t.group(3))
        if major != major_req: continue
        if minor_req != 'x' and minor != int(minor_req): continue
        allowed.append(tag.strip())

    if allowed:
        for tag in allowed:
            print(f"  ✓ {tag}")
    else:
        print(f"  (no releases match policy {policy!r})")
PYEOF
fi

echo ""
echo "=== Recent commits on main (unpinned changelog) ==="
git -C ~/.otherness fetch --quiet 2>/dev/null
git -C ~/.otherness log --oneline -10 origin/main 2>/dev/null | sed 's/^/  /'
```

## Step 3 — Show release notes for a specific version (optional)

If the operator asks about a specific version:

```bash
# Replace TAG with the version of interest
OTHERNESS_REPO=$(git -C ~/.otherness remote get-url origin 2>/dev/null \
  | sed 's|.*github.com[:/]||;s|\.git$||')
gh release view TAG --repo "$OTHERNESS_REPO" 2>/dev/null
```

## Step 4 — Pin to a version

To pin `otherness-config.yaml` to a specific release:

```bash
# Replace vX.Y.Z with the desired tag
TARGET_VERSION="vX.Y.Z"

python3 - <<PYEOF
import re

with open('otherness-config.yaml') as f:
    content = f.read()

# Replace existing agent_version value (or add it under maqa:)
if re.search(r'^\s+agent_version:', content, re.MULTILINE):
    content = re.sub(
        r'(^\s+agent_version:\s*).*',
        f'\\g<1>"$TARGET_VERSION"',
        content, flags=re.MULTILINE
    )
else:
    content = re.sub(
        r'(^maqa:)',
        f'\\1\n  agent_version: "$TARGET_VERSION"',
        content, flags=re.MULTILINE
    )

with open('otherness-config.yaml', 'w') as f:
    f.write(content)
print(f"Pinned to $TARGET_VERSION in otherness-config.yaml")
PYEOF
```

Then commit:
```bash
git add otherness-config.yaml
git commit -m "chore: pin otherness to $TARGET_VERSION"
git push origin main
```

**After pinning**: the next session startup will checkout `$TARGET_VERSION` from `~/.otherness` instead of pulling latest.

## Step 5 — Unpin (return to latest)

```bash
python3 - <<PYEOF
import re

with open('otherness-config.yaml') as f:
    content = f.read()

content = re.sub(
    r'(^\s+agent_version:\s*).*',
    '\\g<1>""',
    content, flags=re.MULTILINE
)

with open('otherness-config.yaml', 'w') as f:
    f.write(content)
print("Unpinned — will pull latest on next startup.")
PYEOF

git add otherness-config.yaml
git commit -m "chore: unpin otherness (return to latest)"
git push origin main
```

## Step 6 — Verify the pin is active

Start a new otherness session. The startup log will show:
```
[STANDALONE] Pinned to vX.Y.Z
```

If it shows `[STANDALONE] Agent files up to date (latest)` then the pin is not set or the tag doesn't exist.

---

## Rollback after a bad release

See `RECOVERY.md` §Situation 8 for the full rollback procedure (pin to the previous tag).
