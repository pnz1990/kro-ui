---
description: "One-shot onboarding for existing projects — reads the codebase, generates docs/aide/ drafts and seeds state.json, opens a PR for review. Run once before /otherness.run."
---

```bash
AGENTS_PATH=$(python3 -c "
import re, os
section = None
for line in open('otherness-config.yaml'):
    s = re.match(r'^(\w[\w_]*):', line)
    if s: section = s.group(1)
    if section == 'maqa':
        m = re.match(r'^\s+agents_path:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
        if m: print(os.path.expanduser(m.group(1).strip())); break
" 2>/dev/null || echo "$HOME/.otherness/agents")
```

Read and follow `$AGENTS_PATH/onboard.md`.
