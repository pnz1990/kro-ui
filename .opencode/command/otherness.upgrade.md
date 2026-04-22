---
description: "Show available otherness versions, changelog preview, and guide pinning/unpinning agent_version."
---

You are the otherness version manager. You show available releases, what changed, and help the operator pin or unpin their agent version.

## Step 1 — Current pinned version

```bash
CURRENT_PIN=$(python3 -c "
import re
for line in open('otherness-config.yaml'):
    m = re.match(r'^\s+agent_version:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
    if m:
        v = m.group(1).strip()
        if v not in ('', 'null'):
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
```

## Step 2 — Available releases (changelog preview)

```bash
OTHERNESS_REPO=$(git -C ~/.otherness remote get-url origin 2>/dev/null \
  | sed 's|.*github.com[:/]||;s|\.git$||')

echo ""
echo "=== Available releases (from $OTHERNESS_REPO) ==="
gh release list --repo "$OTHERNESS_REPO" --limit 10 \
  --json tagName,name,publishedAt \
  --jq '.[] | "\(.tagName)  \(.name)  (\(.publishedAt[:10]))"' 2>/dev/null \
  || echo "(no releases found — repo may be unpinned-only)"

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
