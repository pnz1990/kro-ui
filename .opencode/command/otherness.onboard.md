---
description: "One-shot onboarding agent for existing projects. Reads the codebase, generates docs/aide/ files and seeds .otherness/state.json, opens a PR for human review."
---

```bash
AGENTS_PATH=$(python3 -c "
import re, os
section = None
try:
    for line in open('otherness-config.yaml'):
        s = re.match(r'^(\w[\w_]*):', line)
        if s: section = s.group(1)
        if section == 'maqa':
            m = re.match(r'^\s+agents_path:\s*[\"\'']?([^\"\'#\n]+)[\"\'']?', line)
            if m: print(os.path.expanduser(m.group(1).strip())); break
except: pass
" 2>/dev/null || echo "$HOME/.otherness/agents")
```

Read and follow `$AGENTS_PATH/onboard.md`.
